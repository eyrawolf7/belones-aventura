// Simulación pura de la aventura: pasos fijos de 60 Hz, entradas como máscara de bits.
// Sin DOM, sin canvas, sin Math.random ni Date. El estado entero es serializable (partida guardada).
import { crearRng, azar, entero, hash2 } from './rng.js';
import { T, SUB, cajaChoca, letra, esSolido } from './mundo.js';

export const BOTON = { ARRIBA: 1, ABAJO: 2, IZQ: 4, DER: 8, A: 16, B: 32, MENU: 64, PAUSA: 128 };
export const DIR = { ABAJO: 0, ARRIBA: 1, IZQ: 2, DER: 3 };
const DX = [0, 0, -1, 1], DY = [1, -1, 0, 0];

// medidas en px (la caja de colisión va a los pies)
const CAJA = { w: 10, h: 7 };
const VEL = 20; // subpíxeles por fotograma (1,25 px/f)
const VEL_DIAG = 14;
const ESPADA_F = 18; // duración del golpe
const INVULN_F = 60;

function caja(ent) {
  const x = ent.x / SUB, y = ent.y / SUB;
  return [x - CAJA.w / 2, y - CAJA.h, x + CAJA.w / 2, y];
}

export function crearSim(mundo, datos, semilla = 1) {
  const s = {
    mundo, datos,
    estado: null,
  };
  s.estado = estadoInicial(mundo, datos, semilla);
  return s;
}

function posDe(mundo, lugar) {
  // lugar = {i, j} en baldosas o {calle, di, dj}
  let i = lugar.i, j = lugar.j;
  if (lugar.calle) {
    const c = mundo.calles.find((k) => k.nombre === lugar.calle);
    if (!c) throw new Error('calle desconocida: ' + lugar.calle);
    i = c.i + (lugar.di || 0); j = c.j + (lugar.dj || 0);
  }
  // si cae en algo sólido, busca la baldosa libre más cercana
  for (let r = 0; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    if (!esSolido(mundo, i + di, j + dj) && !esSolido(mundo, i + di, j + dj - 1)) return { x: ((i + di) * T + T / 2) * SUB, y: ((j + dj) * T + T - 2) * SUB };
  }
  return { x: (i * T + T / 2) * SUB, y: (j * T + T - 2) * SUB };
}

function estadoInicial(mundo, datos, semilla) {
  const inicio = posDe(mundo, datos.inicio);
  const e = {
    f: 0, rng: crearRng(semilla),
    jugador: { x: inicio.x, y: inicio.y, dir: DIR.ABAJO, anda: 0, paso: 0, espada: 0, vida: 6, vidaMax: 6, chavos: 0, invuln: 0, empuje: null, muerto: 0 },
    vecinos: datos.vecinos.map((v, k) => ({ id: v.id, k, ...posDe(mundo, v.lugar), dir: v.dir ?? DIR.ABAJO, anda: 0, paso: 0, pausa: 0, casa: null })),
    enemigos: [],
    objetos: [], // monedas y corazones en el suelo
    matas: [], // arbustos cortables
    dialogo: null,
    calle: 0, calleT: 0,
    eventos: [],
    banderas: {},
    prev: 0,
  };
  for (const v of e.vecinos) v.casa = { x: v.x, y: v.y };
  // matas y alacranes deterministas en los solares y el campo (según la baldosa, no gastan rng)
  for (let j = 2; j < mundo.H - 2; j++) for (let i = 2; i < mundo.W - 2; i++) {
    const c = letra(mundo, i, j);
    if ((c === 's' || c === 'c') && !esSolido(mundo, i, j)) {
      const h = hash2(i, j, 7);
      if (h < (c === 's' ? 0.035 : 0.02)) e.matas.push({ i, j, vivo: 1 });
      else if (h > 0.9985) e.enemigos.push(nuevoEnemigo('alacran', (i * T + 8) * SUB, (j * T + 14) * SUB));
    }
  }
  return e;
}

function nuevoEnemigo(tipo, x, y) {
  return { tipo, x, y, x0: x, y0: y, dir: DIR.ABAJO, vida: 2, golpe: 0, anda: 0, paso: 0, estado: 'vaga', t: 0, vx: 0, vy: 0, muerto: 0 };
}

