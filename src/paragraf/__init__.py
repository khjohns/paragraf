"""
Paragraf - MCP server for Norwegian law lookup via Lovdata.

Provides access to 92,000+ paragraphs from Norwegian laws and regulations
through the Model Context Protocol (MCP).

Usage:
    # As CLI
    paragraf serve           # stdio MCP server
    paragraf serve --http    # HTTP MCP server

    # As library
    from paragraf import MCPServer, LovdataService
"""

from paragraf.server import MCPServer
from paragraf.service import LovdataService

__version__ = "0.1.0"
__all__ = ["MCPServer", "LovdataService"]
