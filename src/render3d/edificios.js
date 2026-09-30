// Edificios en 3D a partir de la planta real (Catastro) y del aspecto visto en las fotos (Street View).
// Paredes con ventanas, persianas, zócalo y puertas pintadas por sombreador (sin texturas);
// tejados de teja a dos aguas sobre el rectángulo mínimo de la planta, o azotea con pretil.
import * as THREE from 'three';
import { M_POR_BALDOSA as MB, parchear } from './comun.js';

// plantas algo más bajas que las reales (2,6 m): en HD-2D los edificios se encogen para que se vea la calle
const ALTO_PLANTA = 2.6;
const col = (hex, def) => new THREE.Color(hex || def);
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000; };

// rectángulo mínimo que contiene el polígono (prueba la orientación de cada lado)
function rectMinimo(pts) {
  let mejor = null;
  for (let k = 0; k < pts.length; k++) {
    const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % pts.length];
    const L = Math.hypot(bx - ax, by - ay); if (L < 0.2) continue;
    const ux = (bx - ax) / L, uy = (by - ay) / L;
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const [x, y] of pts) { const a = x * ux + y * uy, b = -x * uy + y * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
    const area = (a1 - a0) * (b1 - b0);
    if (!mejor || area < mejor.area) mejor = { area, ux, uy, a0, a1, b0, b1 };
  }
  return mejor;
}

class Acum {
  constructor(conColores) { this.p = []; this.n = []; this.uv = []; this.c = []; this.c2 = []; this.c3 = []; this.x = []; this.idx = []; this.conColores = conColores; }
  vert(p, n, uv, c, c2, c3, x) {
    this.p.push(...p); this.n.push(...n); this.uv.push(...uv);
    if (this.conColores) { this.c.push(c.r, c.g, c.b); this.c2.push(c2.r, c2.g, c2.b); this.c3.push(c3.r, c3.g, c3.b); this.x.push(...x); }
    return this.p.length / 3 - 1;
  }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.conColores) {
      g.setAttribute('aPared', new THREE.Float32BufferAttribute(this.c, 3));
      g.setAttribute('aPersiana', new THREE.Float32BufferAttribute(this.c2, 3));
      g.setAttribute('aZocalo', new THREE.Float32BufferAttribute(this.c3, 3));
      g.setAttribute('aDatos', new THREE.Float32BufferAttribute(this.x, 4));
    }
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

const BAJO = { house: 0, casa: 0, shop: 1, tienda: 1, bar: 1, office: 1, garage: 2, garaje: 2, wall: 3, church: 4, iglesia: 4, terrace: 1 };

