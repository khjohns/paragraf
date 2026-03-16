#!/usr/bin/env bash
set -euo pipefail

PROJECT="procurement-mcp"
BACKEND_DIR="$(cd "$(dirname "$0")/../backend" && pwd)"
VENV="${BACKEND_DIR}/venv/bin/activate"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $*"; }
info() { echo -e "${YELLOW}·${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*"; exit 1; }

echo ""
echo "Starter Paragraf backend (Flask :5002)"
echo ""

# ── Venv ─────────────────────────────────────────────────────────────────────
[[ ! -f "$VENV" ]] && err "Fant ikke venv på ${VENV}"
# shellcheck disable=SC1090
source "$VENV"
ok "venv aktivert"

# ── Hent secrets fra Secret Manager og eksporter som env vars ────────────────
EXPECTED_KEYS=$(grep -oE '^[A-Z_]+' "${BACKEND_DIR}/.env.example" 2>/dev/null || true)
[[ -z "$EXPECTED_KEYS" ]] && err "Fant ikke ${BACKEND_DIR}/.env.example"

SM_SECRETS=$(gcloud secrets list --project "$PROJECT" --format="value(name)" 2>/dev/null)
MISSING=()

for KEY in $EXPECTED_KEYS; do
  if echo "$SM_SECRETS" | grep -qx "$KEY"; then
    VALUE=$(gcloud secrets versions access latest \
      --secret="$KEY" --project="$PROJECT" 2>/dev/null)
    if [[ -n "$VALUE" ]]; then
      export "$KEY"="$VALUE"
      ok "${KEY} hentet fra Secret Manager"
    else
      info "${KEY} er tom i Secret Manager"
      MISSING+=("$KEY")
    fi
  else
    info "${KEY} ikke i Secret Manager"
    MISSING+=("$KEY")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo ""
  echo "Manglende secrets (legg til via ./scripts/set-secrets.sh):"
  for K in "${MISSING[@]}"; do echo "  - $K"; done
  echo ""
  read -rp "Fortsett likevel? [j/N] " CONFIRM
  [[ "$CONFIRM" != "j" && "$CONFIRM" != "J" ]] && exit 1
fi

echo ""

# ── Start Flask ───────────────────────────────────────────────────────────────
ok "Starter app.py..."
echo ""
cd "$BACKEND_DIR"
python app.py
