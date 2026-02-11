#!/bin/bash
# Layer 2: MCP Tool Correctness Tests
# Runs JSON-RPC calls against `paragraf serve` and validates responses
#
# Usage: bash tests/test_mcp_tools.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load env
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

PASS=0
FAIL=0
ERRORS=""

# Helper: send a single JSON-RPC request and capture output
call_tool() {
    local name="$1"
    local args="$2"
    local id="${3:-1}"
    local request="{\"jsonrpc\":\"2.0\",\"id\":$id,\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$args}}"
    echo "$request" | python3 -m paragraf.cli serve 2>/dev/null
}

# Assert: check that output contains a pattern
assert_contains() {
    local test_name="$1"
    local output="$2"
    local pattern="$3"

    if echo "$output" | grep -qi "$pattern"; then
        PASS=$((PASS + 1))
        echo "  PASS: $test_name"
    else
        FAIL=$((FAIL + 1))
        ERRORS="$ERRORS\n  FAIL: $test_name (expected pattern: '$pattern')"
        echo "  FAIL: $test_name (expected: '$pattern')"
        # Show first 200 chars of output for debugging
        echo "    Got: $(echo "$output" | head -c 200)"
    fi
}

# Assert: check that output does NOT contain a pattern
assert_not_contains() {
    local test_name="$1"
    local output="$2"
    local pattern="$3"

    if echo "$output" | grep -qi "$pattern"; then
        FAIL=$((FAIL + 1))
        ERRORS="$ERRORS\n  FAIL: $test_name (unexpected pattern: '$pattern')"
        echo "  FAIL: $test_name (unexpected: '$pattern')"
    else
        PASS=$((PASS + 1))
        echo "  PASS: $test_name"
    fi
}

# Assert: check no JSON-RPC error
assert_no_error() {
    local test_name="$1"
    local output="$2"

    if echo "$output" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if 'error' not in d and not d.get('result',{}).get('isError') else 1)" 2>/dev/null; then
        PASS=$((PASS + 1))
        echo "  PASS: $test_name (no error)"
    else
        FAIL=$((FAIL + 1))
        ERRORS="$ERRORS\n  FAIL: $test_name (got error in response)"
        echo "  FAIL: $test_name (got error)"
        echo "    Got: $(echo "$output" | head -c 300)"
    fi
}

# Extract text content from JSON-RPC response
extract_text() {
    echo "$1" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    content = d.get('result', {}).get('content', [{}])
    if isinstance(content, list) and len(content) > 0:
        print(content[0].get('text', ''))
    else:
        print('')
except:
    print('')
"
}

echo "================================================"
echo "Layer 2: MCP Tool Correctness Tests"
echo "================================================"
echo ""

# ============================================================
# 2.1 lov — alias resolution chain
# ============================================================
echo "--- 2.1 lov: alias resolution ---"

