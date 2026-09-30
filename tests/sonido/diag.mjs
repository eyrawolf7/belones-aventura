// Diagnóstico rápido: un efecto aislado con y sin sala/eco, RMS cada 0,25 s.
// Uso: node tests/sonido/diag.mjs [tipo] [segundos]
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';
const codigo = readFileSync(new URL('../../src/audio/index.js', import.meta.url), 'utf8');
const [tipo = 'paso', segs = '3'] = process.argv.slice(2);
const nav = await puppeteer.launch({ headless: 'new' });
const pag = await nav.newPage();
pag.on('console', (m) => console.log('[página]', m.text()));
await pag.goto('about:blank');
await pag.addScriptTag({ type: 'module', content: codigo + '\nwindow.crearAudio = crearAudio;' });
await pag.waitForFunction(() => !!window.crearAudio);
for (const op of (process.env.OPS ? JSON.parse(process.env.OPS) : [{}, { sinSala: true }, { sinEco: true }, { sinSala: true, sinEco: true }])) {
  const r = await pag.evaluate(async (op, tipo, segs) => {
    const SR = 44100, ctx = new OfflineAudioContext(2, SR * segs, SR), reloj = { t: 0.1 };
    const a = window.crearAudio({ contexto: ctx, ahora: () => reloj.t, sinReloj: true, ...op });
    a.desbloquear();
    if (tipo.startsWith('tema:')) { a.musica(tipo.slice(5), { fundido: 0.02 }); a._programarHasta(segs); } else a.evento({ tipo });
    const d = (await ctx.startRendering()).getChannelData(0), out = [];
    for (let s = 0; s < d.length; s += SR / 4) { let q = 0; for (let i = s; i < s + SR / 4; i++) q += d[i] * d[i]; out.push((10 * Math.log10(q / (SR / 4) + 1e-12)).toFixed(0)); }
    return out.join(' ');
  }, op, tipo, Number(segs));
  console.log(JSON.stringify(op).padEnd(32), r);
}
await nav.close();
