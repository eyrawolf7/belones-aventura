// Ortofoto PNOA (IGN) de una zona del mundo en baldosas, con los datos encima para comprobar que encajan.
// Uso: node tools/mapa/orto.mjs <nombre> <i0> <j0> <i1> <j1> [--sin-capas]
// Escribe referencias/orto/<nombre>.jpg (foto, 8 px por baldosa = 4 px/m) y <nombre>-capas.png.
import fs from 'node:fs';
import puppeteer from 'puppeteer';

const [nombre, i0, j0, i1, j1] = [process.argv[2], ...process.argv.slice(3, 7).map(Number)];
const mundo = JSON.parse(fs.readFileSync('src/data/mundo.json', 'utf8'));
const O = { lat: 37.6245297, lon: -0.782515 }; // origen local heredado
const cosl = Math.cos((O.lat * Math.PI) / 180);
// baldosa → metros locales (x hacia el oeste, z hacia el norte) → lat/lon
const aLL = (i, j) => { const x = mundo.origen.xOeste - i * mundo.baldosaM, z = mundo.origen.zNorte - j * mundo.baldosaM; return [O.lat + z / 111320, O.lon - x / (111320 * cosl)]; };
const [latN, lonO] = aLL(i0, j0), [latS, lonE] = aLL(i1, j1);
const PXB = 8, W = (i1 - i0) * PXB, H = (j1 - j0) * PXB;
const url = `https://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=OI.OrthoimageCoverage&STYLES=&CRS=EPSG:4326&BBOX=${latS},${lonO},${latN},${lonE}&WIDTH=${W}&HEIGHT=${H}&FORMAT=image/jpeg`;
const r = await fetch(url);
if (!r.ok) throw new Error('PNOA ' + r.status);
fs.mkdirSync('referencias/orto', { recursive: true });
const foto = `referencias/orto/${nombre}.jpg`;
fs.writeFileSync(foto, Buffer.from(await r.arrayBuffer()));
console.log(foto, W + 'x' + H, 'bbox', latS.toFixed(6), lonO.toFixed(6), latN.toFixed(6), lonE.toFixed(6));
if (process.argv.includes('--sin-capas')) process.exit(0);

const b64 = fs.readFileSync(foto).toString('base64');
const px = (i) => (i - i0) * PXB, py = (j) => (j - j0) * PXB;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><image href="data:image/jpeg;base64,${b64}" width="${W}" height="${H}"/>`;
for (const v of mundo.vias) svg += `<polyline points="${v.p.map(([x, y]) => px(x) + ',' + py(y)).join(' ')}" fill="none" stroke="#ff0" stroke-width="2" opacity=".8"/>`;
for (const e of mundo.edificios) for (const p of e.polys) svg += `<polygon points="${p.map(([x, y]) => px(x) + ',' + py(y)).join(' ')}" fill="none" stroke="#0ff" stroke-width="1.5"/>`;
for (const [i, j, rr] of mundo.arboles) svg += `<circle cx="${px(i + 0.5)}" cy="${py(j + 0.5)}" r="${rr * PXB}" fill="none" stroke="#0f0" stroke-width="2"/>`;
for (const c of mundo.calles) svg += `<text x="${px(c.i)}" y="${py(c.j)}" font-size="14" font-family="sans-serif" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${c.nombre}</text>`;
for (let i = Math.ceil(i0 / 10) * 10; i < i1; i += 10) svg += `<text x="${px(i)}" y="12" font-size="11" fill="#fff" stroke="#000" stroke-width="2" paint-order="stroke">${i}</text>`;
for (let j = Math.ceil(j0 / 10) * 10; j < j1; j += 10) svg += `<text x="2" y="${py(j)}" font-size="11" fill="#fff" stroke="#000" stroke-width="2" paint-order="stroke">${j}</text>`;
svg += '</svg>';
const nav = await puppeteer.launch({ headless: true });
const pag = await nav.newPage();
await pag.setViewport({ width: W, height: H });
await pag.setContent(`<body style="margin:0">${svg}</body>`);
await pag.screenshot({ path: `referencias/orto/${nombre}-capas.png` });
await nav.close();
console.log(`referencias/orto/${nombre}-capas.png`);
