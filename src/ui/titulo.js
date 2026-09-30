// Pantalla de título: atardecer sobre el Campo de Cartagena, con la sierra al fondo y molinos de
// velas latinas (los del Campo: torre blanca, tejado cónico y ocho velas triangulares).
// El fondo estático se hornea una vez; por fotograma solo se pintan las velas, las estrellas y el
// texto.

import { texto, medir, ALTO_LINEA, ARRIBA } from './fuente.js';
import { caja, sprite, MARRON, ACENTO, ACENTO_SOMBRA } from './caja.js';
import { preferencias, rebote } from './preferencias.js';

const W = 384;
const H = 216;
const HORIZONTE = 150;

// Cielo de arriba abajo: bandas con transición tramada (sin degradados suaves).
const CIELO = ['#2b2250', '#3a2a60', '#52326c', '#6e3a70', '#8f4470', '#b4526e', '#d4646a', '#ea8262', '#f6a45f', '#fbc673', '#fde09a'];

// Generador determinista pequeño para el paisaje (nada de Math.random: capturas estables).
function rng(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function lienzo(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

let fondo = null;

function perfil(x, semilla, amp, base) {
  // Suma de senos: crestas de sierra suaves pero con carácter.
  return Math.round(
    base
      - amp * (0.55 * Math.sin(x * 0.021 + semilla) + 0.3 * Math.sin(x * 0.057 + semilla * 2.3) + 0.15 * Math.sin(x * 0.13 + semilla * 5.1)),
  );
}

function hornearFondo() {
  fondo = lienzo(W, H);
  const c = fondo.getContext('2d');
  c.imageSmoothingEnabled = false;

  // Cielo por bandas; cada frontera lleva 2 filas de trama en damero.
  const bandaH = HORIZONTE / CIELO.length;
  for (let i = 0; i < CIELO.length; i++) {
    const y0 = Math.round(i * bandaH);
    const y1 = Math.round((i + 1) * bandaH);
    c.fillStyle = CIELO[i];
    c.fillRect(0, y0, W, y1 - y0);
    if (i > 0) {
      c.fillStyle = CIELO[i - 1];
      for (let y = y0; y < y0 + 2; y++) for (let x = (y + i) % 2; x < W; x += 2) if (y === y0 || x % 4 === (y + i) % 4) c.fillRect(x, y, 1, 1);
    }
  }

  // Sol poniéndose detrás de la sierra, a la derecha, con halo tramado.
  const sx = 296, sy = 128;
  for (let y = sy - 34; y <= sy + 34; y++) {
    for (let x = sx - 34; x <= sx + 34; x++) {
      const d = Math.hypot(x - sx, y - sy);
      if (d < 19) c.fillStyle = '#fff3c4';
      else if (d < 21) c.fillStyle = '#ffe49a';
      else if (d < 27 && (x + y) % 2 === 0) c.fillStyle = '#fde09a';
      else if (d < 33 && (x + y) % 4 === 0) c.fillStyle = '#fcd27f';
      else continue;
      c.fillRect(x, y, 1, 1);
    }
  }

  // Nubes alargadas: vetas horizontales con canto iluminado abajo.
  const nubes = [
    [40, 34, 70, '#9a4a74', '#c4607a'], [150, 22, 54, '#7c3f70', '#a44f74'], [230, 52, 90, '#c05a6e', '#e88068'],
    [20, 74, 60, '#d86c68', '#f39a66'], [300, 86, 70, '#e4805f', '#fbb56a'], [120, 96, 46, '#ec905f', '#fcc070'],
  ];
  for (const [x, y, w, cuerpo, luz] of nubes) {
    c.fillStyle = cuerpo;
    c.fillRect(x + 6, y, w - 12, 1);
    c.fillRect(x, y + 1, w, 2);
    c.fillRect(x + 10, y - 1, Math.floor(w / 3), 1);
    c.fillStyle = luz;
    c.fillRect(x + 3, y + 3, w - 6, 1);
  }

  // Sierra lejana (azul violácea) y lomas cercanas (más oscuras), con canto cálido de luz.
  const capas = [
    { base: 138, amp: 16, s: 1.7, color: '#8b567e', canto: '#c0707a' },
    { base: 146, amp: 9, s: 4.2, color: '#643c68', canto: '#9a5670' },
  ];
  for (const k of capas) {
    for (let x = 0; x < W; x++) {
      const y = perfil(x, k.s, k.amp, k.base);
      c.fillStyle = k.color;
      c.fillRect(x, y, 1, H - y);
      c.fillStyle = k.canto;
      c.fillRect(x, y, 1, 1);
    }
  }

  // El campo: llano con surcos que se abren hacia abajo y bancales.
  c.fillStyle = '#4a3058';
  c.fillRect(0, HORIZONTE, W, H - HORIZONTE);
  const campo = ['#4a3058', '#432b52', '#3c274b', '#352244', '#2e1e3c'];
  let y = HORIZONTE;
  let paso = 3;
  let i = 0;
  while (y < H) {
    c.fillStyle = campo[Math.min(campo.length - 1, Math.floor(i / 2))];
    c.fillRect(0, y, W, paso);
    c.fillStyle = '#5a3a62';
    if (i < 6) for (let x = (i * 7) % 11; x < W; x += 11) c.fillRect(x, y, 5, 1);
    y += paso;
    paso += 1;
    i++;
  }
  // Luz rasante del sol sobre el llano.
  c.fillStyle = '#7a4a6a';
  c.fillRect(0, HORIZONTE, W, 1);

  // Árboles del Campo (almendros y algarrobos) en silueta.
  const r = rng(7);
  for (let n = 0; n < 16; n++) {
    const tx = Math.floor(r() * W);
    const ty = HORIZONTE + 2 + Math.floor(r() * 18);
    const tam = ty < HORIZONTE + 8 ? 2 : 3;
    c.fillStyle = '#2c1d38';
    c.fillRect(tx - tam, ty - tam, tam * 2 + 1, tam);
    c.fillRect(tx - tam + 1, ty - tam - 1, tam * 2 - 1, 1);
    c.fillRect(tx, ty, 1, 2);
  }

  // Molinos lejanos sobre el horizonte (velas quietas: se ven como estrellas).
  for (const [mx, my, esc] of [[168, HORIZONTE + 1, 1], [236, HORIZONTE + 3, 1], [352, HORIZONTE + 2, 1]]) {
    molinoLejano(c, mx, my, esc);
  }
}

function molinoLejano(c, x, y, s) {
  c.fillStyle = '#3a2648';
  c.fillRect(x - 2 * s, y - 8 * s, 5 * s, 8 * s);
  c.fillRect(x - 1 * s, y - 10 * s, 3 * s, 2 * s);
  c.fillStyle = '#e8a07a';
  c.fillRect(x + 2 * s, y - 8 * s, 1 * s, 8 * s); // canto con sol
  c.fillStyle = '#3a2648';
  for (let k = -5; k <= 5; k++) {
    c.fillRect(x + k, y - 10 + k, 1, 1);
    c.fillRect(x + k, y - 10 - k, 1, 1);
  }
}

// ---- Molino grande con velas que giran --------------------------------------------------------

function trianguloPx(c, a, b, d, color) {
  const minX = Math.floor(Math.min(a[0], b[0], d[0]));
  const maxX = Math.ceil(Math.max(a[0], b[0], d[0]));
  const minY = Math.floor(Math.min(a[1], b[1], d[1]));
  const maxY = Math.ceil(Math.max(a[1], b[1], d[1]));
  const lado = (p, q, x, y) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  c.fillStyle = color;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const s1 = lado(a, b, px, py), s2 = lado(b, d, px, py), s3 = lado(d, a, px, py);
      if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) c.fillRect(x, y, 1, 1);
    }
  }
}

