"""Shared LLM utilities for Claude/Gemini API calls."""
import json
import logging
import os
import re
import time
from contextvars import ContextVar

import anthropic

# Per-request ID for log correlation (set by Flask before_request hook)
current_request_id: ContextVar[str] = ContextVar("current_request_id", default="")

from db import get_client

CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")
HAIKU_MODEL = "claude-haiku-4-5-20251001"
GEMINI_MODEL = "gemini-3-flash-preview"

# Models that support the effort parameter (Opus 4.6, Sonnet 4.6, Opus 4.5)
_EFFORT_SUPPORTED_PREFIXES = ("claude-opus-4", "claude-sonnet-4")

# Prices per million tokens (USD) — https://platform.claude.com/docs/en/about-claude/pricing
MODEL_PRICING = {
    "claude-sonnet-4-6": {
        "input": 3.00, "output": 15.00,
        "cache_write": 3.75, "cache_read": 0.30,
        "batch_input": 1.50, "batch_output": 7.50,
    },
    "claude-haiku-4-5-20251001": {
        "input": 1.00, "output": 5.00,
        "cache_write": 1.25, "cache_read": 0.10,
        "batch_input": 0.50, "batch_output": 2.50,
    },
    "claude-opus-4-6": {
        "input": 5.00, "output": 25.00,
        "cache_write": 6.25, "cache_read": 0.50,
        "batch_input": 2.50, "batch_output": 12.50,
    },
}

logger = logging.getLogger(__name__)

# Lazily initialized shared Anthropic client
_anthropic_client: anthropic.Anthropic | None = None


class LLMConfigError(Exception):
    """Raised when LLM configuration is missing."""


def get_anthropic_client() -> anthropic.Anthropic:
    """Get or create a shared Anthropic client."""
    global _anthropic_client
    if _anthropic_client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise LLMConfigError("ANTHROPIC_API_KEY ikke konfigurert")
        _anthropic_client = anthropic.Anthropic(
            api_key=api_key, timeout=120.0, max_retries=2,
        )
    return _anthropic_client


def _supports_effort(model: str) -> bool:
    """Check if a model supports the effort parameter."""
    return any(model.startswith(p) for p in _EFFORT_SUPPORTED_PREFIXES)


def build_output_config(
    schema: dict | None = None,
    effort: str | None = "high",
    model: str = CLAUDE_MODEL,
) -> dict:
    """Build output_config respecting model capabilities.

    Effort is only included for models that support it (Opus/Sonnet 4.x).
    Schema and effort are independent — either, both, or neither can be set.
    """
    config: dict = {}
    if schema:
        config["format"] = {"type": "json_schema", "schema": schema}
    if effort and _supports_effort(model):
        config["effort"] = effort
    return config


_DEFAULT_PRICING = MODEL_PRICING["claude-sonnet-4-6"]


def _extract_cache_tokens(usage) -> tuple[int, int]:
    """Extract cache creation and read tokens from usage object.

    Handles both old format (cache_creation_input_tokens) and new SDK format
    (cache_creation.ephemeral_1h_input_tokens + ephemeral_5m_input_tokens).
    """
    # Old format
    cache_creation = getattr(usage, "cache_creation_input_tokens", 0) or 0
    cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0

    # New format: usage.cache_creation is an object with sub-fields
    if not cache_creation:
        cc = getattr(usage, "cache_creation", None)
        if cc and hasattr(cc, "ephemeral_1h_input_tokens"):
            cache_creation = (
                (getattr(cc, "ephemeral_1h_input_tokens", 0) or 0)
                + (getattr(cc, "ephemeral_5m_input_tokens", 0) or 0)
            )
    if not cache_read:
        cr = getattr(usage, "cache_read", None)
        if cr and hasattr(cr, "ephemeral_1h_input_tokens"):
            cache_read = (
                (getattr(cr, "ephemeral_1h_input_tokens", 0) or 0)
                + (getattr(cr, "ephemeral_5m_input_tokens", 0) or 0)
            )

    return cache_creation, cache_read


def _calculate_cost(usage, model: str, is_batch: bool = False) -> tuple[float, int, int]:
    """Calculate USD cost from API usage object.

    Returns (cost_usd, cache_creation_tokens, cache_read_tokens).
    """
    pricing = MODEL_PRICING.get(model, _DEFAULT_PRICING)

    input_price = pricing["batch_input"] if is_batch else pricing["input"]
    output_price = pricing["batch_output"] if is_batch else pricing["output"]

    input_tokens = usage.input_tokens
    output_tokens = usage.output_tokens
    cache_creation, cache_read = _extract_cache_tokens(usage)

    # cache_read is included in input_tokens — bill separately at cache rate
    base_input = input_tokens - cache_read
    cost = (
        base_input * input_price / 1_000_000
        + output_tokens * output_price / 1_000_000
        + cache_creation * pricing["cache_write"] / 1_000_000
        + cache_read * pricing["cache_read"] / 1_000_000
    )
    return cost, cache_creation, cache_read


