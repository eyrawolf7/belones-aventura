// Genera src/data/mundo.json a partir de los datos reales de Los Belones (Catastro + OSM).
// 1 baldosa = 2 m. Pantalla: este a la derecha, norte arriba.
// Datos heredados: x local crece hacia el OESTE y z hacia el NORTE (metros).
//
// Capas (una letra o un número por baldosa, filas de arriba abajo):
//   suelo:    c campo, a asfalto, r acera, p patio privado, s solar, z plaza, h jardín, m muro de patio
//   edif:     índice+1 del edificio en `edificios` (0 = nada), como Uint16 en base64
//   arboles:  [i, j, radio en baldosas]
import fs from 'node:fs';

const D = 'referencias/datos-pueblo/';
const leer = (f) => JSON.parse(fs.readFileSync(D + f, 'utf8'));
const calles = leer('pueblo-calles.json');
const edificiosRaw = leer('pueblo-edificios.json');
const parcelas = leer('catastro-parcelas.json');
const { copas } = leer('copas-tiles.json');
const direcciones = leer('direcciones-pueblo.json');
const negocios = leer('negocios-gmaps.json');

const M = 2; // metros por baldosa
const X_OESTE = -40, X_ESTE = -880, Z_NORTE = 620, Z_SUR = -640;
const W = Math.round((X_OESTE - X_ESTE) / M), H = Math.round((Z_NORTE - Z_SUR) / M);
const aBaldosa = (x, z) => [(X_OESTE - x) / M, (Z_NORTE - z) / M];
const centro = (i, j) => [X_OESTE - (i + 0.5) * M, Z_NORTE - (j + 0.5) * M];

// ---- índice espacial sencillo por celdas de 20 m
const CEL = 20;
function indice(items, bbox) {
  const g = new Map();
  items.forEach((it, k) => {
    const [a, b, c, d] = bbox(it);
    for (let x = Math.floor(a / CEL); x <= Math.floor(c / CEL); x++)
      for (let z = Math.floor(b / CEL); z <= Math.floor(d / CEL); z++) {
        const key = x + ',' + z; if (!g.has(key)) g.set(key, []); g.get(key).push(it);
      }
  });
  return (x, z) => g.get(Math.floor(x / CEL) + ',' + Math.floor(z / CEL)) || [];
}
const bboxPts = (pts) => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, z] of pts) { a = Math.min(a, x); b = Math.min(b, z); c = Math.max(c, x); d = Math.max(d, z); } return [a, b, c, d]; };
function dentro(pts, x, z) {
  let s = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) s = !s;
  }
  return s;
}
function distSeg(px, pz, [ax, az], [bx, bz]) {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)) : 0;
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
}

// ---- edificios: solo los que caen en el encuadre
const edificios = [];
for (const b of edificiosRaw) {
  const [x, z] = b.centroid;
  if (x > X_OESTE || x < X_ESTE || z > Z_NORTE || z < Z_SUR) continue;
  edificios.push(b);
}
const dirPorRef = new Map();
for (const d of direcciones) if (!dirPorRef.has(d.refcat)) dirPorRef.set(d.refcat, d);
const polysEd = edificios.flatMap((b, k) => b.polygons.map((p) => ({ k, p, bb: bboxPts(p) })));
const idxEd = indice(polysEd, (o) => o.bb);
const polysPar = parcelas.flatMap((p) => p.polys.map((q) => ({ tipo: p.tipo, p: q.ext, bb: bboxPts(q.ext) })));
const idxPar = indice(polysPar, (o) => o.bb);
const segs = [];
for (const c of calles) for (let i = 1; i < c.points.length; i++) segs.push({ c, a: c.points[i - 1], b: c.points[i], bb: bboxPts([c.points[i - 1], c.points[i]]).map((v, n) => v + (n < 2 ? -12 : 12)) });
const idxSeg = indice(segs, (s) => s.bb);

const suelo = new Array(W * H).fill('c');
const edif = new Uint16Array(W * H);
const calle = new Uint8Array(W * H);
const nombresCalle = [null];
const idCalle = (nombre) => { if (!nombre) return 0; let k = nombresCalle.indexOf(nombre); if (k < 0) { k = nombresCalle.length; nombresCalle.push(nombre); } return k; };
const esPlaza = (c) => /^Plaza/.test(c.name || '') || c.type === 'living_street' && /Iglesia/.test(c.name || '');

for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const [x, z] = centro(i, j), n = j * W + i;
  // edificio (muestreo con 4 puntos para no perder medianeras finas)
  let k = -1;
  for (const o of idxEd(x, z)) if (dentro(o.p, x, z)) { k = o.k; break; }
  if (k >= 0) { edif[n] = k + 1; suelo[n] = 'p'; continue; }
  // calle más cercana
  let mejor = 1e9, cm = null;
  for (const s of idxSeg(x, z)) { const d = distSeg(x, z, s.a, s.b); if (d < mejor) { mejor = d; cm = s.c; } }
  const ancho = cm ? Math.max(4.4, cm.width || 5) : 0;
  let parc = null;
  for (const o of idxPar(x, z)) if (o.tipo !== 'vial' && dentro(o.p, x, z)) { parc = o; break; }
  if (cm && mejor <= ancho / 2 + 2.6) calle[n] = idCalle(cm.name);
  if (cm && mejor <= ancho / 2) { suelo[n] = esPlaza(cm) ? 'z' : 'a'; continue; }
  if (parc) { suelo[n] = parc.tipo === 'edificada' ? 'p' : 's'; continue; }
  if (cm && mejor <= ancho / 2 + 2.6) { suelo[n] = esPlaza(cm) ? 'z' : 'r'; continue; }
}

