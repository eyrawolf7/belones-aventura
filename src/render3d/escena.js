// Render HD-2D del pueblo: escena 3D con datos reales, personajes de píxel, luz de tarde y maqueta.
// El render solo LEE sim.estado (ver docs/CONTRATO.md).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { U, aMundo } from './comun.js';
import { crearSuelo } from './suelo.js';
import { crearEdificios } from './edificios.js';
import { crearArboles } from './arboles.js';
import { crearVanessa, crearSprite, M_POR_PX } from './sprites.js';

const CALIDAD = {
  alta: { dpr: 2, sombras: 2048, maqueta: true },
  media: { dpr: 1.5, sombras: 1024, maqueta: false },
  baja: { dpr: 1, sombras: 0, maqueta: false },
};

const MaquetaShader = {
  uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uFuerza: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uFuerza; varying vec2 vUv;
    void main(){
      // desenfoque de maqueta: nítido en la franja central, borroso arriba y abajo
      float d = smoothstep(.28, .5, abs(vUv.y - .52)) * uFuerza;
      vec4 c = texture2D(tDiffuse, vUv);
      if (d > .01) {
        vec4 s = vec4(0.); float w = 0.;
        for (int k = 0; k < 12; k++) {
          float a = float(k) * 2.39996, r = sqrt(float(k) + .5) / 3.5;
          vec2 o = vec2(cos(a), sin(a)) * r * d * 9. / uRes;
          s += texture2D(tDiffuse, vUv + o); w += 1.;
        }
        c = mix(c, s / w, min(1., d * 1.4));
      }
      // viñeta cálida
      float v = smoothstep(.95, .35, length((vUv - .5) * vec2(1.1, 1.3)));
      c.rgb *= mix(vec3(.82, .74, .7), vec3(1.), v);
      gl_FragColor = c;
    }`,
};

export function crearRender3D(canvas, mundo, { zona, calidad = 'alta', extra = {} } = {}) {
  const Q = CALIDAD[calidad] || CALIDAD.alta;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q.dpr));
  renderer.shadowMap.enabled = Q.sombras > 0;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const escena = new THREE.Scene();
  escena.background = new THREE.Color('#c9a27a');
  escena.fog = new THREE.Fog('#d8b48c', 70, 140);

  const dentro = (i, j) => !zona || (i >= zona.i0 && i <= zona.i1 && j >= zona.j0 && j <= zona.j1);
  escena.add(crearSuelo(mundo, { plazas: zona?.plazas || [] }));
  escena.add(crearEdificios(mundo, { filtro: (e) => e.polys.some((p) => p.some(([x, y]) => dentro(x, y))), extra: extra.edificios || {} }));
  escena.add(crearArboles(mundo.arboles, { filtro: dentro, extra: extra.arboles || [] }));

  // luz de tarde: sol bajo desde el oeste-suroeste, cielo azul y rebote cálido del suelo
  const sol = new THREE.DirectionalLight('#ffd6a0', 3.1);
  const cielo = new THREE.HemisphereLight('#b9d3f0', '#c79a70', 1.25);
  escena.add(sol, sol.target, cielo);
  if (Q.sombras) {
    sol.castShadow = true;
    sol.shadow.mapSize.set(Q.sombras, Q.sombras);
    Object.assign(sol.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 200 });
    sol.shadow.bias = -0.0006; sol.shadow.normalBias = 0.04;
  }
  const dirSol = new THREE.Vector3(-0.62, 0.55, 0.36).normalize().multiplyScalar(80);

  const camara = new THREE.PerspectiveCamera(30, 16 / 9, 1, 400);
  const PITCH = (56 * Math.PI) / 180, DIST = 34;
  const cam = { x: 0, z: 0, iniciada: false };

  let composer = null, maqueta = null;
  if (Q.maqueta) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(escena, camara));
    maqueta = new ShaderPass(MaquetaShader); composer.addPass(maqueta);
    composer.addPass(new OutputPass());
  }

  const vanessa = crearVanessa(escena);
  // vecinos provisionales hasta tener sus hojas: Vanessa teñida no vale; figura sencilla de píxel
  const texVecino = (ropa, pelo) => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 48; const g = c.getContext('2d');
    const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    r(11, 40, 4, 6, '#3a3a4a'); r(17, 40, 4, 6, '#3a3a4a'); r(9, 24, 14, 17, '#2b1d16'); r(10, 25, 12, 15, ropa);
    r(8, 8, 16, 17, '#2b1d16'); r(9, 9, 14, 15, '#f0c6a0'); r(9, 8, 14, 6, pelo); r(12, 16, 2, 3, '#2b1d16'); r(18, 16, 2, 3, '#2b1d16');
    return c.toDataURL();
  };
  const vecinos = new Map();

  function tam() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    camara.aspect = w / h; camara.updateProjectionMatrix();
    if (composer) { composer.setSize(w, h); maqueta.uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio()); }
  }
  addEventListener('resize', tam); tam();

  const v3 = new THREE.Vector3();
  function pintar(e, datos) {
    const j = e.jugador;
    const [px, pz] = aMundo(j.x, j.y);
    const objX = px, objZ = pz + (e.dialogo ? 3 : 0);
    if (!cam.iniciada) { cam.x = objX; cam.z = objZ; cam.iniciada = true; }
    cam.x += (objX - cam.x) * 0.12; cam.z += (objZ - cam.z) * 0.12;
    camara.position.set(cam.x, Math.sin(PITCH) * DIST, cam.z + Math.cos(PITCH) * DIST);
    camara.lookAt(cam.x, 0, cam.z);
    sol.position.set(cam.x + dirSol.x, dirSol.y, cam.z + dirSol.z); sol.target.position.set(cam.x, 0, cam.z);

    vanessa.ponerEn(px, pz); vanessa.actualizar(j, e.f);
    for (const v of e.vecinos) {
      let sp = vecinos.get(v.id);
      if (!sp) {
        const def = datos.vecinos[v.k], a = def.aspecto || {};
        sp = crearSprite(escena, { url: texVecino(a.ropa || '#8a6a9a', a.colorPelo === 'canoso' ? '#cfcac4' : a.colorPelo === 'negro' ? '#2a2420' : '#6b4a2e'), info: { celda: [32, 48], filas: [1] }, escala: 1 });
        sp.fotograma(0, 0); vecinos.set(v.id, sp);
      }
      const [vx, vz] = aMundo(v.x, v.y); sp.ponerEn(vx, vz);
    }
    // recorte: posición de Vanessa en pantalla y su profundidad
    v3.set(px, 0.9, pz).project(camara);
    const w = renderer.domElement.width, h = renderer.domElement.height;
    U.uCorte.value.set((v3.x * 0.5 + 0.5) * w, (v3.y * 0.5 + 0.5) * h, h * 0.13);
    U.uProfJugador.value = camara.position.distanceTo(v3.set(px, 0.9, pz)) * Math.cos(0); // aprox. distancia en vista
    v3.set(px, 0.9, pz).applyMatrix4(camara.matrixWorldInverse); U.uProfJugador.value = -v3.z;
    U.uTiempo.value = e.f / 60;
    if (composer) composer.render(); else renderer.render(escena, camara);
    return { cx: 0, cy: 0 };
  }
  return { pintar, cam, renderer, escena, camara, M_POR_PX };
}
