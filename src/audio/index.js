// Audio de Belones: música y efectos sintetizados con WebAudio, sin archivos.
//
// Cadena: temas (bus por instrumento) → música → atenuación (ducking) ┐
//         efectos (voz con panorama) → efectos ─────────────────────┤→ mezcla → paso bajo 9 kHz
//         envíos → sala (4 peines amortiguados) y eco (retardo con realimentación) ┘  → compresor → recorte suave (≤ -1 dBFS) → mudo → salida
//
// La música se planifica con reloj de anticipación: un temporizador cada 25 ms programa las notas de los
// próximos 0,3 s en el reloj del AudioContext, así no tiembla aunque el hilo principal vaya cargado.
// Si no hay AudioContext (navegador viejo, pruebas en Node) todo es un no-op: nunca lanza excepciones.

const PASO_TEMPORIZADOR = 0.025;   // s entre pasadas del planificador
const ANTICIPACION = 0.3;          // s de música programada por delante
const ANTICIPACION_OCULTA = 1.5;   // con la pestaña oculta los temporizadores van a 1 Hz
const MAX_VOCES = 12;              // polifonía máxima de efectos
const MAX_VOCES_LEVES = 8;         // por encima de esto se descartan los efectos menores (pasos, letras…)
const MEDIA_PANTALLA = 192;        // px: media anchura de la vista interna (384×216)

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const lim = (x, a, b) => (x < a ? a : x > b ? b : x);

