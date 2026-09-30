// Mobiliario urbano y piezas a mano de la zona (src/data/zona-plaza.json): farolas, bancos, maceteros,
// terraza, pérgola, coches… Piezas low-poly con color plano; cada tipo se construye una vez y se clona.
import * as THREE from 'three';
import { parchear } from './comun.js';

const cacheMat = new Map();
function mat(hex) {
  if (!cacheMat.has(hex)) cacheMat.set(hex, parchear(new THREE.MeshLambertMaterial({ color: hex }), { corte: true }));
  return cacheMat.get(hex);
}
const caja = (w, h, d, hex, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex)); m.position.set(x, y + h / 2, z); return m; };
const cil = (r, h, hex, x = 0, y = 0, z = 0, lados = 8, r2 = r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, lados), mat(hex)); m.position.set(x, y + h / 2, z); return m; };

const PIEZAS = {
  farola(o) { // farola de forja negra con farol de cuatro caras
    const g = new THREE.Group(), n = o.color || '#1f1f22';
    g.add(cil(0.14, 0.4, n, 0, 0, 0, 8, 0.18), cil(0.06, 3.1, n, 0, 0.4), cil(0.12, 0.12, n, 0, 3.45));
    g.add(caja(0.34, 0.45, 0.34, '#f3d9a0', 0, 3.55), caja(0.44, 0.08, 0.44, n, 0, 4.0), cil(0.03, 0.25, n, 0, 4.08));
    return g;
  },
  banco(o) {
    const g = new THREE.Group(), w = o.w || 1.8, m = o.color || '#8a5a36';
    for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) g.add(caja(0.08, 0.45, 0.5, '#2a2a2c', x, 0, 0));
    g.add(caja(w, 0.06, 0.45, m, 0, 0.42, 0), caja(w, 0.35, 0.05, m, 0, 0.55, 0.22));
    return g;
  },
  papelera(o) { const g = new THREE.Group(); g.add(cil(0.22, 0.8, o.color || '#3b4a3a', 0, 0, 0, 10)); return g; },
  macetero(o) {
    const g = new THREE.Group(), w = o.w || 1.2, d = o.d || 0.6;
    g.add(caja(w, 0.55, d, o.color || '#e8e2d6'));
    for (let k = 0; k < 5; k++) g.add(cil(0.22 + 0.08 * (k % 2), 0.45, k % 2 ? '#4f7d34' : '#6b9a3c', (k / 4 - 0.5) * (w - 0.3), 0.5, (k % 2 - 0.5) * 0.15, 6));
    g.add(cil(0.1, 0.12, '#d4506a', w * 0.2, 0.95, 0), cil(0.1, 0.12, '#e8c24a', -w * 0.25, 0.95, 0.05));
    return g;
  },
  mesa_terraza(o) { // mesa con cuatro sillas blancas
    const g = new THREE.Group(), b = o.color || '#f4f2ee';
    g.add(cil(0.04, 0.72, '#9a9a9a'), cil(0.38, 0.04, b, 0, 0.72, 0, 16));
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2, x = Math.cos(a) * 0.62, z = Math.sin(a) * 0.62;
      const s = new THREE.Group(); s.add(caja(0.42, 0.05, 0.42, b, 0, 0.44), caja(0.42, 0.45, 0.05, b, 0, 0.47, 0.2));
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) s.add(caja(0.03, 0.44, 0.03, '#d8d8d8', lx, 0, lz));
      s.position.set(x, 0, z); s.rotation.y = -a + Math.PI / 2; g.add(s);
    }
    return g;
  },
  pergola(o) { // pérgola blanca de arcos con malla de sombreo
    const g = new THREE.Group(), w = o.w || 8, d = o.d || 5, h = o.h || 2.9, b = o.color || '#f2f2ef';
    const nArcos = Math.max(2, Math.round(w / 2.6));
    for (let k = 0; k <= nArcos; k++) {
      const x = -w / 2 + (k / nArcos) * w;
      g.add(cil(0.05, h, b, x, 0, -d / 2, 6), cil(0.05, h, b, x, 0, d / 2, 6));
      const arco = new THREE.Mesh(new THREE.TorusGeometry(d / 2, 0.045, 5, 16, Math.PI), mat(b));
      arco.rotation.y = Math.PI / 2; arco.scale.set(1, 0.35, 1); arco.position.set(x, h, 0); g.add(arco);
    }
    // malla de sombreo: plano curvado siguiendo los arcos
    const gm = new THREE.PlaneGeometry(w, d, 1, 8); gm.rotateX(-Math.PI / 2);
    const pm = gm.attributes.position;
    for (let k = 0; k < pm.count; k++) { const z = pm.getZ(k) / (d / 2); pm.setY(k, h + (d / 2) * 0.35 * Math.sqrt(Math.max(0, 1 - z * z))); }
    gm.computeVertexNormals();
    const malla = new THREE.Mesh(gm, parchear(new THREE.MeshLambertMaterial({ color: '#e8e1cf', transparent: true, opacity: 0.6, side: THREE.DoubleSide }), { corte: true }));
    g.add(malla);
    return g;
  },
  toldo(o) { const g = new THREE.Group(); const t = caja(o.w || 3, 0.06, o.d || 1.2, o.color || '#2f6f4a', 0, o.h || 2.6, (o.d || 1.2) / 2); t.rotation.x = -0.25; g.add(t); return g; },
  bolardo(o) { const g = new THREE.Group(); g.add(cil(0.08, 0.8, o.color || '#2a2a2c', 0, 0, 0, 8)); return g; },
  senal(o) { const g = new THREE.Group(); g.add(cil(0.035, 2.4, '#8a8a8a'), caja(0.5, 0.5, 0.04, o.color || '#2e5fb0', 0, 2.1)); return g; },
  coche(o) {
    const g = new THREE.Group(), c = o.color || '#c8c8c8', L = o.w || 4, A = o.d || 1.75;
    g.add(caja(L, 0.62, A, c, 0, 0.3), caja(L * 0.55, 0.5, A * 0.9, c, -L * 0.05, 0.92), caja(L * 0.53, 0.42, A * 0.92, '#2c3440', -L * 0.05, 0.96));
    for (const [x, z] of [[L * 0.32, A / 2], [-L * 0.32, A / 2], [L * 0.32, -A / 2], [-L * 0.32, -A / 2]]) { const r = cil(0.32, 0.22, '#1c1c1c', x, 0.32, z, 10); r.rotation.x = Math.PI / 2; g.add(r); }
    return g;
  },
  alcorque(o) { const g = new THREE.Group(); g.add(caja(o.w || 1.2, 0.08, o.d || 1.2, '#b9b2a4'), caja((o.w || 1.2) - 0.2, 0.09, (o.d || 1.2) - 0.2, '#6b5238')); return g; },
  caja(o) { const g = new THREE.Group(); g.add(caja(o.w || 1, o.h || 1, o.d || 1, o.color || '#cccccc')); return g; },
};

export function crearMobiliario(objetos = []) {
  const g = new THREE.Group();
  for (const o of objetos) {
    const f = PIEZAS[o.tipo]; if (!f) continue;
    const p = f(o);
    p.position.set(o.i * 2, 0, o.j * 2);
    p.rotation.y = (-(o.rot || 0) * Math.PI) / 180;
    p.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    g.add(p);
  }
  return g;
}