function lineaPx(c, x0, y0, x1, y1, color) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  c.fillStyle = color;
  for (;;) {
    c.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

const TORRE = { x: 46, base: 200, alto: 70, anchoAbajo: 26, anchoArriba: 20 };

function pintarMolino(c, t) {
  const { x, base, alto, anchoAbajo, anchoArriba } = TORRE;
  const arriba = base - alto;
  // Torre encalada en contraluz: cara en sombra lila, canto derecho encendido por el sol.
  for (let y = arriba; y < base; y++) {
    const f = (y - arriba) / alto;
    const w = Math.round(anchoArriba + (anchoAbajo - anchoArriba) * f);
    const x0 = x - Math.floor(w / 2);
    c.fillStyle = '#6a4a78';
    c.fillRect(x0, y, w, 1);
    c.fillStyle = '#8a6490';
    c.fillRect(x0 + w - 5, y, 3, 1);
    c.fillStyle = '#f0b48a';
    c.fillRect(x0 + w - 2, y, 2, 1);
    c.fillStyle = '#3b2a44';
    c.fillRect(x0, y, 1, 1);
  }
  // Puerta y ventanuco.
  c.fillStyle = '#2e2036';
  c.fillRect(x - 3, base - 12, 6, 12);
  c.fillRect(x - 4, base - 11, 8, 11);
  c.fillRect(x + 1, arriba + 20, 3, 4);
  // Tejado cónico de madera.
  for (let k = 0; k < 12; k++) {
    const w = Math.max(1, Math.round((anchoArriba + 4) * (k / 11)));
    c.fillStyle = k === 11 ? '#2e2036' : '#4a3040';
    c.fillRect(x - Math.floor(w / 2), arriba - 12 + k, w, 1);
    c.fillStyle = '#c47a62';
    c.fillRect(x - Math.floor(w / 2) + w - 1, arriba - 12 + k, 1, 1);
  }
  // Velas: ocho palos, cada uno con su vela latina triangular.
  const hx = x + 1, hy = arriba - 6;
  const R = 44;
  const giro = preferencias.movimientoReducido ? 0.3 : 0.3 + t * 0.006;
  const velas = [];
  for (let k = 0; k < 8; k++) {
    const a = giro + (k * Math.PI) / 4;
    const tip = [hx + Math.cos(a) * R, hy + Math.sin(a) * R];
    const raiz = [hx + Math.cos(a) * 8, hy + Math.sin(a) * 8];
    const a2 = a + 0.42;
    const pun = [hx + Math.cos(a2) * R * 0.8, hy + Math.sin(a2) * R * 0.8];
    velas.push({ a, tip, raiz, pun });
  }
  for (const v of velas) {
    trianguloPx(c, v.raiz, v.tip, v.pun, '#f6d8bc');
    // Sombra de la tela: media vela del lado de la escota, más oscura.
    const mid = [(v.raiz[0] + v.tip[0]) / 2, (v.raiz[1] + v.tip[1]) / 2];
    trianguloPx(c, mid, v.tip, v.pun, '#d9a896');
  }
  for (const v of velas) {
    lineaPx(c, hx, hy, v.tip[0], v.tip[1], '#3b2a30');
    lineaPx(c, v.tip[0], v.tip[1], v.pun[0], v.pun[1], '#9a6a6a');
  }
  // Cable entre puntas (los molinos del Campo lo llevan) y el eje.
  for (let k = 0; k < 8; k++) {
    const p = velas[k].tip, q = velas[(k + 1) % 8].tip;
    lineaPx(c, p[0], p[1], q[0], q[1], '#8a5a78');
  }
  c.fillStyle = '#2e2036';
  c.fillRect(hx - 2, hy - 2, 5, 5);
  c.fillStyle = '#c47a62';
  c.fillRect(hx - 1, hy - 1, 2, 2);
}

// ---- Estrellas --------------------------------------------------------------------------------

const ESTRELLAS = (() => {
  const r = rng(21);
  const l = [];
  for (let i = 0; i < 26; i++) l.push([Math.floor(r() * W), Math.floor(r() * 44), Math.floor(r() * 90)]);
  return l;
})();

// ---- Botón A dibujado -------------------------------------------------------------------------

// Botón redondo de 13×13: contorno, cuerpo, sombra abajo a la derecha y brillo arriba a la izquierda.
const BOTON_A = (() => {
  const n = 13, r = 6.5, filas = [];
  for (let y = 0; y < n; y++) {
    let f = '';
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x + 0.5 - r, y + 0.5 - r);
      if (d > r) f += '.';
      else if (d > r - 1.2) f += 'o';
      else if (x + y > 15) f += 's';
      else if (d < 4.2 && x < 5 && y < 5 && x + y < 7) f += 'w';
      else f += 'g';
    }
    filas.push(f);
  }
  return filas;
})();

