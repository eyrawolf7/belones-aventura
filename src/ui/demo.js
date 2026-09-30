// Demo de la interfaz: pinta título, menú, HUD, cartel de zona y diálogo a 384×216 y lo escala por
// enteros. Parámetros de la URL:
//   ?escena=todo|titulo|menu|juego|zona|fuente   (todo por defecto: todo apilado a ×3)
//   ?t=120        congela en ese fotograma (para capturas deterministas)
//   ?escala=4     fuerza la escala (en píxeles del dispositivo por píxel interno)
//   ?reducido     simula prefers-reduced-motion
// La demo es solo para capturas: el fondo del juego es un apaño, el de verdad lo pinta src/render.

import { texto, CARACTERES, partirLineas, medir } from './fuente.js';
import { pintarDialogo, ANCHO_TEXTO_DIALOGO, LINEAS_DIALOGO } from './dialogo.js';
import { pintarHud } from './hud.js';
import { pintarTitulo } from './titulo.js';
import { preferencias } from './preferencias.js';

const W = 384, H = 216;
const q = new URLSearchParams(location.search);
const escena = q.get('escena') || 'todo';
const tFijo = q.has('t') ? Number(q.get('t')) : null;
preferencias.movimientoReducido = q.has('reducido') || matchMedia('(prefers-reduced-motion: reduce)').matches;

const FRASE = '¡Ea, zagal! ¿Ande vas tan acelerao? Pásate por la plaza, que el cura te busca.';

// ---- Fondo de juego de mentira: calle, aceras, casas encaladas, césped y un personaje ----------
function fondoJuego(c) {
  c.fillStyle = '#7cc26a';
  c.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 16) {
    c.fillStyle = (x / 16 + y / 16) % 2 ? '#74b964' : '#7cc26a';
    c.fillRect(x, y, 16, 16);
    c.fillStyle = '#5fa452';
    c.fillRect(x + 3, y + 5, 1, 2); c.fillRect(x + 11, y + 10, 1, 2);
  }
  // Calle
  c.fillStyle = '#d8c9a8'; c.fillRect(0, 96, W, 48);
  c.fillStyle = '#9a9186'; c.fillRect(0, 104, W, 32);
  c.fillStyle = '#e8e0cc'; for (let x = 4; x < W; x += 24) c.fillRect(x, 119, 12, 2);
  // Casas
  for (const [x, y, w, h, teja] of [[16, 30, 80, 60, '#c8603a'], [120, 20, 96, 70, '#b85a3a'], [250, 34, 70, 56, '#c8603a'], [40, 156, 90, 60, '#b85a3a'], [240, 152, 110, 64, '#c8603a']]) {
    c.fillStyle = '#00000030'; c.fillRect(x + 4, y + 4, w, h);
    c.fillStyle = '#f7efe2'; c.fillRect(x, y, w, h);
    c.fillStyle = teja; c.fillRect(x - 2, y - 6, w + 4, 16);
    c.fillStyle = '#00000022'; for (let k = 0; k < w + 4; k += 4) c.fillRect(x - 2 + k, y - 6, 1, 16);
    c.fillStyle = '#6a8ab8'; c.fillRect(x + 10, y + 22, 10, 10); c.fillRect(x + w - 20, y + 22, 10, 10);
    c.fillStyle = '#7a5030'; c.fillRect(x + Math.floor(w / 2) - 6, y + h - 20, 12, 20);
  }
  // Personaje provisional en el centro (el de verdad lo pinta src/render).
  const px = 184, py = 104;
  c.fillStyle = '#00000040'; c.fillRect(px + 2, py + 18, 12, 3);
  c.fillStyle = '#3b2a20'; c.fillRect(px + 3, py, 10, 20);
  c.fillStyle = '#f2c69a'; c.fillRect(px + 4, py + 2, 8, 7);
  c.fillStyle = '#4a7ad0'; c.fillRect(px + 4, py + 10, 8, 6);
  c.fillStyle = '#5a3a28'; c.fillRect(px + 4, py + 1, 8, 2);
}

