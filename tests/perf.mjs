// Coste de dibujo de la escena 3D (llamadas, triángulos) y fps orientativos en Chrome sin cabeza.
import puppeteer from 'puppeteer';
const nav = await puppeteer.launch({ headless: true });
const pag = await nav.newPage();
await pag.setViewport({ width: 844, height: 390, deviceScaleFactor: 3 });
await pag.goto('' + (process.env.GAME_URL || 'http://localhost:5173/') + '?jugar&q=media', { waitUntil: 'networkidle0' });
await pag.waitForFunction(() => window.__game);
await new Promise((r) => setTimeout(r, 3000));
const info = await pag.evaluate(() => { const r = window.__game.render.renderer; const i = r.info.render; return { lienzo: r.domElement.width + 'x' + r.domElement.height, llamadas: i.calls, triangulos: i.triangles, texturas: r.info.memory.textures }; });
const fps = await pag.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / 3); }; requestAnimationFrame(f); }));
console.log(info, 'fps (headless, sin GPU real):', fps.toFixed(1));
await nav.close();