function pintarBotonA(c, x, y) {
  sprite(c, BOTON_A, x, y, { o: MARRON, g: '#5fb84a', w: '#a8e68a', s: '#3e8a36' });
  // La A queda centrada: mayúsculas de 7 px en las filas 3-9 de la celda, botón de 13 px.
  texto(c, 'A', x + 4, y, '#fff8ec', { sombra: '#2c6a2a' });
}

// ---- Título y cinta ---------------------------------------------------------------------------

let spriteTitulo = null;

function hornearTitulo() {
  // Letra de 4 px por píxel de glifo, engordada 2 px (trazos de 6 px) para que aguante como logo.
  const ESC = 4, ESP = 1, D = 2, G = 2, E = 4;
  const titulo = 'LOS BELONES';
  const tw = medir(titulo, ESC, ESP) + D;
  const alto = 7 * ESC + D;
  spriteTitulo = lienzo(tw + G * 2, alto + G * 2 + E);
  const c = spriteTitulo.getContext('2d');
  c.imageSmoothingEnabled = false;
  const ox = G, oy = G - ARRIBA * ESC; // la celda empieza 3 filas por encima de las mayúsculas
  const op = { sombra: null, escala: ESC, espacio: ESP };
  const grueso = (x, y, color) => {
    for (let dy = 0; dy <= D; dy++) for (let dx = 0; dx <= D; dx++) texto(c, titulo, x + dx, y + dy, color, op);
  };
  // Contorno marrón alrededor de la letra y extrusión hacia abajo en el mismo marrón.
  for (let dy = -G; dy <= E + G; dy += 1) for (let dx = -G; dx <= G; dx += 1) texto(c, titulo, ox + dx, oy + dy, MARRON, op);
  for (let dy = -G + D; dy <= E + G + D; dy += 1) for (let dx = -G + D; dx <= G + D; dx += 1) texto(c, titulo, ox + dx, oy + dy, MARRON, op);
  // Relleno en franjas: crema arriba, oro en medio, naranja claro abajo, brillo en la primera fila.
  const franjas = [[0, 11, '#fff4dc'], [11, 10, '#ffd25e'], [21, alto - 21, '#f7a24e'], [0, 2, '#ffffff']];
  for (const [y0, h, color] of franjas) {
    c.save();
    c.beginPath();
    c.rect(0, G + y0, spriteTitulo.width, h);
    c.clip();
    grueso(ox, oy, color);
    c.restore();
  }
}

