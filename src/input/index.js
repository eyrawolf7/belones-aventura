// Teclado, mando y táctil → máscara de bits de la simulación (ver docs/CONTRATO.md).
import { BOTON } from '../sim/sim.js';

const TECLAS = {
  ArrowUp: BOTON.ARRIBA, KeyW: BOTON.ARRIBA, ArrowDown: BOTON.ABAJO, KeyS: BOTON.ABAJO,
  ArrowLeft: BOTON.IZQ, KeyA: BOTON.IZQ, ArrowRight: BOTON.DER, KeyD: BOTON.DER,
  Space: BOTON.A, KeyJ: BOTON.A, KeyZ: BOTON.A, Enter: BOTON.A, KeyK: BOTON.B, KeyX: BOTON.B,
  Escape: BOTON.PAUSA, KeyP: BOTON.PAUSA, Tab: BOTON.MENU, KeyI: BOTON.MENU,
};

export function crearEntrada(elemento) {
  let teclas = 0, tactil = 0;
  addEventListener('keydown', (e) => { const b = TECLAS[e.code]; if (b) { teclas |= b; e.preventDefault(); } });
  addEventListener('keyup', (e) => { const b = TECLAS[e.code]; if (b) teclas &= ~b; });
  addEventListener('blur', () => { teclas = 0; tactil = 0; });

  // táctil: mitad izquierda = joystick que aparece donde tocas; mitad derecha: A abajo, B encima
  const toques = new Map();
  const joy = { activo: false, x0: 0, y0: 0, x: 0, y: 0 };
  const recalcular = () => {
    tactil = 0;
    for (const t of toques.values()) {
      if (t.tipo === 'joy') {
        const dx = t.x - t.x0, dy = t.y - t.y0, r = Math.hypot(dx, dy), zona = 14;
        if (r > zona) {
          const a = Math.atan2(dy, dx), oct = Math.round(a / (Math.PI / 4));
          const dirs = [BOTON.DER, BOTON.DER | BOTON.ABAJO, BOTON.ABAJO, BOTON.ABAJO | BOTON.IZQ, BOTON.IZQ, BOTON.IZQ | BOTON.ARRIBA, BOTON.ARRIBA, BOTON.ARRIBA | BOTON.DER];
          tactil |= dirs[(oct + 8) % 8];
        }
      } else tactil |= t.tipo;
    }
    const j = [...toques.values()].find((t) => t.tipo === 'joy');
    Object.assign(joy, j ? { activo: true, x0: j.x0, y0: j.y0, x: j.x, y: j.y } : { activo: false });
  };
  const botonEn = (x, y) => {
    const r = elemento.getBoundingClientRect();
    const fx = (x - r.left) / r.width, fy = (y - r.top) / r.height;
    if (fx < 0.5) return 'joy';
    return fy > 0.55 && fx > 0.78 ? BOTON.A : fy > 0.55 ? BOTON.B : fx > 0.85 && fy < 0.2 ? BOTON.PAUSA : BOTON.A;
  };
  let tocado = false;
  const inicio = (e) => {
    tocado = true;
    for (const t of e.changedTouches) {
      const tipo = botonEn(t.clientX, t.clientY);
      toques.set(t.identifier, { tipo, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY });
    }
    recalcular(); e.preventDefault();
  };
  const mueve = (e) => { for (const t of e.changedTouches) { const q = toques.get(t.identifier); if (q) { q.x = t.clientX; q.y = t.clientY; } } recalcular(); e.preventDefault(); };
  const fin = (e) => { for (const t of e.changedTouches) toques.delete(t.identifier); recalcular(); e.preventDefault(); };
  document.addEventListener('touchstart', inicio, { passive: false });
  document.addEventListener('touchmove', mueve, { passive: false });
  document.addEventListener('touchend', fin, { passive: false });
  document.addEventListener('touchcancel', fin, { passive: false });

  const mando = () => {
    let b = 0;
    for (const g of navigator.getGamepads ? navigator.getGamepads() : []) {
      if (!g) continue;
      const [ax, ay] = g.axes, p = (i) => g.buttons[i]?.pressed;
      if (ay < -0.4 || p(12)) b |= BOTON.ARRIBA; if (ay > 0.4 || p(13)) b |= BOTON.ABAJO;
      if (ax < -0.4 || p(14)) b |= BOTON.IZQ; if (ax > 0.4 || p(15)) b |= BOTON.DER;
      if (p(0)) b |= BOTON.A; if (p(1) || p(2)) b |= BOTON.B; if (p(9)) b |= BOTON.PAUSA; if (p(8) || p(3)) b |= BOTON.MENU;
    }
    return b;
  };
  return {
    leer: () => teclas | tactil | mando(),
    joy,
    hayTactil: () => toques.size > 0 || 'ontouchstart' in window,
    tocado: () => { const t = tocado; tocado = false; return t; },
    toques,
    elemento,
  };
}
