// Render sin conexión del audio (OfflineAudioContext en Chrome sin cabeza): WAV + espectrograma + medidas.
// Uso: node tests/sonido/render.mjs [escena ...]   (sin argumentos, todas)
// Escenas: titulo pueblo campo mina peligro efectos letras transiciones estres
// No necesita servidor: inyecta src/audio/index.js en una página en blanco.
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const RAIZ = new URL('../../', import.meta.url).pathname;
const DIR = new URL('./', import.meta.url).pathname;
mkdirSync(DIR, { recursive: true });
const SR = 44100;
const codigo = readFileSync(RAIZ + 'src/audio/index.js', 'utf8');

// ── guiones: [segundo, acción] ──
const EFECTOS = [
  ['paso', {}], ['paso', { suelo: 'h' }], ['paso', { suelo: 'a' }], ['paso', { suelo: 'e' }],
  ['espada', {}], ['golpe', {}], ['daño', {}], ['recoger', {}], ['corazon', {}], ['hablar', {}],
  ['pagina', {}], ['puerta', {}], ['cofre', {}], ['secreto', {}], ['objeto', {}], ['menu', {}],
  ['seleccion', {}], ['arbusto', {}], ['muerte', {}],
];
function guionEfectos() {
  const g = []; let t = 0.3; const tramos = [];
  EFECTOS.forEach(([tipo, extra], k) => {
    const dur = { objeto: 3, muerte: 2.8, secreto: 1.8, cofre: 1.8 }[tipo] || 0.8;
    g.push([t, { tipo, x: [0, 150, -150][k % 3], camX: 0, ...extra }]);
    tramos.push({ nombre: tipo + (extra.suelo ? '-' + extra.suelo : ''), t0: t, t1: t + dur });
    t += dur;
  });
  // monedas seguidas: la escala del combo
  for (let k = 0; k < 6; k++) g.push([t + k * 0.2, { tipo: 'recoger' }]);
  tramos.push({ nombre: 'recoger-combo', t0: t, t1: t + 1.8 }); t += 1.8;
  return { segundos: t + 0.5, guion: g, tramos };
}
function guionLetras() {
  const g = [], frase = 'Buenas, zagal. Esto es Los Belones';
  let t = 0.3;
  for (let v = 0; v < 8; v++) {
    for (const c of frase) { g.push([t, { tipo: 'letra', voz: v, c }]); t += 0.035; }
    t += 0.35;
  }
  return { segundos: t + 0.5, guion: [[0.02, { tipo: 'hablar' }], ...g], tramos: [] };
}

const escenas = {
  titulo: { musica: [[0, 'titulo']], extra: 3 },
  pueblo: { musica: [[0, 'pueblo']], extra: 3 },
  campo: { musica: [[0, 'campo']], extra: 3 },
  mina: { musica: [[0, 'mina']], extra: 4 },
  peligro: { musica: [[0, 'peligro']], extra: 3 },
  efectos: { ...guionEfectos(), musica: [] },
  letras: { ...guionLetras(), musica: [] },
  transiciones: { musica: [[0, 'pueblo'], [8, 'mina'], [16, 'peligro'], [22, 'campo'], [30, 'silencio']], segundos: 33, guion: [[5, { tipo: 'objeto' }], [19, { tipo: 'golpe', x: 100, camX: 0 }]] },
  estres: {
    musica: [[0, 'peligro']], segundos: 6,
    guion: Array.from({ length: 80 }, (_, k) => [2 + (k % 20) * 0.01, { tipo: ['golpe', 'espada', 'recoger', 'paso', 'daño', 'arbusto', 'objeto', 'letra'][k % 8], x: (k * 37) % 300 - 150, camX: 0 }]),
  },
};

if (process.env.ESCENA) escenas.dbg = JSON.parse(process.env.ESCENA);
const pedidas = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const lista = pedidas.length ? pedidas : Object.keys(escenas);

const nav = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
const pag = await nav.newPage();
pag.on('console', (m) => console.log('[página]', m.text()));
pag.on('pageerror', (e) => console.log('[error página]', e.message));
await pag.goto('about:blank');
await pag.addScriptTag({ type: 'module', content: codigo + '\nwindow.crearAudio = crearAudio;' });
await pag.waitForFunction(() => !!window.crearAudio);
const temas = await pag.evaluate(() => window.crearAudio()._temas());

