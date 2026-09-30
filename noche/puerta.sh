#!/bin/bash
# Puerta de verificación: TODO commit la pasa.  Uso: sh noche/puerta.sh [rapida]
set -u
cd "$(dirname "$0")/.."
PORT=${GAME_PORT:-5173}
export GAME_URL="http://localhost:$PORT/"
fallo=0
paso() { printf '%-24s %s\n' "$1" "$2"; }
if node tests/sim-checks.mjs > /tmp/belones-$PORT-sim.txt 2>&1; then paso "sim-checks" "OK"; else paso "sim-checks" "FALLA (ver /tmp/belones-$PORT-sim.txt)"; fallo=1; fi
if [ -f tests/bot.mjs ]; then
  if node tests/bot.mjs > /tmp/belones-$PORT-bot.txt 2>&1; then paso "bot" "$(tail -1 /tmp/belones-$PORT-bot.txt)"; else paso "bot" "FALLA (ver /tmp/belones-$PORT-bot.txt)"; fallo=1; fi
fi
if [ "${1:-}" != "rapida" ]; then
  if ! curl -s -o /dev/null "$GAME_URL"; then
    (npx vite --port "$PORT" --strictPort > /tmp/belones-$PORT-vite.txt 2>&1 &)
    for i in $(seq 1 30); do curl -s -o /dev/null "$GAME_URL" && break; sleep 1; done
  fi
  node tests/shots.mjs /tmp/belones-$PORT-puerta > /tmp/belones-$PORT-shot.txt 2>&1
  if grep -q "sin errores" /tmp/belones-$PORT-shot.txt; then paso "captura sin errores" "OK"; else paso "captura sin errores" "FALLA: $(head -3 /tmp/belones-$PORT-shot.txt | tr '\n' ' ')"; fallo=1; fi
  if [ -f tests/qa.mjs ]; then
    if node tests/qa.mjs > /tmp/belones-$PORT-qa.txt 2>&1; then paso "qa" "$(tail -1 /tmp/belones-$PORT-qa.txt)"; else paso "qa" "FALLA (ver /tmp/belones-$PORT-qa.txt)"; fallo=1; fi
  fi
fi
exit $fallo
