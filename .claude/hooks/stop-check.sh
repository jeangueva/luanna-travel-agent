#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPORT_FILE="$REPO_ROOT/.claude/reports/latest-test-report.txt"

if [[ ! -s "$REPORT_FILE" ]]; then
  echo "BLOQUEADO POR HOOK Stop: No puedes dar por terminada la tarea hasta que exista un informe de pruebas no vacío en .claude/reports/latest-test-report.txt" >&2
  exit 2
fi

exit 0
