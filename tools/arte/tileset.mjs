// Pinta el juego de baldosas PROVISIONAL (public/mapas/pueblo.png) píxel a píxel en un canvas de Chrome.
// Estilo: pixel art moderno a color, 16 px, contorno oscuro suave. Uso: node tools/arte/tileset.mjs
import fs from 'node:fs';
import puppeteer from 'puppeteer';
import { COLUMNAS, FACHADAS, T, TOTAL } from './catalogo.mjs';

const filas = Math.ceil(TOTAL / COLUMNAS);
const nav = await puppeteer.launch({ headless: true });
const pag = await nav.newPage();
const png = await pag.evaluate((COLUMNAS, filas, FACHADAS, T) => {
  const c = document.createElement('canvas'); c.width = COLUMNAS * 16; c.height = filas * 16;
  const g = c.getContext('2d');
  let semilla = 1; const r = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mezcla = (h, f) => { const [a, b, d] = hex(h); const k = (v) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f))); return `rgb(${k(a)},${k(b)},${k(d)})`; };
  let ox = 0, oy = 0;
  const en = (idx) => { ox = (idx % COLUMNAS) * 16; oy = Math.floor(idx / COLUMNAS) * 16; };
  const p = (x, y, col, w = 1, h = 1) => { const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(16, x + w), y1 = Math.min(16, y + h); if (x1 <= x0 || y1 <= y0) return; g.fillStyle = col; g.fillRect(ox + x0, oy + y0, x1 - x0, y1 - y0); };
  const salpicar = (base, tonos, n) => { p(0, 0, base, 16, 16); for (let k = 0; k < n; k++) p((r() * 16) | 0, (r() * 16) | 0, tonos[(r() * tonos.length) | 0]); };

  // --- suelos
  T.tierra.forEach((i, v) => { en(i); salpicar('#d9b47a', ['#c9a066', '#e6c890', '#c29a62'], 18 + v * 6); if (v === 2) { p(4, 9, '#b08a58', 2, 1); p(11, 4, '#e9d2a2', 1, 1); } });
  T.hierba.forEach((i, v) => { en(i); salpicar('#86bf52', ['#6fa843', '#9cd064', '#78b24a'], 26); for (let k = 0; k < 4 + v * 3; k++) { const x = (r() * 14) | 0, y = (r() * 13) | 0; p(x, y + 1, '#5e9a3a'); p(x + 1, y, '#5e9a3a'); p(x + 2, y + 1, '#5e9a3a'); } });
  T.asfalto.forEach((i, v) => { en(i); salpicar('#6b707d', ['#5f6470', '#787d8a', '#646874'], 30 + v * 10); });
  for (let m = 0; m < 16; m++) { // acera con bordillo hacia los lados donde hay asfalto
    en(T.acera + m); p(0, 0, '#e8dec8', 16, 16);
    for (let k = 0; k < 16; k += 8) { p(k, 0, '#d4c7aa', 1, 16); p(0, k, '#d4c7aa', 16, 1); }
    p(3, 5, '#efe7d4'); p(12, 11, '#dcd0b6');
    if (m & 1) { p(0, 0, '#f6f2e8', 16, 3); p(0, 3, '#b3a78e', 16, 1); }
    if (m & 4) { p(0, 13, '#f6f2e8', 16, 3); p(0, 12, '#b3a78e', 16, 1); p(0, 15, '#9a8f78', 16, 1); }
    if (m & 8) { p(0, 0, '#f6f2e8', 3, 16); p(3, 0, '#b3a78e', 1, 16); }
    if (m & 2) { p(13, 0, '#f6f2e8', 3, 16); p(12, 0, '#b3a78e', 1, 16); }
  }
  T.plaza.forEach((i, v) => { // ladrillo en espiga: ladrillos de 4×2 px que alternan en escalera, con junta clara
    en(i);
    const ton = ['#c8704a', '#d07a52', '#c06843', '#cc744d'];
    const id = (x, y) => { // devuelve [id del ladrillo, ¿junta?]
      const k = Math.floor((x - y + 64) / 4); // franja diagonal
      if (k % 2 === 0) { const f = Math.floor(y / 2), c = Math.floor((x - (f % 2) * 2 + 64) / 4); return [c * 31 + f * 7 + 1, (y % 2 === 1) || ((x - (f % 2) * 2 + 64) % 4 === 3)]; }
      const c = Math.floor(x / 2), f = Math.floor((y - (c % 2) * 2 + 64) / 4); return [c * 13 + f * 29 + 2, (x % 2 === 1) || ((y - (c % 2) * 2 + 64) % 4 === 3)];
    };
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const [n, junta] = id(x + v * 16, y);
      p(x, y, junta ? '#d99a74' : ton[((n * 2654435761) >>> 0) % 4]);
    }
  });
  en(T.franja); salpicar('#a7a6a4', ['#9b9a98', '#b3b2af'], 20); for (let k = 0; k < 16; k += 5) p(0, k, '#8f8e8c', 16, 1);
  en(T.patio); p(0, 0, '#d9a47c', 16, 16); for (let k = 0; k < 16; k += 5) { p(k, 0, '#bf8a64', 1, 16); p(0, k, '#bf8a64', 16, 1); }
  en(T.paso); p(0, 0, '#6b707d', 16, 16); for (let k = 1; k < 16; k += 5) p(k, 0, '#f2f0ea', 3, 16);

  // --- fachadas
  FACHADAS.forEach(({ c: base }, ci) => {
    const osc = mezcla(base, 0.82), mas = mezcla(base, 0.68), luz = mezcla(base, 1.06);
    const pared = (alta) => { p(0, 0, base, 16, 16); for (let k = 0; k < 10; k++) p((r() * 16) | 0, (r() * 16) | 0, k % 2 ? osc : luz); if (!alta) { p(0, 12, mas, 16, 4); p(0, 12, osc, 16, 1); } p(0, 0, mas, 16, 1); };
    const ventana = (y, persiana) => {
      p(4, y, '#f4f2ec', 8, 8); p(5, y + 1, '#3a4c60', 6, 6); p(5, y + 1, '#56708a', 2, 3); p(4, y + 8, '#d9d4c8', 8, 1);
      if (persiana) { for (let k = 0; k < 3; k++) p(5, y + 1 + k * 1, k % 2 ? '#4a7a44' : '#5f9456', 6, 1); }
      p(7, y + 1, '#2c3a4a', 1, 6);
    };
    const pz = (n) => en(32 + ci * 16 + n);
    pz(0); pared(false);
    pz(1); pared(false); ventana(3, false);
    pz(2); pared(false); ventana(3, true);
    pz(3); pared(false); p(4, 3, '#4a2e1c', 8, 13); p(5, 4, '#8a5532', 6, 12); p(5, 4, '#9e6640', 3, 12); p(9, 10, '#e2c060');
    pz(4); pared(false); p(1, 3, '#2f2f33', 14, 10); p(2, 4, '#4f6478', 12, 8); p(2, 4, '#7890a6', 4, 4); p(8, 4, '#2f2f33', 1, 8);
    pz(5); pared(false); p(1, 3, '#6a6a6e', 14, 13); for (let k = 4; k < 16; k += 2) p(2, k, '#a9a9ad', 12, 1);
    pz(8); pared(true);
    pz(9); pared(true); ventana(4, false);
    pz(10); pared(true); ventana(4, true);
    pz(11); pared(true); ventana(3, true); p(2, 11, '#2b2b2e', 12, 1); for (let k = 2; k < 14; k += 2) p(k, 11, '#2b2b2e', 1, 4); p(2, 14, '#2b2b2e', 12, 1);
  });

  // --- tejados (máscara de bordes: N1 E2 S4 O8)
  for (let m = 0; m < 16; m++) {
    en(T.teja + m); p(0, 0, '#c4623f', 16, 16);
    for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? -2 : 0; x < 16; x += 4) { p(x, y, '#d97b52', 3, 1); p(x + 3, y, '#9e4a30', 1, 3); p(x, y + 3, '#a9533a', 4, 1); }
    if (m & 1) { p(0, 0, '#7a3422', 16, 1); p(0, 1, '#e48c62', 16, 1); }
    if (m & 4) { p(0, 13, '#8e3f2a', 16, 2); p(0, 15, '#5a2618', 16, 1); }
    if (m & 8) { p(0, 0, '#7a3422', 1, 16); }
    if (m & 2) { p(15, 0, '#6a2c1c', 1, 16); }
  }
  for (let m = 0; m < 16; m++) {
    en(T.azotea + m); salpicar('#dcd6c7', ['#d2ccbd', '#e4dfd2'], 14);
    for (let k = 0; k < 16; k += 8) { p(k, 0, '#cdc6b6', 1, 16); p(0, k, '#cdc6b6', 16, 1); }
    if (m & 1) { p(0, 0, '#f2eee4', 16, 3); p(0, 3, '#b9b2a3', 16, 1); }
    if (m & 4) { p(0, 13, '#f2eee4', 16, 3); p(0, 15, '#9e978a', 16, 1); }
    if (m & 8) { p(0, 0, '#f2eee4', 3, 16); p(3, 0, '#b9b2a3', 1, 16); }
    if (m & 2) { p(13, 0, '#f2eee4', 3, 16); p(12, 0, '#b9b2a3', 1, 16); }
  }
  for (let m = 0; m < 16; m++) {
    en(T.muro + m); p(0, 0, '#f3efe6', 16, 16); p(0, 0, '#e3ddd0', 16, 1);
    if (m & 4) { p(0, 8, '#e6e0d3', 16, 8); p(0, 8, '#cfc7b8', 16, 1); p(0, 13, '#c7bfae', 16, 3); }
    if (m & 1) p(0, 0, '#b9b1a2', 16, 1); if (m & 8) p(0, 0, '#b9b1a2', 1, 16); if (m & 2) p(15, 0, '#b9b1a2', 1, 16);
  }
  return c.toDataURL('image/png');
}, COLUMNAS, filas, FACHADAS, T);
await nav.close();
fs.mkdirSync('public/mapas', { recursive: true });
fs.writeFileSync('public/mapas/pueblo.png', Buffer.from(png.split(',')[1], 'base64'));
fs.writeFileSync('public/mapas/pueblo.tsj', JSON.stringify({
  name: 'pueblo', type: 'tileset', version: '1.10', tiledversion: '1.11.0',
  image: 'pueblo.png', imagewidth: COLUMNAS * 16, imageheight: filas * 16, tilewidth: 16, tileheight: 16, tilecount: COLUMNAS * filas, columns: COLUMNAS, margin: 0, spacing: 0,
}, null, 1));
console.log('public/mapas/pueblo.png', COLUMNAS * 16 + 'x' + filas * 16);
