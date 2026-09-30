// Pegamento: bucle de 60 Hz fijo, estados (título / juego) y gancho de pruebas window.__game.
import mundoJson from './data/mundo.json';
import * as vecinos from './data/vecinos.js';
import { cargarMundo } from './sim/mundo.js';
import { crearSim, paso, guardar, cargar, BOTON } from './sim/sim.js';
import { crearRender, ANCHO, ALTO } from './render/provisional.js';
import { crearRender2D } from './render2d/escena.js';
import { crearEntrada } from './input/index.js';
import { pintarHud } from './ui/hud.js';
import { pintarDialogo } from './ui/dialogo.js';
import { pintarTitulo } from './ui/titulo.js';
import { texto } from './ui/fuente.js';
import { pintarTactil } from './ui/tactil.js';

const canvas = document.getElementById('juego');
canvas.width = ANCHO; canvas.height = ALTO;
const url0 = new URLSearchParams(location.search);
const mundo = cargarMundo(mundoJson);
const datos = { inicio: vecinos.inicio, vecinos: vecinos.vecinos };
const en2D = url0.get('r') === '2d';
// zona de prueba: todo lo de fuera es sólido (bordes cerrados)
const Z = vecinos.zona;
if (Z && !en2D) for (let j = 0; j < mundo.H; j++) for (let i = 0; i < mundo.W; i++) if (i < Z.i0 || i > Z.i1 || j < Z.j0 || j > Z.j1) mundo.solido[j * mundo.W + i] = 1;
// el pavimento de la plaza (trazado sobre la ortofoto) cuenta como plaza también para la simulación
const dentroPoly = (pts, x, y) => { let r = false; for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) { const [xa, ya] = pts[a], [xb, yb] = pts[b]; if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) r = !r; } return r; };
if (Z?.plazas && !en2D) for (let j = Z.j0; j <= Z.j1; j++) for (let i = Z.i0; i <= Z.i1; i++) {
  const n = j * mundo.W + i;
  if (!mundo.edif[n] && Z.plazas.some((p) => dentroPoly(p, i + 0.5, j + 0.5))) { mundo.suelo[n] = 122; mundo.solido[n] = 0; }
}
for (const [i, j] of mundo.arboles) mundo.solido[j * mundo.W + i] = 1;
const esTactil = 'ontouchstart' in window;
const render = en2D ? crearRender(canvas, mundo) : crearRender2D(document.getElementById('mundo'), mundo, { zona: Z });
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const entrada = crearEntrada(canvas);
let audio = null;
import { crearAudio } from './audio/index.js';
audio = crearAudio();
audio.musica(new URLSearchParams(location.search).has('jugar') ? 'pueblo' : 'titulo');
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, () => audio.desbloquear(), { passive: true });

const url = new URLSearchParams(location.search);
let modo = url.has('jugar') ? 'juego' : 'titulo';
let sim = crearSim(mundo, datos, +(url.get('semilla') || 1));
let t = 0;
const guardada = localStorage.getItem('belones-partida');

function escalar() {
  if (!en2D && render.game?.canvas) {
    // la interfaz de píxel va encima del lienzo de Phaser, con el mismo tamaño y sitio
    const r = render.game.canvas.getBoundingClientRect();
    Object.assign(canvas.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    return;
  }
  // escala entera en píxeles del dispositivo (en el móvil a 844×390 con DPR 3 sale ×5)
  const dpr = devicePixelRatio || 1;
  const k = Math.max(1, Math.floor(Math.min((innerWidth * dpr) / ANCHO, (innerHeight * dpr) / ALTO)));
  canvas.style.width = (ANCHO * k) / dpr + 'px'; canvas.style.height = (ALTO * k) / dpr + 'px';
}
addEventListener('resize', escalar); escalar();

let prevBits = 0, bitsPintados = 0;
function tick() {
  const bits = entrada.leer();
  const pulsa = bits & ~prevBits; prevBits = bits; bitsPintados = bits;
  t++;
  if (modo === 'titulo') {
    if (pulsa & BOTON.A || entrada.tocado()) { modo = 'juego'; audio?.musica?.('pueblo'); if (guardada) try { cargar(sim, guardada); } catch {} }
    return;
  }
  const e = paso(sim, bits);
  if (audio) for (const ev of e.eventos) audio.evento({ ...ev, camX: en2D ? render.cam.x + ANCHO / 2 : render.cam.x * 8 });
  if (e.f % 600 === 0) localStorage.setItem('belones-partida', guardar(sim));
}

function pintar() {
  ctx.imageSmoothingEnabled = false;
  if (modo === 'titulo') { pintarTitulo(ctx, t, [], 0); return; }
  canvas.style.background = 'transparent';
  const e = sim.estado;
  if (!en2D) ctx.clearRect(0, 0, ANCHO, ALTO);
  render.pintar(e, datos);
  const j = e.jugador;
  pintarHud(ctx, { vida: j.vida, vidaMax: j.vidaMax, monedas: j.chavos, zona: mundo.nombresCalle[e.calle] || null, zonaT: e.calleT }, t);
  if (e.dialogo) {
    const d = e.dialogo;
    pintarDialogo(ctx, { nombre: d.nombre, texto: d.paginas[d.pagina], visibles: Math.floor(d.visibles), terminado: d.terminado, retrato: null }, t);
  }
  if (j.muerto > 60) {
    ctx.fillStyle = '#000a'; ctx.fillRect(0, 0, ANCHO, ALTO);
    texto(ctx, '¡Uy! Te has quedao sin corazones.', ANCHO / 2, 90, '#fff', { alinear: 'centro' });
    if (j.muerto > 150) texto(ctx, 'Pulsa A para volver a la plaza', ANCHO / 2, 110, '#f2c14e', { alinear: 'centro' });
  }
  escalar();
  if (entrada.hayTactil()) pintarTactil(ctx, entrada, bitsPintados);
  if (innerHeight > innerWidth) {
    ctx.fillStyle = '#1d1420ee'; ctx.fillRect(0, 0, ANCHO, ALTO);
    texto(ctx, 'Gira el móvil en horizontal', ANCHO / 2, 96, '#fff4dc', { alinear: 'centro', escala: 2 });
  }
  if (url.has('fps')) texto(ctx, fps + ' fps', 4, ALTO - 14, '#fff');
}

// bucle de paso fijo
let acc = 0, ultimo = performance.now(), fps = 0, cuadros = 0, tf = ultimo;
function bucle(ahora) {
  if (!window.__freeze) {
    acc += Math.min(100, ahora - ultimo);
    while (acc >= 1000 / 60) { tick(); acc -= 1000 / 60; }
  }
  ultimo = ahora;
  pintar();
  cuadros++; if (ahora - tf > 1000) { fps = cuadros; cuadros = 0; tf = ahora; }
  requestAnimationFrame(bucle);
}
requestAnimationFrame(bucle);

// gancho de pruebas
window.__game = {
  get sim() { return sim; }, mundo, BOTON, render,
  start(semilla = 1) { sim = crearSim(mundo, datos, semilla); modo = 'juego'; },
  step(n = 1, bits = 0) { for (let i = 0; i < n; i++) { const e = paso(sim, bits); } pintar(); },
  teleport(i, j) { sim.estado.jugador.x = (i * 16 + 8) * 16; sim.estado.jugador.y = (j * 16 + 14) * 16; render.cam.x = -1e4; render.cam.iniciada = false; pintar(); },
  pintar,
};
