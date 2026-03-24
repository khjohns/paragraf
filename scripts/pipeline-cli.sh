#!/bin/bash
# Wrapper for pipeline-context.py — loads secrets from GCP if not already set.
# Usage: bash scripts/pipeline-cli.sh <command> <args...>
set -euo pipefail

if [ -z "${SUPABASE_URL:-}" ]; then
  export SUPABASE_URL=$(gcloud secrets versions access latest --secret=SUPABASE_URL --project=procurement-mcp 2>/dev/null)
  export SUPABASE_KEY=$(gcloud secrets versions access latest --secret=SUPABASE_KEY --project=procurement-mcp 2>/dev/null)
fi

if [ -z "${GOOGLE_API_KEY:-}" ]; then
  export GOOGLE_API_KEY=$(gcloud secrets versions access latest --secret=GOOGLE_API_KEY --project=procurement-mcp 2>/dev/null)
fi

exec backend/venv/bin/python3 scripts/pipeline-context.py "$@"
