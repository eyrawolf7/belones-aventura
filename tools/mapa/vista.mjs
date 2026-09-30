// Plano de referencia del pueblo con los datos reales (Catastro + OSM), para decidir escala y zonas.
// Uso: node tools/mapa/vista.mjs [salida.png] [x0 z0 x1 z1]
// Coordenadas locales en metros: x crece hacia el OESTE (datos heredados), z hacia el NORTE.
// En pantalla se dibuja con el este a la derecha y el norte arriba.
import fs from 'node:fs';
import puppeteer from 'puppeteer';

const D = 'referencias/datos-pueblo/';
const leer = (f) => JSON.parse(fs.readFileSync(D + f, 'utf8'));
const calles = leer('pueblo-calles.json');
const edificios = leer('pueblo-edificios.json');
const { copas } = leer('copas-tiles.json');

const salida = process.argv[2] || 'tests/out/plano.png';
let [x0, z0, x1, z1] = process.argv.slice(3).map(Number);
if (!Number.isFinite(x1)) {
  // encuadre: caja de los edificios
  x0 = z0 = 1e9; x1 = z1 = -1e9;
  for (const b of edificios) { const [x, z] = b.centroid; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  x0 -= 40; z0 -= 40; x1 += 40; z1 += 40;
}
const W = 2400, esc = W / (x1 - x0), H = Math.round((z1 - z0) * esc);
const px = (x) => ((x1 - x) * esc).toFixed(1); // este a la derecha
const pz = (z) => ((z1 - z) * esc).toFixed(1); // norte arriba
const pts = (arr) => arr.map(([x, z]) => `${px(x)},${pz(z)}`).join(' ');

const col = { '1_residential': '#e9d9b8', '3_industrial': '#b9b2a6', '4_2_retail': '#f2a65a', '4_3_publicServices': '#7fb3d5', '4_1_office': '#c39bd3', '2_agriculture': '#a9c77a' };
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#d8cfa0"/>`;
for (const c of calles) svg += `<polyline points="${pts(c.points)}" fill="none" stroke="#8a8a8a" stroke-width="${(c.width || 5) * esc}" stroke-linecap="round" stroke-linejoin="round"/>`;
for (const b of edificios) for (const p of b.polygons) svg += `<polygon points="${pts(p)}" fill="${col[b.use] || '#ddd'}" stroke="#5a4a3a" stroke-width="0.6"/>`;
for (const t of copas) svg += `<circle cx="${px(t.x)}" cy="${pz(t.z)}" r="${t.radio * esc}" fill="#4f8a3c" opacity=".8"/>`;
// cuadrícula de 100 m y nombres de calle
for (let x = Math.ceil(x0 / 100) * 100; x < x1; x += 100) svg += `<line x1="${px(x)}" y1="0" x2="${px(x)}" y2="${H}" stroke="#0003"/><text x="${px(x)}" y="14" font-size="12">${x}</text>`;
for (let z = Math.ceil(z0 / 100) * 100; z < z1; z += 100) svg += `<line x1="0" y1="${pz(z)}" x2="${W}" y2="${pz(z)}" stroke="#0003"/><text x="2" y="${pz(z)}" font-size="12">${z}</text>`;
const vistos = new Set();
for (const c of calles) {
  if (!c.name || vistos.has(c.name)) continue; vistos.add(c.name);
  const [x, z] = c.points[Math.floor(c.points.length / 2)];
  svg += `<text x="${px(x)}" y="${pz(z)}" font-size="11" font-family="sans-serif" fill="#222" stroke="#fff" stroke-width="3" paint-order="stroke">${c.name.replace(/^Calle /, '')}</text>`;
}
svg += '</svg>';

fs.mkdirSync('tests/out', { recursive: true });
const nav = await puppeteer.launch({ headless: true });
const pag = await nav.newPage();
await pag.setViewport({ width: W, height: H });
await pag.setContent(`<body style="margin:0">${svg}</body>`);
await pag.screenshot({ path: salida });
await nav.close();
console.log(`${salida}: ${W}x${H} px, encuadre x ${x0.toFixed(0)}..${x1.toFixed(0)} z ${z0.toFixed(0)}..${z1.toFixed(0)} (${(x1 - x0).toFixed(0)}x${(z1 - z0).toFixed(0)} m)`);
