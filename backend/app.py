import json
import logging
import os
import sys
import uuid

from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS
from traversal import build_traversal_response
from cases import get_case_detail
from provisions import get_provision_detail
from curation import generate_curation
from eu_cases import get_eu_case_detail
from forarbeider import get_forarbeid_detail, get_forarbeid_section
from db import get_client
from analyses import list_analyses, get_analysis, get_analysis_with_seeds, create_analysis, update_analysis, upsert_seeds, update_candidate, persist_candidates, parse_seed_rows, get_analysis_documents
from scoping import generate_scope, ScopeError
from screening import screen_cases, rescreen_case, screen_cases_batch, process_screening_batch_results, ScreeningError
from post_search import generate_post_search, PostSearchError
from cross_propositions import generate_cross_propositions, CrossPropositionsError
from eu_screening import identify_eu_cases, screen_eu_cases, screen_eu_cases_batch, process_eu_screening_batch_results, EuScreeningError
from synthesis import generate_synthesis, generate_synthesis_stream, update_synthesis, SynthesisError
from qa import run_qa, run_qa_stream, submit_qa_batch, process_qa_batch_results, verify_screening_citations, QAError
from llm_utils import poll_batch_status, cancel_batch
from chat import chat_stream, load_chat_history

class _ColorFormatter(logging.Formatter):
    """ANSI-colored log formatter. Colors are only applied when stderr is a TTY."""

    _RESET = "\x1b[0m"
    _LEVEL_COLORS = {
        logging.DEBUG: "\x1b[2m",      # dim/gray
        logging.INFO: "\x1b[32m",      # green
        logging.WARNING: "\x1b[33m",   # yellow
        logging.ERROR: "\x1b[31m",     # red
        logging.CRITICAL: "\x1b[31;1m",  # bold red
    }
    _USE_COLOR = sys.stderr.isatty()

    def format(self, record: logging.LogRecord) -> str:
        # Truncate module name to 10 chars
        name = record.name
        if len(name) > 10:
            name = name[:9] + "…"

        time_str = self.formatTime(record, "%H:%M:%S")
        level = record.levelname

        if self._USE_COLOR:
            color = self._LEVEL_COLORS.get(record.levelno, "")
            level_str = f"{color}{level}{self._RESET}"
        else:
            level_str = level

        msg = record.getMessage()
        if record.exc_info:
            msg = msg + "\n" + self.formatException(record.exc_info)

        return f"{time_str} {level_str} {name}: {msg}"


_handler = logging.StreamHandler()
_handler.setFormatter(_ColorFormatter())
logging.root.setLevel(logging.INFO)
logging.root.handlers = [_handler]
logging.getLogger("httpx").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

app = Flask(__name__)


@app.before_request
def _set_request_id():
    """Generate a short request ID for log correlation."""
    from llm_utils import current_request_id
    current_request_id.set(uuid.uuid4().hex[:8])


def sse_response(generator_fn, error_class):
    """Create an SSE Response from a generator that yields (id, result) tuples."""
    def generate():
        try:
            for _id, result in generator_fn():
                yield f"data: {json.dumps(result, ensure_ascii=False)}\n\n"
        except error_class as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def sse_typed_response(generator_fn):
    """Create an SSE Response from a generator that yields (event_type, data) tuples.

    Uses named SSE events (event: + data:) for typed streaming — used by
    synthesis and QA streaming endpoints (ADR-004 Fase 2).
    """
    def generate():
        try:
            for event_type, data in generator_fn():
                yield f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
        except Exception as e:
            logger.exception("SSE stream error")
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"
        yield f"event: done\ndata: {{}}\n\n"

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
CORS(app)


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "service": "paragraf-backend"})