let fallos = 0;
for (const nombre of lista) {
  const e = escenas[nombre];
  if (!e) { console.log('escena desconocida', nombre); continue; }
  const segundos = e.segundos || temas[e.musica[0][1]].segundos + e.extra;
  const datos = await pag.evaluate(async (e, segundos, SR) => {
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * segundos), SR);
    const reloj = { t: 0 };
    const a = window.crearAudio({ contexto: ctx, ahora: () => reloj.t, sinReloj: true });
    a.desbloquear();
    const musica = [...e.musica], guion = [...(e.guion || [])].sort((x, y) => x[0] - y[0]);
    let maxVoces = 0;
    for (let t = 0; t < segundos; t += 0.02) {   // simula el temporizador del planificador
      reloj.t = t;
      while (musica.length && musica[0][0] <= t) a.musica(musica.shift()[1], t === 0 ? { fundido: 0.02 } : {});
      while (guion.length && guion[0][0] <= t) a.evento(guion.shift()[1]);
      maxVoces = Math.max(maxVoces, a._voces());
      a._programarHasta(t + 0.3);
    }
    const buf = await ctx.startRendering();
    const pcm = (ch) => {
      const d = buf.getChannelData(ch), i16 = new Int16Array(d.length);
      for (let i = 0; i < d.length; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(d[i] * 32767)));
      const u8 = new Uint8Array(i16.buffer); let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    };
    return { L: pcm(0), R: pcm(1), maxVoces };
  }, e, segundos, SR);
  const L = new Int16Array(new Uint8Array(Buffer.from(datos.L, 'base64')).buffer);
  const R = new Int16Array(new Uint8Array(Buffer.from(datos.R, 'base64')).buffer);
  const wav = DIR + nombre + '.wav';
  escribirWav(wav, L, R);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-lavfi', 'showspectrumpic=s=1200x480:mode=combined:scale=log:stop=12000:legend=1', DIR + nombre + '.png']);
  const m = medir(L, R, 0, L.length);
  const aviso = [];
  if (m.picoDb > -1) aviso.push('PICO > -1 dBFS');
  if (m.agudos > 0.02) aviso.push('energía > 6 kHz alta');
  if (m.clics.length) aviso.push(m.clics.length + ' posibles clics');
  if (aviso.length) fallos++;
  console.log(`${nombre.padEnd(13)} ${segundos.toFixed(1).padStart(5)} s · pico ${m.picoDb.toFixed(1)} dBFS · RMS ${m.rmsDb.toFixed(1)} dBFS · >6 kHz ${(m.agudos * 100).toFixed(2)} % · voces efecto máx ${datos.maxVoces}${m.clics.length ? ' · clics en ' + m.clics.slice(0, 6).map((c) => c.toFixed(2)).join(', ') : ''}${aviso.length ? '  ← ' + aviso.join(', ') : ''}`);
  if (process.argv.includes("--rms")) { const v = []; for (let s = 0; s + SR <= L.length; s += SR / 2) v.push(medir(L, R, s, s + SR / 2).rmsDb.toFixed(0)); console.log("   RMS cada 0,5 s:", v.join(" ")); }
  for (const tr of e.tramos || []) {
    const t = medir(L, R, Math.floor(tr.t0 * SR), Math.floor(tr.t1 * SR));
    console.log(`   ${tr.nombre.padEnd(14)} pico ${t.picoDb.toFixed(1).padStart(6)} · RMS ${t.rmsDb.toFixed(1).padStart(6)} · >6 kHz ${(t.agudos * 100).toFixed(2)} % · centroide ${t.centroide.toFixed(0)} Hz${t.clics.length ? ' · CLICS' : ''}`);
  }
}
await nav.close();
console.log(fallos ? `SONIDO: ${fallos} escenas con avisos` : 'SONIDO: OK');
process.exit(fallos ? 1 : 0);

function escribirWav(ruta, L, R) {
  const n = L.length, b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { b.writeInt16LE(L[i], 44 + i * 4); b.writeInt16LE(R[i], 46 + i * 4); }
  writeFileSync(ruta, b);
}

// pico, RMS, fracción de energía por encima de 6 kHz (FFT de 2048 con Hann), centroide y clics
function medir(L, R, i0, i1) {
  let pico = 0, sq = 0;
  const x = new Float32Array(i1 - i0);
  for (let i = i0; i < i1; i++) { const a = L[i] / 32768, b = R[i] / 32768; pico = Math.max(pico, Math.abs(a), Math.abs(b)); sq += (a * a + b * b) / 2; x[i - i0] = (a + b) / 2; }
  const N = 2048, hann = new Float32Array(N).map((_, k) => 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / N));
  let alto = 0, total = 0, cen = 0;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let s = 0; s + N <= x.length; s += N / 2) {
    for (let k = 0; k < N; k++) { re[k] = x[s + k] * hann[k]; im[k] = 0; }
    fft(re, im);
    for (let k = 1; k < N / 2; k++) { const p = re[k] * re[k] + im[k] * im[k], f = (k * SR) / N; total += p; cen += p * f; if (f > 6000) alto += p; }
  }
  // clic: salto de la segunda diferencia muy por encima de su entorno
  const clics = [], V = 88, vent = [];
  for (let w = 0; w + V <= x.length; w += V) { let m = 0; for (let i = w + 2; i < w + V; i++) m = Math.max(m, Math.abs(x[i] - 2 * x[i - 1] + x[i - 2])); vent.push(m); }
  for (let k = 25; k < vent.length - 25; k++) {
    const ent = vent.slice(k - 25, k).concat(vent.slice(k + 1, k + 26)).sort((a, b) => a - b), med = ent[25];
    if (vent[k] > 0.04 && vent[k] > med * 12) clics.push((i0 + k * V) / SR);
  }
  const db = (v) => 20 * Math.log10(Math.max(v, 1e-9));
  return { picoDb: db(pico), rmsDb: db(Math.sqrt(sq / Math.max(1, x.length))), agudos: total ? alto / total : 0, centroide: total ? cen / total : 0, clics };
}
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
