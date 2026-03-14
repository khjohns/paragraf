"""Shared LLM utilities for Claude/Gemini API calls."""
import json
import re

CLAUDE_MODEL = "claude-sonnet-4-6"
GEMINI_MODEL = "gemini-3-flash-preview"


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
