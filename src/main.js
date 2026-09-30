// Pegamento: bucle de 60 Hz fijo, estados (título / juego) y gancho de pruebas window.__game.
import mundoJson from './data/mundo.json';
import * as vecinos from './data/vecinos.js';
import { cargarMundo } from './sim/mundo.js';
import { crearSim, paso, guardar, cargar, BOTON } from './sim/sim.js';
import { crearRender, ANCHO, ALTO } from './render/provisional.js';
import { crearEntrada } from './input/index.js';
import { pintarHud } from './ui/hud.js';
import { pintarDialogo } from './ui/dialogo.js';
import { pintarTitulo } from './ui/titulo.js';
import { texto } from './ui/fuente.js';
import { pintarTactil } from './ui/tactil.js';

const canvas = document.getElementById('juego');
canvas.width = ANCHO; canvas.height = ALTO;
const mundo = cargarMundo(mundoJson);
const datos = { inicio: vecinos.inicio, vecinos: vecinos.vecinos };
const render = crearRender(canvas, mundo);
const { ctx } = render;
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
  if (audio) for (const ev of e.eventos) audio.evento({ ...ev, camX: render.cam.x + ANCHO / 2 });
  if (e.f % 600 === 0) localStorage.setItem('belones-partida', guardar(sim));
}

function pintar() {
  ctx.imageSmoothingEnabled = false;
  if (modo === 'titulo') { pintarTitulo(ctx, t, [], 0); return; }
  const e = sim.estado;
  render.pintar(e);
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
  get sim() { return sim; }, mundo, BOTON,
  start(semilla = 1) { sim = crearSim(mundo, datos, semilla); modo = 'juego'; },
  step(n = 1, bits = 0) { for (let i = 0; i < n; i++) { const e = paso(sim, bits); } pintar(); },
  teleport(i, j) { sim.estado.jugador.x = (i * 16 + 8) * 16; sim.estado.jugador.y = (j * 16 + 14) * 16; render.cam.x = -1e4; pintar(); },
  pintar,
};
