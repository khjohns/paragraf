from flask import Flask, jsonify, request
from flask_cors import CORS
from traversal import build_traversal_response

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


if __name__ == "__main__":
    app.run(port=5002, debug=True)
