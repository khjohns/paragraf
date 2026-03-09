from flask import Flask, jsonify, request
from flask_cors import CORS
from traversal import build_traversal_response
from cases import get_case_detail
from provisions import get_provision_detail

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


if __name__ == "__main__":
    app.run(port=5002, debug=True)
