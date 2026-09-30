// El mundo en baldosas: se decodifica una vez desde src/data/mundo.json y la simulación solo lo lee.
export const T = 16; // px por baldosa
export const SUB = 16; // subpíxeles por píxel

const SOLIDO_SUELO = { p: 1, m: 1 };

function base64(b64) {
  const bin = atob(b64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

export function cargarMundo(json) {
  const W = json.ancho, H = json.alto;
  const suelo = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) { const f = json.suelo[j]; for (let i = 0; i < W; i++) suelo[j * W + i] = f.charCodeAt(i); }
  const edif = new Uint16Array(base64(json.edif).buffer);
  const calle = json.calle ? base64(json.calle) : new Uint8Array(W * H);
  const solido = new Uint8Array(W * H);
  for (let n = 0; n < W * H; n++) solido[n] = edif[n] || SOLIDO_SUELO[String.fromCharCode(suelo[n])] ? 1 : 0;
  // troncos de árbol
  for (const [i, j] of json.arboles) solido[j * W + i] = 1;
  // bordes del mapa
  for (let i = 0; i < W; i++) { solido[i] = 1; solido[(H - 1) * W + i] = 1; }
  for (let j = 0; j < H; j++) { solido[j * W] = 1; solido[j * W + W - 1] = 1; }
  return {
    W, H, suelo, edif, calle, solido,
    edificios: json.edificios, arboles: json.arboles, calles: json.calles, nombresCalle: json.nombresCalle || [],
    puertas: json.puertas || [],
  };
}

export const letra = (m, i, j) => (i < 0 || j < 0 || i >= m.W || j >= m.H ? 'c' : String.fromCharCode(m.suelo[j * m.W + i]));
export const esSolido = (m, i, j) => i < 0 || j < 0 || i >= m.W || j >= m.H || m.solido[j * m.W + i] === 1;

// ¿choca una caja (en px) con el mundo?
export function cajaChoca(m, x0, y0, x1, y1) {
  const i0 = Math.floor(x0 / T), i1 = Math.floor((x1 - 1) / T), j0 = Math.floor(y0 / T), j1 = Math.floor((y1 - 1) / T);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (esSolido(m, i, j)) return true;
  return false;
}
