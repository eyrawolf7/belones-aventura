// Render PROVISIONAL de colores planos para probar la simulación sobre el pueblo real.
// Se sustituye cuando Víctor elija el estilo visual (docs/prompt-estilos.md).
import { T, SUB } from '../sim/mundo.js';
import { hash2 } from '../sim/rng.js';

export const ANCHO = 384, ALTO = 216;
const COL = { c: '#d8b77c', a: '#5d6170', r: '#e6dcc6', p: '#9fb77a', s: '#c9a66b', z: '#b8573f', h: '#7fae5a', m: '#efe9dc' };
const FACHADAS = ['#f4efe4', '#efe2c4', '#ead0a2', '#f0cdb2', '#dfe6e6', '#f6f1e0', '#e8c78e'];
const CHUNK = 32;

export function crearRender(canvas, mundo) {
  const ctx = canvas.getContext('2d');
  const trozos = new Map();

  function hornear(ci, cj) {
    const c = document.createElement('canvas'); c.width = c.height = CHUNK * T;
    const g = c.getContext('2d');
    for (let j = 0; j < CHUNK; j++) for (let i = 0; i < CHUNK; i++) {
      const I = ci * CHUNK + i, J = cj * CHUNK + j;
      if (I >= mundo.W || J >= mundo.H) continue;
      const n = J * mundo.W + I, e = mundo.edif[n];
      if (e) {
        const abajo = mundo.edif[n + mundo.W] === e;
        const ed = mundo.edificios[e - 1], a = ed.aspecto;
        const col = a?.color || FACHADAS[Math.floor(hash2(e, 1) * FACHADAS.length)];
        const teja = a ? a.tejado === 'tile' || a.tejado === 'flat-eave' && !mundo.edif[n - mundo.W] : ed.anyo && ed.anyo < 1975;
        g.fillStyle = abajo ? (teja ? '#c0603e' : '#d4cdbf') : col;
        g.fillRect(i * T, j * T, T, T);
        if (!abajo) { g.fillStyle = '#4a6a86'; g.fillRect(i * T + 5, j * T + 4, 6, 6); }
        else if (mundo.edif[n - mundo.W] !== e) { g.fillStyle = '#0002'; g.fillRect(i * T, j * T, T, 2); }
        continue;
      }
      const l = String.fromCharCode(mundo.suelo[n]);
      g.fillStyle = COL[l] || '#f0f'; g.fillRect(i * T, j * T, T, T);
      if (hash2(I, J) < 0.2) { g.fillStyle = '#0001'; g.fillRect(i * T + ((hash2(I, J, 1) * 12) | 0), j * T + ((hash2(I, J, 2) * 12) | 0), 2, 2); }
    }
    for (const p of mundo.puertas) {
      const [, I, J] = p;
      if (I >= ci * CHUNK && I < (ci + 1) * CHUNK && J >= cj * CHUNK && J < (cj + 1) * CHUNK) { g.fillStyle = '#6b4226'; g.fillRect((I - ci * CHUNK) * T + 4, (J - cj * CHUNK) * T + 3, 8, 13); }
    }
    return c;
  }
  const trozo = (ci, cj) => { const k = ci + ',' + cj; if (!trozos.has(k)) trozos.set(k, hornear(ci, cj)); return trozos.get(k); };

  const cam = { x: 0, y: 0 };
  function pintar(e) {
    const j = e.jugador;
    const px = j.x / SUB, py = j.y / SUB - 8;
    // la cámara sigue con suavidad, sin salirse del mundo
    const objX = Math.max(0, Math.min(mundo.W * T - ANCHO, px - ANCHO / 2)), objY = Math.max(0, Math.min(mundo.H * T - ALTO, py - ALTO / 2 + (e.dialogo ? 30 : 0)));
    cam.x += (objX - cam.x) * 0.2; cam.y += (objY - cam.y) * 0.2;
    if (Math.abs(objX - cam.x) > 200 || Math.abs(objY - cam.y) > 200) { cam.x = objX; cam.y = objY; }
    const cx = Math.round(cam.x), cy = Math.round(cam.y);
    ctx.fillStyle = '#d8b77c'; ctx.fillRect(0, 0, ANCHO, ALTO);
    const s = CHUNK * T;
    for (let cj = Math.floor(cy / s); cj <= Math.floor((cy + ALTO) / s); cj++)
      for (let ci = Math.floor(cx / s); ci <= Math.floor((cx + ANCHO) / s); ci++) ctx.drawImage(trozo(ci, cj), ci * s - cx, cj * s - cy);

    // entidades ordenadas por y
    const lista = [];
    for (const m of e.matas) if (m.vivo) lista.push({ y: m.j * T + 14, f: () => { ctx.fillStyle = '#6f8f3a'; ctx.fillRect(m.i * T + 2 - cx, m.j * T + 4 - cy, 12, 11); } });
    for (const o of e.objetos) lista.push({ y: o.y / SUB, f: () => { ctx.fillStyle = o.tipo === 'chavo' ? '#f2c14e' : '#e8413c'; ctx.fillRect(o.x / SUB - 3 - cx, o.y / SUB - 6 - cy - (Math.sin(o.t / 8) * 2 | 0), 6, 6); } });
    for (const en of e.enemigos) if (!en.muerto || en.muerto < 20) lista.push({ y: en.y / SUB, f: () => {
      ctx.fillStyle = en.golpe % 4 > 1 ? '#fff' : en.estado === 'aviso' ? '#ff9a3c' : '#7a3b1e';
      ctx.fillRect(en.x / SUB - 6 - cx, en.y / SUB - 8 - cy, 12, 8);
      if (en.estado === 'aviso') { ctx.fillStyle = '#fff'; ctx.fillRect(en.x / SUB - 1 - cx, en.y / SUB - 18 - cy, 2, 6); }
    } });
    for (const v of e.vecinos) lista.push({ y: v.y / SUB, f: () => figura(v.x / SUB - cx, v.y / SUB - cy, '#8a6a9a', v.dir) });
    if (!j.muerto || e.f % 8 < 4) lista.push({ y: j.y / SUB, f: () => {
      if (j.invuln && e.f % 6 < 3) return;
      figura(px - cx, j.y / SUB - cy, '#ef7b5c', j.dir, '#f3d36b');
      if (j.espada) { const DX = [0, 0, -1, 1], DY = [1, -1, 0, 0]; ctx.fillStyle = '#8b5a2b'; ctx.fillRect(px - cx + DX[j.dir] * 12 - 2, j.y / SUB - cy - 6 + DY[j.dir] * 12 - 2, DX[j.dir] ? 12 : 4, DY[j.dir] ? 12 : 4); }
    } });
    lista.sort((a, b) => a.y - b.y); for (const l of lista) l.f();
    // copas de los árboles, por encima
    for (const [i, jj, r] of mundo.arboles) {
      const x = i * T + 8 - cx, y = jj * T - 6 - cy;
      if (x < -60 || y < -60 || x > ANCHO + 60 || y > ALTO + 60) continue;
      ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x - 2, y + 4, 4, 10);
      ctx.fillStyle = '#4f8a3c'; ctx.beginPath(); ctx.arc(x, y, 6 + r * 4, 0, 7); ctx.fill();
    }
    return { cx, cy };
  }
  function figura(x, y, ropa, dir, pelo = '#5a3a28') {
    ctx.fillStyle = '#0003'; ctx.fillRect(x - 5, y - 2, 10, 3);
    ctx.fillStyle = ropa; ctx.fillRect(x - 4, y - 12, 8, 10);
    ctx.fillStyle = '#f2c29b'; ctx.fillRect(x - 5, y - 21, 10, 9);
    ctx.fillStyle = pelo; ctx.fillRect(x - 5, y - 22, 10, dir === 1 ? 9 : 4);
    if (pelo === '#f3d36b') ctx.fillRect(x - 6, y - 20, 2, 12), ctx.fillRect(x + 4, y - 20, 2, 12);
  }
  return { ctx, pintar, cam };
}
