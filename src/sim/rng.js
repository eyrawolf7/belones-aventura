// Aleatoriedad con semilla (mulberry32). El estado es un entero: se guarda con la partida.
export function crearRng(semilla) {
  return { s: semilla >>> 0 };
}
export function azar(r) {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const entero = (r, n) => Math.floor(azar(r) * n);
// hash determinista de una baldosa (para variaciones fijas del mundo, no gasta rng)
export function hash2(i, j, k = 0) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
