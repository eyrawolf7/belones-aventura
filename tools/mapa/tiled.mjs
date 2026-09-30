// Genera un mapa de Tiled (public/mapas/<nombre>.tmj) de una zona del pueblo real, con el juego de
// baldosas del catálogo. Se puede abrir y retocar a mano en Tiled (https://www.mapeditor.org).
// Uso: node tools/mapa/tiled.mjs [nombre]   (la zona sale de src/data/vecinos.js → zona)
import fs from 'node:fs';
import { COLUMNAS, FACHADAS, PIEZA, T, TOTAL } from '../arte/catalogo.mjs';
import { zona } from '../../src/data/vecinos.js';

const nombre = process.argv[2] || 'zona';
const m = JSON.parse(fs.readFileSync('src/data/mundo.json', 'utf8'));
const W0 = m.ancho;
const suelo = m.suelo.join('');
const edif = new Uint16Array(Buffer.from(m.edif, 'base64').buffer.slice(0));
const { i0, j0, i1, j1 } = zona;
const W = i1 - i0 + 1, H = j1 - j0 + 1;

const dentroPoly = (pts, x, y) => { let r = false; for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) { const [xa, ya] = pts[a], [xb, yb] = pts[b]; if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) r = !r; } return r; };
const L = (i, j) => { if (i < 0 || j < 0 || i >= W0) return 'c'; const n = j * W0 + i; if (!edif[n] && (zona.plazas || []).some((p) => dentroPoly(p, i + 0.5, j + 0.5))) return 'z'; return suelo[n]; };
const E = (i, j) => (i < 0 || j < 0 || i >= W0 ? 0 : edif[j * W0 + i]);
const h = (i, j, k = 0) => { let x = Math.imul(i, 374761393) + Math.imul(j, 668265263) + k * 97; x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
const hexRGB = (s) => [1, 3, 5].map((k) => parseInt(s.slice(k, k + 2), 16));
const colorFachada = (hex) => {
  if (!hex) return 0;
  const [a, b, c] = hexRGB(hex); let mejor = 0, d0 = 1e9;
  FACHADAS.forEach((f, k) => { const [x, y, z] = hexRGB(f.c); const d = (a - x) ** 2 + (b - y) ** 2 + (c - z) ** 2; if (d < d0) { d0 = d; mejor = k; } });
  return mejor;
};
const puertas = new Set(m.puertas.map(([, i, j]) => i + ',' + j));

const capaSuelo = [], capaEdif = [];
for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
  const l = L(i, j);
  let t;
  if (l === 'a') t = T.asfalto[h(i, j) < 0.8 ? 0 : 1];
  else if (l === 'r') t = T.acera + ((L(i, j - 1) === 'a' ? 1 : 0) | (L(i + 1, j) === 'a' ? 2 : 0) | (L(i, j + 1) === 'a' ? 4 : 0) | (L(i - 1, j) === 'a' ? 8 : 0));
  else if (l === 'z') t = T.plaza[(i + j) % 2];
  else if (l === 'p') t = T.patio;
  else if (l === 'm') { const no = (a, b) => L(a, b) !== 'm' && !E(a, b); t = T.muro + ((no(i, j - 1) ? 1 : 0) | (no(i + 1, j) ? 2 : 0) | (no(i, j + 1) ? 4 : 0) | (no(i - 1, j) ? 8 : 0)); }
  else if (l === 's') t = h(i, j, 1) < 0.35 ? T.hierba[h(i, j, 2) < 0.5 ? 0 : 1] : T.tierra[(h(i, j, 3) * 3) | 0];
  else t = T.tierra[(h(i, j, 3) * 3) | 0];
  capaSuelo.push(t + 1);

  // edificio: fachada en las filas de abajo de cada columna, tejado en el resto
  const e = E(i, j);
  if (!e) { capaEdif.push(0); continue; }
  const ed = m.edificios[e - 1], a = ed.aspecto || {};
  let d = 0; while (E(i, j + d + 1) === e) d++; // baldosas del mismo edificio por debajo
  let alto = 1; while (E(i, j - alto) === e) alto++; // profundidad de la columna
  const F = Math.max(1, Math.min(ed.plantas || 1, 3, alto - 1 || 1));
  const col = colorFachada(a.color);
  if (d < F) {
    let pieza;
    if (d === 0) {
      if (puertas.has(i + ',' + j)) pieza = a.bajo === 'garage' ? PIEZA.garaje : PIEZA.puerta;
      else if (a.bajo === 'shop' || a.bajo === 'bar' || a.bajo === 'office') pieza = PIEZA.escaparate;
      else pieza = [PIEZA.ventana, PIEZA.persiana, PIEZA.pared][(i + ((h(e, 0) * 3) | 0)) % 3];
    } else pieza = a.balcon && (i + e) % 2 === 0 ? PIEZA.balcon : [PIEZA.ventanaAlta, PIEZA.persianaAlta, PIEZA.paredAlta][(i + e) % 3];
    capaEdif.push(T.fachada(col, pieza) + 1);
  } else {
    const teja = a.tejado === 'tile';
    const esTecho = (x, y) => E(x, y) === e && (() => { let dd = 0; while (E(x, y + dd + 1) === e) dd++; return dd >= F; })();
    const mask = (esTecho(i, j - 1) ? 0 : 1) | (esTecho(i + 1, j) ? 0 : 2) | (esTecho(i, j + 1) ? 0 : 4) | (esTecho(i - 1, j) ? 0 : 8);
    capaEdif.push((teja ? T.teja : T.azotea) + mask + 1);
  }
}

// objetos: vecinos, árboles y puertas (para colocar sprites y, en el futuro, editarlos en Tiled)
let id = 1;
const objetos = [];
for (const [i, j, r] of m.arboles) if (i >= i0 && i <= i1 && j >= j0 && j <= j1) objetos.push({ id: id++, name: 'arbol', type: 'arbol', x: (i - i0) * 16 + 8, y: (j - j0) * 16 + 14, width: 0, height: 0, point: true, properties: [{ name: 'radio', type: 'int', value: r }] });
for (const [e, i, j] of m.puertas) if (i >= i0 && i <= i1 && j >= j0 && j <= j1) objetos.push({ id: id++, name: 'puerta', type: 'puerta', x: (i - i0) * 16, y: (j - j0) * 16, width: 16, height: 16, properties: [{ name: 'ref', type: 'string', value: m.edificios[e].ref }] });

const filas = Math.ceil(TOTAL / COLUMNAS);
const mapa = {
  type: 'map', version: '1.10', tiledversion: '1.11.0', orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H, tilewidth: 16, tileheight: 16, infinite: false, nextlayerid: 4, nextobjectid: id,
  properties: [{ name: 'origen_i', type: 'int', value: i0 }, { name: 'origen_j', type: 'int', value: j0 }],
  tilesets: [{ firstgid: 1, name: 'pueblo', image: 'pueblo.png', imagewidth: COLUMNAS * 16, imageheight: filas * 16, tilewidth: 16, tileheight: 16, tilecount: COLUMNAS * filas, columns: COLUMNAS, margin: 0, spacing: 0 }],
  layers: [
    { id: 1, name: 'suelo', type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: capaSuelo },
    { id: 2, name: 'edificios', type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: capaEdif },
    { id: 3, name: 'objetos', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: objetos },
  ],
};
fs.writeFileSync(`public/mapas/${nombre}.tmj`, JSON.stringify(mapa));
console.log(`public/mapas/${nombre}.tmj ${W}x${H} baldosas, ${objetos.length} objetos`);
