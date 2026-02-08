"""
MCP (Model Context Protocol) routes for Lovdata integration.

Exposes Norwegian law lookup as tools for Claude.ai custom connectors.

Endpoint: /mcp/
Protocol: MCP 2025-06-18 over Streamable HTTP

Authentication:
    - Anonymous: No token required (rate limited per IP)
    - API key: Bearer pgf_xxx (same rate limit)
    - JWT: Bearer <supabase-jwt> (for API key creation)

Rate limiting:
    - 120 req/min per IP (burst protection, not quota)
    - Provided by Flask-Limiter via unified-timeline backend
    - No-op when running standalone (pip install paragraf)

Usage in Claude.ai:
    Settings → Connectors → Add custom connector
    URL: https://your-domain.com/mcp/

See: https://modelcontextprotocol.io/
"""

import json
import os
import secrets
from collections.abc import Generator

from flask import Blueprint, Response, g, jsonify, request

from paragraf import MCPServer, LovdataService

import logging
logger = logging.getLogger(__name__)

# Rate limiting: provided by unified-timeline's Flask-Limiter.
# No-op fallback when running standalone (no Flask-Limiter available).
try:
    from lib.security.rate_limiter import limit_mcp
except ImportError:
    def limit_mcp(f):
        """No-op decorator when running outside unified-timeline."""
        return f

mcp_bp = Blueprint("mcp", __name__, url_prefix="/mcp")

# =============================================================================
# Configuration
# =============================================================================

# Set MCP_REQUIRE_AUTH=true to require OAuth authentication
MCP_REQUIRE_AUTH = os.getenv("MCP_REQUIRE_AUTH", "false").lower() == "true"

# Supabase configuration for OAuth validation
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")


# =============================================================================
# Service Singletons
# =============================================================================

_lovdata_service: LovdataService | None = None
_mcp_server: MCPServer | None = None


def get_lovdata_service() -> LovdataService:
    """Get or create LovdataService singleton."""
    global _lovdata_service
    if _lovdata_service is None:
        _lovdata_service = LovdataService()
    return _lovdata_service


def get_mcp_server() -> MCPServer:
    """Get or create MCPServer singleton."""
    global _mcp_server
    if _mcp_server is None:
        _mcp_server = MCPServer(get_lovdata_service())
    return _mcp_server


# =============================================================================
# OAuth Authentication (optional)
# =============================================================================


def validate_jwt_token(token: str) -> dict | None:
    """
    Validate a Supabase JWT token.

    Returns:
        User dict {"id": ..., "email": ...} if valid, None otherwise
    """
    if not SUPABASE_JWT_SECRET:
        logger.warning("SUPABASE_JWT_SECRET not configured, cannot validate JWT")
        return None

    try:
        import jwt
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated"
        )
        return {"id": payload.get("sub"), "email": payload.get("email")}
    except Exception as e:
        logger.warning(f"Invalid JWT token: {e}")
        return None


def validate_api_key(key: str) -> dict | None:
    """
    Validate a pgf_ API key against the paragraf_api_keys table.

    Updates last_used_at on success.

    Returns:
        User dict {"id": ..., "api_key_id": ...} if valid, None otherwise
    """
    try:
        from paragraf._supabase_utils import get_shared_client
        client = get_shared_client()
        result = (
            client.table("paragraf_api_keys")
            .select("id, user_id")
            .eq("api_key", key)
            .is_("revoked_at", "null")
            .execute()
        )
        if not result.data:
            return None

        row = result.data[0]

        # Update last_used_at (fire-and-forget, don't block on failure)
        try:
            client.table("paragraf_api_keys").update(
                {"last_used_at": "now()"}
            ).eq("id", row["id"]).execute()
        except Exception:
            pass

        return {"id": row["user_id"], "api_key_id": row["id"]}
    except Exception as e:
        logger.error(f"API key validation error: {e}")
        return None


def generate_api_key() -> str:
    """Generate a new API key with pgf_ prefix."""
    return "pgf_" + secrets.token_hex(32)


