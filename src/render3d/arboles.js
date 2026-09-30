// Árboles: copas hechas de racimos de hojas pintadas (tarjetas que miran a la cámara) y palmeras de hojas
// colgantes. Todo instanciado: una llamada de dibujo por tipo de pieza.
import * as THREE from 'three';
import { parchear, U } from './comun.js';

function lienzo(w, h, f) { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; return t; }
const azar = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

// racimo de hojas: muchas hojitas en 3 tonos, más claras arriba (la luz), estilo píxel
function texturaRacimo(tonos) {
  return lienzo(96, 96, (g, w, h) => {
    const r = azar(7);
    // hojitas alargadas en grupos pequeños, huecos entre ellas para que la copa respire
    for (let k = 0; k < 900; k++) {
      const a = r() * Math.PI * 2, d = Math.pow(r(), 0.6) * 42;
      const x = 48 + Math.cos(a) * d, y = 49 + Math.sin(a) * d * 0.85;
      if (Math.hypot(x - 48, (y - 49) / 0.85) > 44) continue;
      const luz = (48 - y) / 44 + (r() - 0.5) * 0.7;
      g.fillStyle = luz > 0.4 ? tonos[2] : luz > -0.2 ? tonos[1] : tonos[0];
      const horiz = r() < 0.5;
      g.fillRect(x | 0, y | 0, horiz ? 2 : 1, horiz ? 1 : 2);
    }
  });
}
function texturaHojaPalma() {
  return lienzo(32, 128, (g, w, h) => {
    for (let y = 0; y < h; y++) {
      const t = y / h, ancho = Math.sin(t * Math.PI) * 13 + 1;
      g.fillStyle = '#6b5a2e'; g.fillRect(15, y, 2, 1);
      for (let x = 0; x < ancho; x += 1) {
        if ((y + x * 3) % 5 === 0) continue;
        g.fillStyle = x > ancho * 0.6 ? '#3d6b2c' : (y % 4 < 2 ? '#5c8f3a' : '#4d7d33');
        g.fillRect(16 + x, y + (x * 0.5 | 0), 1, 1); g.fillRect(15 - x, y + (x * 0.5 | 0), 1, 1);
      }
    }
  });
}

// billboard instanciado: cada instancia es un centro + escala; el quad mira a la cámara (o a la luz en la pasada de sombras)
function materialBillboard(tex, extraColor = '') {
  const vs = /* glsl */ `
    vec4 cen = instanceMatrix * vec4(0., 0., 0., 1.);
    float sc = length(instanceMatrix[0].xyz);
    vec3 der = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 arr = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 wp = cen.xyz + (der * position.x + arr * position.y) * sc;
    mvPosition = viewMatrix * vec4(wp, 1.);
    gl_Position = projectionMatrix * mvPosition;`;
  const m = parchear(new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }), { corte: true, corteEscala: 1.9, vsFin: vs, color: extraColor });
  const d = new THREE.MeshDepthMaterial({ map: tex, alphaTest: 0.5, depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  d.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + vs); };
  return [m, d];
}

