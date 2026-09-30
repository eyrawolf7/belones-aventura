// Comprobaciones de la simulación pura (sin navegador). Sale con 1 si algo falla.
import fs from 'node:fs';
import { cargarMundo } from '../src/sim/mundo.js';
import { crearSim, paso, guardar, cargar, BOTON } from '../src/sim/sim.js';
import * as vecinos from '../src/data/vecinos.js';

const mundo = cargarMundo(JSON.parse(fs.readFileSync('src/data/mundo.json', 'utf8')));
const datos = { inicio: vecinos.inicio, vecinos: vecinos.vecinos };
let fallos = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALLA ') + msg); if (!c) fallos++; };

// 1) determinismo: misma semilla y entradas → mismo estado
const guion = (f) => [BOTON.DER, BOTON.ABAJO, BOTON.IZQ | BOTON.ARRIBA, BOTON.A, 0][Math.floor(f / 37) % 5];
const correr = (sem) => { const s = crearSim(mundo, datos, sem); for (let f = 0; f < 3000; f++) paso(s, guion(f)); return guardar(s); };
ok(correr(7) === correr(7), 'determinista con la misma semilla');

// 2) el jugador empieza en suelo libre y se mueve
const s = crearSim(mundo, datos, 1);
const j = s.estado.jugador, p0 = j.x + ',' + j.y;
for (const b of [BOTON.DER, BOTON.IZQ, BOTON.ABAJO, BOTON.ARRIBA]) for (let f = 0; f < 30; f++) paso(s, b);
ok(j.anda > 0 || j.x + ',' + j.y !== p0, 'el jugador responde al movimiento');

// 3) nunca atraviesa paredes: 20.000 pasos al azar y siempre en baldosa libre
const s2 = crearSim(mundo, datos, 3);
let dentro = 0;
for (let f = 0; f < 20000; f++) {
  paso(s2, [BOTON.ARRIBA, BOTON.ABAJO, BOTON.IZQ, BOTON.DER, BOTON.ARRIBA | BOTON.DER][Math.floor(f / 45 + (f % 7)) % 5]);
  const p = s2.estado.jugador, i = Math.floor(p.x / 16 / 16), jj = Math.floor((p.y / 16 - 1) / 16);
  if (mundo.solido[jj * mundo.W + i]) dentro++;
}
ok(dentro === 0, `no se mete en paredes (${dentro} fotogramas dentro)`);

// 4) hablar con la abuela abre un diálogo y se cierra
const s3 = crearSim(mundo, datos, 1);
const ab = s3.estado.vecinos.find((v) => v.id === 'abuela');
Object.assign(s3.estado.jugador, { x: ab.x, y: ab.y + 14 * 16, dir: 1 });
paso(s3, 0); paso(s3, BOTON.A);
ok(!!s3.estado.dialogo, 'A delante de un vecino abre el diálogo');
for (let f = 0; f < 2000 && s3.estado.dialogo; f++) paso(s3, f % 2 ? BOTON.A : 0);
ok(!s3.estado.dialogo, 'el diálogo se cierra pulsando A');

// 5) guardar y cargar da el mismo estado
const s4 = crearSim(mundo, datos, 5);
for (let f = 0; f < 500; f++) paso(s4, guion(f));
const g = guardar(s4); cargar(s4, g);
ok(guardar(s4) === g, 'guardar y cargar es idéntico');

// 6) todos los vecinos están en suelo libre
ok(s.estado.vecinos.every((v) => !mundo.solido[Math.floor((v.y / 16 - 1) / 16) * mundo.W + Math.floor(v.x / 256)]), 'vecinos en suelo libre');

console.log(fallos ? `${fallos} FALLOS` : 'Todo OK');
process.exit(fallos ? 1 : 0);
