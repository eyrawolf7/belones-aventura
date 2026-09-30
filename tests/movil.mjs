// Prueba en móvil horizontal con toques reales: tocar para empezar, joystick, A. Captura en tests/out/movil/.
import puppeteer from 'puppeteer';
import fs from 'node:fs';
const URL = process.env.GAME_URL || 'http://localhost:5173/';
fs.mkdirSync('tests/out/movil', { recursive: true });
const nav = await puppeteer.launch({ headless: true });
const pag = await nav.newPage();
const errores = []; pag.on('pageerror', (e) => errores.push(e.message));
await pag.emulate({ viewport: { width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true, isLandscape: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14) Mobile' });
await pag.goto(URL, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 500));
await pag.screenshot({ path: 'tests/out/movil/1-titulo.png' });
await pag.touchscreen.tap(600, 200);
await new Promise((r) => setTimeout(r, 400));
const antes = await pag.evaluate(() => ({ x: __game.sim.estado.jugador.x, y: __game.sim.estado.jugador.y }));
const cdp = await pag.target().createCDPSession();
const toque = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
await toque('touchStart', 150, 250);
for (let i = 1; i <= 10; i++) { await toque('touchMove', 150 + i * 6, 250); await new Promise((r) => setTimeout(r, 30)); }
await new Promise((r) => setTimeout(r, 700));
await pag.screenshot({ path: 'tests/out/movil/2-joystick.png' });
await toque('touchEnd');
const despues = await pag.evaluate(() => ({ x: __game.sim.estado.jugador.x, y: __game.sim.estado.jugador.y }));
console.log('movido', despues.x - antes.x, despues.y - antes.y, errores.length ? errores : 'sin errores');
await nav.close();