// Cinta de acento con los extremos en cola de golondrina.
function pintarCinta(c, cx, y, str) {
  const w = medir(str) + 28;
  const h = 15;
  const x = cx - Math.floor(w / 2);
  // Colas que asoman detrás, más bajas y oscuras, con muesca en cola de golondrina.
  const colaH = h, colaW = 14, colaY = y + 4;
  for (const lado of [-1, 1]) {
    for (let r = 0; r < colaH; r++) {
      const muesca = Math.max(0, 4 - Math.abs(r - (colaH >> 1))); // hasta 4 px de entrante
      const x0 = lado < 0 ? x - 10 + muesca : x + w - 4;
      const ancho = colaW - muesca;
      const borde = r === 0 || r === colaH - 1;
      c.fillStyle = MARRON;
      c.fillRect(x0, colaY + r, ancho, 1);
      if (!borde) {
        c.fillStyle = ACENTO_SOMBRA;
        if (lado < 0) c.fillRect(x0 + 2, colaY + r, ancho - 2, 1);
        else c.fillRect(x0, colaY + r, ancho - 2, 1);
      }
    }
  }
  caja(c, x, y, w, h, { relleno: ACENTO, borde: MARRON, brillo: '#f59a5e', sombraInt: ACENTO_SOMBRA, sombra: null, r: 2 });
  texto(c, str, cx, y + 1, '#fff8ec', { alinear: 'centro', sombra: ACENTO_SOMBRA });
}

