// Personajes PROVISIONALES pintados por código en 16×24 (4 direcciones × 3 pasos), a la espera de las
// hojas definitivas. Mismo tamaño de píxel que las baldosas: nada de mezclas de resolución.
export const CW = 16, CH = 24;

export function hojaPersonaje(pal) {
  const c = document.createElement('canvas'); c.width = CW * 3; c.height = CH * 4;
  const g = c.getContext('2d');
  const K = '#2b1d16';
  for (let dir = 0; dir < 4; dir++) for (let f = 0; f < 3; f++) {
    const ox = f * CW, oy = dir * CH;
    const p = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(ox + x, oy + y, w, h); };
    const paso = f === 1 ? 1 : f === 2 ? -1 : 0;
    // piernas
    const pier = pal.falda ? pal.ropa : pal.pantalon;
    p(5, 18, 3, 4 - Math.max(0, paso), K); p(8, 18, 3, 4 - Math.max(0, -paso), K);
    p(6, 18, 1, 3 - Math.max(0, paso), pier); p(9, 18, 1, 3 - Math.max(0, -paso), pier);
    p(5, 21 - Math.max(0, paso), 3, 1, pal.zapato); p(8, 21 - Math.max(0, -paso), 3, 1, pal.zapato);
    // cuerpo
    p(4, 12, 8, 7, K); p(5, 13, 6, 5, pal.ropa); p(5, 17, 6, 1, pal.falda ? pal.ropa : pal.pantalon);
    if (pal.delantal && dir !== 1) p(6, 14, 4, 4, '#f0ece2');
    // brazos
    const bz = dir >= 2 ? 0 : paso;
    if (dir !== 3) { p(3, 13 + bz, 2, 5, K); p(3, 16 + bz, 2, 1, pal.piel); }
    if (dir !== 2) { p(11, 13 - bz, 2, 5, K); p(11, 16 - bz, 2, 1, pal.piel); }
    // cabeza
    p(3, 2, 10, 11, K); p(4, 3, 8, 9, pal.piel);
    // pelo
    const pe = pal.pelo;
    if (dir === 1) p(4, 3, 8, 9, pe);
    else { p(4, 3, 8, 3, pe); if (dir === 2) p(8, 3, 4, 7, pe); if (dir === 3) p(4, 3, 4, 7, pe); }
    if (pal.largo) { p(3, 5, 2, 10, pe); p(11, 5, 2, 10, pe); if (dir === 1) p(4, 11, 8, 4, pe); }
    if (pal.gorro) { p(3, 1, 10, 3, pal.gorro); p(3, 3, 10, 1, K); }
    // cara
    if (dir === 0) { p(5, 7, 1, 2, K); p(10, 7, 1, 2, K); p(5, 10, 1, 1, '#e8a08a'); p(10, 10, 1, 1, '#e8a08a'); }
    if (dir === 2) { p(5, 7, 1, 2, K); }
    if (dir === 3) { p(10, 7, 1, 2, K); }
    if (pal.vara && dir !== 1) { const x = dir === 2 ? 2 : 13; p(x, 8, 1, 11, '#7a4a2a'); p(x - 1, 7, 3, 2, '#5f9a3c'); }
  }
  return c;
}

export const PALETAS = {
  vanessa: { piel: '#f5cfa8', pelo: '#f1c24a', largo: true, ropa: '#ef7b6c', pantalon: '#4a78c0', zapato: '#f4f4f4', vara: true },
  abuela: { piel: '#f0c6a0', pelo: '#d9d4cc', ropa: '#3b3b4f', falda: true, delantal: true, zapato: '#5a4a3a' },
  paco: { piel: '#e8b890', pelo: '#cfcac4', ropa: '#8a6d4a', pantalon: '#5a4a3a', zapato: '#2b2420', gorro: '#2a2a2e' },
  encarna: { piel: '#f0c6a0', pelo: '#6b4a2e', ropa: '#d9667e', falda: true, delantal: true, zapato: '#6a4a3a' },
  nano: { piel: '#d9a57c', pelo: '#2a2420', ropa: '#3a8fd0', pantalon: '#e8e4da', zapato: '#e85a4a', gorro: '#2f5fb0' },
};