// muros: borde del patio privado que da a algo público
const pub = (c) => c === 'a' || c === 'r' || c === 'z' || c === 's' || c === 'c';
for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
  const n = j * W + i;
  if (suelo[n] !== 'p' || edif[n]) continue;
  if (pub(suelo[n - 1]) || pub(suelo[n + 1]) || pub(suelo[n - W]) || pub(suelo[n + W])) suelo[n] = 'm';
}

// árboles (copas reales) que no caen sobre asfalto ni edificio
const arboles = [];
for (const t of copas) {
  const [fi, fj] = aBaldosa(t.x, t.z), i = Math.floor(fi), j = Math.floor(fj);
  if (i < 1 || j < 1 || i >= W - 1 || j >= H - 1) continue;
  const n = j * W + i;
  if (edif[n] || suelo[n] === 'a') continue;
  arboles.push([i, j, Math.max(1, Math.round(t.radio / M))]);
}

// datos por edificio para el juego
const negPorNum = new Map();
for (const g of negocios) {
  const m = /^(C\. Mayor|Av\. de la Fuente|Plaza (?:de la )?Iglesia|C\. [^,]+),\s*(\d+)/.exec(g.addr || '');
  if (m) negPorNum.set(m[1] + '|' + m[2], g.name);
}
const via = (v) => (v || '').replace(/^CL /, 'Calle ').replace(/^AV /, 'Avenida ').replace(/^PZ /, 'Plaza ');
const datosEd = edificios.map((b) => {
  const d = dirPorRef.get(b.refcat);
  const [ci, cj] = aBaldosa(...b.centroid);
  return { ref: b.refcat, uso: b.use || '', plantas: b.maxFloors || 1, anyo: b.year ? +b.year : 0, calle: b.near?.name || (d ? via(d.via) : null), numero: d?.numero || null, c: [Math.round(ci), Math.round(cj)] };
});

// rótulos de calle: punto medio del tramo más largo de cada nombre
const rotulos = {};
for (const c of calles) {
  if (!c.name) continue;
  let L = 0; for (let i = 1; i < c.points.length; i++) L += Math.hypot(c.points[i][0] - c.points[i - 1][0], c.points[i][1] - c.points[i - 1][1]);
  if (rotulos[c.name] && rotulos[c.name].L >= L) continue;
  const [i, j] = aBaldosa(...c.points[Math.floor(c.points.length / 2)]);
  rotulos[c.name] = { L, i: Math.round(i), j: Math.round(j) };
}

// puertas: en la fila de abajo de cada edificio que da a algo pisable, en el centro del tramo más largo
const pisable = (c) => c === 'a' || c === 'r' || c === 'z' || c === 's' || c === 'c';
const tramos = new Map();
for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
  const n = j * W + i, e = edif[n];
  if (!e || edif[n + W] === e || !pisable(suelo[n + W])) continue;
  if (!tramos.has(e)) tramos.set(e, []);
  tramos.get(e).push([i, j]);
}
const puertas = [];
for (const [e, t] of tramos) {
  // agrupa en tramos contiguos por fila y elige el más largo
  t.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  let mejor = [], act = [];
  for (const p of t) { const u = act[act.length - 1]; if (u && u[1] === p[1] && u[0] === p[0] - 1) act.push(p); else { if (act.length > mejor.length) mejor = act; act = [p]; } }
  if (act.length > mejor.length) mejor = act;
  if (mejor.length < 1) continue;
  const [i, j] = mejor[Math.floor(mejor.length / 2)];
  puertas.push([e - 1, i, j]);
}

const filas = []; for (let j = 0; j < H; j++) filas.push(suelo.slice(j * W, (j + 1) * W).join(''));
const mundo = {
  version: 1, baldosaM: M, ancho: W, alto: H,
  origen: { xOeste: X_OESTE, zNorte: Z_NORTE },
  suelo: filas,
  edif: Buffer.from(edif.buffer).toString('base64'),
  edificios: datosEd,
  arboles,
  calle: Buffer.from(calle.buffer).toString('base64'),
  nombresCalle,
  puertas,
  calles: Object.entries(rotulos).map(([nombre, r]) => ({ nombre, i: r.i, j: r.j })),
};
fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/mundo.json', JSON.stringify(mundo));
const cuenta = {}; for (const c of suelo) cuenta[c] = (cuenta[c] || 0) + 1;
console.log(`mundo ${W}x${H} baldosas (${W * M}x${H * M} m), ${edificios.length} edificios, ${arboles.length} árboles, ${Object.keys(rotulos).length} calles, ${puertas.length} puertas`, cuenta);
