// Preferencias de la interfaz que no son estado de juego. El integrador (main.js) puede poner
// movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)').matches al arrancar:
// entonces los rebotes y deslizamientos se sustituyen por apariciones directas o fundidos.
export const preferencias = {
  movimientoReducido: false,
};

// Rebote corto al aparecer (0 → 1 con un pequeño sobrepaso). p en [0, 1].
export function rebote(p) {
  if (p >= 1) return 1;
  if (p <= 0) return 0;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}
