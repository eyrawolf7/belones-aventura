// Cajas de interfaz pintadas en píxel: esquinas redondeadas escalonadas, borde de 2 px,
// brillo arriba y sombra interior abajo. Todo con fillRect en coordenadas enteras.

export const CREMA = '#fff4dc';
export const CREMA_SOMBRA = '#f1dcb2';
export const CREMA_BRILLO = '#fffbf0';
export const MARRON = '#3b2a20';
export const MARRON_SUAVE = '#7a5a44';
export const ACENTO = '#e0703a';
export const ACENTO_BRILLO = '#f59a5e';
export const ACENTO_SOMBRA = '#b4522a';

// Forma con esquinas recortadas en escalera de radio r (1 o 2).
export function forma(ctx, x, y, w, h, color, r = 2) {
  ctx.fillStyle = color;
  if (r >= 2) {
    ctx.fillRect(x + 2, y, w - 4, h);
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillRect(x, y + 2, w, h - 4);
  } else if (r === 1) {
    ctx.fillRect(x + 1, y, w - 2, h);
    ctx.fillRect(x, y + 1, w, h - 2);
  } else {
    ctx.fillRect(x, y, w, h);
  }
}

/**
 * Caja con borde de 2 px. opciones: relleno, borde, brillo, sombraInt (línea interior inferior),
 * sombra (color de la sombra proyectada, o null), r (radio exterior, 2 o 3).
 */
export function caja(ctx, x, y, w, h, {
  relleno = CREMA, borde = MARRON, brillo = CREMA_BRILLO, sombraInt = CREMA_SOMBRA, sombra = '#0000004d', r = 3,
} = {}) {
  x = Math.round(x); y = Math.round(y);
  if (sombra) {
    ctx.fillStyle = sombra;
    ctx.fillRect(x + 3, y + h, w - 6, 2);
    ctx.fillRect(x + 2, y + h - 1, 1, 2);
    ctx.fillRect(x + w - 3, y + h - 1, 1, 2);
  }
  // Borde exterior con esquina de radio 3 (escalera 1-1-1) o 2.
  ctx.fillStyle = borde;
  if (r >= 3) {
    ctx.fillRect(x + 3, y, w - 6, h);
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillRect(x, y + 3, w, h - 6);
    ctx.fillRect(x + 2, y + 1, w - 4, 1);
  } else {
    forma(ctx, x, y, w, h, borde, 2);
  }
  // Relleno interior (radio 1 dentro del borde de 2 px).
  const ix = x + 2, iy = y + 2, iw = w - 4, ih = h - 4;
  forma(ctx, ix, iy, iw, ih, relleno, r >= 3 ? 2 : 1);
  if (brillo) {
    ctx.fillStyle = brillo;
    ctx.fillRect(ix + 2, iy, iw - 4, 1);
  }
  if (sombraInt) {
    ctx.fillStyle = sombraInt;
    ctx.fillRect(ix + 2, iy + ih - 2, iw - 4, 2);
    ctx.fillRect(ix + 1, iy + ih - 3, 1, 1);
    ctx.fillRect(ix + iw - 2, iy + ih - 3, 1, 1);
  }
}

// Dibuja un mapa de píxeles: filas de caracteres, cada uno se traduce por la paleta (sin clave = vacío).
export function sprite(ctx, filas, x, y, paleta) {
  for (let r = 0; r < filas.length; r++) {
    const f = filas[r];
    for (let c = 0; c < f.length; c++) {
      const col = paleta[f[c]];
      if (col) {
        ctx.fillStyle = col;
        ctx.fillRect(x + c, y + r, 1, 1);
      }
    }
  }
}