// ---- movimiento con deslizamiento en esquinas (como en Zelda)
function mover(m, ent, dx, dy, bloquear) {
  const intenta = (nx, ny) => {
    const x = nx / SUB, y = ny / SUB;
    return !cajaChoca(m, x - CAJA.w / 2, y - CAJA.h, x + CAJA.w / 2, y) && !(bloquear && bloquear(nx, ny));
  };
  let movido = false;
  if (dx) {
    if (intenta(ent.x + dx, ent.y)) { ent.x += dx; movido = true; }
    else if (!dy) { // empuja hacia el hueco si la esquina está cerca
      for (const s of [1, -1]) {
        let libre = false;
        for (let k = 1; k <= 6; k++) if (intenta(ent.x + dx, ent.y + s * k * SUB)) { libre = true; break; }
        if (libre && intenta(ent.x, ent.y + s * VEL_DIAG)) { ent.y += s * VEL_DIAG; movido = true; break; }
      }
    }
  }
  if (dy) {
    if (intenta(ent.x, ent.y + dy)) { ent.y += dy; movido = true; }
    else if (!dx) {
      for (const s of [1, -1]) {
        let libre = false;
        for (let k = 1; k <= 6; k++) if (intenta(ent.x + s * k * SUB, ent.y + dy)) { libre = true; break; }
        if (libre && intenta(ent.x + s * VEL_DIAG, ent.y)) { ent.x += s * VEL_DIAG; movido = true; break; }
      }
    }
  }
  return movido;
}

const cerca = (a, b, r) => Math.abs(a.x - b.x) < r * SUB && Math.abs(a.y - b.y) < r * SUB;
function delante(j, r) { return { x: j.x + DX[j.dir] * r * SUB, y: j.y + DY[j.dir] * r * SUB - (j.dir === DIR.ABAJO ? 0 : 4 * SUB) }; }

// choque con vecinos (son sólidos para el jugador)
function bloqueoVecinos(e, yo) {
  return (nx, ny) => {
    for (const v of e.vecinos) if (v !== yo && Math.abs(v.x - nx) < 11 * SUB && Math.abs(v.y - ny) < 7 * SUB) return true;
    if (yo !== e.jugador && Math.abs(e.jugador.x - nx) < 11 * SUB && Math.abs(e.jugador.y - ny) < 7 * SUB) return true;
    return false;
  };
}

function abrirDialogo(e, v, def) {
  const paginas = typeof def.texto === 'function' ? def.texto(e.banderas) : def.texto;
  e.dialogo = { quien: v?.id ?? null, nombre: def.nombre, voz: def.voz ?? 3, paginas: paginas.split('|'), pagina: 0, visibles: 0, terminado: false, al_cerrar: def.al_cerrar || null };
  e.eventos.push({ tipo: 'hablar', voz: e.dialogo.voz });
}

function pasoDialogo(s, e, pulsa) {
  const d = e.dialogo, texto = d.paginas[d.pagina];
  if (!d.terminado) {
    const antes = d.visibles;
    d.visibles = Math.min(texto.length, d.visibles + 0.75);
    if (Math.floor(d.visibles) !== Math.floor(antes) && Math.floor(d.visibles) % 2 === 0 && texto[Math.floor(d.visibles) - 1] !== ' ') e.eventos.push({ tipo: 'letra', voz: d.voz });
    if (d.visibles >= texto.length) d.terminado = true;
    if (pulsa & BOTON.A && d.visibles > 2) { d.visibles = texto.length; d.terminado = true; }
    return;
  }
  if (pulsa & (BOTON.A | BOTON.B)) {
    if (d.pagina < d.paginas.length - 1) { d.pagina++; d.visibles = 0; d.terminado = false; e.eventos.push({ tipo: 'pagina' }); }
    else {
      const fin = d.al_cerrar; e.dialogo = null; e.eventos.push({ tipo: 'pagina' });
      if (fin) for (const [k, v] of Object.entries(fin)) e.banderas[k] = v;
    }
  }
}

function soltar(e, x, y) {
  const r = azar(e.rng);
  if (r < 0.28) e.objetos.push({ tipo: 'chavo', x, y, t: 0, vida: 600 });
  else if (r < 0.36 && e.jugador.vida < e.jugador.vidaMax) e.objetos.push({ tipo: 'corazon', x, y, t: 0, vida: 600 });
}

function dañar(e, j, desde) {
  if (j.invuln || j.muerto) return;
  j.vida -= 1; j.invuln = INVULN_F;
  const dx = j.x - desde.x, dy = j.y - desde.y, L = Math.hypot(dx, dy) || 1;
  j.empuje = { vx: Math.round((dx / L) * 48), vy: Math.round((dy / L) * 48), t: 10 };
  e.eventos.push({ tipo: 'daño', x: j.x / SUB, y: j.y / SUB });
  if (j.vida <= 0) { j.muerto = 1; e.eventos.push({ tipo: 'muerte', x: j.x / SUB, y: j.y / SUB }); }
}

