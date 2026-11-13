#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
APPROVAL_DIR="$REPO_ROOT/.claude/approvals"

# Si se invoca desde git pre-push, lee stdin: <local ref> <local sha1> <remote ref> <remote sha1>
CHECKED_ANY=0
while read -r local_ref local_sha remote_ref remote_sha; do
  CHECKED_ANY=1
  if [[ "$remote_ref" == "refs/heads/main" || "$local_ref" == "refs/heads/main" ]]; then
    if [[ ! -f "$APPROVAL_DIR/${local_sha}.approved" ]]; then
      echo "BLOQUEADO POR HOOK git pre-push: El commit ${local_sha} hacia [main] NO tiene examen 5/5 aprobado en .claude/approvals/${local_sha}.approved" >&2
      exit 1
    fi
  fi
done

# Si se ejecuta en prueba directa sin stdin de refs, valida HEAD actual
if [[ "$CHECKED_ANY" -eq 0 ]]; then
  HEAD_SHA="$(git rev-parse HEAD)"
  if [[ ! -f "$APPROVAL_DIR/${HEAD_SHA}.approved" ]]; then
    echo "BLOQUEADO POR HOOK git pre-push: El commit actual (${HEAD_SHA}) NO tiene examen 5/5 aprobado en .claude/approvals/${HEAD_SHA}.approved" >&2
    exit 1
  fi
fi

exit 0
