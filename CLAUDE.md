# Belones — contexto para Claude Code

Aventura de acción vista desde arriba (3/4, estilo Zelda: Minish Cap / Link's Awakening, con la
exploración y los vecinos de Pokémon) ambientada en **Los Belones** (Cartagena, Murcia). El mapa del
pueblo sale de **datos reales** (Catastro y OSM, en `referencias/datos-pueblo/`, heredados del proyecto
`../game-losbelones`): cada calle, cada manzana y cada árbol están donde están. Proyecto personal de
Víctor (SDG), que habla español de España, en tono informal, prueba en el móvil en horizontal y quiere
llevarlo a **Android** y **Switch homebrew**. Meta de calidad: un indie que podría ganar premios.

Documentos: `docs/GDD.md` (diseño: qué juego es, bucle, zonas, historia), `docs/CONTRATO.md` (carpetas y
dueños, interfaces), `docs/investigacion-pueblo.md` (datos del pueblo), `tareas.json` (lista de
funcionalidades con criterio de hecho, fuente de la verdad del avance) y `PROGRESO.md` (bitácora).

## Arquitectura

- `src/sim/`: **simulación pura**: sin DOM ni canvas, pasos fijos de 60 Hz, entradas como máscara de
  bits por fotograma, aleatoriedad con semilla, estado serializable (partida guardada = JSON). Es lo que se
  portaría a C para Switch.
- `src/data/`: el mundo generado (`mundo.json`, lo escribe `npm run mapa`), vecinos, diálogos, objetos.
- `src/render/`: Canvas 2D a resolución interna de **384×216** escalada por enteros; el arte se
  **pinta por código** con una paleta fija (`src/render/paleta.js`) y se hornea por trozos.
- `src/ui/` (diálogos, HUD, menús, pintados en el mismo canvas), `src/audio/` (WebAudio sintetizado),
  `src/input/` (teclado, mando, táctil), `src/main.js` (bucle y estados).
- Baldosa = 16 px = **2 m** reales. Coordenadas locales heredadas: x crece hacia el OESTE, z hacia el
  NORTE; el generador las pasa a baldosas con el este a la derecha y el norte arriba.

## Reglas de diseño (NO romper)

1. **Es su pueblo.** Calles, nombres y manzanas reales. Lo inventado (mazmorras, criaturas, magia) va
   fuera del casco o bajo tierra. Nada de caricaturizar a la gente del pueblo.
2. **Se entiende en 10 segundos y se juega con 2 botones** (acción y objeto) + moverse. Táctil primero.
3. **Legibilidad**: el jugador, los enemigos y lo que se puede tocar se distinguen siempre del fondo.
   Nada tapa al personaje. Texto grande en móvil (mínimo 8 px de fuente interna ×3).
4. **Justo**: todo daño se telegrafía antes; ninguna muerte sin aviso; se guarda a menudo.
5. **Cada sesión deja algo que se nota en el primer minuto** de juego. Nada de fontanería invisible
   sin algo visible que la justifique.
6. **Presupuesto de móvil desde el día 1**: 60 fps en un móvil normal, sin posproceso caro; el mundo
   se hornea en trozos y solo se dibuja lo visible.
7. **Tono amable** (Nintendo): humor, calidez, nada gore. Sonido agradable, nada de pitidos agudos.

## Flujo de trabajo obligatorio

```
npm run dev                  # http://localhost:5173
npm run mapa                 # regenera src/data/mundo.json desde los datos reales
npm test                     # comprobaciones de la simulación (sin navegador)
npm run bot                  # bot que recorre el mundo y la historia sobre la simulación pura
node tests/shots.mjs <carpeta> [--x=.. --y=.. --escena=..]   # capturas deterministas
node tests/qa.mjs            # comprobaciones funcionales en Chrome sin cabeza
sh noche/puerta.sh           # puerta: TODO commit la pasa
npm run build                # dist/ en un solo HTML
```

Gancho de pruebas: `window.__game` (`start(semilla)`, `step(n)`, `sim`, `teleport(x, y)`,
`escena(nombre)`), y `window.__freeze = true` para avanzar a mano. `?fps` muestra fps.

**Pruébalo tú antes de entregar**: capturas mirándolas con Read, bot y QA. Una tarea está hecha
cuando su `criterio_hecho` de `tareas.json` se cumple **medido**, no cuando lo parece. Una sola
vuelta de críticos por tarea (`.claude/agents/`): `juego-director-arte` tras cambios visuales,
`juego-critico-jugador` tras mecánicas o contenido, `juego-qa` antes de publicar, `juego-sonido` y
`juego-interfaz` en lo suyo. Antes de cada bloque grande, pregunta a Víctor sus 3 prioridades.

## Límites

- **Publicar SIEMPRE** en https://eyrawolf7.github.io/belones-aventura/ al terminar cada cambio que Víctor tenga que ver: él prueba desde el móvil y no tiene otra forma. Basta con `git push` a `main` (cuenta **eyrawolf7**, nunca la del trabajo): GitHub Actions compila y publica en ~40 s. Comprueba después con `GAME_URL=https://eyrawolf7.github.io/belones-aventura/ node tests/movil.mjs`. El turno autónomo NO publica (trabaja en ramas); publica la sesión principal al integrar.
- No mates procesos que no hayas lanzado tú (nada de `pkill` genérico): cada carril usa su puerto.
- No uses el ratón del jugador para nada que no se pueda hacer con mando.