export function paso(s, bits) {
  const e = s.estado, m = s.mundo, j = e.jugador;
  e.eventos.length = 0;
  e.f++;
  const pulsa = bits & ~e.prev; // flancos de subida
  e.prev = bits;

  if (e.dialogo) { pasoDialogo(s, e, pulsa); animarVecinos(s, e, true); return e; }

  if (j.muerto) {
    j.muerto++;
    if (j.muerto > 150 && pulsa & BOTON.A) { // reaparece en la plaza con la vida llena
      const p = posDe(m, s.datos.inicio); Object.assign(j, { x: p.x, y: p.y, vida: j.vidaMax, muerto: 0, invuln: INVULN_F, empuje: null, espada: 0 });
    }
    return e;
  }

  // ---- jugador
  if (j.invuln) j.invuln--;
  let dx = 0, dy = 0;
  if (bits & BOTON.IZQ) dx -= 1; if (bits & BOTON.DER) dx += 1;
  if (bits & BOTON.ARRIBA) dy -= 1; if (bits & BOTON.ABAJO) dy += 1;
  if (j.empuje) {
    mover(m, j, j.empuje.vx, j.empuje.vy, bloqueoVecinos(e, j));
    if (--j.empuje.t <= 0) j.empuje = null;
  } else if (j.espada) {
    j.espada--;
  } else {
    if (dx || dy) {
      // la dirección mira hacia el eje nuevo, o se mantiene si sigue pulsado
      if (dx && !dy) j.dir = dx < 0 ? DIR.IZQ : DIR.DER;
      else if (dy && !dx) j.dir = dy < 0 ? DIR.ARRIBA : DIR.ABAJO;
      else if (!((j.dir === DIR.IZQ && dx < 0) || (j.dir === DIR.DER && dx > 0) || (j.dir === DIR.ARRIBA && dy < 0) || (j.dir === DIR.ABAJO && dy > 0))) j.dir = dy < 0 ? DIR.ARRIBA : DIR.ABAJO;
      const v = dx && dy ? VEL_DIAG : VEL;
      const movido = mover(m, j, dx * v, dy * v, bloqueoVecinos(e, j));
      j.anda = movido ? j.anda + 1 : 0;
      if (movido && j.anda % 16 === 8) e.eventos.push({ tipo: 'paso', x: j.x / SUB, y: j.y / SUB, suelo: letra(m, Math.floor(j.x / SUB / T), Math.floor(j.y / SUB / T)) });
    } else j.anda = 0;
    if (pulsa & BOTON.A) {
      // ¿hay alguien delante para hablar?
      const p = delante(j, 12);
      const v = e.vecinos.find((q) => cerca(q, p, 12));
      if (v) {
        const def = s.datos.vecinos[v.k];
        v.dir = j.dir === DIR.ABAJO ? DIR.ARRIBA : j.dir === DIR.ARRIBA ? DIR.ABAJO : j.dir === DIR.IZQ ? DIR.DER : DIR.IZQ;
        v.anda = 0; v.pausa = 120;
        abrirDialogo(e, v, def);
        return e;
      }
      // ¿un cartel de calle? (la baldosa de delante es una puerta)
      j.espada = ESPADA_F; j.anda = 0;
      e.eventos.push({ tipo: 'espada', x: j.x / SUB, y: j.y / SUB, dir: j.dir });
    }
  }
  // golpe de espada: activo en los fotogramas centrales del barrido
  if (j.espada && j.espada < ESPADA_F - 3 && j.espada > 4) golpear(s, e, j);

  // calle actual (para el cartel del HUD)
  const ci = Math.floor(j.x / SUB / T), cj = Math.floor((j.y / SUB - 3) / T);
  const c = m.calle[cj * m.W + ci];
  if (c && c !== e.calle) { e.calle = c; e.calleT = 0; }
  else e.calleT++;

  // ---- objetos del suelo
  for (const o of e.objetos) {
    o.t++; o.vida--;
    if (cerca(o, { x: j.x, y: j.y - 4 * SUB }, 10)) {
      o.vida = 0;
      if (o.tipo === 'chavo') { j.chavos = Math.min(999, j.chavos + 1); e.eventos.push({ tipo: 'recoger', x: o.x / SUB, y: o.y / SUB }); }
      else { j.vida = Math.min(j.vidaMax, j.vida + 2); e.eventos.push({ tipo: 'corazon', x: o.x / SUB, y: o.y / SUB }); }
    }
  }
  e.objetos = e.objetos.filter((o) => o.vida > 0);

  pasoEnemigos(s, e);
  animarVecinos(s, e, false);
  return e;
}