export function crearEdificios(mundo, { filtro = () => true, extra = {} } = {}) {
  const paredes = new Acum(true), tejas = new Acum(false), azoteas = new Acum(false);
  const huellas = [];
  mundo.edificios.forEach((e, k) => {
    if (!filtro(e)) return;
    const a = { ...(e.aspecto || {}), ...(extra[e.ref] || {}) };
    const plantas = Math.max(1, a.plantas || e.plantas || 1);
    const H = plantas * ALTO_PLANTA + 0.3;
    const pared = col(a.color, '#f2eee4'), pers = col(a.persiana || a.remate || a.reja, '#5d7a4e'), zoc = col(a.zocalo || a.bajoColor, a.color || '#d8cfbf');
    const zocAlto = a.zocalo ? a.zocaloAlto || 0.9 : 0;
    const bajo = BAJO[a.bajo] ?? 0;
    const teja = a.tejado === 'tile' || a.tejado === 'teja';
    const semilla = hash(e.ref);
    for (const poly of e.polys) {
      const pts = poly.map(([x, y]) => [x * MB, y * MB]);
      if (pts.length > 2 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
      // orientación: queremos las normales hacia fuera
      let area = 0; for (let q = 0; q < pts.length; q++) { const [x0, y0] = pts[q], [x1, y1] = pts[(q + 1) % pts.length]; area += x0 * y1 - x1 * y0; }
      const sentido = area > 0 ? 1 : -1;
      huellas.push({ pts, H, ref: e.ref });
      const altoPared = H + (teja ? 0 : 0.5); // pretil de las azoteas
      for (let q = 0; q < pts.length; q++) {
        const [x0, z0] = pts[q], [x1, z1] = pts[(q + 1) % pts.length];
        const L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.05) continue;
        const nx = (sentido * (z1 - z0)) / L, nz = (-sentido * (x1 - x0)) / L;
        // datos por pared: tipo de planta baja, largo, zócalo, semilla
        const d = [bajo, L, zocAlto, (semilla + q * 0.137) % 1];
        const v0 = paredes.vert([x0, 0, z0], [nx, 0, nz], [0, 0], pared, pers, zoc, d);
        const v1 = paredes.vert([x1, 0, z1], [nx, 0, nz], [L, 0], pared, pers, zoc, d);
        const v2 = paredes.vert([x1, altoPared, z1], [nx, 0, nz], [L, altoPared], pared, pers, zoc, d);
        const v3 = paredes.vert([x0, altoPared, z0], [nx, 0, nz], [0, altoPared], pared, pers, zoc, d);
        if (sentido > 0) paredes.quad(v0, v3, v2, v1); else paredes.quad(v0, v1, v2, v3);
      }
      if (teja) tejado(tejas, paredes, pts, H, pared, pers, zoc, semilla);
      else {
        // azotea: el suelo del tejado un poco por debajo del pretil
        const tri = THREE.ShapeUtils.triangulateShape(pts.map(([x, z]) => new THREE.Vector2(x, z)), []);
        const base = azoteas.p.length / 3;
        for (const [x, z] of pts) azoteas.vert([x, H + 0.05, z], [0, 1, 0], [x, z]);
        for (const [a0, b0, c0] of tri) azoteas.idx.push(base + a0, base + c0, base + b0);
      }
    }
  });

  const matPared = parchear(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), {
    corte: true,
    vsCab: 'attribute vec3 aPared, aPersiana, aZocalo; attribute vec4 aDatos; varying vec3 vPared, vPers, vZoc; varying vec4 vDatos; varying vec2 vUvP; varying float vNy;',
    vsFin: 'vPared = aPared; vPers = aPersiana; vZoc = aZocalo; vDatos = aDatos; vUvP = uv; vNy = normal.y;',
    fsCab: 'varying vec3 vPared, vPers, vZoc; varying vec4 vDatos; varying vec2 vUvP; varying float vNy;',
    color: /* glsl */ `
      vec3 c = vPared;
      float u = vUvP.x, v = vUvP.y, L = vDatos.y, bajo = vDatos.x, sem = vDatos.w;
      float nH = max(1., floor(L / 3.2 + .5)), anchoH = L / nH;
      float hueco = floor(u / anchoH), fu = u - hueco * anchoH, cu = fu / anchoH;
      float planta = floor(v / 2.6), fv = (v - planta * 2.6) * (3.1 / 2.6);
      float rnd = h21(vec2(hueco, planta) + sem * 17.);
      // enfoscado: ligera irregularidad y suciedad abajo
      c *= .94 + .08 * fbm(vec2(u, v) * 1.7 + sem * 9.);
      c *= mix(.86, 1., smoothstep(0., 1.4, v));
      if (vNy < .5) {
        bool esBajo = planta < .5;
        // ventana (plantas altas) o puerta/escaparate (planta baja)
        float x0 = .5 - .2, x1 = .5 + .2, y0 = 1., y1 = 2.3;
        float puerta = 0.;
        if (esBajo) {
          float h0 = h21(vec2(sem * 31., 1.));
          bool esPuerta = abs(hueco - floor(h0 * nH)) < .5;
          if (bajo > .5 && bajo < 1.5) { x0 = .08; x1 = .92; y0 = .35; y1 = 2.6; }                  // escaparate
          else if (bajo > 1.5 && bajo < 2.5 && esPuerta) { x0 = .1; x1 = .9; y0 = 0.; y1 = 2.5; puerta = 2.; } // garaje
          else if (bajo > 3.5) { x0 = .3; x1 = .7; y0 = 0.; y1 = 2.6; puerta = 1.; }             // iglesia
          else if (esPuerta) { x0 = .32; x1 = .68; y0 = 0.; y1 = 2.25; puerta = 1.; }
        }
        bool enHueco = cu > x0 && cu < x1 && fv > y0 && fv < y1 && true && bajo < 2.9;
        if (enHueco) {
          float yy = (fv - y0) / (y1 - y0), xx = (cu - x0) / (x1 - x0);
          if (puerta > 1.5) c = lin(vec3(.78,.77,.74)) * (.85 + .15 * step(.5, fract(yy * 12.)));            // chapa del garaje
          else if (puerta > .5) c = mix(vPers * .55, vPers * .75, step(.5, fract(xx * 2.))) * (.9 + .1 * step(.9, fract(yy * 5.)));
          else {
            vec3 vidrio = mix(lin(vec3(.18,.22,.27)), lin(vec3(.42,.5,.56)), smoothstep(.2, 1., yy) * .6);
            c = vidrio;
            // persiana alicantina medio bajada en muchas ventanas
            float bajada = (bajo > .5 && esBajo) ? 0. : step(.35, rnd) * (.25 + .55 * h21(vec2(rnd, 3.)));
            if (1. - yy < bajada) c = vPers * (.8 + .25 * step(.5, fract(yy * 22.)));
            // marco
            if (xx < .06 || xx > .94 || yy < .05 || yy > .95) c = vec3(.9, .88, .84) * .9;
          }
        } else {
          // alféizar bajo la ventana y sombra del hueco
          if (!esBajo && cu > x0 - .03 && cu < x1 + .03 && fv > y0 - .12 && fv < y0) c = lin(vec3(.93,.91,.87));
          if (cu > x0 && cu < x1 && fv > y1 && fv < y1 + .12 && !(esBajo && bajo > .5 && bajo < 1.5)) c *= .8;
        }
        // zócalo
        if (v < vDatos.z && !enHueco) c = vZoc * (.9 + .15 * ruido(vec2(u, v) * 6.));
        // cornisa entre plantas
        if (abs(fv - 3.0) < .06) c *= .82;
      } else c = vPared * .9;
      diffuseColor.rgb = c;
    `,
  });
  const matTeja = parchear(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), {
    corte: true,
    vsCab: 'varying vec2 vUvT;', vsFin: 'vUvT = uv;', fsCab: 'varying vec2 vUvT;',
    color: /* glsl */ `
      vec2 q = vUvT * vec2(1. / .24, 1. / .32);
      float fila = floor(q.y), col = floor(q.x + fila * .5);
      float fx = fract(q.x + fila * .5), fy = fract(q.y);
      float canal = sin(fx * 3.14159);
      vec3 t = mix(lin(vec3(.66,.31,.20)), lin(vec3(.80,.43,.28)), h21(vec2(col, fila)));
      t = mix(t, lin(vec3(.55,.40,.30)), step(.9, h21(vec2(fila, col))) * .6);
      t *= .72 + .38 * canal;
      t *= mix(.65, 1., smoothstep(0., .25, fy));
      diffuseColor.rgb = t;
    `,
  });
  const matAzotea = parchear(new THREE.MeshLambertMaterial(), {
    corte: true,
    vsCab: 'varying vec2 vUvA;', vsFin: 'vUvA = uv;', fsCab: 'varying vec2 vUvA;',
    color: /* glsl */ `
      vec2 f = fract(vUvA / 1.);
      vec3 c = lin(vec3(.83,.80,.74)) * (.88 + .14 * fbm(vUvA * .8));
      c *= .93 + .07 * step(.03, f.x) * step(.03, f.y);
      diffuseColor.rgb = c;
    `,
  });
  const g = new THREE.Group();
  for (const [acum, mat] of [[paredes, matPared], [tejas, matTeja], [azoteas, matAzotea]]) {
    if (!acum.idx.length) continue;
    const m = new THREE.Mesh(acum.geo(), mat);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  g.userData.huellas = huellas;
  return g;
}

