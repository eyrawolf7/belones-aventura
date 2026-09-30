# Contrato entre agentes

Cada carpeta tiene un dueño. Un agente solo edita su carpeta; si necesita algo de otra, lo pide en
`PROGRESO.md` («Peticiones») o lo hace el integrador. `src/main.js` es el pegamento y lo toca el
integrador (la sesión principal).

| Carpeta | Dueño | Qué hay | No puede |
|---|---|---|---|
| `src/sim/` | mecánicas | mundo, jugador, colisiones, enemigos, combate, objetos, guion, guardado | usar DOM, canvas, `Math.random`, `Date`, audio |
| `src/data/` | contenido / guion | `mundo.json` (generado), `vecinos.js`, `dialogos.js`, `objetos.js`, `zonas.js` | editar `mundo.json` a mano (se regenera) |
| `tools/mapa/` | contenido | generador del mundo desde los datos reales | — |
| `src/render/` | visual | paleta, pintores de baldosas y sprites, horneado por trozos, cámara, luz, partículas | cambiar el estado de la simulación |
| `src/ui/` | interfaz | diálogo, HUD, menús, pantalla de título, controles táctiles dibujados | lógica de juego |
| `src/audio/` | sonido | música y efectos sintetizados | archivos de audio con licencia dudosa |
| `src/input/` | interfaz | teclado, mando, táctil → máscara de bits | — |
| `tests/` | QA | comprobaciones, bots, capturas, rodajes | tocar `src/` |
| `noche/` | integrador | turno autónomo, puerta, ajustes | — |

## Interfaces

- **Entrada** → `sim.step(bits)`: `ARRIBA 1, ABAJO 2, IZQ 4, DER 8, A 16 (acción/espada/hablar),
  B 32 (objeto), MENU 64, PAUSA 128`. Nada más entra en la simulación.
- **Simulación → render**: el render solo lee `sim.estado` (jugador, entidades, efectos, cámara
  deseada, diálogo activo, eventos del fotograma en `estado.eventos` para sonido y partículas).
- **Eventos**: `{tipo: 'golpe'|'recoger'|'hablar'|'puerta'|'daño'|'muerte'|'cofre'|..., x, y, ...}`,
  se vacían en cada paso. Sonido, partículas y vibración se enganchan aquí.
- **Mundo**: `mundo.json` = `{ancho, alto, suelo: [], solido: [], edificio: [], ...}` en baldosas
  (ver `tools/mapa/generar.mjs`). La simulación solo necesita `solido` y las entidades.
- **Unidades**: posiciones de la simulación en 1/16 de píxel (enteros), 16 px por baldosa.
