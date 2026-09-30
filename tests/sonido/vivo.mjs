// Prueba en vivo de la demo (AudioContext real + temporizador): sin errores, el planificador va por delante
// del reloj aunque el hilo principal se bloquee, y sin AudioContext todo es un no-op.
// Uso: npx vite --port 5182 (aparte) y node tests/sonido/vivo.mjs
import puppeteer from 'puppeteer';
const URL_DEMO = (process.env.URL_BASE || 'http://localhost:5182') + '/src/audio/demo.html';
const nav = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
const errores = [];
let fallos = 0;

const pag = await nav.newPage();
pag.on('pageerror', (e) => errores.push(e.message));
pag.on('response', (x) => { if (x.status() >= 400 && !x.url().includes('favicon')) errores.push(x.status() + ' ' + x.url()); });
await pag.goto(URL_DEMO, { waitUntil: 'networkidle0' });
await pag.mouse.click(5, 5);
const r = await pag.evaluate(async () => {
  const a = window.audio, esperar = (ms) => new Promise((s) => setTimeout(s, ms));
  const ok = a.desbloquear();
  a.musica('pueblo');
  await esperar(1500);
  // bloquea el hilo principal 180 ms (menos que la anticipación de 300 ms): la música no debe cortarse
  const t0 = performance.now(); while (performance.now() - t0 < 180) { /* ocupado */ }
  for (const t of ['golpe', 'espada', 'recoger', 'objeto', 'letra', 'paso']) a.evento({ tipo: t, x: 50, camX: 0, voz: 2 });
  for (let k = 0; k < 60; k++) a.evento({ tipo: 'golpe', x: k, camX: 0 });
  const voces = a._voces();
  a.musica('mina'); await esperar(1200); a.musica('peligro'); await esperar(600);
  a.volumen(0.3, 0.3); a.silenciar(true); a.silenciar(false); a.musica('silencio'); await esperar(300);
  return { ok, voces, tema: a.tema, retrasos: a._retrasos() };
});
console.log('en vivo:', JSON.stringify(r));
if (!r.ok) { fallos++; console.log('FALLA: no se desbloqueó'); }
if (r.retrasos) { fallos++; console.log('FALLA: notas programadas tarde'); }
if (r.voces > 12) { fallos++; console.log('FALLA: polifonía por encima de 12'); }

// sin AudioContext: nada debe lanzar
const p2 = await nav.newPage();
p2.on('pageerror', (e) => errores.push('sin AudioContext: ' + e.message));
await p2.evaluateOnNewDocument(() => { delete window.AudioContext; delete window.webkitAudioContext; window.AudioContext = undefined; window.webkitAudioContext = undefined; });
await p2.goto(URL_DEMO, { waitUntil: 'networkidle0' });
const r2 = await p2.evaluate(() => {
  const a = window.audio;
  const ok = a.desbloquear(); a.musica('pueblo'); a.evento({ tipo: 'golpe', x: 1, camX: 0 }); a.volumen(0.5, 0.5); a.silenciar(true);
  return { ok, tema: a.tema };
});
console.log('sin AudioContext:', JSON.stringify(r2));
if (r2.ok !== false) { fallos++; console.log('FALLA: debería devolver false'); }

await nav.close();
if (errores.length) { fallos++; console.log('ERRORES:', errores.join(' | ')); }
console.log(fallos ? 'VIVO: FALLA' : 'VIVO: OK');
process.exit(fallos ? 1 : 0);
