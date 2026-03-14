import json
import os

from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS
from traversal import build_traversal_response
from cases import get_case_detail
from provisions import get_provision_detail
from curation import generate_curation
from eu_cases import get_eu_case_detail
from forarbeider import get_forarbeid_detail, get_forarbeid_section
from analyses import list_analyses, get_analysis, get_analysis_with_seeds, create_analysis, update_analysis, upsert_seeds, update_candidate, persist_candidates, parse_seed_rows
from scoping import generate_scope, ScopeError
from screening import screen_cases, rescreen_case, ScreeningError

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

app = Flask(__name__)
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

        # Persist candidates
        candidate_count = persist_candidates(analysis_id, result["nodes"], iteration)

        # Persist gaps on the analysis
        update_analysis(analysis_id, {
            "gaps": result.get("gaps", []),
            "status": "candidates_ready",
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

    def generate():
        try:
            for sak_nr, result in screen_cases(analysis_id, sak_nrs, max_parallel):
                event_data = json.dumps(result, ensure_ascii=False)
                yield f"data: {event_data}\n\n"
        except ScreeningError as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        # Send done event
        yield f"data: {json.dumps({'done': True})}\n\n"

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


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
