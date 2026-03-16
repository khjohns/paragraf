#!/usr/bin/env bash
set -euo pipefail

PROJECT="procurement-mcp"
SERVICE="paragraf"
REGION="europe-north1"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*"; exit 1; }

# ── Hjelp ────────────────────────────────────────────────────────────────────
echo ""
echo "Setter secrets for Cloud Run: ${SERVICE} (${PROJECT}/${REGION})"
echo "Secrets lagres i Secret Manager og monteres som env vars."
echo "Trykk Enter uten verdi når du er ferdig."
echo ""

# ── Hent service account ─────────────────────────────────────────────────────
SA=$(gcloud run services describe "$SERVICE" \
  --region "$REGION" \
  --project "$PROJECT" \
  --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null) || err "Fant ikke Cloud Run-tjenesten '$SERVICE'"

ok "Service account: ${SA}"
echo ""

# ── Samle inn secrets interaktivt ────────────────────────────────────────────
SECRET_ARGS=""
declare -a SECRET_NAMES=()

while true; do
  echo -n "Secret-navn (f.eks. ANTHROPIC_API_KEY), eller Enter for å avslutte: "
  read -r SECRET_NAME
  [[ -z "$SECRET_NAME" ]] && break

  echo -n "  Verdi (skjult): "
  read -rs SECRET_VALUE
  echo ""

  [[ -z "$SECRET_VALUE" ]] && warn "Tom verdi — hopper over ${SECRET_NAME}" && continue

  # Sjekk om secret finnes fra før
  if gcloud secrets describe "$SECRET_NAME" --project "$PROJECT" &>/dev/null; then
    warn "${SECRET_NAME} finnes allerede — legger til ny versjon"
    echo -n "$SECRET_VALUE" | gcloud secrets versions add "$SECRET_NAME" \
      --project "$PROJECT" \
      --data-file=- > /dev/null
  else
    echo -n "$SECRET_VALUE" | gcloud secrets create "$SECRET_NAME" \
      --project "$PROJECT" \
      --replication-policy="automatic" \
      --data-file=- > /dev/null
    ok "Opprettet secret ${SECRET_NAME}"
  fi

  # Gi service account tilgang
  gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
    --project "$PROJECT" \
    --member="serviceAccount:${SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None > /dev/null 2>&1
  ok "IAM-tilgang gitt til ${SA}"

  SECRET_ARGS="${SECRET_ARGS} --update-secrets=${SECRET_NAME}=${SECRET_NAME}:latest"

  # Fjern plain env var med samme navn hvis den finnes
  EXISTING_ENV=$(gcloud run services describe "$SERVICE" \
    --region "$REGION" --project "$PROJECT" \
    --format="yaml(spec.template.spec.containers[0].env)" 2>/dev/null \
    | grep "name: ${SECRET_NAME}" || true)
  if [[ -n "$EXISTING_ENV" ]]; then
    SECRET_ARGS="${SECRET_ARGS} --remove-env-vars=${SECRET_NAME}"
    warn "Fjerner eksisterende plain env var ${SECRET_NAME}"
  fi

  SECRET_NAMES+=("$SECRET_NAME")
  ok "${SECRET_NAME} klar"
  echo ""
done

[[ ${#SECRET_NAMES[@]} -eq 0 ]] && err "Ingen secrets oppgitt — avbryter."

# ── Deploy til Cloud Run ─────────────────────────────────────────────────────
echo ""
echo "Oppdaterer Cloud Run-tjenesten..."
# shellcheck disable=SC2086
gcloud run services update "$SERVICE" \
  --region "$REGION" \
  --project "$PROJECT" \
  $SECRET_ARGS > /dev/null

ok "Cloud Run oppdatert"

# ── Verifisering ─────────────────────────────────────────────────────────────
echo ""
echo "Verifiserer..."

for SECRET_NAME in "${SECRET_NAMES[@]}"; do
  MOUNTED=$(gcloud run services describe "$SERVICE" \
    --region "$REGION" \
    --project "$PROJECT" \
    --format="yaml(spec.template.spec.containers[0].env)" 2>/dev/null \
    | grep -c "$SECRET_NAME" || true)

  if [[ "$MOUNTED" -gt 0 ]]; then
    ok "${SECRET_NAME} er montert som env var"
  else
    err "${SECRET_NAME} ble IKKE montert — sjekk manuelt"
  fi

  VERSIONS=$(gcloud secrets versions list "$SECRET_NAME" \
    --project "$PROJECT" \
    --filter="state=ENABLED" \
    --format="value(name)" 2>/dev/null | wc -l | tr -d ' ')
  ok "${SECRET_NAME} har ${VERSIONS} aktiv(e) versjon(er) i Secret Manager"
done

echo ""
ok "Alt OK. Tjenesten bruker nå secrets fra Secret Manager."
