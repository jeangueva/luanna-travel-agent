#!/usr/bin/env bash
set -euo pipefail

# Lee el payload JSON de stdin (Claude Code PreToolUse / Hook runner) o argumentos directos
PAYLOAD="$(cat || true)"
COMBINED="${PAYLOAD} $*"

if echo "$COMBINED" | grep -Eiq '(git[[:space:]]+push|--no-verify)'; then
  echo "BLOQUEADO POR HOOK PreToolUse: Está prohibido ejecutar 'git push' o usar '--no-verify' desde la sesión del agente." >&2
  exit 2
fi

exit 0
