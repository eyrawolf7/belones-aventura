// Suelo del pueblo: una sola malla y un sombreador que pinta cada material del suelo a partir de
// una máscara hecha con las calles REALES (curvas suaves, sin escalones) y los tipos de baldosa.
import * as THREE from 'three';
import { M_POR_BALDOSA, parchear } from './comun.js';

const RES = 4; // texeles de máscara por baldosa (0,5 m)

function mascaraCalles(mundo, plazas = []) {
  const W = mundo.W * RES, H = mundo.H * RES;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.lineCap = 'round'; g.lineJoin = 'round';
  // plazas por baldosa (el azul), luego aceras (verde) y asfalto (rojo) encima, con su ancho real
  g.fillStyle = '#0000ff';
  for (let j = 0; j < mundo.H; j++) for (let i = 0; i < mundo.W; i++) if (mundo.suelo[j * mundo.W + i] === 122 /* z */) g.fillRect(i * RES, j * RES, RES, RES);
  const trazar = (v, ancho, color) => {
    g.strokeStyle = color; g.lineWidth = ancho * RES; g.beginPath();
    v.p.forEach(([x, y], k) => (k ? g.lineTo(x * RES, y * RES) : g.moveTo(x * RES, y * RES)));
    g.stroke();
  };
  for (const pl of plazas) { g.beginPath(); pl.forEach(([x, y], k) => (k ? g.lineTo(x * RES, y * RES) : g.moveTo(x * RES, y * RES))); g.closePath(); g.fill(); }
  for (const v of mundo.vias) trazar(v, v.w + 2.6, v.plaza ? '#0000ff' : '#00ff00');
  for (const v of mundo.vias) if (!v.plaza) trazar(v, v.w, '#ff0000');
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function texturaTipos(mundo) {
  // un texel por baldosa: 0 campo, 1 solar, 2 patio/muro, (el resto lo decide la máscara)
  const d = new Uint8Array(mundo.W * mundo.H * 4);
  for (let n = 0; n < mundo.W * mundo.H; n++) {
    const l = mundo.suelo[n];
    d[n * 4] = l === 115 ? 255 : 0; // s
    d[n * 4 + 1] = l === 112 || l === 109 ? 255 : 0; // p, m
    d[n * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(d, mundo.W, mundo.H, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; t.flipY = false;
  return t;
}

export function crearSuelo(mundo, { plazas = [] } = {}) {
  const ancho = mundo.W * M_POR_BALDOSA, alto = mundo.H * M_POR_BALDOSA;
  const geo = new THREE.PlaneGeometry(ancho, alto, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(ancho / 2, 0, alto / 2);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const uMasc = { value: mascaraCalles(mundo, plazas) }, uTipos = { value: texturaTipos(mundo) };
  const uTam = { value: new THREE.Vector2(ancho, alto) };
  parchear(mat, {
    vsCab: 'varying vec3 vMundo;',
    vsFin: 'vMundo = (modelMatrix * vec4(transformed, 1.)).xyz;',
    fsCab: /* glsl */ `
      uniform sampler2D uMasc, uTipos; uniform vec2 uTam; varying vec3 vMundo;
      vec3 espiga(vec2 p){ // ladrillo en espiga, 24x12 cm, con juntas
        vec2 q = p * vec2(1./.24, 1./.12);
        float fila = floor((p.x + p.y) / .24);
        vec2 r = mod(fila, 2.) < 1. ? vec2(p.x, p.y) : vec2(p.y, p.x);
        vec2 b = vec2(r.x / .24 + floor(r.y / .12) * .5, r.y / .12);
        vec2 f = fract(b), id = floor(b);
        float junta = step(.06, f.x) * step(f.x, .94) * step(.1, f.y) * step(f.y, .9);
        float h = h21(id + fila * 7.1);
        vec3 lad = mix(lin(vec3(.73,.37,.25)), lin(vec3(.80,.46,.31)), h);
        lad = mix(lad, lin(vec3(.62,.31,.22)), step(.85, h));
        return mix(lin(vec3(.83,.69,.56)), lad, junta);
      }
      vec3 baldosa(vec2 p, vec3 base){ vec2 f = fract(p / .4); vec2 id = floor(p / .4);
        float junta = step(.04, f.x) * step(.04, f.y);
        return mix(base * .86, base * (.95 + .08 * h21(id)), junta); }
      vec3 asfalto(vec2 p){ float n = ruido(p * 9.) * .5 + ruido(p * 31.) * .5;
        vec3 c = lin(vec3(.36,.37,.41)) * (.9 + .2 * n);
        return mix(c, lin(vec3(.55,.55,.56)), step(.93, h21(floor(p * 18.))) * .5); }
      vec3 tierra(vec2 p, float matojos){ float n = fbm(p * .35), m = fbm(p * 2.1 + 3.);
        vec3 c = mix(lin(vec3(.78,.58,.38)), lin(vec3(.84,.66,.45)), n);
        c = mix(c, lin(vec3(.70,.50,.33)), step(.7, ruido(p * 3.)) * .35);
        float hierba = smoothstep(.55 - matojos * .2, .7 - matojos * .2, m);
        c = mix(c, mix(lin(vec3(.62,.58,.30)), lin(vec3(.50,.55,.28)), ruido(p * 5.)), hierba * (.55 + matojos * .3));
        c *= .92 + .16 * step(.97, h21(floor(p * 6.))); // piedrecitas
        return c; }
    `,
    color: /* glsl */ `
      vec2 uv = vMundo.xz / uTam;
      vec4 m = texture2D(uMasc, uv);
      vec4 t = texture2D(uTipos, uv);
      vec2 p = vMundo.xz;
      vec3 c = tierra(p, t.r);
      c = mix(c, baldosa(p * vec2(1., 1.), lin(vec3(.80,.72,.58))), smoothstep(.2, .5, t.g) * .8); // patios
      float acera = smoothstep(.35, .6, m.g), asf = smoothstep(.35, .6, m.r), pla = smoothstep(.35, .6, m.b);
      c = mix(c, baldosa(p, lin(vec3(.87,.82,.72))), acera);
      // bordillo: donde se tocan acera y asfalto
      float bord = smoothstep(.15, .45, m.g) * smoothstep(.1, .5, m.r) * (1. - smoothstep(.55, .8, m.r));
      c = mix(c, espiga(p), pla);
      float banda = max(step(fract(p.x / 7.) , .085), step(fract(p.y / 7.), .085));
      c = mix(c, lin(vec3(.58,.58,.60)) * (.92 + .1 * h21(floor(p * 2.5))), pla * banda);
      c = mix(c, asfalto(p), asf);
      c = mix(c, lin(vec3(.86,.84,.80)), smoothstep(.2, .6, bord));
      diffuseColor.rgb = c;
    `,
  });
  mat.onBeforeCompile = ((f) => (sh) => { f(sh); Object.assign(sh.uniforms, { uMasc, uTipos, uTam }); })(mat.onBeforeCompile);
  const malla = new THREE.Mesh(geo, mat);
  malla.receiveShadow = true;
  return malla;
}