function tejado(tejas, paredes, pts, H, pared, pers, zoc, semilla) {
  const r = rectMinimo(pts); if (!r) return;
  const vuelo = 0.3, pend = Math.tan((24 * Math.PI) / 180);
  let { ux, uy, a0, a1, b0, b1 } = r;
  // la cumbrera va a lo largo del lado largo
  let largo = a1 - a0, corto = b1 - b0;
  const P = (a, b) => [a * ux - b * uy, a * uy + b * ux];
  let A = (a, b) => P(a, b);
  if (corto > largo) { // gira ejes
    [largo, corto] = [corto, largo];
    const [oa0, oa1, ob0, ob1] = [a0, a1, b0, b1];
    a0 = ob0; a1 = ob1; b0 = oa0; b1 = oa1;
    A = (a, b) => P(b, a);
  }
  const hc = (corto / 2) * pend, bm = (b0 + b1) / 2;
  const e0 = a0 - vuelo, e1 = a1 + vuelo, f0 = b0 - vuelo, f1 = b1 + vuelo;
  const y0 = H - vuelo * pend, yc = H + hc;
  // dos faldones: uv = (a lo largo, a lo largo de la pendiente)
  const falda = (fb, signo) => {
    const s = Math.hypot(Math.abs(fb - bm), yc - y0);
    const pA = A(e0, fb), pB = A(e1, fb), pC = A(e1, bm), pD = A(e0, bm);
    const n = new THREE.Vector3().crossVectors(new THREE.Vector3(pB[0] - pA[0], 0, pB[1] - pA[1]), new THREE.Vector3(pD[0] - pA[0], yc - y0, pD[1] - pA[1])).normalize();
    if (n.y < 0) n.negate();
    const v0 = tejas.vert([pA[0], y0, pA[1]], n.toArray(), [0, 0]);
    const v1 = tejas.vert([pB[0], y0, pB[1]], n.toArray(), [e1 - e0, 0]);
    const v2 = tejas.vert([pC[0], yc, pC[1]], n.toArray(), [e1 - e0, s]);
    const v3 = tejas.vert([pD[0], yc, pD[1]], n.toArray(), [0, s]);
    tejas.quad(v0, v1, v2, v3);
  };
  falda(f0, -1); falda(f1, 1);
  // hastiales (triángulos de pared en los extremos)
  for (const ea of [a0, a1]) {
    const p0 = A(ea, b0), p1 = A(ea, b1), pc = A(ea, bm);
    const d = [3, corto, 0, semilla];
    const base = [
      paredes.vert([p0[0], H, p0[1]], [0, 0, 1], [0, H], pared, pers, zoc, d),
      paredes.vert([p1[0], H, p1[1]], [0, 0, 1], [corto, H], pared, pers, zoc, d),
      paredes.vert([pc[0], yc, pc[1]], [0, 0, 1], [corto / 2, yc], pared, pers, zoc, d),
    ];
    paredes.idx.push(...base);
  }
}