@app.route("/api/traverse", methods=["POST"])
def traverse():
    body = request.get_json()
    if not body:
        return jsonify({"error": "Request body required"}), 400

    try:
        result = build_traversal_response(
            provisions=body.get("provisions", []),
            fts_terms=body.get("ftsTerms", []),
            vector_query=body.get("vectorQuery", ""),
            seed_cases=body.get("cases", []),
            regulation_filter=body.get("regulationFilter", "new"),
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/provisions/<path:provision_path>")
def provision_detail(provision_path):
    # Split on last '/' — dok_id can contain slashes (e.g. 'forskrift/2016-08-12-974')
    sep = provision_path.rfind("/")
    if sep == -1:
        return jsonify({"error": "URL must be /api/provisions/{dok_id}/{section_id}"}), 400
    dok_id = provision_path[:sep]
    section_id = provision_path[sep + 1:]
    result = get_provision_detail(dok_id, section_id)
    if result is None:
        return jsonify({"error": "Provision not found"}), 404
    return jsonify(result)


@app.route("/api/cases/<path:sak_nr>")
def case_detail(sak_nr):
    result = get_case_detail(sak_nr)
    if result is None:
        return jsonify({"error": "Case not found"}), 404
    return jsonify(result)


@app.route("/api/curate/<path:sak_nr>", methods=["POST"])
def curate_case(sak_nr):
    body = request.get_json()
    if not body:
        return jsonify({"error": "Request body required"}), 400

    problem_statement = body.get("problem_statement", "")
    seed_provisions = body.get("seed_provisions", [])

    if not problem_statement:
        return jsonify({"error": "problem_statement is required"}), 400

    try:
        result = generate_curation(sak_nr, problem_statement, seed_provisions)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/eu-cases/<path:eu_case_id>")
def eu_case_detail(eu_case_id):
    result = get_eu_case_detail(eu_case_id)
    if result is None:
        return jsonify({"error": "EU case not found"}), 404
    return jsonify(result)


@app.route("/api/forarbeider/<path:doc_id>")
def forarbeid_detail(doc_id):
    provision = request.args.get("provision")
    result = get_forarbeid_detail(doc_id, provision)
    if result is None:
        return jsonify({"error": "Forarbeid not found"}), 404
    return jsonify(result)


@app.route("/api/forarbeider/<path:doc_id>/section/<path:section_number>")
def forarbeid_section(doc_id, section_number):
    result = get_forarbeid_section(doc_id, section_number)
    if result is None:
        return jsonify({"error": "Section not found"}), 404
    return jsonify(result)


@app.route("/api/analyses", methods=["GET"])
def list_analyses_route():
    return jsonify(list_analyses())


@app.route("/api/analyses", methods=["POST"])
def create_analysis_route():
    body = request.get_json()
    if not body or not body.get("title"):
        return jsonify({"error": "title required"}), 400
    result = create_analysis(body["title"], body.get("problem", ""))
    if not result:
        return jsonify({"error": "Failed to create"}), 500
    return jsonify(result), 201


@app.route("/api/analyses/<analysis_id>")
def get_analysis_route(analysis_id):
    result = get_analysis(analysis_id)
    if not result:
        return jsonify({"error": "Not found"}), 404
    return jsonify(result)


@app.route("/api/analyses/<analysis_id>", methods=["PATCH"])
def update_analysis_route(analysis_id):
    body = request.get_json()
    if not body:
        return jsonify({"error": "Body required"}), 400
    # Handle seeds separately
    if "seeds" in body:
        upsert_seeds(analysis_id, body.pop("seeds"))
    if body:
        result = update_analysis(analysis_id, body)
        if result is None and not body:
            return jsonify({"error": "Not found"}), 404
    return jsonify({"ok": True})


@app.route("/api/analyses/<analysis_id>/scope", methods=["POST"])
def scope_analysis_route(analysis_id):
    body = request.get_json()
    if not body or not body.get("problem"):
        return jsonify({"error": "problem required"}), 400

    try:
        result = generate_scope(body["problem"])
    except ScopeError as e:
        return jsonify({"error": str(e)}), 500

    # Persist refined problem and sub_problems to the analysis
    updates = {}
    if result.get("refined_problem"):
        updates["refined_problem"] = result["refined_problem"]
    if result.get("sub_problems"):
        updates["sub_problems"] = result["sub_problems"]
    if result.get("context"):
        updates["context"] = result["context"]
    # Persist the full scoping result for later recall (ContextStrip)
    updates["scoping_result"] = result

    if updates:
        update_analysis(analysis_id, updates)

    return jsonify(result)


@app.route("/api/analyses/<analysis_id>/traverse", methods=["POST"])
def traverse_analysis_route(analysis_id):
    """Run traversal for an analysis, persist candidates and gaps, return results."""
    body = request.get_json() or {}
    iteration = body.get("iteration", 1)

    # Get analysis with seeds only (no candidates — lighter query)
    analysis = get_analysis_with_seeds(analysis_id)
    if not analysis:
        return jsonify({"error": "Analysis not found"}), 404

    # Build seed lists from DB seeds
    seed_lists = parse_seed_rows(analysis.get("seeds", []))

    try:
        result = build_traversal_response(
            provisions=seed_lists["provisions"],
            fts_terms=seed_lists["fts_terms"],
            vector_query=seed_lists["vector_query"],
            seed_cases=seed_lists["seed_cases"],
            regulation_filter=body.get("regulationFilter", "new"),
        )

        # Persist candidates — but skip if analysis already has screened candidates
        # (re-traversal for edges only should not overwrite categories or add new cases)
        existing_screened = (
            get_client()
            .table("analysis_candidates")
            .select("id", count="exact")
            .eq("analysis_id", analysis_id)
            .eq("screening_status", "ai_screened")
            .limit(1)
            .execute()
        )
        if existing_screened.count and existing_screened.count > 0:
            candidate_count = 0  # Skip persist — candidates already screened
        else:
            candidate_count = persist_candidates(analysis_id, result["nodes"], iteration)

        # Persist gaps on the analysis
        update_analysis(analysis_id, {
            "gaps": result.get("gaps", []),
            "status": analysis.get("status", "candidates_ready"),  # Don't regress status
        })

        result["candidateCount"] = candidate_count
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyses/<analysis_id>/candidates/<path:sak_nr>", methods=["PATCH"])
def update_candidate_route(analysis_id, sak_nr):
    body = request.get_json()
    if not body:
        return jsonify({"error": "Body required"}), 400
    result = update_candidate(analysis_id, sak_nr, body)
    if not result:
        return jsonify({"error": "Not found"}), 404
    return jsonify(result)


@app.route("/api/analyses/<analysis_id>/screen", methods=["POST"])
def screen_analysis_route(analysis_id):
    """Screen cases with Claude AI. Streams results via SSE as they complete."""
    body = request.get_json()
    if not body or not body.get("sak_nrs"):
        return jsonify({"error": "sak_nrs required"}), 400

    sak_nrs = body["sak_nrs"]
    max_parallel = body.get("max_parallel", 3)

    # Update analysis status
    update_analysis(analysis_id, {"status": "screening"})

    return sse_response(
        lambda: screen_cases(analysis_id, sak_nrs, max_parallel),
        ScreeningError,
    )


@app.route("/api/analyses/<analysis_id>/post-search", methods=["POST"])
def post_search_route(analysis_id):
    """Generate post-search suggestions based on screening results and gaps."""
    try:
        result = generate_post_search(analysis_id)
        return jsonify(result)
    except PostSearchError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyses/<analysis_id>/cross-propositions", methods=["POST"])
def cross_propositions_route(analysis_id):
    """Analyze propositions across cases — thematic grouping, evolution, tensions."""
    try:
        result = generate_cross_propositions(analysis_id)
        # Update analysis status
        update_analysis(analysis_id, {"status": "post_search"})
        return jsonify(result)
    except CrossPropositionsError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyses/<analysis_id>/screen/<path:sak_nr>/rescreen", methods=["POST"])
def rescreen_case_route(analysis_id, sak_nr):
    """Re-screen a single case with additional sections."""
    body = request.get_json() or {}
    sections = body.get("sections", ["vurdering", "bakgrunn"])

    try:
        result = rescreen_case(analysis_id, sak_nr, sections)
        return jsonify(result)
    except ScreeningError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyses/<analysis_id>/eu-cases", methods=["GET"])
def eu_cases_for_analysis(analysis_id):
    """Identify EU cases referenced by screened KOFA cases in this analysis."""
    try:
        result = identify_eu_cases(analysis_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyses/<analysis_id>/eu-screen", methods=["POST"])
def eu_screen_route(analysis_id):
    """Screen EU cases with Claude AI. Streams results via SSE."""
    body = request.get_json() or {}
    eu_case_ids = body.get("eu_case_ids")
    max_parallel = body.get("max_parallel", 3)

    return sse_response(
        lambda: screen_eu_cases(analysis_id, eu_case_ids, max_parallel),
        EuScreeningError,
    )


@app.route("/api/analyses/<analysis_id>/synthesize", methods=["POST"])
def synthesize_route(analysis_id):
    """Generate a legal analysis note from screening results."""
    body = request.get_json() or {}
    model = body.get("model")  # Optional: e.g. "claude-opus-4-6"
    try:
        result = generate_synthesis(analysis_id, model=model)
        update_analysis(analysis_id, {"status": "synthesis"})
        return jsonify(result)
    except SynthesisError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyses/<analysis_id>/synthesize-stream", methods=["POST"])
def synthesize_stream_route(analysis_id):
    """Streaming synthesis with live tool-call feedback (ADR-004 Fase 2)."""
    update_analysis(analysis_id, {"status": "synthesis"})
    return sse_typed_response(lambda: generate_synthesis_stream(analysis_id))


@app.route("/api/analyses/<analysis_id>/synthesis", methods=["PATCH"])
def update_synthesis_route(analysis_id):
    """Update the synthesis note (user edits)."""
    body = request.get_json()
    if not body or "content" not in body:
        return jsonify({"error": "content required"}), 400
    try:
        result = update_synthesis(analysis_id, body["content"])
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyses/<analysis_id>/documents", methods=["GET"])
def get_documents_route(analysis_id):
    """Get synthesis note and QA report for an analysis."""
    try:
        docs = get_analysis_documents(analysis_id)
        return jsonify(docs)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyses/<analysis_id>/qa", methods=["POST"])
def qa_route(analysis_id):
    """Run quality assurance on the synthesis note."""
    body = request.get_json() or {}
    model = body.get("model")  # Optional: e.g. "claude-opus-4-6"
    try:
        result = run_qa(analysis_id, model=model)
        update_analysis(analysis_id, {"status": "qa"})
        return jsonify(result)
    except QAError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyses/<analysis_id>/qa-stream", methods=["POST"])
def qa_stream_route(analysis_id):
    """Streaming QA with live tool-call feedback (ADR-004 Fase 2)."""
    return sse_typed_response(lambda: run_qa_stream(analysis_id))


@app.route("/api/analyses/<analysis_id>/verify-citations", methods=["POST"])
def verify_citations_route(analysis_id):
    """Pre-synthesis citation verification on screening quotes."""
    try:
        result = verify_screening_citations(analysis_id)
        update_analysis(analysis_id, {"status": "screening_complete"})
        return jsonify(result)
    except QAError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        logger.exception("verify-citations failed")
        return jsonify({"error": str(e)}), 500


# --- Batch API endpoints ---


@app.route("/api/analyses/<analysis_id>/screen-batch", methods=["POST"])
def screen_batch_route(analysis_id):
    """Submit screening as a batch job. Returns batch_id for polling."""
    body = request.get_json()
    if not body or not body.get("sak_nrs"):
        return jsonify({"error": "sak_nrs required"}), 400

    try:
        update_analysis(analysis_id, {"status": "screening"})
        batch_id = screen_cases_batch(analysis_id, body["sak_nrs"])
        return jsonify({"batch_id": batch_id})
    except ScreeningError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        logger.exception("screen-batch failed")
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyses/<analysis_id>/eu-screen-batch", methods=["POST"])
def eu_screen_batch_route(analysis_id):
    """Submit EU screening as a batch job. Returns batch_id for polling."""
    body = request.get_json() or {}
    eu_case_ids = body.get("eu_case_ids")

    try:
        batch_id = screen_eu_cases_batch(analysis_id, eu_case_ids)
        return jsonify({"batch_id": batch_id})
    except EuScreeningError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyses/<analysis_id>/qa-batch", methods=["POST"])
def qa_batch_route(analysis_id):
    """Submit QA as a batch job. Returns batch_id for polling."""
    try:
        batch_id = submit_qa_batch(analysis_id)
        return jsonify({"batch_id": batch_id})
    except QAError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyses/<analysis_id>/batch-status/<batch_id>")
def batch_status_route(analysis_id, batch_id):
    """Poll batch status. Returns processing_status and request_counts."""
    try:
        status = poll_batch_status(batch_id)
        return jsonify(status)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyses/<analysis_id>/cancel-batch/<batch_id>", methods=["POST"])
def cancel_batch_route(analysis_id, batch_id):
    """Cancel a running batch."""
    try:
        result = cancel_batch(batch_id)
        return jsonify(result)
    except Exception as e:
        logger.exception("cancel-batch failed")
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyses/<analysis_id>/batch-results/<batch_id>", methods=["POST"])
def batch_results_route(analysis_id, batch_id):
    """Retrieve and process batch results. Body must include batch_type."""
    body = request.get_json() or {}
    batch_type = body.get("batch_type")
    if not batch_type:
        return jsonify({"error": "batch_type required"}), 400

    try:
        if batch_type == "screening":
            results = process_screening_batch_results(analysis_id, batch_id)
            update_analysis(analysis_id, {"status": "screening_complete"})
            return jsonify({"results": results})
        elif batch_type == "eu_screening":
            eu_cases_meta = body.get("eu_cases_meta")
            results = process_eu_screening_batch_results(
                analysis_id, batch_id, eu_cases_meta
            )
            return jsonify({"results": results})
        elif batch_type == "qa":
            report = process_qa_batch_results(analysis_id, batch_id)
            update_analysis(analysis_id, {"status": "qa"})
            return jsonify(report)
        else:
            return jsonify({"error": f"Ukjent batch_type: {batch_type}"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyses/<analysis_id>/complete", methods=["POST"])
def complete_route(analysis_id):
    """Mark analysis as complete."""
    update_analysis(analysis_id, {"status": "complete"})
    return jsonify({"ok": True})


@app.route("/api/analyses/<analysis_id>/chat/messages", methods=["GET"])
def chat_history_route(analysis_id):
    """Return persisted chat history for an analysis."""
    try:
        messages = load_chat_history(analysis_id)
        return jsonify(messages)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyses/<analysis_id>/chat", methods=["POST"])
def chat_route(analysis_id):
    """Free-form chat with analysis context. Streams response via typed SSE."""
    body = request.get_json()
    if not body or not body.get("messages"):
        return jsonify({"error": "messages required"}), 400

    return sse_typed_response(
        lambda: chat_stream(analysis_id, body["messages"]),
    )


# SPA fallback — serve static frontend in production
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path):
    file_path = os.path.join(STATIC_DIR, path)
    if path and os.path.isfile(file_path):
        return send_from_directory(STATIC_DIR, path)
    return send_from_directory(STATIC_DIR, "index.html")


if __name__ == "__main__":
    app.run(port=5002, debug=True)