function mulberry(s) {
  return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ───────────────────────────── notación musical ─────────────────────────────
const PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
function nota(s) {
  const m = /^([a-g])(#|b)?(-?\d)$/.exec(s);
  if (!m) throw new Error('nota mala: ' + s);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
function acorde(nombre) {
  const m = /^([A-G])(#|b)?(m)?(7)?$/.exec(nombre);
  if (!m) throw new Error('acorde malo: ' + nombre);
  const raiz = (PC[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  const iv = [0, m[3] ? 3 : 4, 7];
  if (m[4]) iv.push(10);
  return { raiz, pcs: iv.map((i) => (raiz + i) % 12) };
}
const enRango = (pc, lo) => lo + ((pc - lo) % 12 + 12) % 12;   // la primera nota de esa clase ≥ lo
// voz de guitarra: bajo en [45, 56] y notas del acorde por encima, separadas al menos 3 semitonos
function vozGuitarra(ac) {
  const v = [enRango(ac.raiz, 45)];
  for (let p = v[0] + 3; v.length < 7 && p < v[0] + 30; p++) if (ac.pcs.includes(p % 12) && p - v[v.length - 1] >= 3) v.push(p);
  return v;
}
const raizBajo = (ac) => enRango(ac.raiz, 38);                  // D2..C#3

// "a4:2 d5:1 -:1" → notas; unidad = pulsos por unidad de duración
function melodia(evs, texto, inicio, unidad, inst, vel = 0.8, transp = 0) {
  let b = inicio;
  for (const tok of texto.trim().split(/\s+/)) {
    const [n, d] = tok.split(':');
    const dur = Number(d) * unidad;
    if (n !== '-') evs.push({ b, d: dur, i: inst, n: nota(n) + transp, v: vel });
    b += dur;
  }
  return b - inicio;
}

// ───────────────────────────── temas ─────────────────────────────
// Cada tema devuelve {bpm, compas, compases, evs:[{b (pulso), d, i, n, v}], mezcla, envios}.
function arpegios(evs, prog, desde, compas, patron, vel, inst = 'guit') {
  prog.forEach((c, k) => {
    if (!c) return;
    const v = vozGuitarra(acorde(c));
    for (const [off, idx, d, vv = 1] of patron) evs.push({ b: (desde + k) * compas + off, d, i: inst, n: v[Math.min(idx, v.length - 1)], v: vel * vv });
  });
}
function rasgueo(evs, b, c, vel, d = 1.2, n = 4, sep = 0.03) {
  const v = vozGuitarra(acorde(c));
  for (let k = 0; k < n && k < v.length; k++) evs.push({ b: b + k * sep, d, i: 'guit', n: v[k], v: vel * (1 - k * 0.08) });
}
function bajos(evs, prog, desde, compas, patron, vel) {
  prog.forEach((c, k) => {
    if (!c) return;
    const r = raizBajo(acorde(c)), q = r + 7 <= 50 ? r + 7 : r - 5, o = r + 12 <= 52 ? r + 12 : r;
    for (const [off, cual, d, vv = 1] of patron) evs.push({ b: (desde + k) * compas + off, d, i: 'bajo', n: cual === 'q' ? q : cual === 'o' ? o : r, v: vel * vv });
  });
}
function colchon(evs, prog, desde, compas, vel, dur) {
  prog.forEach((c, k) => {
    if (!c) return;
    const ac = acorde(c);
    const notas = [enRango(ac.pcs[0], 57), enRango(ac.pcs[1], 60), enRango(ac.pcs[2], 62)];
    for (const n of notas) evs.push({ b: (desde + k) * compas, d: dur ?? compas, i: 'pad', n, v: vel });
  });
}
function bateria(evs, desde, compases, compas, patron) {
  for (let k = 0; k < compases; k++) for (const [off, inst, v] of patron) evs.push({ b: (desde + k) * compas + off, d: 0.2, i: inst, v });
}

const A_PROG = ['D', 'A', 'Bm', 'F#m', 'G', 'D', 'Em', 'A', 'D', 'A', 'Bm', 'F#m', 'G', 'A', 'D', 'F#'];
const A_MEL = `a4:2 d5:1 e5:1 f#5:2  e5:3 c#5:1 a4:2  b4:2 d5:1 f#5:1 b5:2  a5:3 f#5:1 c#5:2
               d5:2 g5:1 f#5:1 e5:1 d5:1  f#5:3 e5:1 d5:2  e5:2 g5:1 f#5:1 e5:1 c#5:1  e5:5 -:1
               a4:2 d5:1 e5:1 f#5:2  e5:3 c#5:1 a4:2  b4:2 d5:1 f#5:1 b5:2  a5:2 g5:1 f#5:1 e5:1 c#5:1
               d5:2 g5:1 a5:1 b5:2  a5:2 g5:1 f#5:1 e5:2  f#5:1 e5:1 d5:4  -:6`;
// sección B: la cadencia andaluza (Bm-A-G-F#) con adornos de cante, el guiño a la taranta y al trovo
const B_PROG = ['Bm', 'A', 'G', 'F#', 'Bm', 'A', 'G', 'F#', 'G', 'D', 'Em', 'Bm', 'G', 'A', 'F#', 'A7'];
const B_MEL = `f#5:3 e5:1 d5:1 e5:1  c#5:2 e5:1 d5:1 c#5:2  b4:2 d5:1 c#5:1 b4:2  a#4:4 -:2
               f#5:0.5 g5:0.5 f#5:1 e5:1 f#5:1 d5:2  e5:0.5 f#5:0.5 e5:1 d5:1 c#5:1 e5:2  d5:1 c#5:1 b4:1 a#4:1 b4:1 c#5:1  a#4:5 -:1
               b4:2 d5:1 g5:1 f#5:2  f#5:2 e5:1 d5:1 a4:2  g4:1 b4:1 e5:2 d5:1 e5:1  f#5:4 d5:2
               g5:2 f#5:1 e5:1 d5:2  c#5:2 e5:1 a5:1 g5:2  f#5:0.5 g5:0.5 f#5:1 e5:1 c#5:1 a#4:2  c#5:2 e5:1 g5:1 e5:1 c#5:1`;
const C_MEL2 = `a5:2 f#5:1 e5:1 d5:2  c#5:2 e5:1 a5:1 e5:2  d5:2 f#5:1 b5:1 a5:1 f#5:1  a5:3 g5:0.5 f#5:0.5 e5:1 c#5:1
                b4:1 d5:1 g5:2 b5:2  a5:1.5 g5:0.5 f#5:1 e5:1 c#5:2  f#5:1 e5:1 d5:4  -:6`;

function temaPueblo() {
  const evs = [], C = 3;   // 3/4, negra = pulso; 48 compases a 120 = 72 s
  const C_PROG = [...A_PROG.slice(0, 15), 'A7'];
  const prog = [...A_PROG, ...B_PROG, ...C_PROG];
  const ARP = [[0, 0, 1.4], [0.5, 2, 1], [1, 3, 1, 0.85], [1.5, 2, 0.8, 0.7], [2, 4, 0.9, 0.85], [2.5, 3, 0.8, 0.7]];
  melodia(evs, A_MEL, 0, 0.5, 'flauta', 0.8);
  melodia(evs, B_MEL, 16 * C, 0.5, 'flauta', 0.85);
  melodia(evs, A_MEL.trim().split(/\s+/).slice(0, 29).join(' '), 32 * C, 0.5, 'lead', 0.9, -12);  // guitarra canta
  melodia(evs, C_MEL2, 40 * C, 0.5, 'flauta', 0.8);
  arpegios(evs, A_PROG, 0, C, ARP, 0.5);
  arpegios(evs, B_PROG, 16, C, ARP, 0.52);
  C_PROG.forEach((c, k) => { if (k < 8) { rasgueo(evs, (32 + k) * C, c, 0.35, 1.3); rasgueo(evs, (32 + k) * C + 2, c, 0.22, 0.8, 3); } });
  arpegios(evs, C_PROG.slice(8), 40, C, ARP, 0.5);
  // remates de guitarra en los huecos de la flauta
  melodia(evs, 'd5:1 c#5:1 b4:1 a4:1 g4:1 f#4:1', 15 * C, 0.5, 'lead', 0.55);
  melodia(evs, 'a4:1 b4:1 c#5:1 e5:1 g5:1 e5:1', 47 * C, 0.5, 'lead', 0.5);
  bajos(evs, prog, 0, C, [[0, 'r', 1.3], [2, 'q', 0.9, 0.7]], 0.75);
  const perc = [[0, 'bombo', 0.8], [2, 'slap', 0.45], [0, 'shaker', 0.12], [0.5, 'shaker', 0.2], [1, 'shaker', 0.12], [1.5, 'shaker', 0.2], [2, 'shaker', 0.12], [2.5, 'shaker', 0.22]];
  bateria(evs, 0, 16, C, perc);
  bateria(evs, 16, 16, C, [...perc, [1, 'palma', 0.3], [2, 'palma', 0.38]]);
  bateria(evs, 32, 8, C, [[0, 'bombo', 0.6], [0.5, 'shaker', 0.14], [1.5, 'shaker', 0.14], [2.5, 'shaker', 0.16]]);
  bateria(evs, 40, 8, C, perc);
  return { bpm: 120, compas: C, compases: 48, evs, mezcla: { guit: 0.55, lead: 0.7, flauta: 0.5, bajo: 0.75, bombo: 0.7, slap: 0.45, shaker: 0.35, palma: 0.4 }, envios: { rev: 0.22, eco: { flauta: 0.12, lead: 0.1 } } };
}

function temaTitulo() {
  const evs = [], C = 3;   // 20 compases a 92: intro, tema principal, cierre
  const prog = ['D', 'D', ...A_PROG.slice(0, 15), 'D', 'G', 'D'];
  melodia(evs, A_MEL.replace(/-:6\s*$/, 'd5:6'), 2 * C, 0.5, 'flauta', 0.85);
  arpegios(evs, prog, 0, C, [[0, 0, 2], [0.5, 2, 1.5], [1, 3, 1.4, 0.8], [1.5, 4, 1.2, 0.8], [2, 5, 1.2, 0.75], [2.5, 3, 1, 0.65]], 0.45);
  colchon(evs, prog, 0, C, 0.16);
  bajos(evs, prog, 0, C, [[0, 'r', 2.6]], 0.7);
  bateria(evs, 10, 8, C, [[0, 'bombo', 0.5], [2, 'slap', 0.25]]);
  return { bpm: 92, compas: C, compases: 20, evs, mezcla: { guit: 0.55, flauta: 0.55, pad: 0.35, bajo: 0.7, bombo: 0.6, slap: 0.4 }, envios: { rev: 0.35, eco: { flauta: 0.15, guit: 0.08 } } };
}

function temaCampo() {
  const evs = [], C = 4;   // 4/4 a 80, 16 compases = 48 s, mucho aire
  const prog = ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'C', 'Am', 'Em', 'F', 'C', 'G', 'D', 'C', 'D'];
  melodia(evs, `d5:4 g5:2 a5:2  f#5:6 e5:2  g5:4 e5:2 d5:2  e5:8
                -:2 b4:2 d5:2 g5:2  a5:4 f#5:2 d5:2  e5:6 g5:2  e5:4 -:4
                c5:2 e5:2 a5:4  g5:4 b4:4  a4:2 c5:2 f5:4  e5:8
                d5:3 e5:1 g5:4  f#5:3 e5:1 d5:4  e5:4 c5:2 d5:2  d5:6 -:2`, 0, 0.5, 'flauta', 0.7);
  arpegios(evs, prog, 0, C, [[0, 0, 2.5], [1, 2, 2, 0.8], [1.5, 3, 1.6, 0.7], [2.5, 4, 1.5, 0.75], [3, 3, 1, 0.6]], 0.45);
  colchon(evs, prog, 0, C, 0.13);
  bajos(evs, prog, 0, C, [[0, 'r', 3.6]], 0.6);
  bateria(evs, 8, 8, C, [[1, 'shaker', 0.1], [3, 'shaker', 0.12]]);
  evs.push({ b: 2 * C + 2.5, d: 0.3, i: 'pajaro', v: 0.3, p: 0.6 }, { b: 11 * C + 1.25, d: 0.3, i: 'pajaro', v: 0.25, p: -0.5 });
  return { bpm: 80, compas: C, compases: 16, evs, mezcla: { guit: 0.55, flauta: 0.5, pad: 0.35, bajo: 0.65, shaker: 0.3, pajaro: 0.4 }, envios: { rev: 0.3, eco: { guit: 0.2, flauta: 0.2 } } };
}

function temaMina() {
  const evs = [], C = 4;   // 4/4 a 66, cadencia andaluza en La (modo de mi), 16 compases ≈ 58 s
  const prog = ['Am', 'G', 'F', 'E', 'Am', 'G', 'F', 'E', 'Dm', 'Am', 'F', 'E', 'Am', 'G', 'F', 'E'];
  melodia(evs, `e5:3 f5:0.5 e5:0.5 d5:1 c5:1 b4:2  d5:1 c5:1 b4:1 a4:1 b4:4
                c5:0.5 d5:0.5 c5:1 b4:1 a4:5  g#4:0.5 a4:0.5 g#4:1 f4:1 e4:5`, 4 * C, 0.5, 'flauta', 0.6);
  melodia(evs, `a4:2 c5:1 e5:1 a5:4  g5:1 f5:1 e5:1 d5:1 e5:4
                f5:0.5 g5:0.5 f5:1 e5:1 d5:1 c5:4  b4:1 c5:0.5 b4:0.5 a4:1 g#4:5`, 12 * C, 0.5, 'flauta', 0.6);
  arpegios(evs, prog.map((c, k) => (k % 8 < 4 ? c : null)), 0, C, [[0, 0, 3], [1.5, 3, 2.5, 0.8], [3, 2, 2, 0.7]], 0.5);
  arpegios(evs, prog.map((c, k) => (k % 8 >= 4 ? c : null)), 0, C, [[0, 0, 3, 0.8]], 0.45);
  colchon(evs, prog, 0, C, 0.12, C + 0.5);
  bajos(evs, prog, 0, C, [[0, 'r', 3.8]], 0.55);
  for (let k = 0; k < 16; k += 2) evs.push({ b: k * C, d: 0.3, i: 'bombo', v: 0.45 });
  const r = mulberry(11);
  for (let k = 0; k < 22; k++) evs.push({ b: r() * 16 * C, d: 0.2, i: 'gota', n: 84 + Math.floor(r() * 7), v: 0.2 + r() * 0.2, p: r() * 1.6 - 0.8 });
  evs.sort((a, b) => a.b - b.b);
  return { bpm: 66, compas: C, compases: 16, evs, mezcla: { guit: 0.55, flauta: 0.45, pad: 0.4, bajo: 0.65, bombo: 0.55, gota: 0.35 }, filtroPad: 700, envios: { rev: 0.4, eco: { guit: 0.35, flauta: 0.35, gota: 0.5 } } };
}

function temaPeligro() {
  const evs = [], C = 4;   // 4/4 a 138, Re menor andaluz, 16 compases ≈ 28 s
  const prog = ['Dm', 'C', 'Bb', 'A', 'Dm', 'C', 'Bb', 'A', 'Gm', 'Dm', 'Bb', 'A', 'Dm', 'C', 'Bb', 'A'];
  const fr = `a4:1 d5:1 f5:1 a5:2 g5:1 f5:1 e5:1  e5:1 g5:1 e5:1 c5:1 d5:2 e5:2
              f5:1 d5:1 bb4:1 d5:1 f5:2 g5:1 f5:1  e5:3 c#5:1 e5:1 f5:0.5 e5:0.5 c#5:2`;
  melodia(evs, fr, 4 * C, 0.5, 'flauta', 0.75);
  melodia(evs, `d5:1 g5:1 bb5:2 a5:1 g5:1 f5:1 g5:1  a5:3 f5:1 d5:2 e5:1 f5:1
                d5:1 f5:1 bb5:2 a5:1 g5:1 f5:1 d5:1  e5:4 c#5:2 a4:2`, 8 * C, 0.5, 'flauta', 0.75);
  melodia(evs, fr, 12 * C, 0.5, 'flauta', 0.8);
  bajos(evs, prog, 0, C, [[0, 'r', 0.4], [0.5, 'r', 0.3, 0.6], [1, 'o', 0.4, 0.8], [1.5, 'r', 0.3, 0.6], [2, 'r', 0.4], [2.5, 'q', 0.3, 0.7], [3, 'r', 0.4, 0.8], [3.5, 'o', 0.3, 0.7]], 0.7);
  prog.forEach((c, k) => { rasgueo(evs, k * C, c, 0.4, 0.5); rasgueo(evs, k * C + 1.5, c, 0.3, 0.3, 3, 0.02); rasgueo(evs, k * C + 2.5, c, 0.3, 0.3, 3, 0.02); });
  bateria(evs, 0, 16, C, [[0, 'bombo', 0.85], [1, 'slap', 0.5], [2.5, 'bombo', 0.6], [3, 'slap', 0.55], [3.75, 'slap', 0.2],
    ...[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((o) => [o, 'shaker', o % 1 ? 0.22 : 0.12])]);
  evs.sort((a, b) => a.b - b.b);
  return { bpm: 138, compas: C, compases: 16, evs, mezcla: { guit: 0.5, flauta: 0.5, bajo: 0.8, bombo: 0.75, slap: 0.5, shaker: 0.3 }, envios: { rev: 0.15, eco: {} } };
}

const TEMAS = { titulo: temaTitulo, pueblo: temaPueblo, campo: temaCampo, mina: temaMina, peligro: temaPeligro };
const compilados = {};
function tema(nombre) {
  if (!compilados[nombre]) { const t = TEMAS[nombre](); t.evs.sort((a, b) => a.b - b.b); compilados[nombre] = t; }
  return compilados[nombre];
}

const PAN_INST = { guit: -0.22, lead: -0.1, flauta: 0.2, bajo: 0, pad: 0, bombo: 0, slap: -0.12, shaker: 0.3, palma: 0.15 };

// ───────────────────────────── el motor ─────────────────────────────
export function crearAudio(opciones = {}) {
  let ctx = opciones.contexto || null;
  const reloj = opciones.ahora || null;
  let n = null;                 // nodos fijos de la cadena
  let volM = 0.8, volE = 0.9, mudo = false;
  const NIVEL_M = 0.32, NIVEL_E = 0.6;   // calibrado: música ≈ -19 dBFS RMS, efectos con picos de -6 a -14 dBFS
  let pedido = null;            // tema que se quiere (aunque aún no haya contexto)
  let actual = null;            // reproductor que suena
  const salientes = [];         // reproductores en fundido de salida
  let temporizador = null;
  const rng = mulberry(20260930);
  let retrasos = 0;             // notas que llegaron tarde al planificador (deberían ser 0)
  const voces = [];             // fin de cada voz de efecto activa
  const ultimo = {};            // último instante de cada tipo de efecto
  let combo = 0, ultimoRecoger = -9;

  const ahora = () => (reloj ? reloj() : ctx.currentTime);
  const hay = () => !!(ctx && n);
  const enDiferido = () => typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;

  function montar() {
    if (n || !ctx) return;
    try {
      n = {};
      n.mudo = ctx.createGain(); n.mudo.gain.value = mudo ? 0 : 1; n.mudo.connect(ctx.destination);
      // recorte suave: lineal hasta 0,6 y rodilla hasta 0,88 (-1,1 dBFS), nunca pasa de ahí
      n.recorte = ctx.createWaveShaper();
      const N = 2049, curva = new Float32Array(N);
      for (let i = 0; i < N; i++) { const s = (i / (N - 1)) * 4 - 2, a = Math.abs(s); curva[i] = Math.sign(s) * (a < 0.6 ? a : 0.6 + 0.28 * Math.tanh((a - 0.6) / 0.28)); }
      n.recorte.curve = curva;
      n.pre = ctx.createGain(); n.pre.gain.value = 0.5;   // la curva cubre [-2, 2]
      n.pre.connect(n.recorte); n.recorte.connect(n.mudo);
      n.comp = ctx.createDynamicsCompressor();
      n.comp.threshold.value = -9; n.comp.knee.value = 5; n.comp.ratio.value = 12; n.comp.attack.value = 0.002; n.comp.release.value = 0.15;
      n.comp.connect(n.pre);
      n.pb = ctx.createBiquadFilter(); n.pb.type = 'lowpass'; n.pb.frequency.value = 9000; n.pb.Q.value = 0.5;
      n.pb.connect(n.comp);
      n.mezcla = ctx.createGain(); n.mezcla.connect(n.pb);
      n.agache = ctx.createGain(); n.agache.connect(n.mezcla);
      n.musica = ctx.createGain(); n.musica.gain.value = volM * NIVEL_M; n.musica.connect(n.agache);
      n.efectos = ctx.createGain(); n.efectos.gain.value = volE * NIVEL_E; n.efectos.connect(n.mezcla);
      montarSala(); montarEco();
      n.envioEfectos = ctx.createGain(); n.envioEfectos.gain.value = 0.12; n.envioEfectos.connect(n.sala);
      n.efectos.connect(n.envioEfectos);
      montarOndas(); montarRuido();
    } catch (e) { n = null; }
  }

  // sala barata: cuatro peines amortiguados (la FDN de Hadamard daba lazos inestables en Chrome)
  function montarSala() {
    n.sala = ctx.createGain();
    const pa = ctx.createBiquadFilter(); pa.type = 'highpass'; pa.frequency.value = 220; n.sala.connect(pa);
    const salida = ctx.createGain(); salida.gain.value = opciones.sinSala ? 0 : 0.55;
    const fusion = ctx.createChannelMerger(2); fusion.connect(salida); salida.connect(n.mezcla);
    // peines paralelos (dos por canal), cada uno con su lazo: retardo → paso bajo → realimentación < 1
    const mono = ctx.createGain(); mono.channelCount = 1; mono.channelCountMode = 'explicit'; pa.connect(mono);
    const T = [0.0297, 0.0411, 0.0371, 0.0437], g = opciones.salaG ?? 0.72;
    for (let i = 0; i < 4; i++) {
      const d = ctx.createDelay(0.1); d.delayTime.value = T[i];
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000; lp.Q.value = -3.01;   // Q en dB: sin pico
      const fb = ctx.createGain(); fb.gain.value = g;
      mono.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(fusion, 0, i < 2 ? 0 : 1);
    }
  }
  // eco de mina: un retardo con realimentación, filtrado para que cada repetición sea más oscura
  function montarEco() {
    n.eco = ctx.createGain();
    const pa = ctx.createBiquadFilter(); pa.type = 'highpass'; pa.frequency.value = 280;
    const d = ctx.createDelay(1); d.delayTime.value = 0.36;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1900; lp.Q.value = -3.01;
    const fb = ctx.createGain(); fb.gain.value = 0.42;
    const sal = ctx.createGain(); sal.gain.value = opciones.sinEco ? 0 : 0.6;
    n.eco.connect(pa); pa.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(sal);
    sal.connect(n.mezcla); sal.connect(n.sala);
  }
  function onda(armonicos) {
    const re = new Float32Array(armonicos.length + 1), im = new Float32Array(armonicos.length + 1);
    armonicos.forEach((a, k) => { im[k + 1] = a; });
    return ctx.createPeriodicWave(re, im);
  }
  function montarOndas() {
    const g = []; for (let k = 1; k <= 10; k++) g.push(Math.abs(Math.sin(k * Math.PI * 0.2)) / Math.pow(k, 1.15));
    n.ondas = {
      guit: onda(g),                                   // cuerda pulsada cerca del puente
      flauta: onda([1, 0.28, 0.1, 0.04, 0.015]),
      bajo: onda([1, 0.5, 0.2, 0.08, 0.03]),
      campana: onda([1, 0.0, 0.18, 0.0, 0.06]),
      voz: onda([1, 0.35, 0.18, 0.08, 0.04]),
    };
  }
  function montarRuido() {
    const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0), r = mulberry(7);
    for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
    n.ruido = b;
  }

  // ─────────── instrumentos (programan una nota en el instante t, sin tocar nada más) ───────────
  function guitarra(dest, t, m, dur, vel) {
    const f = mtof(m), o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.setPeriodicWave(n.ondas.guit); o.frequency.value = f;
    lp.type = 'lowpass'; lp.Q.value = 0.6;
    lp.frequency.setValueAtTime(Math.min(f * 6 + 500, 3500), t);
    lp.frequency.setTargetAtTime(Math.min(f * 2 + 250, 1800), t, 0.08);
    const tau = lim(0.55 * Math.pow(196 / f, 0.35), 0.2, 0.9), fin = t + Math.max(dur, 0.08);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.004);
    g.gain.setTargetAtTime(0, t + 0.004, tau); g.gain.setTargetAtTime(0, fin, 0.07);
    o.connect(lp); lp.connect(g); g.connect(dest);
    o.start(t); o.stop(fin + 0.5);
  }
  function flauta(dest, t, m, dur, vel) {
    const f = mtof(m), o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.setPeriodicWave(n.ondas.flauta); o.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.value = 2600;
    const fin = t + Math.max(dur - 0.02, 0.06);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.035);
    g.gain.linearRampToValueAtTime(vel * 0.78, t + 0.15); g.gain.setValueAtTime(vel * 0.78, fin);
    g.gain.setTargetAtTime(0, fin, 0.045);
    o.connect(g); g.connect(lp); lp.connect(dest);
    if (dur > 0.4) {   // vibrato que entra tarde, como un flautista
      const lfo = ctx.createOscillator(), prof = ctx.createGain();
      lfo.frequency.value = 5.2; prof.gain.setValueAtTime(0, t); prof.gain.setValueAtTime(0, t + 0.22); prof.gain.linearRampToValueAtTime(13, t + 0.6);
      lfo.connect(prof); prof.connect(o.detune); lfo.start(t); lfo.stop(fin + 0.3);
    }
    // soplo del ataque: ruido estrecho alrededor del segundo armónico, muy breve
    const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), gs = ctx.createGain();
    s.buffer = n.ruido; bp.type = 'bandpass'; bp.frequency.value = Math.min(f * 2, 2400); bp.Q.value = 3;
    gs.gain.setValueAtTime(0, t); gs.gain.linearRampToValueAtTime(vel * 0.12, t + 0.01); gs.gain.setTargetAtTime(0, t + 0.012, 0.02);
    s.connect(bp); bp.connect(gs); gs.connect(dest); s.start(t, rng() * 1.5); s.stop(t + 0.15);
    o.start(t); o.stop(fin + 0.3);
  }
  function bajo(dest, t, m, dur, vel) {
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.setPeriodicWave(n.ondas.bajo); o.frequency.value = mtof(m);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.setTargetAtTime(420, t, 0.12);
    const fin = t + Math.max(dur, 0.1);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.008);
    g.gain.setTargetAtTime(vel * 0.25, t + 0.01, 0.35); g.gain.setTargetAtTime(0, fin, 0.06);
    o.connect(lp); lp.connect(g); g.connect(dest); o.start(t); o.stop(fin + 0.4);
  }
  function colchonNota(dest, t, m, dur, vel, corte = 1100) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = corte; lp.Q.value = 0.4;
    const ataque = Math.min(0.6, dur * 0.4), fin = t + dur;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + ataque); g.gain.setValueAtTime(vel, fin); g.gain.setTargetAtTime(0, fin, 0.25);
    g.connect(lp); lp.connect(dest);
    for (const det of [-6, 6]) { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = det; o.connect(g); o.start(t); o.stop(fin + 1.4); }
  }
  function ruidoFiltrado(dest, t, { dur, f = 1000, f2, q = 1, tipo = 'bandpass', vol = 0.3, ataque = 0.003 }) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = n.ruido; s.loop = true;
    fl.type = tipo; fl.Q.value = q; fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0005, t + Math.max(dur, ataque + 0.01));
    s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, rng() * 1.8); s.stop(t + dur + 0.03);
  }
  function tono(dest, t, { f, f2, desliz, dur, onda: tipoOnda = 'sine', vol = 0.3, ataque = 0.004, corte }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    if (n.ondas[tipoOnda]) o.setPeriodicWave(n.ondas[tipoOnda]); else o.type = tipoOnda;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + (desliz ?? dur));
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0005, t + Math.max(dur, ataque + 0.01));
    let ult = o;
    if (corte) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = corte; o.connect(lp); ult = lp; }
    ult.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.03);
  }
  function percusion(dest, t, inst, vel, ev) {
    if (inst === 'bombo') {   // cajón grave
      tono(dest, t, { f: 120, f2: 52, desliz: 0.07, dur: 0.22, vol: vel, ataque: 0.002 });
      ruidoFiltrado(dest, t, { dur: 0.03, f: 700, q: 0.8, tipo: 'lowpass', vol: vel * 0.25, ataque: 0.001 });
    } else if (inst === 'slap') {   // golpe seco del cajón
      ruidoFiltrado(dest, t, { dur: 0.07, f: 1700, q: 1.1, vol: vel * 0.7, ataque: 0.001 });
      tono(dest, t, { f: 230, f2: 180, dur: 0.06, vol: vel * 0.4, ataque: 0.001 });
    } else if (inst === 'shaker') {
      ruidoFiltrado(dest, t, { dur: 0.06, f: 4200, q: 1.6, vol: vel * 0.5, ataque: 0.012 });
    } else if (inst === 'palma') {
      for (let k = 0; k < 3; k++) ruidoFiltrado(dest, t + k * 0.009, { dur: k === 2 ? 0.09 : 0.012, f: 1350, q: 1.4, vol: vel * (k === 2 ? 0.7 : 0.45), ataque: 0.001 });
    } else if (inst === 'gota') {
      tono(dest, t, { f: mtof(ev.n), f2: mtof(ev.n) * 1.9, desliz: 0.035, dur: 0.12, vol: vel, ataque: 0.002 });
    } else if (inst === 'pajaro') {
      tono(dest, t, { f: 2100, f2: 2800, desliz: 0.05, dur: 0.08, vol: vel * 0.6 });
      tono(dest, t + 0.11, { f: 2500, f2: 2150, desliz: 0.07, dur: 0.1, vol: vel * 0.5 });
      tono(dest, t + 0.26, { f: 2200, f2: 2900, desliz: 0.06, dur: 0.09, vol: vel * 0.45 });
    }
  }

  // ─────────── reproductor de un tema ───────────
  function Reproductor(nombre, t0, fundido) {
    const tm = tema(nombre), spb = 60 / tm.bpm, largo = tm.compases * tm.compas * spb;
    const gan = ctx.createGain(); gan.connect(n.musica);
    gan.gain.setValueAtTime(0, t0); gan.gain.linearRampToValueAtTime(1, t0 + fundido);
    const sala = ctx.createGain(); sala.gain.value = tm.envios.rev; gan.connect(sala); sala.connect(n.sala);
    const buses = {};
    const bus = (inst) => {
      if (buses[inst]) return buses[inst];
      const g = ctx.createGain(); g.gain.value = tm.mezcla[inst] ?? 0.5;
      let ult = g;
      if (PAN_INST[inst] && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = PAN_INST[inst]; g.connect(p); ult = p; }
      ult.connect(gan);
      const e = tm.envios.eco[inst];
      if (e) {   // envío al eco con su propio fundido (va en paralelo a la ganancia del tema)
        const ge = ctx.createGain(); ge.gain.value = e;
        const f = ctx.createGain(); seguirFundido(f.gain);
        ult.connect(ge); ge.connect(f); f.connect(n.eco); ecos.push(f);
      }
      return (buses[inst] = g);
    };
    const ecos = [];
    function seguirFundido(p) {
      p.setValueAtTime(0, 0);
      p.setValueAtTime(0, t0); p.linearRampToValueAtTime(1, t0 + fundido);
      if (r.fin < Infinity) { p.setValueAtTime(1, r.fin - r.fundidoSalida); p.linearRampToValueAtTime(0, r.fin); }
    }
    const r = { nombre, gan, ecos, idx: 0, inicioBucle: t0, fin: Infinity, vueltas: 0, fundidoSalida: 0 };
    r.programar = (hasta) => {
      const evs = tm.evs;
      if (!evs.length) return;
      for (;;) {
        const ev = evs[r.idx];
        let t = r.inicioBucle + ev.b * spb;
        if (t >= hasta || t >= r.fin) return;
        const hum = ev.i === 'flauta' || ev.i === 'pad' ? 0 : rng() * 0.006;
        const vel = ev.v * (0.92 + rng() * 0.16);
        t += hum;
        if (t < ahora()) retrasos++;
        tocar(bus(ev.i), t, ev, ev.d * spb, vel, tm);
        if (++r.idx >= evs.length) { r.idx = 0; r.inicioBucle += largo; r.vueltas++; }
      }
    };
    r.parar = (t, fundido) => {
      r.fin = t + fundido; r.fundidoSalida = fundido;
      // valor de la rampa de entrada en t (por si se corta a medio entrar), calculado sin leer .value
      const v = t >= t0 + r.fundidoEntrada ? 1 : lim((t - t0) / r.fundidoEntrada, 0, 1);
      for (const p of [gan.gain, ...ecos.map((f) => f.gain)]) {
        p.cancelScheduledValues(t); p.setValueAtTime(v, t); p.linearRampToValueAtTime(0, t + fundido);
      }
    };
    r.fundidoEntrada = Math.max(fundido, 0.001);
    return r;
  }
  function tocar(dest, t, ev, dur, vel, tm) {
    switch (ev.i) {
      case 'guit': case 'lead': return guitarra(dest, t, ev.n, dur, vel);
      case 'flauta': return flauta(dest, t, ev.n, dur, vel);
      case 'bajo': return bajo(dest, t, ev.n, dur, vel);
      case 'pad': return colchonNota(dest, t, ev.n, dur, vel, tm.filtroPad);
      default: {
        if (ev.p !== undefined && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = ev.p; p.connect(dest); dest = p; }
        return percusion(dest, t, ev.i, vel, ev);
      }
    }
  }

  function programarHasta(hasta) {
    if (!hay()) return;
    if (actual) actual.programar(hasta);
    for (let k = salientes.length - 1; k >= 0; k--) {
      const s = salientes[k];
      s.programar(hasta);
      if (ahora() > s.fin + 2) {
        // en un OfflineAudioContext desconectar actúa sobre todo el render: solo se libera en vivo
        if (!enDiferido()) { try { s.gan.disconnect(); for (const f of s.ecos) f.disconnect(); } catch (e) { /* ya estaba */ } }
        salientes.splice(k, 1);
      }
    }
  }
  function tic() {
    try {
      const oculto = typeof document !== 'undefined' && document.hidden;
      programarHasta(ahora() + (oculto ? ANTICIPACION_OCULTA : ANTICIPACION));
    } catch (e) { /* nunca romper el juego por el audio */ }
  }
  function arrancarReloj() {
    if (temporizador || opciones.sinReloj || typeof setInterval === 'undefined') return;
    temporizador = setInterval(tic, PASO_TEMPORIZADOR * 1000);
  }

  function cambiarTema(nombre, fundido = 1) {
    if (!hay()) return;
    const t = ahora() + 0.03;
    if (actual && actual.nombre === nombre) return;
    if (actual) { actual.parar(t, fundido); salientes.push(actual); actual = null; }
    if (nombre && TEMAS[nombre]) {
      actual = Reproductor(nombre, t, fundido);
    }
    tic();
  }

  // ─────────── efectos ───────────
  const LEVES = { paso: 1, letra: 1, menu: 1, arbusto: 1, pagina: 1 };
  const MIN_SEP = { paso: 0.06, letra: 0.03, menu: 0.03, recoger: 0.035, arbusto: 0.04, golpe: 0.03, espada: 0.05 };
  const DURACION = { paso: 0.1, espada: 0.25, golpe: 0.2, 'daño': 0.45, muerte: 2.6, recoger: 0.45, corazon: 0.6, hablar: 0.25, letra: 0.06, pagina: 0.12, puerta: 0.45, cofre: 1.5, secreto: 1.6, objeto: 2.8, menu: 0.08, seleccion: 0.25, arbusto: 0.25 };
  const SUELOS = { a: 'piedra', r: 'piedra', z: 'piedra', c: 'piedra', p: 'piedra', m: 'piedra', s: 'tierra', t: 'tierra', h: 'hierba', v: 'hierba', g: 'hierba', e: 'arena', y: 'arena', w: 'agua', o: 'agua' };

  function subGrupo(d, g) { const s = ctx.createGain(); s.gain.value = g; s.connect(d); return s; }
  function agachar(t, cuanto, dur) {
    const g = n.agache.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(cuanto, t + 0.08); g.setValueAtTime(cuanto, t + dur); g.linearRampToValueAtTime(1, t + dur + 0.6);
  }

  function vozEfecto(tipo, t, ev) {
    for (let k = voces.length - 1; k >= 0; k--) if (voces[k] < t) voces.splice(k, 1);
    if (voces.length >= MAX_VOCES || (LEVES[tipo] && voces.length >= MAX_VOCES_LEVES)) return null;
    if (MIN_SEP[tipo] && ultimo[tipo] !== undefined && t - ultimo[tipo] < MIN_SEP[tipo]) return null;
    const juntos = ultimo[tipo] !== undefined && t - ultimo[tipo] < 0.08;
    ultimo[tipo] = t;
    voces.push(t + (DURACION[tipo] || 0.5));
    const g = ctx.createGain(); g.gain.value = juntos ? 0.6 : 1;
    let pan = 0;
    if (typeof ev.pan === 'number') pan = ev.pan;
    else if (typeof ev.x === 'number' && typeof ev.camX === 'number') pan = lim((ev.x - ev.camX) / MEDIA_PANTALLA, -1, 1) * 0.7;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(n.efectos); } else g.connect(n.efectos);
    return g;
  }

  const EFECTOS = {
    paso(d, t, ev) {
      const suelo = SUELOS[ev.suelo] || ev.suelo || 'tierra', alt = rng() < 0.5 ? 1 : 1.18;
      if (suelo === 'hierba') ruidoFiltrado(d, t, { dur: 0.07, f: 1300 * alt, q: 0.9, vol: 0.13, ataque: 0.006 });
      else if (suelo === 'arena') ruidoFiltrado(d, t, { dur: 0.09, f: 800 * alt, f2: 500, q: 0.7, vol: 0.15, ataque: 0.01 });
      else if (suelo === 'agua') { ruidoFiltrado(d, t, { dur: 0.1, f: 900 * alt, f2: 1500, q: 1.5, vol: 0.08, ataque: 0.008 }); tono(d, t, { f: 500 * alt, f2: 900, dur: 0.06, vol: 0.05 }); }
      else if (suelo === 'piedra') { ruidoFiltrado(d, t, { dur: 0.04, f: 1100 * alt, q: 1.2, vol: 0.08, ataque: 0.002 }); tono(d, t, { f: 150 * alt, f2: 90, dur: 0.05, vol: 0.07 }); }
      else { ruidoFiltrado(d, t, { dur: 0.05, f: 450 * alt, q: 0.8, vol: 0.1, ataque: 0.003 }); tono(d, t, { f: 95 * alt, f2: 60, dur: 0.05, vol: 0.08 }); }
    },
    espada(d, t) {
      const k = 0.92 + rng() * 0.16;
      ruidoFiltrado(d, t, { dur: 0.17, f: 520 * k, f2: 2100 * k, q: 1.5, vol: 0.7, ataque: 0.045 });
      tono(d, t, { f: 190 * k, f2: 120, dur: 0.1, vol: 0.06, onda: 'triangle', ataque: 0.02 });
    },
    golpe(d, t) {
      tono(d, t, { f: 210, f2: 70, desliz: 0.09, dur: 0.14, vol: 0.36, ataque: 0.001 });
      ruidoFiltrado(d, t, { dur: 0.06, f: 1400, q: 0.9, vol: 0.28, ataque: 0.001 });
      tono(d, t + 0.005, { f: 640, f2: 430, dur: 0.08, vol: 0.13, onda: 'triangle' });
    },
    'daño'(d, t) {
      tono(d, t, { f: 466, f2: 330, dur: 0.16, vol: 0.26, onda: 'voz', corte: 1800 });
      tono(d, t + 0.1, { f: 311, f2: 196, dur: 0.28, vol: 0.26, onda: 'voz', corte: 1500 });
      tono(d, t, { f: 160, f2: 70, dur: 0.12, vol: 0.3 });
    },
    muerte(d, t) {
      d = subGrupo(d, 0.5);
      agachar(t, 0.15, 2.2);
      [['a4', 0, 0.4], ['f4', 0.4, 0.4], ['d4', 0.8, 0.4], ['c#4', 1.2, 0.35], ['d4', 1.55, 0.9]].forEach(([m, o, du]) => flauta(d, t + o, nota(m), du, 0.3));
      for (const [c, o] of [['Dm', 0], ['Bb', 0.8], ['A', 1.2], ['Dm', 1.55]]) { const v = vozGuitarra(acorde(c)); v.slice(0, 4).forEach((m, k) => guitarra(d, t + o + k * 0.04, m, 0.9, 0.18)); }
      bajo(d, t, nota('d2'), 0.8, 0.3); bajo(d, t + 1.55, nota('d2'), 1, 0.3);
    },
    recoger(d, t) {
      combo = t - ultimoRecoger < 0.45 ? Math.min(combo + 1, 5) : 0; ultimoRecoger = t;
      const sube = [0, 2, 4, 5, 7, 9][combo];
      tono(d, t, { f: mtof(74 + sube), dur: 0.08, vol: 0.2, onda: 'campana', corte: 3500 });
      tono(d, t + 0.07, { f: mtof(81 + sube), dur: 0.38, vol: 0.22, onda: 'campana', corte: 3500 });
    },
    corazon(d, t) {
      ['d5', 'f#5', 'a5', 'd6'].forEach((m, k) => tono(d, t + k * 0.07, { f: mtof(nota(m)), dur: k === 3 ? 0.5 : 0.18, vol: 0.18, onda: 'campana' }));
    },
    hablar(d, t) {
      tono(d, t, { f: 392, dur: 0.1, vol: 0.2, onda: 'campana' });
      tono(d, t + 0.065, { f: 587, dur: 0.16, vol: 0.2, onda: 'campana' });
    },
    letra(d, t, ev) {
      const c = typeof ev.c === 'string' ? ev.c : typeof ev.letra === 'string' ? ev.letra : '';
      if (c && /[\s.,;:!?¡¿…\-]/.test(c)) return false;
      const BASE = [165, 196, 220, 247, 277, 311, 349, 392];
      const PENTA = [0, 2, 4, 7, 9];
      const sel = c ? c.toLowerCase().charCodeAt(0) * 7 : Math.floor(rng() * 5);
      const f = BASE[lim(ev.voz | 0, 0, 7)] * Math.pow(2, PENTA[sel % 5] / 12);
      tono(d, t, { f, dur: 0.045, vol: 0.07, onda: 'voz', ataque: 0.003, corte: 1600 });
    },
    pagina(d, t) {
      ruidoFiltrado(d, t, { dur: 0.05, f: 1600, f2: 2600, q: 1.2, vol: 0.07, ataque: 0.004 });
      tono(d, t + 0.01, { f: 520, f2: 780, dur: 0.07, vol: 0.12, onda: 'campana' });
    },
    puerta(d, t) {
      tono(d, t, { f: 115, f2: 65, dur: 0.3, vol: 0.34 });
      ruidoFiltrado(d, t, { dur: 0.22, f: 500, tipo: 'lowpass', q: 0.7, vol: 0.2, ataque: 0.004 });
      tono(d, t + 0.005, { f: 240, f2: 215, dur: 0.12, vol: 0.14, onda: 'triangle' });
      ruidoFiltrado(d, t + 0.2, { dur: 0.025, f: 1800, q: 3, vol: 0.1, ataque: 0.001 });
      tono(d, t + 0.2, { f: 330, dur: 0.05, vol: 0.06, onda: 'triangle' });
    },
    cofre(d, t) {
      d = subGrupo(d, 0.5);
      ruidoFiltrado(d, t, { dur: 0.5, f: 220, f2: 700, tipo: 'lowpass', q: 0.8, vol: 0.14, ataque: 0.2 });
      tono(d, t, { f: 98, f2: 147, dur: 0.5, vol: 0.14, onda: 'triangle', ataque: 0.15 });
      ['d4', 'f#4', 'a4', 'd5', 'f#5'].forEach((m, k) => guitarra(d, t + 0.45 + k * 0.06, nota(m), 0.9, 0.3));
      tono(d, t + 0.8, { f: mtof(nota('a5')), dur: 0.7, vol: 0.16, onda: 'campana' });
    },
    secreto(d, t) {
      d = subGrupo(d, 0.5);
      agachar(t, 0.3, 1.2);
      ['e4', 'a4', 'c#5', 'e5', 'a5'].forEach((m, k) => guitarra(d, t + k * 0.06, nota(m), 1.2, 0.3));
      [['e5', 0.3, 0.1], ['f5', 0.4, 0.1], ['e5', 0.5, 0.1], ['d5', 0.6, 0.12], ['a5', 0.75, 0.75]].forEach(([m, o, du]) => flauta(d, t + o, nota(m), du, 0.34));
      bajo(d, t + 0.75, nota('a2'), 0.9, 0.35);
      tono(d, t + 0.75, { f: mtof(nota('e6')), dur: 0.6, vol: 0.08, onda: 'campana' });
    },
    objeto(d, t) {
      d = subGrupo(d, 0.5);
      agachar(t, 0.2, 2.4);
      [['a4', 0, 0.12], ['d5', 0.12, 0.12], ['e5', 0.24, 0.12], ['f#5', 0.36, 0.36], ['e5', 0.72, 0.12], ['f#5', 0.84, 0.12], ['a5', 0.96, 1.2]].forEach(([m, o, du]) => flauta(d, t + o, nota(m), du, 0.36));
      for (const [c, o, du] of [['D', 0, 0.6], ['A', 0.6, 0.4], ['D', 0.96, 1.4]]) { const v = vozGuitarra(acorde(c)); v.slice(0, 5).forEach((m, k) => guitarra(d, t + o + k * 0.025, m, du, 0.2)); }
      bajo(d, t, nota('d2'), 0.55, 0.36); bajo(d, t + 0.6, nota('a2'), 0.35, 0.32); bajo(d, t + 0.96, nota('d2'), 1.3, 0.38);
      for (const m of ['d4', 'f#4', 'a4']) colchonNota(d, t + 0.96, nota(m), 1.2, 0.06);
      tono(d, t + 0.96, { f: mtof(nota('d6')), dur: 0.9, vol: 0.07, onda: 'campana' });
    },
    menu(d, t) { tono(d, t, { f: 587, dur: 0.06, vol: 0.14, onda: 'campana' }); },
    seleccion(d, t) {
      tono(d, t, { f: 587, dur: 0.08, vol: 0.17, onda: 'campana' });
      tono(d, t + 0.06, { f: 880, dur: 0.18, vol: 0.17, onda: 'campana' });
    },
    arbusto(d, t) {
      ruidoFiltrado(d, t, { dur: 0.13, f: 2000, f2: 900, q: 0.9, vol: 0.36, ataque: 0.003 });
      ruidoFiltrado(d, t + 0.05, { dur: 0.1, f: 1500, f2: 800, q: 1.1, vol: 0.2, ataque: 0.004 });
      tono(d, t, { f: 300, f2: 170, dur: 0.06, vol: 0.1, onda: 'triangle' });
    },
  };

  // ─────────── API ───────────
  const api = {
    desbloquear() {
      try {
        if (!ctx) {
          const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
          if (!AC) return false;
          ctx = new AC({ latencyHint: 'interactive' });
        }
        montar();
        if (!n) return false;
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => {});
        arrancarReloj();
        if (pedido && (!actual || actual.nombre !== pedido)) cambiarTema(pedido === 'silencio' ? null : pedido, 0.6);
        return true;
      } catch (e) { return false; }
    },
    musica(nombre, op = {}) {
      try {
        if (!(nombre in TEMAS) && nombre !== 'silencio' && nombre) return;
        pedido = nombre || 'silencio';
        if (!hay()) return;
        cambiarTema(pedido === 'silencio' ? null : pedido, op.fundido ?? 1);
      } catch (e) { /* nada */ }
    },
    evento(ev) {
      try {
        if (!hay() || !ev || mudo || volE <= 0) return;
        const f = EFECTOS[ev.tipo];
        if (!f) return;
        const t = ahora() + 0.005;
        const d = vozEfecto(ev.tipo, t, ev);
        if (!d) return;
        f(d, t, ev);
      } catch (e) { /* nada */ }
    },
    volumen(m, e) {
      if (typeof m === 'number') volM = lim(m, 0, 1);
      if (typeof e === 'number') volE = lim(e, 0, 1);
      if (!hay()) return;
      const t = ahora();
      n.musica.gain.setTargetAtTime(volM * NIVEL_M, t, 0.05);
      n.efectos.gain.setTargetAtTime(volE * NIVEL_E, t, 0.05);
    },
    silenciar(b) {
      mudo = !!b;
      if (!hay()) return;
      n.mudo.gain.setTargetAtTime(mudo ? 0 : 1, ahora(), 0.04);
    },
    get tema() { return pedido; },
    // ganchos de prueba (render sin conexión)
    _programarHasta: (t) => { try { programarHasta(t); } catch (e) { console.error(e); } },
    _voces: () => voces.length,
    _retrasos: () => retrasos,
    _temas: () => Object.fromEntries(Object.keys(TEMAS).map((k) => { const t = tema(k); return [k, { bpm: t.bpm, compases: t.compases, segundos: (t.compases * t.compas * 60) / t.bpm, notas: t.evs.length }]; })),
    _cerrar() { if (temporizador) clearInterval(temporizador); temporizador = null; },
  };
  if (ctx) montar();
  return api;
}