def _fmt_tokens(n: int) -> str:
    """Format token count: use 'k' suffix for counts >= 1000."""
    if n >= 1000:
        return f"{n / 1000:.1f}k"
    return str(n)


def log_usage(usage, model: str, label: str, is_batch: bool = False, elapsed_ms: int | None = None) -> float:
    """Log token usage with cost breakdown. Returns cost in USD."""
    cost, cache_creation, cache_read = _calculate_cost(usage, model, is_batch)

    # Extract short model name: "claude-sonnet-4-6" → "sonnet"
    parts = model.split("-")
    short_name = parts[1] if len(parts) > 1 else model

    in_str = _fmt_tokens(usage.input_tokens)
    out_str = _fmt_tokens(usage.output_tokens)

    if cache_read:
        in_part = f"{in_str} in ({_fmt_tokens(cache_read)} cached)"
    else:
        in_part = f"{in_str} in"

    if elapsed_ms is not None:
        time_part = f" {elapsed_ms / 1000:.1f}s" if elapsed_ms >= 1000 else f" {elapsed_ms}ms"
    else:
        time_part = ""
    req_id = current_request_id.get()
    id_part = f" [{req_id}]" if req_id else ""

    logger.info(
        "%s [%s]%s — %s, %s out — $%.4f%s",
        label,
        short_name,
        id_part,
        in_part,
        out_str,
        cost,
        time_part,
    )
    return cost


class CostTracker:
    """Track cumulative LLM costs for an analysis run."""

    def __init__(self):
        self.entries: list[dict] = []

    def add(self, label: str, model: str, usage, is_batch: bool = False) -> float:
        """Log usage and track cost. Returns cost in USD."""
        cost = log_usage(usage, model, label, is_batch)
        self.entries.append({
            "label": label,
            "model": model,
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "cost_usd": cost,
        })
        return cost

    @property
    def total_cost(self) -> float:
        return sum(e["cost_usd"] for e in self.entries)

    def summary(self) -> str:
        lines = [f"  {e['label']}: ${e['cost_usd']:.4f}" for e in self.entries]
        lines.append(f"  TOTAL: ${self.total_cost:.4f}")
        return "\n".join(lines)


def call_claude_structured(
    system_prompt: str,
    user_message: str,
    schema: dict,
    max_tokens: int = 4000,
    effort: str = "high",
    model: str = CLAUDE_MODEL,
    log_label: str = "Claude call",
) -> dict:
    """Call Claude with structured outputs, prompt caching, and token logging.

    Args:
        model: Model to use. Defaults to CLAUDE_MODEL (Sonnet).
            Effort is automatically omitted for models that don't support it.

    Returns the parsed JSON response. Includes _llm_meta key with usage/thinking data.
    """
    client = get_anthropic_client()
    kwargs = dict(
        model=model,
        max_tokens=max_tokens,
        output_config=build_output_config(schema=schema, effort=effort, model=model),
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_message}],
    )
    if _supports_effort(model):
        kwargs["thinking"] = {"type": "adaptive"}

    t0 = time.monotonic()
    response = client.messages.create(**kwargs)
    elapsed_ms = int((time.monotonic() - t0) * 1000)

    # With adaptive thinking, response may contain thinking blocks before text
    text = ""
    thinking_text = ""
    for block in response.content:
        if block.type == "thinking":
            thinking_text = block.thinking
        elif block.type == "text":
            text = block.text

    cost = log_usage(response.usage, model, log_label, elapsed_ms=elapsed_ms)

    result = json.loads(text)

    # Attach LLM metadata for persistence (thinking, usage, cost)
    usage = response.usage
    cache_write, cache_read = _extract_cache_tokens(usage)
    result["_llm_meta"] = {
        "model": model,
        "input_tokens": usage.input_tokens,
        "output_tokens": usage.output_tokens,
        "cache_read_tokens": cache_read,
        "cache_write_tokens": cache_write,
        "cost_usd": round(cost, 6),
        "elapsed_ms": elapsed_ms,
        "stop_reason": response.stop_reason,
        "has_thinking": bool(thinking_text),
    }
    if thinking_text:
        result["_llm_meta"]["thinking_summary"] = thinking_text

    return result


