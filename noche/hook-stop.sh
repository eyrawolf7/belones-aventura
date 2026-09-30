#!/bin/bash
# Gancho Stop de Claude Code: si la simulación no pasa sus comprobaciones, no se puede dar el turno por terminado.
entrada=$(cat)
echo "$entrada" | grep -q '"stop_hook_active": *true' && exit 0
cd "$(dirname "$0")/.."
git diff --quiet HEAD -- src tools 2>/dev/null && [ -z "$(git ls-files --others --exclude-standard src tools)" ] && exit 0
if ! node tests/sim-checks.mjs > /tmp/belones-hook.txt 2>&1; then
  echo "npm test falla ($(grep FALLA /tmp/belones-hook.txt | head -3 | tr '\n' ' ')). Arréglalo antes de terminar." >&2
  exit 2
fi
exit 0