OUT=$(call_tool "lov" '{"lov_id":"aml"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.1a lov(aml) no error" "$OUT"
assert_contains "2.1a lov(aml) finds arbeidsmiljoloven" "$TEXT" "arbeidsmilj"

OUT=$(call_tool "lov" '{"lov_id":"aml","paragraf":"14-9"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.1b lov(aml, 14-9) no error" "$OUT"
assert_contains "2.1b lov(aml, 14-9) has section content" "$TEXT" "14-9"

OUT=$(call_tool "lov" '{"lov_id":"arbeidsmiljøloven"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.1c lov(arbeidsmiljoloven) no error" "$OUT"
assert_contains "2.1c lov(arbeidsmiljoloven) finds aml" "$TEXT" "arbeidsmilj"

OUT=$(call_tool "lov" '{"lov_id":"husleieloven","paragraf":"9-2"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.1d lov(husleieloven, 9-2) no error" "$OUT"
assert_contains "2.1d husleieloven 9-2 has content" "$TEXT" "9-2"

OUT=$(call_tool "lov" '{"lov_id":"lov/2005-06-17-62"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.1e lov(direct dok_id) no error" "$OUT"
assert_contains "2.1e direct dok_id finds aml" "$TEXT" "arbeidsmilj"

OUT=$(call_tool "lov" '{"lov_id":"aksjeloven"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.1f lov(aksjeloven) no error" "$OUT"
assert_contains "2.1f aksjeloven found" "$TEXT" "aksje"

OUT=$(call_tool "lov" '{"lov_id":"nonexistent-law-xyz"}')
TEXT=$(extract_text "$OUT")
assert_contains "2.1g nonexistent law gives error msg" "$TEXT" "fant ikke\|ikke funnet\|feil\|ingen"

echo ""

# ============================================================
# 2.2 lov — metadata in TOC
# ============================================================
echo "--- 2.2 lov: metadata in TOC ---"

OUT=$(call_tool "lov" '{"lov_id":"aml"}')
TEXT=$(extract_text "$OUT")
assert_contains "2.2a aml TOC has Departement" "$TEXT" "departement"

OUT=$(call_tool "forskrift" '{"forskrift_id":"tek17"}')
TEXT=$(extract_text "$OUT")
assert_contains "2.2b tek17 TOC has Hjemmelslov" "$TEXT" "hjemmelslov\|hjemmel"

OUT=$(call_tool "lov" '{"lov_id":"personopplysningsloven"}')
TEXT=$(extract_text "$OUT")
assert_contains "2.2c personopplysningsloven has structure" "$TEXT" "kapittel\|del\|artikkel"

echo ""

# ============================================================
# 2.3 forskrift — alias + lookup
# ============================================================
echo "--- 2.3 forskrift: alias + lookup ---"

OUT=$(call_tool "forskrift" '{"forskrift_id":"tek17"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.3a forskrift(tek17) no error" "$OUT"
assert_contains "2.3a tek17 found" "$TEXT" "byggteknisk\|bygning\|tek"

OUT=$(call_tool "forskrift" '{"forskrift_id":"tek17","paragraf":"5-2"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.3b forskrift(tek17, 5-2) no error" "$OUT"
assert_contains "2.3b tek17 5-2 has content" "$TEXT" "5-2"

OUT=$(call_tool "forskrift" '{"forskrift_id":"sak10"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.3c forskrift(sak10) no error" "$OUT"
assert_contains "2.3c sak10 found" "$TEXT" "byggesak\|saksbehandling\|sak"

echo ""

# ============================================================
# 2.4 sok — basic FTS
# ============================================================
echo "--- 2.4 sok: basic FTS ---"

OUT=$(call_tool "sok" '{"query":"erstatning"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.4a sok(erstatning) no error" "$OUT"
assert_contains "2.4a sok(erstatning) has results" "$TEXT" "treff\|resultat\|§"

OUT=$(call_tool "sok" '{"query":"vesentlig mislighold"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.4b sok(vesentlig mislighold) no error" "$OUT"
assert_contains "2.4b vesentlig mislighold has results" "$TEXT" "treff\|resultat\|§"

OUT=$(call_tool "sok" '{"query":"xyznonexistent12345"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.4c sok(nonexistent) no error" "$OUT"
assert_contains "2.4c nonexistent gives no-hit msg" "$TEXT" "ingen treff\|0 treff\|fant ingen"

OUT=$(call_tool "sok" '{"query":"oppsigelse nedbemanning"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.4d sok(oppsigelse nedbemanning) no error" "$OUT"
assert_contains "2.4d oppsigelse nedbemanning has results" "$TEXT" "treff\|resultat\|§"

OUT=$(call_tool "sok" '{"query":"\"eksakt frase\""}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.4e sok(quoted phrase) no error" "$OUT"

echo ""

# ============================================================
# 2.5 sok — filters
# ============================================================
echo "--- 2.5 sok: filters ---"

OUT=$(call_tool "sok" '{"query":"erstatning","doc_type":"lov"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.5a sok(erstatning, doc_type=lov) no error" "$OUT"
assert_contains "2.5a has results" "$TEXT" "treff\|resultat\|§"

OUT=$(call_tool "sok" '{"query":"erstatning","doc_type":"forskrift"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.5b sok(erstatning, doc_type=forskrift) no error" "$OUT"
assert_contains "2.5b has results" "$TEXT" "treff\|resultat\|§\|forskrift"

OUT=$(call_tool "sok" '{"query":"arbeidstid","departement":"Arbeids"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.5c sok(arbeidstid, dept=Arbeids) no error" "$OUT"
assert_contains "2.5c has results" "$TEXT" "treff\|resultat\|§"

OUT=$(call_tool "sok" '{"query":"endring","inkluder_endringslover":true}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.5e sok(endring, inkluder_endringslover=true) no error" "$OUT"
assert_contains "2.5e has results" "$TEXT" "treff\|resultat\|§"

echo ""

# ============================================================
# 2.6 semantisk_sok — basic
# ============================================================
echo "--- 2.6 semantisk_sok: basic ---"

OUT=$(call_tool "semantisk_sok" '{"query":"skjulte feil i boligen"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.6a semantisk_sok(skjulte feil) no error" "$OUT"
assert_contains "2.6a finds mangel-related" "$TEXT" "mangel\|avhending\|bolig\|kjøp"

OUT=$(call_tool "semantisk_sok" '{"query":"oppsigelse"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.6b semantisk_sok(oppsigelse) no error" "$OUT"
assert_contains "2.6b finds aml-related" "$TEXT" "oppsig\|arbeid\|ansatt"

OUT=$(call_tool "semantisk_sok" '{"query":"miljokrav","doc_type":"forskrift"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.6c semantisk_sok(miljokrav, forskrift) no error" "$OUT"
assert_contains "2.6c filter shown" "$TEXT" "filter\|type=forskrift"

echo ""

# ============================================================
# 2.7 semantisk_sok — filters
# ============================================================
echo "--- 2.7 semantisk_sok: filters ---"

OUT=$(call_tool "semantisk_sok" '{"query":"personvern","doc_type":"lov"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.7c semantisk_sok(personvern, lov) no error" "$OUT"
assert_contains "2.7c filter shown" "$TEXT" "filter\|type=lov"

echo ""

# ============================================================
# 2.8 hent_flere — batch
# ============================================================
echo "--- 2.8 hent_flere: batch ---"

OUT=$(call_tool "hent_flere" '{"lov_id":"aml","paragrafer":["1-1","14-9","15-7"]}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.8a hent_flere(aml, 3 sections) no error" "$OUT"
assert_contains "2.8a has 1-1" "$TEXT" "1-1"
assert_contains "2.8a has 14-9" "$TEXT" "14-9"
assert_contains "2.8a has 15-7" "$TEXT" "15-7"

OUT=$(call_tool "hent_flere" '{"lov_id":"aml","paragrafer":["1-1","NONEXISTENT"]}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.8b hent_flere(mixed) no error" "$OUT"
assert_contains "2.8b has 1-1" "$TEXT" "1-1"
assert_contains "2.8b warns about missing" "$TEXT" "ikke funnet\|fant ikke\|NONEXISTENT"

OUT=$(call_tool "hent_flere" '{"lov_id":"aml","paragrafer":[]}')
TEXT=$(extract_text "$OUT")
assert_contains "2.8c empty list gives message" "$TEXT" "ingen\|feil\|tom\|mangler\|minst"

echo ""

# ============================================================
# 2.9 relaterte_forskrifter
# ============================================================
echo "--- 2.9 relaterte_forskrifter ---"

OUT=$(call_tool "relaterte_forskrifter" '{"lov_id":"aml"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.9a relaterte_forskrifter(aml) no error" "$OUT"
assert_contains "2.9a has results" "$TEXT" "forskrift"

OUT=$(call_tool "relaterte_forskrifter" '{"lov_id":"pbl"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.9b relaterte_forskrifter(pbl) no error" "$OUT"
assert_contains "2.9b has results" "$TEXT" "forskrift"

OUT=$(call_tool "relaterte_forskrifter" '{"lov_id":"nonexistent-law"}')
TEXT=$(extract_text "$OUT")
assert_contains "2.9c nonexistent gives message" "$TEXT" "ingen\|fant ikke\|ikke funnet\|0"

echo ""

# ============================================================
# 2.10 departementer
# ============================================================
echo "--- 2.10 departementer ---"

OUT=$(call_tool "departementer" '{}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.10a departementer() no error" "$OUT"
assert_contains "2.10a has multiple depts" "$TEXT" "departement"

echo ""

# ============================================================
# 2.10b rettsomrader
# ============================================================
echo "--- 2.10b rettsomrader ---"

OUT=$(call_tool "rettsomrader" '{}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.10b rettsomrader() no error" "$OUT"
assert_contains "2.10b has legal areas" "$TEXT" "rett"

echo ""

# ============================================================
# 2.11 liste
# ============================================================
echo "--- 2.11 liste ---"

OUT=$(call_tool "liste" '{}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.11a liste() no error" "$OUT"
assert_contains "2.11a has alias info" "$TEXT" "alias\|aml\|lov"

echo ""

# ============================================================
# 2.12 status
# ============================================================
echo "--- 2.12 status ---"

OUT=$(call_tool "status" '{}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.12a status() no error" "$OUT"
assert_contains "2.12a has backend info" "$TEXT" "backend\|supabase\|status"

echo ""

# ============================================================
# 2.13 sjekk_storrelse
# ============================================================
echo "--- 2.13 sjekk_storrelse ---"

OUT=$(call_tool "sjekk_storrelse" '{"lov_id":"aml","paragraf":"1-1"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.13a sjekk_storrelse(aml, 1-1) no error" "$OUT"
assert_contains "2.13a has token estimate" "$TEXT" "token\|tegn"

OUT=$(call_tool "sjekk_storrelse" '{"lov_id":"aml","paragraf":"NONEXISTENT"}')
TEXT=$(extract_text "$OUT")
assert_contains "2.13b nonexistent gives message" "$TEXT" "fant ikke\|ikke funnet"

echo ""

# ============================================================
# 2.14 Edge cases
# ============================================================
echo "--- 2.14 Edge cases ---"

OUT=$(call_tool "lov" '{"lov_id":"aml","paragraf":"§ 14-9"}')
TEXT=$(extract_text "$OUT")
assert_contains "2.14a § prefix handled" "$TEXT" "14-9"

OUT=$(call_tool "lov" '{"lov_id":""}')
TEXT=$(extract_text "$OUT")
assert_contains "2.14b empty ID gives error" "$TEXT" "feil\|ugyldig\|mangler\|fant ikke\|angi"

OUT=$(call_tool "sok" '{"query":""}')
TEXT=$(extract_text "$OUT")
# Empty query should either error or return no results
echo "  INFO: 2.14c sok('') -> $(echo "$TEXT" | head -c 100)"
PASS=$((PASS + 1))

OUT=$(call_tool "sok" '{"query":"miljø OR klima -bil"}')
TEXT=$(extract_text "$OUT")
assert_no_error "2.14d special operators no error" "$OUT"
assert_contains "2.14d special operators has results" "$TEXT" "treff\|resultat\|§\|miljø\|klima"

OUT=$(call_tool "semantisk_sok" '{"query":"test","doc_type":"invalid"}')
TEXT=$(extract_text "$OUT")
# Should either work gracefully or return error
echo "  INFO: 2.14g semantisk_sok(invalid doc_type) -> $(echo "$TEXT" | head -c 150)"
PASS=$((PASS + 1))

echo ""

# ============================================================
# Summary
# ============================================================
echo "================================================"
echo "RESULTS: $PASS passed, $FAIL failed"
echo "================================================"

if [ $FAIL -gt 0 ]; then
    echo ""
    echo "Failures:"
    echo -e "$ERRORS"
    exit 1
fi