@mcp_bp.before_request
def check_mcp_auth():
    """
    Optional authentication for MCP requests.

    - Bearer pgf_xxx -> validate as API key (unlimited access)
    - Bearer <jwt>   -> validate as Supabase JWT
    - No token       -> anonymous (rate limited by IP upstream)

    Skips auth for: OPTIONS, HEAD, /health, /info
    """
    # Skip auth for preflight and info endpoints
    if request.method in ("OPTIONS", "HEAD"):
        return None
    if request.path.endswith(("/health", "/info")):
        return None

    auth_header = request.headers.get("Authorization", "")

    # No token -> anonymous access (rate limiter handles limits)
    if not auth_header:
        g.mcp_user = None
        return None

    if not auth_header.startswith("Bearer "):
        return jsonify({
            "error": "invalid_request",
            "message": "Authorization header must use Bearer scheme"
        }), 400

    token = auth_header[7:]  # Remove "Bearer " prefix

    if token.startswith("pgf_"):
        # API key authentication
        user = validate_api_key(token)
        if not user:
            return jsonify({
                "error": "invalid_token",
                "message": "Invalid or revoked API key"
            }), 401
        g.mcp_user = user
        logger.info(f"MCP authenticated via API key: {user['id']}")
    else:
        # JWT authentication
        user = validate_jwt_token(token)
        if not user:
            return jsonify({
                "error": "invalid_token",
                "message": "Invalid or expired access token"
            }), 401
        g.mcp_user = user
        logger.info(f"MCP authenticated via JWT: {user.get('email', user.get('id'))}")

    return None


# =============================================================================
# MCP Protocol Endpoints
# =============================================================================


@mcp_bp.route("/", methods=["HEAD"])
def mcp_head() -> Response:
    """
    Return MCP protocol version header.

    Required by Claude.ai to detect MCP server capabilities.
    """
    logger.debug("MCP HEAD request received")
    return Response(
        status=200,
        headers={
            "MCP-Protocol-Version": "2025-06-18",
            "Content-Type": "application/json",
        }
    )


@mcp_bp.route("/", methods=["OPTIONS"])
def mcp_options() -> Response:
    """
    Handle CORS preflight requests.
    """
    return Response(
        status=204,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
            "Access-Control-Max-Age": "86400",
        }
    )


@mcp_bp.route("/", methods=["POST"])
@limit_mcp
def mcp_post() -> Response:
    """
    Handle MCP JSON-RPC requests.

    This is the main endpoint for MCP communication.
    Receives JSON-RPC requests and returns responses.
    """
    # Get session ID if provided
    session_id = request.headers.get("Mcp-Session-Id", "")

    try:
        body = request.get_json()
        if not body:
            return jsonify({
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": "Parse error: empty body"}
            }), 400

        logger.info(
            f"MCP POST: method={body.get('method')} "
            f"session={session_id[:8] if session_id else 'none'}"
        )

        # Handle request via MCP server
        server = get_mcp_server()
        response = server.handle_request(body)

        return jsonify(response)

    except json.JSONDecodeError as e:
        logger.warning(f"MCP JSON parse error: {e}")
        return jsonify({
            "jsonrpc": "2.0",
            "id": None,
            "error": {"code": -32700, "message": f"Parse error: {str(e)}"}
        }), 400

    except Exception as e:
        logger.exception(f"MCP request error: {e}")
        return jsonify({
            "jsonrpc": "2.0",
            "id": None,
            "error": {"code": -32603, "message": f"Internal error: {str(e)}"}
        }), 500


@mcp_bp.route("/", methods=["GET"])
def mcp_sse() -> Response:
    """
    SSE endpoint for streaming responses.

    Note: SSE transport may be deprecated in favor of Streamable HTTP.
    This endpoint is provided for backwards compatibility.
    """
    logger.debug("MCP SSE connection opened")

    def generate() -> Generator[str, None, None]:
        """Generate SSE events."""
        # Send initial ping
        yield f"data: {json.dumps({'type': 'ping'})}\n\n"

        # Keep connection alive (Claude will close when done)
        # In a real implementation, you'd stream tool results here

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


# =============================================================================
# API Key Management
# =============================================================================


