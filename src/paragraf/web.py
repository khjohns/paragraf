"""
Flask blueprint factory for Paragraf MCP server.

Usage in unified-timeline or standalone:
    from paragraf.web import create_mcp_blueprint
    app.register_blueprint(create_mcp_blueprint(), url_prefix="/mcp")
"""


def create_mcp_blueprint():
    """Create and return Flask MCP blueprint."""
    # Import here to avoid Flask dependency at package level
    import importlib.util
    import sys

    # Load the web/app.py module
    spec = importlib.util.find_spec("paragraf")
    if spec and spec.origin:
        import os
        web_app_path = os.path.join(os.path.dirname(os.path.dirname(spec.origin)), "..", "web", "app.py")
        if os.path.exists(web_app_path):
            spec = importlib.util.spec_from_file_location("paragraf_web_app", web_app_path)
            if spec and spec.loader:
                mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
                return mod.mcp_bp

    # Fallback: inline minimal blueprint
    from flask import Blueprint, Response, jsonify, request
    import json

    from paragraf import MCPServer, LovdataService

    mcp_bp = Blueprint("mcp", __name__)

    _mcp_server = None

    def get_mcp_server():
        nonlocal _mcp_server
        if _mcp_server is None:
            _mcp_server = MCPServer(LovdataService())
        return _mcp_server

    @mcp_bp.route("/", methods=["HEAD"])
    def mcp_head():
        return Response(
            status=200,
            headers={"MCP-Protocol-Version": "2025-06-18", "Content-Type": "application/json"},
        )

    @mcp_bp.route("/", methods=["POST"])
    def mcp_post():
        body = request.get_json()
        if not body:
            return jsonify({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Empty body"}}), 400
        server = get_mcp_server()
        response = server.handle_request(body)
        return jsonify(response)

    @mcp_bp.route("/health", methods=["GET"])
    def mcp_health():
        return jsonify({"status": "ok", "server": "paragraf", "version": "0.1.0"})

    return mcp_bp