export function crearArboles(arboles, { filtro = () => true, extra = [] } = {}) {
  const g = new THREE.Group();
  const lista = [];
  for (const [i, j, r] of arboles) if (filtro(i, j)) lista.push({ x: i * 2 + 1, z: j * 2 + 1, r, tipo: null });
  for (const e of extra) lista.push(e);
  const rnd = azar(12345);
  for (const t of lista) if (!t.tipo) t.tipo = t.r >= 3 ? 'eucalipto' : rnd() < 0.35 ? 'palmera' : 'ficus';

  // troncos (cilindros) para todos
  const troncos = [], racimos = [], hojas = [];
  for (const t of lista) {
    // alturas de juego (encogidas respecto a las reales) para que las copas no tapen la calle
    const alto = t.tipo === 'palmera' ? 5 + rnd() * 1.5 : t.tipo === 'eucalipto' ? 3.4 + t.r * 0.4 : 2 + t.r * 0.4;
    const grosor = t.tipo === 'palmera' ? 0.24 : t.tipo === 'eucalipto' ? 0.17 + t.r * 0.03 : 0.13;
    troncos.push({ t, alto, grosor });
    if (t.tipo === 'palmera') {
      for (let k = 0; k < 11; k++) hojas.push({ t, alto, ang: (k / 11) * Math.PI * 2 + rnd() * 0.3, caida: 0.3 + rnd() * 0.5, largo: 2.6 + rnd() * 0.8 });
    } else {
      const R = t.tipo === 'eucalipto' ? 1.3 + t.r * 0.7 : 1 + t.r * 0.55;
      const n = Math.round(14 + R * 7);
      for (let k = 0; k < n; k++) {
        const a = rnd() * Math.PI * 2, b = Math.acos(2 * rnd() - 1), d = Math.cbrt(rnd());
        const x = Math.sin(b) * Math.cos(a) * R * d, y = Math.cos(b) * R * 0.7 * d, z = Math.sin(b) * Math.sin(a) * R * d;
        racimos.push({ x: t.x + x, y: alto + R * 0.25 + y, z: t.z + z, s: R * (0.5 + rnd() * 0.3), luz: 0.75 + 0.35 * ((y / R + 1) / 2) + rnd() * 0.1, tipo: t.tipo });
      }
    }
  }
  // troncos
  const geoT = new THREE.CylinderGeometry(0.7, 1, 1, 6, 1); geoT.translate(0, 0.5, 0);
  const matT = parchear(new THREE.MeshLambertMaterial({ color: 0xffffff }), { corte: true, color: 'diffuseColor.rgb *= vec3(1.);' });
  const troncoI = new THREE.InstancedMesh(geoT, matT, troncos.length);
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  troncos.forEach(({ t, alto, grosor }, k) => {
    m4.makeScale(grosor, alto + 0.6, grosor).setPosition(t.x, 0, t.z);
    troncoI.setMatrixAt(k, m4);
    troncoI.setColorAt(k, c.set(t.tipo === 'palmera' ? '#8a6d4a' : t.tipo === 'eucalipto' ? '#d8cdb8' : '#7a6650'));
  });
  troncoI.castShadow = true; troncoI.receiveShadow = true; g.add(troncoI);

  // racimos de hojas
  const texR = texturaRacimo(['#3e6a33', '#6a9844', '#a9c766']);
  const [matR, depR] = materialBillboard(texR);
  const geoR = new THREE.PlaneGeometry(1, 1);
  const racI = new THREE.InstancedMesh(geoR, matR, racimos.length);
  racI.customDepthMaterial = depR;
  racimos.forEach((q, k) => {
    m4.makeScale(q.s, q.s, q.s).setPosition(q.x, q.y, q.z);
    racI.setMatrixAt(k, m4);
    const base = q.tipo === 'eucalipto' ? '#b9c79a' : '#ffffff';
    racI.setColorAt(k, c.set(base).multiplyScalar(q.luz));
  });
  racI.castShadow = true; racI.receiveShadow = true; racI.frustumCulled = false; g.add(racI);

  // hojas de palmera: planos fijos que cuelgan desde la copa
  if (hojas.length) {
    const texH = texturaHojaPalma();
    const geoH = new THREE.PlaneGeometry(0.9, 1, 1, 4); geoH.translate(0, -0.5, 0); geoH.rotateX(-Math.PI / 2);
    // curva: cada vértice cae según lo lejos que está del tronco
    const pos = geoH.attributes.position;
    for (let k = 0; k < pos.count; k++) { const z = pos.getZ(k); pos.setY(k, -z * z * 0.55); }
    geoH.computeVertexNormals();
    const matH = parchear(new THREE.MeshLambertMaterial({ map: texH, alphaTest: 0.5, side: THREE.DoubleSide }), { corte: true, corteEscala: 1.9 });
    const hojI = new THREE.InstancedMesh(geoH, matH, hojas.length);
    const q = new THREE.Quaternion(), e = new THREE.Euler();
    hojas.forEach((h, k) => {
      e.set(-h.caida, h.ang, 0, 'YXZ'); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(h.t.x, h.alto + 0.5, h.t.z), q, new THREE.Vector3(h.largo * 0.9, h.largo, h.largo));
      hojI.setMatrixAt(k, m4);
    });
    hojI.castShadow = true; g.add(hojI);
  }
  return g;
}