@mcp_bp.route("/api-keys", methods=["POST"])
def create_api_key() -> Response:
    """
    Create or retrieve an API key for the authenticated user.

    Requires JWT Bearer token (from Supabase Auth).
    Returns existing active key or creates a new one.
    """
    user = getattr(g, "mcp_user", None)
    if not user or not user.get("id"):
        return jsonify({
            "error": "unauthorized",
            "message": "JWT authentication required"
        }), 401

    user_id = user["id"]

    try:
        from paragraf._supabase_utils import get_shared_client
        client = get_shared_client()

        # Check for existing active key
        existing = (
            client.table("paragraf_api_keys")
            .select("api_key, created_at")
            .eq("user_id", user_id)
            .eq("name", "default")
            .is_("revoked_at", "null")
            .execute()
        )

        if existing.data:
            return jsonify({
                "api_key": existing.data[0]["api_key"],
                "created_at": existing.data[0]["created_at"],
                "existing": True,
            })

        # Generate and store new key
        api_key = generate_api_key()
        result = (
            client.table("paragraf_api_keys")
            .insert({
                "user_id": user_id,
                "api_key": api_key,
                "name": "default",
            })
            .execute()
        )

        return jsonify({
            "api_key": api_key,
            "created_at": result.data[0]["created_at"],
            "existing": False,
        })

    except Exception as e:
        logger.exception(f"Failed to create API key: {e}")
        return jsonify({
            "error": "internal_error",
            "message": "Failed to create API key"
        }), 500


@mcp_bp.route("/api-keys", methods=["OPTIONS"])
def api_keys_options() -> Response:
    """Handle CORS preflight for api-keys endpoint."""
    return Response(
        status=204,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
        }
    )


# =============================================================================
# Health & Info Endpoints
# =============================================================================


@mcp_bp.route("/health", methods=["GET"])
def mcp_health() -> Response:
    """Health check endpoint for MCP server."""
    return jsonify({
        "status": "ok",
        "server": "paragraf",
        "version": "0.1.0",
        "protocol": "2025-06-18",
    })


@mcp_bp.route("/info", methods=["GET"])
def mcp_info() -> Response:
    """
    Return information about the MCP server and available tools.

    Useful for debugging and documentation.
    """
    server = get_mcp_server()

    # Build auth info
    auth_info = {
        "required": MCP_REQUIRE_AUTH,
        "type": "oauth2" if MCP_REQUIRE_AUTH else "none",
    }
    if MCP_REQUIRE_AUTH and SUPABASE_URL:
        auth_info["discovery_url"] = f"{SUPABASE_URL}/auth/v1/.well-known/openid-configuration"

    return jsonify({
        "server": {
            "name": "paragraf",
            "version": "0.1.0",
            "description": "MCP server for Norwegian law lookup via Lovdata API",
        },
        "protocol": {
            "version": "2025-06-18",
            "transport": ["streamable-http", "sse"],
        },
        "authentication": auth_info,
        "tools": server.tools,
        "usage": {
            "claude_ai": {
                "instructions": "Settings → Connectors → Add custom connector",
                "url": "https://your-domain.com/mcp/",
            },
            "curl_example": {
                "initialize": 'curl -X POST /mcp/ -H "Content-Type: application/json" '
                              '-d \'{"jsonrpc":"2.0","id":1,"method":"initialize",'
                              '"params":{"clientInfo":{"name":"test","version":"1.0"}}}\'',
                "tools_list": 'curl -X POST /mcp/ -H "Content-Type: application/json" '
                              '-d \'{"jsonrpc":"2.0","id":2,"method":"tools/list"}\'',
                "tool_call": 'curl -X POST /mcp/ -H "Content-Type: application/json" '
                             '-d \'{"jsonrpc":"2.0","id":3,"method":"tools/call",'
                             '"params":{"name":"lov","arguments":{"lov_id":"avhendingslova","paragraf":"3-9"}}}\'',
            }
        },
        "data_source": {
            "provider": "Lovdata",
            "url": "https://api.lovdata.no/",
            "license": "NLOD 2.0 - Norsk lisens for offentlige data",
        }
    })
