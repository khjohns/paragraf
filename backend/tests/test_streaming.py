"""Streaming endpoint integration tests (ADR-004 Fase 2).

Tests the SSE streaming endpoints for synthesis and QA.

Run with:
    cd backend && python -m pytest tests/test_streaming.py -v -s

Requires:
    - Backend running on localhost:5002
    - ANTHROPIC_API_KEY set
    - An existing PYTEST analysis with screened candidates in DB
"""
import json


def parse_sse_events(response_text: str) -> list[dict]:
    """Parse SSE response text into a list of {event, data} dicts."""
    events = []
    for block in response_text.split("\n\n"):
        block = block.strip()
        if not block:
            continue
        event_type = ""
        event_data = ""
        for line in block.split("\n"):
            if line.startswith("event: "):
                event_type = line[7:]
            elif line.startswith("data: "):
                event_data = line[6:]
        if event_type:
            try:
                data = json.loads(event_data) if event_data else {}
            except json.JSONDecodeError:
                data = {"raw": event_data}
            events.append({"event": event_type, "data": data})
    return events


class TestSynthesisStreaming:
    def test_synthesis_stream_returns_sse(self, api, screened_analysis):
        """Streaming endpoint returns valid SSE with expected event types."""
        aid = screened_analysis["id"]

        r = api.post(
            f"/api/analyses/{aid}/synthesize-stream",
            headers={"Accept": "text/event-stream"},
            stream=True,
            timeout=300,
        )
        assert r.status_code == 200, f"Stream failed: {r.status_code}"
        assert "text/event-stream" in r.headers.get("Content-Type", "")

        # Collect full response
        text = r.text
        events = parse_sse_events(text)

        assert len(events) >= 2, f"Too few events: {len(events)}"

        event_types = [e["event"] for e in events]

        # Must have at least status and done events
        assert "status" in event_types, f"No status event. Got: {event_types}"
        assert "done" in event_types, f"No done event. Got: {event_types}"

        # Should have a result event (unless error)
        if "error" not in event_types:
            assert "result" in event_types, f"No result event. Got: {event_types}"

    def test_synthesis_stream_event_sequence(self, api, screened_analysis):
        """Events follow expected sequence: status → (tool_call/tool_result)* → result → done."""
        aid = screened_analysis["id"]

        r = api.post(
            f"/api/analyses/{aid}/synthesize-stream",
            headers={"Accept": "text/event-stream"},
            stream=True,
            timeout=300,
        )
        assert r.status_code == 200

        events = parse_sse_events(r.text)
        event_types = [e["event"] for e in events]

        # First event should be status (loading_context)
        assert event_types[0] == "status"
        first_status = events[0]["data"]
        assert first_status.get("phase") == "loading_context"

        # Last event should be done
        assert event_types[-1] == "done"

        # If there are tool_call events, each should be followed by tool_result
        tool_calls = [i for i, t in enumerate(event_types) if t == "tool_call"]
        tool_results = [i for i, t in enumerate(event_types) if t == "tool_result"]
        assert len(tool_calls) == len(tool_results), (
            f"Mismatched tool_call ({len(tool_calls)}) vs tool_result ({len(tool_results)})"
        )

    def test_synthesis_stream_result_has_content(self, api, screened_analysis):
        """The result event contains a valid synthesis with title/sections/markdown."""
        aid = screened_analysis["id"]

        r = api.post(
            f"/api/analyses/{aid}/synthesize-stream",
            headers={"Accept": "text/event-stream"},
            stream=True,
            timeout=300,
        )
        assert r.status_code == 200

        events = parse_sse_events(r.text)

        result_events = [e for e in events if e["event"] == "result"]
        if not result_events:
            # Check if there was an error instead
            error_events = [e for e in events if e["event"] == "error"]
            if error_events:
                assert False, f"Got error instead of result: {error_events[0]['data']}"
            assert False, "No result event found"

        result = result_events[0]["data"]
        synthesis = result.get("synthesis", {})
        assert synthesis.get("title"), "Missing title in synthesis result"
        assert len(synthesis.get("sections", [])) >= 1, "No sections in synthesis result"
        assert result.get("markdown"), "Missing markdown in result"

    def test_synthesis_stream_tool_call_has_details(self, api, screened_analysis):
        """Tool call events include tool name and input details."""
        aid = screened_analysis["id"]

        r = api.post(
            f"/api/analyses/{aid}/synthesize-stream",
            headers={"Accept": "text/event-stream"},
            stream=True,
            timeout=300,
        )
        assert r.status_code == 200

        events = parse_sse_events(r.text)
        tool_calls = [e for e in events if e["event"] == "tool_call"]

        # Tool calls are optional (model may not use tools), so only check if present
        for tc in tool_calls:
            assert tc["data"].get("tool"), f"tool_call missing tool name: {tc}"
            assert tc["data"].get("input") is not None, f"tool_call missing input: {tc}"
            assert tc["data"].get("turn"), f"tool_call missing turn: {tc}"

        tool_results = [e for e in events if e["event"] == "tool_result"]
        for tr in tool_results:
            assert tr["data"].get("tool"), f"tool_result missing tool name: {tr}"
            assert tr["data"].get("summary"), f"tool_result missing summary: {tr}"


class TestQAStreaming:
    def test_qa_stream_returns_sse(self, api, screened_analysis):
        """QA streaming endpoint returns valid SSE."""
        aid = screened_analysis["id"]

        # Ensure synthesis exists first
        docs = api.get(f"/api/analyses/{aid}/documents").json()
        if not docs.get("note"):
            # Run blocking synthesis first
            r = api.post(f"/api/analyses/{aid}/synthesize", timeout=300)
            assert r.status_code == 200, f"Pre-synthesis failed: {r.text}"

        r = api.post(
            f"/api/analyses/{aid}/qa-stream",
            headers={"Accept": "text/event-stream"},
            stream=True,
            timeout=300,
        )
        assert r.status_code == 200, f"QA stream failed: {r.status_code}"
        assert "text/event-stream" in r.headers.get("Content-Type", "")

        events = parse_sse_events(r.text)
        event_types = [e["event"] for e in events]

        assert "status" in event_types, f"No status event. Got: {event_types}"
        assert "done" in event_types, f"No done event. Got: {event_types}"

    def test_qa_stream_result_structure(self, api, screened_analysis):
        """QA streaming result has the expected structure."""
        aid = screened_analysis["id"]

        r = api.post(
            f"/api/analyses/{aid}/qa-stream",
            headers={"Accept": "text/event-stream"},
            stream=True,
            timeout=300,
        )
        assert r.status_code == 200

        events = parse_sse_events(r.text)
        result_events = [e for e in events if e["event"] == "result"]

        if not result_events:
            error_events = [e for e in events if e["event"] == "error"]
            if error_events:
                assert False, f"Got error: {error_events[0]['data']}"
            assert False, "No result event"

        result = result_events[0]["data"]
        qa = result.get("qa_report", {})
        assert "reference_issues" in qa, f"Missing reference_issues: {list(qa.keys())}"
        assert "logic_flags" in qa, f"Missing logic_flags: {list(qa.keys())}"
        assert "untreated_cases" in qa, f"Missing untreated_cases: {list(qa.keys())}"
        assert "overall_assessment" in qa, f"Missing overall_assessment: {list(qa.keys())}"
