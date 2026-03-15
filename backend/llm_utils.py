"""Shared LLM utilities for Claude/Gemini API calls."""
import json
import logging
import os
import re

import anthropic

from db import get_client

CLAUDE_MODEL = "claude-sonnet-4-6"
GEMINI_MODEL = "gemini-3-flash-preview"

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
        _anthropic_client = anthropic.Anthropic(api_key=api_key, timeout=120.0)
    return _anthropic_client


def call_claude_structured(
    system_prompt: str,
    user_message: str,
    schema: dict,
    max_tokens: int = 4000,
    effort: str = "high",
    log_label: str = "Claude call",
) -> dict:
    """Call Claude with structured outputs, prompt caching, and token logging.

    Returns the parsed JSON response.
    """
    client = get_anthropic_client()
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=max_tokens,
        output_config={
            "format": {
                "type": "json_schema",
                "schema": schema,
            },
            "effort": effort,
        },
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_message}],
    )

    text = response.content[0].text
    logger.info(
        "%s: %d input tokens (%d cached), %d output tokens",
        log_label,
        response.usage.input_tokens,
        getattr(response.usage, "cache_read_input_tokens", 0),
        response.usage.output_tokens,
    )

    return json.loads(text)


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
    effort: str = "high",
) -> dict:
    """Build a single request for the Message Batches API.

    Returns a dict with custom_id and params matching the batch request format.
    """
    return {
        "custom_id": custom_id,
        "params": {
            "model": CLAUDE_MODEL,
            "max_tokens": max_tokens,
            "output_config": {
                "format": {
                    "type": "json_schema",
                    "schema": schema,
                },
                "effort": effort,
            },
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


def get_batch_results(batch_id: str) -> dict[str, dict]:
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
            logger.info(
                "Batch result %s: %d input tokens, %d output tokens",
                custom_id,
                entry.result.message.usage.input_tokens,
                entry.result.message.usage.output_tokens,
            )
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
