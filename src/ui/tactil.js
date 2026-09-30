// Controles táctiles dibujados encima del juego: joystick donde se toca (mitad izquierda), A y B a la derecha.
import { texto } from './fuente.js';
import { BOTON } from '../sim/sim.js';

export const BOTONES_TACTILES = { A: { x: 346, y: 170, r: 20 }, B: { x: 290, y: 186, r: 15 } };

export function pintarTactil(ctx, entrada, bits) {
  const r = entrada.elemento.getBoundingClientRect(), k = 384 / r.width;
  const j = entrada.joy;
  ctx.save();
  if (j.activo) {
    const x0 = (j.x0 - r.left) * k, y0 = (j.y0 - r.top) * k;
    let dx = (j.x - j.x0) * k, dy = (j.y - j.y0) * k; const L = Math.hypot(dx, dy), max = 18;
    if (L > max) { dx *= max / L; dy *= max / L; }
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff4dc'; ctx.beginPath(); ctx.arc(x0, y0, 24, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.7; ctx.fillStyle = '#3b2a20'; ctx.beginPath(); ctx.arc(x0 + dx, y0 + dy, 10, 0, 7); ctx.fill();
  } else {
    ctx.globalAlpha = 0.25; ctx.strokeStyle = '#fff4dc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(46, 170, 22, 0, 7); ctx.stroke();
  }
  for (const [n, b] of Object.entries(BOTONES_TACTILES)) {
    const pulsado = bits & BOTON[n];
    ctx.globalAlpha = pulsado ? 0.75 : 0.4;
    ctx.fillStyle = n === 'A' ? '#e0703a' : '#6b8fb3'; ctx.beginPath(); ctx.arc(b.x, b.y + (pulsado ? 1 : 0), b.r, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.9; texto(ctx, n, b.x, b.y - 6 + (pulsado ? 1 : 0), '#fff4dc', { alinear: 'centro', escala: 1 });
  }
  ctx.restore();
}
