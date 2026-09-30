// Capturas deterministas del juego.
// Uso: node tests/shots.mjs <carpeta> [--semilla=1] [--en=i,j] [--pasos=60] [--titulo] [--ancho=1152 --alto=648]
// Necesita el servidor de desarrollo en $GAME_URL (por defecto http://localhost:5173/).
import puppeteer from 'puppeteer';
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(3).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const carpeta = process.argv[2] || 'tests/out/shots';
const URL = process.env.GAME_URL || 'http://localhost:5173/';
fs.mkdirSync(carpeta, { recursive: true });

const nav = await puppeteer.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const pag = await nav.newPage();
const errores = [];
pag.on('pageerror', (e) => errores.push(e.message));
pag.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
await pag.setViewport({ width: +(args.ancho || 1152), height: +(args.alto || 648), deviceScaleFactor: 1 });
await pag.goto(URL + (args.titulo ? '' : '?jugar'), { waitUntil: 'networkidle0' });
await pag.waitForFunction(() => window.__game);
await pag.evaluate(() => { window.__freeze = true; });
if (args.titulo) {
  await pag.screenshot({ path: `${carpeta}/titulo.png` });
} else {
  await pag.evaluate((s) => window.__game.start(s), +(args.semilla || 1));
  if (args.en) { const [i, j] = String(args.en).split(',').map(Number); await pag.evaluate((i, j) => window.__game.teleport(i, j), i, j); }
  const pasos = +(args.pasos || 60);
  await pag.evaluate((n) => window.__game.step(n), pasos);
  await pag.screenshot({ path: `${carpeta}/juego.png` });
}
console.log(errores.length ? 'ERRORES:\n' + errores.join('\n') : 'sin errores', '→', carpeta);
await nav.close();