// ---- Escenas ----------------------------------------------------------------------------------
const ESCENAS = {
  titulo: (c, t) => pintarTitulo(c, t, [], 0),
  menu: (c, t) => pintarTitulo(c, t, ['Nueva partida', 'Continuar', 'Ajustes'], 0),
  juego: (c, t) => {
    fondoJuego(c);
    pintarHud(c, { vida: 5, vidaMax: 6, monedas: 128, zona: null, zonaT: 999 }, t);
    const n = [...FRASE].length;
    const visibles = tFijo != null ? Math.floor(n * 0.62) : Math.min(n, Math.floor((t % 300) / 2));
    pintarDialogo(c, { nombre: 'Tía Encarna', texto: FRASE, visibles, terminado: false, retrato: null }, t);
  },
  fin: (c, t) => {
    fondoJuego(c);
    pintarHud(c, { vida: 2, vidaMax: 10, monedas: 7, zona: null, zonaT: 999 }, t);
    pintarDialogo(c, { nombre: 'Tía Encarna', texto: FRASE + ' Y no te entretengas por la rambla, que luego se hace de noche y tu madre se preocupa.', visibles: 999, terminado: true, retrato: null }, t);
  },
  zona: (c, t) => {
    fondoJuego(c);
    const zt = tFijo != null ? 40 : t % 200;
    pintarHud(c, { vida: 5, vidaMax: 6, monedas: 128, zona: 'Calle de la Iglesia', zonaT: zt }, t);
  },
  fuente: (c) => {
    c.fillStyle = '#fff4dc'; c.fillRect(0, 0, W, H);
    const lineas = partirLineas(CARACTERES, W - 16);
    lineas.forEach((l, i) => texto(c, l, 8, 6 + i * 13, '#3b2a20', { sombra: null }));
    const y = 6 + lineas.length * 13 + 6;
    texto(c, '¡Ea, zagal! ¿Ande vas? Él, ÁÉÍÓÚ Ñ ü «hola» — …', 8, y, '#3b2a20', { sombra: null });
    texto(c, 'Pequeño x2 Ñandú', 8, y + 16, '#e0703a', { escala: 2, contorno: '#3b2a20' });
  },
};

const lista = escena === 'todo' ? ['titulo', 'menu', 'juego', 'fin', 'zona', 'fuente'] : [escena];
if (escena === 'todo') document.body.classList.add('todo');

const dpr = window.devicePixelRatio || 1;
function escalaEntera() {
  if (q.has('escala')) return Number(q.get('escala'));
  if (escena === 'todo') return Math.max(1, Math.round(3 * dpr));
  return Math.max(1, Math.floor(Math.min((innerWidth * dpr) / W, (innerHeight * dpr) / H)));
}

const vistas = lista.map((nombre) => {
  const interno = document.createElement('canvas');
  interno.width = W; interno.height = H;
  const pantalla = document.createElement('canvas');
  document.body.appendChild(pantalla);
  return { nombre, interno, ci: interno.getContext('2d'), pantalla, cp: pantalla.getContext('2d') };
});

let t = tFijo ?? 0;

function ajustar() {
  const e = escalaEntera();
  for (const v of vistas) {
    const w = W * e, h = H * e;
    if (v.pantalla.width === w && v.pantalla.height === h) continue;
    v.pantalla.width = w; v.pantalla.height = h; // esto borra el lienzo: hay que repintar
    v.pantalla.style.width = `${w / dpr}px`;
    v.pantalla.style.height = `${h / dpr}px`;
  }
  if (tFijo != null) pintar();
}

function pintar() {
  for (const v of vistas) {
    v.ci.clearRect(0, 0, W, H);
    ESCENAS[v.nombre](v.ci, t);
    v.cp.imageSmoothingEnabled = false;
    v.cp.drawImage(v.interno, 0, 0, v.pantalla.width, v.pantalla.height);
  }
}

function cuadro() {
  pintar();
  t++;
  requestAnimationFrame(cuadro);
}

addEventListener('resize', ajustar);
ajustar();
if (tFijo == null) cuadro();
else { pintar(); window.__listo = true; }

// Datos para pruebas.
window.__ui = { ANCHO_TEXTO_DIALOGO, LINEAS_DIALOGO, partirLineas, medir, FRASE };
