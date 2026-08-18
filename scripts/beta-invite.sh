#!/bin/bash
# Mint, list or revoke personal beta invite links.
#
#   scripts/beta-invite.sh alice@example.com "Alice, via Ian"     # mint (30 days, 5 uses)
#   scripts/beta-invite.sh --list [email]                          # who has been invited
#   scripts/beta-invite.sh --revoke alice@example.com              # kill every link for that email
#
# The operator token is KIT_BETA_ADMIN_TOKEN (env, else the macOS keychain
# item of the same name), the same secret that reads the beta roster. The
# invite link it returns is the only thing the invitee ever sees.
set -euo pipefail
ORIGIN="${KIT_SITE_ORIGIN:-https://kit-project.com}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN="${KIT_BETA_ADMIN_TOKEN:-$(security find-generic-password -s KIT_BETA_ADMIN_TOKEN -w 2>/dev/null || true)}"
# Last resort: the untracked env pull the Vercel CLI leaves in the repo root.
[ -n "$TOKEN" ] || TOKEN="$(grep -E '^KIT_BETA_ADMIN_TOKEN=' "$HERE/.env.diagnostic" 2>/dev/null | cut -d= -f2- | tr -d '"')"
[ -n "$TOKEN" ] || { echo "KIT_BETA_ADMIN_TOKEN not set (env or keychain)"; exit 1; }
api() { curl -sS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$@"; }
case "${1:-}" in
  --list)   api "$ORIGIN/api/beta-invite${2:+?email=$2}" | python3 -c '
import sys,json
for r in json.load(sys.stdin):
    print(f"{r[\"id\"]:>4}  {r[\"email\"]:<32} {r.get(\"label\") or \"\":<24} uses {r[\"uses\"]}/{r[\"max_uses\"]}  expires {r[\"expires_at\"][:10]}  {\"REVOKED\" if r[\"revoked\"] else \"\"}")' ;;
  --revoke) [ -n "${2:-}" ] || { echo "email required"; exit 1; }
            api -X DELETE "$ORIGIN/api/beta-invite" -d "{\"email\":\"$2\"}"; echo ;;
  ""|-h|--help) sed -n '2,12p' "$0" ;;
  *)        api -X POST "$ORIGIN/api/beta-invite" -d "{\"email\":\"$1\",\"label\":\"${2:-}\",\"created_by\":\"$(whoami)\"}" | python3 -c '
import sys,json; r=json.load(sys.stdin)
if "url" in r: print(r["url"]); print(f"for {r[\"email\"]}, {r[\"max_uses\"]} uses, expires {r[\"expires_at\"][:10]}")
else: print(r); sys.exit(1)' ;;
esac
