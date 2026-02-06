"""
Paragraf CLI - MCP server for Norwegian law lookup.

Usage:
    paragraf serve              # stdio MCP server
    paragraf serve --http       # HTTP MCP server (Flask)
    paragraf serve --http --port 8000
    paragraf sync               # Sync from Lovdata API
    paragraf sync --force       # Force re-sync
    paragraf status             # Show sync status
"""

import argparse
import json
import logging
import sys


def cmd_serve(args):
    """Start MCP server (stdio or HTTP)."""
    from paragraf import MCPServer, LovdataService

    if args.http:
        # HTTP mode via Flask
        try:
            from flask import Flask
            from paragraf.web import create_mcp_blueprint
        except ImportError:
            print("Flask not installed. Run: pip install paragraf[http]", file=sys.stderr)
            sys.exit(1)

        app = Flask(__name__)
        app.register_blueprint(create_mcp_blueprint(), url_prefix="/mcp")

        host = args.host or "0.0.0.0"
        port = args.port or 8000
        print(f"Starting Paragraf MCP server on http://{host}:{port}/mcp/")
        app.run(host=host, port=port, debug=args.debug)
    else:
        # stdio mode - read JSON-RPC from stdin, write to stdout
        server = MCPServer(LovdataService())
        print("Paragraf MCP server (stdio mode). Send JSON-RPC requests via stdin.", file=sys.stderr)

        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                request = json.loads(line)
                response = server.handle_request(request)
                print(json.dumps(response), flush=True)
            except json.JSONDecodeError as e:
                error_response = {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {"code": -32700, "message": f"Parse error: {e}"},
                }
                print(json.dumps(error_response), flush=True)


def cmd_sync(args):
    """Sync law data from Lovdata API."""
    from paragraf import LovdataService

    service = LovdataService()
    print("Syncing from Lovdata API...")
    results = service.sync(force=args.force)

    for dataset, count in results.items():
        if count >= 0:
            print(f"  {dataset}: {count} documents")
        else:
            print(f"  {dataset}: FAILED")


def cmd_status(args):
    """Show sync status."""
    from paragraf import LovdataService

    service = LovdataService()
    status = service.get_sync_status()

    if not status:
        print("Not synced. Run: paragraf sync")
        return

    print(f"Backend: {service.get_backend_type()}")
    for dataset, info in status.items():
        print(f"\n{dataset}:")
        print(f"  Last synced: {info.get('synced_at', 'unknown')}")
        print(f"  Files: {info.get('file_count', 0)}")


def main():
    parser = argparse.ArgumentParser(
        prog="paragraf",
        description="MCP server for Norwegian law lookup via Lovdata",
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable debug logging"
    )

    subparsers = parser.add_subparsers(dest="command")

    # serve
    serve_parser = subparsers.add_parser("serve", help="Start MCP server")
    serve_parser.add_argument("--http", action="store_true", help="Use HTTP transport (Flask)")
    serve_parser.add_argument("--host", default=None, help="HTTP host (default: 0.0.0.0)")
    serve_parser.add_argument("--port", type=int, default=None, help="HTTP port (default: 8000)")
    serve_parser.add_argument("--debug", action="store_true", help="Enable Flask debug mode")

    # sync
    sync_parser = subparsers.add_parser("sync", help="Sync data from Lovdata API")
    sync_parser.add_argument("--force", "-f", action="store_true", help="Force re-download")

    # status
    subparsers.add_parser("status", help="Show sync status")

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    if args.command == "serve":
        cmd_serve(args)
    elif args.command == "sync":
        cmd_sync(args)
    elif args.command == "status":
        cmd_status(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