// ---- Pantalla ---------------------------------------------------------------------------------

/**
 * Pinta la pantalla de título.
 * t = fotogramas desde que se abrió; opciones = array de strings (vacío → «Pulsa A»); sel = índice.
 */
export function pintarTitulo(ctx, t = 0, opciones = [], sel = 0) {
  ctx.imageSmoothingEnabled = false;
  if (!fondo) hornearFondo();
  ctx.drawImage(fondo, 0, 0);
  const reducido = preferencias.movimientoReducido;

  // Estrellas que titilan en lo alto.
  for (const [x, y, f] of ESTRELLAS) {
    const fase = (t + f * 7) % 120;
    ctx.fillStyle = fase < 8 && !reducido ? '#ffffff' : '#e8d8ff';
    ctx.fillRect(x, y, 1, 1);
    if (fase < 4 && !reducido) {
      ctx.fillStyle = '#e8d8ff80';
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
    }
  }

  pintarMolino(ctx, t);

  // Título (sprite horneado una vez) que cae con un rebote corto al abrir.
  if (!spriteTitulo) hornearTitulo();
  const cx = Math.round(W / 2) + 8;
  const entrada = reducido ? 1 : rebote(Math.min(1, t / 36));
  const ty = Math.round(24 - (1 - entrada) * 70);
  ctx.drawImage(spriteTitulo, cx - Math.floor(spriteTitulo.width / 2), ty);

  // Subtítulo sobre una cinta.
  const aparece = reducido ? 1 : Math.max(0, Math.min(1, (t - 24) / 16));
  if (aparece > 0) {
    const previo = ctx.globalAlpha;
    ctx.globalAlpha = previo * aparece;
    pintarCinta(ctx, cx, ty + spriteTitulo.height + 4, 'Una aventura en el Campo de Cartagena');
    ctx.globalAlpha = previo;
  }

  // Menú o «Pulsa A».
  const menuY = 138;
  if (!opciones || opciones.length === 0) {
    const visible = reducido ? t % 90 < 70 : t % 60 < 42;
    if (visible && t > 30) {
      const hueco = 4;
      const wa = medir('Pulsa'), wb = medir('para empezar');
      const w = wa + hueco + BOTON_A.length + hueco + wb;
      const x0 = cx - Math.floor(w / 2);
      const y = menuY + 14;
      const estilo = { contorno: MARRON, sombra: '#2a1a2280' };
      texto(ctx, 'Pulsa', x0, y, '#fff4dc', estilo);
      pintarBotonA(ctx, x0 + wa + hueco, y);
      texto(ctx, 'para empezar', x0 + wa + hueco + BOTON_A.length + hueco, y, '#fff4dc', estilo);
    }
  } else {
    const anchoMenu = Math.max(112, ...opciones.map((o) => medir(o) + 40));
    const paso = 18;
    const y0 = menuY + Math.max(0, Math.round((3 - opciones.length) * paso / 2));
    opciones.forEach((op, i) => {
      const y = y0 + i * paso;
      if (i === sel) {
        const x = cx - Math.floor(anchoMenu / 2);
        caja(ctx, x, y - 1, anchoMenu, 17);
        const bote = reducido ? 0 : Math.round(Math.sin(t * 0.16) * 1.5);
        texto(ctx, '►', x + 7 + bote, y + 1, ACENTO, { sombra: null });
        texto(ctx, op, cx, y + 1, MARRON, { alinear: 'centro', sombra: null });
      } else {
        texto(ctx, op, cx, y + 1, '#fff4dc', { alinear: 'centro', contorno: MARRON, sombra: '#2a1a2280' });
      }
    });
  }

  texto(ctx, 'v0.1', W - 6, H - ALTO_LINEA - 2, '#a07a98', { alinear: 'der', sombra: null });
}