def load_analysis_context(
    analysis_id: str,
    extra_columns: list[str] | None = None,
) -> dict:
    """Load analysis context needed for LLM calls.

    Returns dict with keys: problem, sub_problems, provisions.
    Extra columns from the analyses table are included under their column names.
    """
    columns = ["problem", "refined_problem", "sub_problems"]
    if extra_columns:
        columns.extend(extra_columns)

    client = get_client()
    analysis = (
        client.table("analyses")
        .select(", ".join(columns))
        .eq("id", analysis_id)
        .single()
        .execute()
        .data
    )
    if not analysis:
        raise LLMConfigError("Analyse ikke funnet")

    result = {
        "problem": analysis.get("refined_problem") or analysis.get("problem", ""),
        "sub_problems": analysis.get("sub_problems") or [],
    }

    # Load provision seeds
    seeds = (
        client.table("analysis_seeds")
        .select("value")
        .eq("analysis_id", analysis_id)
        .eq("seed_type", "provision")
        .execute()
        .data
    )
    result["provisions"] = [s["value"] for s in (seeds or [])]

    # Include extra columns
    if extra_columns:
        for col in extra_columns:
            result[col] = analysis.get(col)

    return result


def format_sub_problems(sub_problems: list[str]) -> str:
    """Format sub-problems list for prompts."""
    if not sub_problems:
        return "  Ingen delspørsmål"
    return "\n".join(f"  {i+1}. {sp}" for i, sp in enumerate(sub_problems))


def build_batch_request(
    custom_id: str,
    system_prompt: str,
    user_message: str,
    schema: dict,
    max_tokens: int = 4000,
    model: str = CLAUDE_MODEL,
) -> dict:
    """Build a single request for the Message Batches API.

    Note: effort is not passed — the Batch API does not support it.

    Returns a dict with custom_id and params matching the batch request format.
    """
    return {
        "custom_id": custom_id,
        "params": {
            "model": model,
            "max_tokens": max_tokens,
            "output_config": build_output_config(schema=schema, effort=None, model=model),
            "system": [
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            "messages": [{"role": "user", "content": user_message}],
        },
    }


def submit_batch(requests: list[dict], log_label: str = "Batch") -> str:
    """Submit a batch of requests to the Message Batches API.

    Args:
        requests: List of dicts from build_batch_request().
        log_label: Label for logging.

    Returns:
        The batch ID for polling.
    """
    client = get_anthropic_client()
    batch = client.messages.batches.create(requests=requests)
    logger.info(
        "%s: submitted batch %s with %d requests",
        log_label,
        batch.id,
        len(requests),
    )
    return batch.id


def poll_batch_status(batch_id: str) -> dict:
    """Poll batch status. Returns dict with processing_status and request_counts.

    Returns:
        {
            "batch_id": str,
            "processing_status": "in_progress" | "ended" | ...,
            "request_counts": {"processing": int, "succeeded": int, "errored": int, "canceled": int, "expired": int},
        }
    """
    client = get_anthropic_client()
    batch = client.messages.batches.retrieve(batch_id)
    return {
        "batch_id": batch.id,
        "processing_status": batch.processing_status,
        "request_counts": {
            "processing": batch.request_counts.processing,
            "succeeded": batch.request_counts.succeeded,
            "errored": batch.request_counts.errored,
            "canceled": batch.request_counts.canceled,
            "expired": batch.request_counts.expired,
        },
    }


def cancel_batch(batch_id: str) -> dict:
    """Cancel a running batch."""
    client = get_anthropic_client()
    batch = client.messages.batches.cancel(batch_id)
    return {
        "batch_id": batch.id,
        "processing_status": batch.processing_status,
    }


def get_batch_results(batch_id: str, cost_tracker: CostTracker | None = None) -> dict[str, dict]:
    """Retrieve results from a completed batch.

    Returns a dict mapping custom_id → parsed JSON result.
    Failed requests have {"error": message} as value.
    """
    client = get_anthropic_client()
    results: dict[str, dict] = {}

    for entry in client.messages.batches.results(batch_id):
        custom_id = entry.custom_id
        if entry.result.type == "succeeded":
            text = entry.result.message.content[0].text
            results[custom_id] = json.loads(text)
            model = entry.result.message.model
            usage = entry.result.message.usage
            if cost_tracker:
                cost_tracker.add(f"Batch/{custom_id}", model, usage, is_batch=True)
            else:
                log_usage(usage, model, f"Batch/{custom_id}", is_batch=True)
        elif entry.result.type == "errored":
            error_msg = str(entry.result.error)
            logger.error("Batch request %s errored: %s", custom_id, error_msg)
            results[custom_id] = {"error": error_msg}
        else:
            # expired or canceled
            logger.warning("Batch request %s: %s", custom_id, entry.result.type)
            results[custom_id] = {"error": f"Request {entry.result.type}"}

    return results


def parse_json_response(text: str) -> dict | None:
    """Parse JSON from LLM response, handling markdown code blocks."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                return None
        return None