function golpear(s, e, j) {
  const p = delante(j, 11);
  for (const mt of e.matas) {
    if (!mt.vivo) continue;
    const mx = (mt.i * T + 8) * SUB, my = (mt.j * T + 12) * SUB;
    if (Math.abs(mx - p.x) < 12 * SUB && Math.abs(my - p.y) < 12 * SUB) {
      mt.vivo = 0; e.eventos.push({ tipo: 'arbusto', x: mx / SUB, y: my / SUB }); soltar(e, mx, my);
    }
  }
  for (const en of e.enemigos) {
    if (en.muerto || en.golpe) continue;
    if (Math.abs(en.x - p.x) < 13 * SUB && Math.abs(en.y - p.y) < 13 * SUB) {
      en.vida--; en.golpe = 16;
      const dx = en.x - j.x, dy = en.y - j.y, L = Math.hypot(dx, dy) || 1;
      en.vx = Math.round((dx / L) * 56); en.vy = Math.round((dy / L) * 56);
      e.eventos.push({ tipo: 'golpe', x: en.x / SUB, y: en.y / SUB });
      if (en.vida <= 0) { en.muerto = 1; soltar(e, en.x, en.y); }
    }
  }
}

function pasoEnemigos(s, e) {
  const m = s.mundo, j = e.jugador;
  for (const en of e.enemigos) {
    if (en.muerto) { if (en.muerto < 40) en.muerto++; continue; }
    // solo se simulan los que están cerca del jugador (como en las consolas de antes)
    if (Math.abs(en.x - j.x) > 300 * SUB || Math.abs(en.y - j.y) > 200 * SUB) continue;
    en.t++;
    if (en.golpe) {
      en.golpe--; mover(m, en, en.vx, en.vy); en.vx = (en.vx * 7) >> 3; en.vy = (en.vy * 7) >> 3;
      continue;
    }
    const dx = j.x - en.x, dy = j.y - en.y, d = Math.hypot(dx, dy) / SUB;
    if (en.estado === 'vaga' && d < 64 && !j.muerto) { en.estado = 'aviso'; en.t = 0; }
    if (en.estado === 'aviso') { // se para y levanta la cola: se telegrafía antes de atacar
      if (en.t > 24) { en.estado = 'persigue'; en.t = 0; }
    } else if (en.estado === 'persigue') {
      if (d > 110 || j.muerto) { en.estado = 'vaga'; en.t = 0; }
      else {
        const v = 11, ux = dx / (d * SUB || 1), uy = dy / (d * SUB || 1);
        const movido = mover(m, en, Math.round(ux * v), Math.round(uy * v));
        en.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? DIR.IZQ : DIR.DER) : dy < 0 ? DIR.ARRIBA : DIR.ABAJO;
        en.anda = movido ? en.anda + 1 : 0;
      }
    } else {
      // vaga cerca de su sitio
      if (en.t % 90 === 0) { const a = entero(e.rng, 5); en.dir = a < 4 ? a : en.dir; en.vx = a < 4 ? 1 : 0; }
      if (en.vx) { const movido = mover(m, en, DX[en.dir] * 6, DY[en.dir] * 6); en.anda = movido ? en.anda + 1 : 0; if (!movido) en.vx = 0; }
      if (Math.abs(en.x - en.x0) > 48 * SUB || Math.abs(en.y - en.y0) > 48 * SUB) { en.dir = en.x > en.x0 ? DIR.IZQ : DIR.DER; }
    }
    if (!j.invuln && Math.abs(dx) < 10 * SUB && Math.abs(dy) < 9 * SUB) dañar(e, j, en);
  }
  e.enemigos = e.enemigos.filter((en) => en.muerto < 40 || Math.abs(en.x - j.x) < 400 * SUB);
}

function animarVecinos(s, e, quietos) {
  for (const v of e.vecinos) {
    const def = s.datos.vecinos[v.k];
    if (quietos || def.mover !== 'pasear') { v.anda = 0; continue; }
    if (v.pausa > 0) { v.pausa--; v.anda = 0; continue; }
    const movido = mover(s.mundo, v, DX[v.dir] * 8, DY[v.dir] * 8, bloqueoVecinos(e, v));
    v.anda = movido ? v.anda + 1 : 0;
    const lejos = Math.abs(v.x - v.casa.x) > (def.radio || 3) * T * SUB || Math.abs(v.y - v.casa.y) > (def.radio || 3) * T * SUB;
    if (!movido || lejos || azar(e.rng) < 0.01) {
      v.pausa = 40 + entero(e.rng, 120);
      v.dir = lejos ? (Math.abs(v.x - v.casa.x) > Math.abs(v.y - v.casa.y) ? (v.x > v.casa.x ? DIR.IZQ : DIR.DER) : v.y > v.casa.y ? DIR.ARRIBA : DIR.ABAJO) : entero(e.rng, 4);
    }
  }
}

// partida guardada: todo menos el mundo y los datos
export const guardar = (s) => JSON.stringify(s.estado);
export const cargar = (s, txt) => { s.estado = JSON.parse(txt); };
