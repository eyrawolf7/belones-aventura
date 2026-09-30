// HUD mínimo: corazones arriba a la izquierda, chavos arriba a la derecha y el cartel de la zona o
// de la calle al entrar (arriba en el centro, 2,5 s). Nunca toca el centro de la pantalla.
// Corazones y chavos se hornean en un lienzo propio y solo se repintan cuando cambia un valor.

import { texto, medir } from './fuente.js';
import { caja, sprite, MARRON, ACENTO } from './caja.js';
import { preferencias, rebote } from './preferencias.js';

const ANCHO = 384;
const MARGEN = 8;

export const DURACION_ZONA = 150; // fotogramas (2,5 s a 60 Hz)

const ROJO = '#e8413c';
const ROJO_OSCURO = '#a8282e';
const ROJO_BRILLO = '#ffb3a3';
const VACIO = '#5b3b33';
const VACIO_BRILLO = '#7b5549';

// Corazón de 9×8: o contorno, w brillo, r relleno, d sombra.
const CORAZON = [
  '.ooo.ooo.',
  'owwrorrro',
  'owrrrrrro',
  'orrrrrrro',
  '.orrrrdo.',
  '..orrdo..',
  '...odo...',
  '....o....',
];
const PAL_LLENO = { o: MARRON, w: ROJO_BRILLO, r: ROJO, d: ROJO_OSCURO };
const PAL_VACIO = { o: MARRON, w: VACIO_BRILLO, r: VACIO, d: VACIO };

// Chavo de 9×9: o contorno, y oro, w brillo, s sombra, g grabado.
const CHAVO = [
  '..ooooo..',
  '.oyyyyyo.',
  'oywwyyyso',
  'oywygyyso',
  'oyyygyyso',
  'oyyygyyso',
  'oyyyyysso',
  '.ossssso.',
  '..ooooo..',
];
const PAL_CHAVO = { o: MARRON, y: '#f6c94a', w: '#fff1a8', s: '#c98a2c', g: '#d9a23a' };

export const CORAZON_W = 9;
const PASO_CORAZON = 10;
const POR_FILA = 10;

function pintarCorazon(ctx, x, y, mitades) {
  // mitades: 2 lleno, 1 medio (mitad izquierda), 0 vacío.
  if (mitades === 2) return sprite(ctx, CORAZON, x, y, PAL_LLENO);
  sprite(ctx, CORAZON, x, y, PAL_VACIO);
  if (mitades === 1) {
    const izq = CORAZON.map((f) => f.slice(0, 5));
    // La columna central queda como contorno partido: se ve claramente que es medio.
    sprite(ctx, izq, x, y, PAL_LLENO);
    ctx.fillStyle = MARRON;
    ctx.fillRect(x + 4, y + 1, 1, 6);
  }
}

let horno = null;
let clave = '';

function lienzo(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function hornear(e) {
  if (!horno) horno = lienzo(ANCHO, 32);
  const c = horno.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, ANCHO, 32);
  const total = Math.ceil((e.vidaMax || 0) / 2);
  const vida = Math.max(0, e.vida || 0);
  for (let i = 0; i < total; i++) {
    const fila = Math.floor(i / POR_FILA);
    const col = i % POR_FILA;
    const m = Math.max(0, Math.min(2, vida - i * 2));
    // Sombra suave de 1 px para despegar el corazón del suelo.
    const x = MARGEN + col * PASO_CORAZON;
    const y = MARGEN + fila * 10;
    sprite(c, CORAZON.map((f) => f.replace(/[wrd]/g, 'o')), x + 1, y + 1, { o: '#00000040' });
    pintarCorazon(c, x, y, m);
  }
  const n = String(Math.max(0, Math.floor(e.monedas || 0)));
  const xd = ANCHO - MARGEN;
  const w = medir(n);
  texto(c, n, xd - 1, MARGEN - 3, '#fff8ec', { alinear: 'der', contorno: MARRON, sombra: '#00000040' });
  sprite(c, CHAVO.map((f) => f.replace(/[ywsg]/g, 'o')), xd - w - 13 + 1, MARGEN + 1, { o: '#00000040' });
  sprite(c, CHAVO, xd - w - 13, MARGEN, PAL_CHAVO);
}

/**
 * e = {vida, vidaMax (en medios corazones), monedas, zona: string|null, zonaT: fotogramas}
 * t = fotogramas (latido cuando queda poca vida).
 */
export function pintarHud(ctx, e, t = 0) {
  if (!e) return;
  ctx.imageSmoothingEnabled = false;
  const k = `${e.vida}|${e.vidaMax}|${e.monedas}`;
  if (k !== clave) {
    hornear(e);
    clave = k;
  }
  ctx.drawImage(horno, 0, 0);

  // Latido del último corazón con vida cuando queda 1 corazón o menos.
  if (e.vida > 0 && e.vida <= 2 && !preferencias.movimientoReducido) {
    const i = Math.ceil(e.vida / 2) - 1;
    const x = MARGEN + (i % POR_FILA) * PASO_CORAZON;
    const y = MARGEN + Math.floor(i / POR_FILA) * 10;
    if (t % 40 < 6) {
      ctx.fillStyle = '#ffffff80';
      ctx.fillRect(x + 1, y + 1, 3, 2);
      ctx.fillRect(x + 5, y + 1, 3, 2);
    }
  }

  if (e.zona && e.zonaT != null && e.zonaT < DURACION_ZONA) pintarCartelZona(ctx, e.zona, e.zonaT);
}

function pintarCartelZona(ctx, nombre, zt) {
  const reducido = preferencias.movimientoReducido;
  const ENTRA = 14;
  const SALE = 18;
  let alfa = 1;
  if (zt < ENTRA) alfa = zt / ENTRA;
  else if (zt > DURACION_ZONA - SALE) alfa = (DURACION_ZONA - zt) / SALE;
  alfa = Math.max(0, Math.min(1, alfa));
  const dy = reducido ? 0 : Math.round((1 - rebote(Math.min(1, zt / 20))) * -10);

  const w = medir(nombre) + 34;
  const h = 19;
  const x = Math.round((ANCHO - w) / 2);
  const y = 7 + dy;
  const previo = ctx.globalAlpha;
  ctx.globalAlpha = previo * alfa;
  caja(ctx, x, y, w, h);
  // Rombos de acento a los lados.
  for (const cx of [x + 8, x + w - 11]) {
    ctx.fillStyle = ACENTO;
    ctx.fillRect(cx + 1, y + 7, 1, 1);
    ctx.fillRect(cx, y + 8, 3, 1);
    ctx.fillRect(cx + 1, y + 9, 1, 1);
  }
  texto(ctx, nombre, x + Math.floor(w / 2), y + 3, MARRON, { alinear: 'centro', sombra: null });
  ctx.globalAlpha = previo;
}
