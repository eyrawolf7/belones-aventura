// Caja de diálogo abajo de la pantalla, con placa de nombre y máquina de escribir.
// La simulación decide cuántos caracteres se ven (d.visibles) y cuándo termina la página
// (d.terminado); aquí solo se pinta. Para paginar, la simulación usa partirLineas(texto,
// ANCHO_TEXTO_DIALOGO) y agrupa de LINEAS_DIALOGO en LINEAS_DIALOGO.

import { texto, medir, partirLineas } from './fuente.js';
import { caja, forma, sprite, MARRON, ACENTO, ACENTO_BRILLO, ACENTO_SOMBRA } from './caja.js';
import { preferencias } from './preferencias.js';

const ANCHO = 384;
const ALTO = 216;
const MARGEN = 8;
const CAJA_H = 70;
const CAJA_X = MARGEN;
const CAJA_W = ANCHO - MARGEN * 2;
const CAJA_Y = ALTO - MARGEN - CAJA_H;
const PAD_X = 14;
const PASO_LINEA = 16;

export const LINEAS_DIALOGO = 3;
export const ANCHO_TEXTO_DIALOGO = CAJA_W - PAD_X * 2;
export const CAJA_DIALOGO = { x: CAJA_X, y: CAJA_Y, w: CAJA_W, h: CAJA_H };

const TEXTO = MARRON;

const FLECHA = [
  'ooooooooo',
  'oaaaaaaao',
  '.oaaaaao.',
  '..oasao..',
  '...oso...',
  '....o....',
];
const PAL_FLECHA = { o: MARRON, a: ACENTO, s: ACENTO_SOMBRA };

/**
 * d = {nombre: string|null, texto: string, visibles: número, terminado: bool, retrato: null}
 * t = fotogramas (para el parpadeo de la flecha).
 */
export function pintarDialogo(ctx, d, t = 0) {
  if (!d) return;
  ctx.imageSmoothingEnabled = false;

  caja(ctx, CAJA_X, CAJA_Y, CAJA_W, CAJA_H);

  // Placa del nombre: sobresale por arriba a la izquierda.
  if (d.nombre) {
    const w = medir(d.nombre) + 16;
    const px = CAJA_X + 10;
    const py = CAJA_Y - 9;
    const ph = 16;
    forma(ctx, px, py, w, ph, MARRON, 2);
    forma(ctx, px + 2, py + 2, w - 4, ph - 4, ACENTO, 1);
    ctx.fillStyle = ACENTO_BRILLO;
    ctx.fillRect(px + 3, py + 2, w - 6, 1);
    ctx.fillStyle = ACENTO_SOMBRA;
    ctx.fillRect(px + 3, py + ph - 3, w - 6, 1);
    texto(ctx, d.nombre, px + 8, py + 1, '#fff8ec', { sombra: ACENTO_SOMBRA });
  }

  // Texto con máquina de escribir: el corte de líneas se hace con el texto completo para que las
  // palabras no salten de línea mientras aparecen.
  const lineas = partirLineas(d.texto || '', ANCHO_TEXTO_DIALOGO).slice(0, LINEAS_DIALOGO);
  let quedan = d.visibles == null ? Infinity : Math.max(0, Math.floor(d.visibles));
  const x0 = CAJA_X + PAD_X;
  const y0 = CAJA_Y + (d.nombre ? 11 : 9);
  for (let i = 0; i < lineas.length && quedan > 0; i++) {
    const letras = [...lineas[i]];
    const trozo = letras.slice(0, quedan).join('');
    texto(ctx, trozo, x0, y0 + i * PASO_LINEA, TEXTO, { sombra: null });
    quedan -= letras.length + 1; // +1 por el espacio o salto que se comió el corte
  }

  // Flecha ▼ que parpadea y bota al terminar la página.
  if (d.terminado) {
    // Ciclo de 48 fotogramas: bota 1 px en la primera mitad y se apaga el último cuarto.
    // Con movimiento reducido se queda quieta y solo parpadea despacio.
    const ciclo = t % 48;
    const reducido = preferencias.movimientoReducido;
    const visible = reducido ? t % 64 < 48 : ciclo < 36;
    const bote = reducido ? 0 : (ciclo >= 8 && ciclo < 20 ? 1 : 0);
    if (visible) sprite(ctx, FLECHA, CAJA_X + CAJA_W - 22, CAJA_Y + CAJA_H - 14 + bote, PAL_FLECHA);
  }
}
