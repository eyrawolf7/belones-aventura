// Utilidades compartidas del render 3D (HD-2D): unidades, ruido en GLSL y recorte de lo que tapa a Vanessa.
import * as THREE from 'three';

export const M_POR_BALDOSA = 2; // 1 baldosa = 2 m
export const PX_POR_M = 8; // la simulación usa 16 px por baldosa
export const SUB = 16;
// posición de la simulación (subpíxeles) → metros del mundo 3D (x este, z sur)
export const aMundo = (x, y) => [x / SUB / PX_POR_M, y / SUB / PX_POR_M];

// uniformes compartidos por todos los materiales: recorte alrededor del jugador y tiempo
export const U = {
  uCorte: { value: new THREE.Vector3(-9999, -9999, 0) }, // x, y en píxeles de pantalla, radio
  uProfJugador: { value: 0 },
  uTiempo: { value: 0 },
};

export const GLSL_RUIDO = /* glsl */ `
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float ruido(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*ruido(p); p*=2.03; a*=.5; } return s; }
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
`;

// Recorte con tramado: lo que está entre la cámara y Vanessa, cerca de ella en pantalla, se vuelve hueco.
export const GLSL_CORTE_VS = /* glsl */ `varying float vProf;`;
export const GLSL_CORTE_FS = /* glsl */ `
uniform vec3 uCorte; uniform float uProfJugador; varying float vProf;
void cortar(){
  float d = length(gl_FragCoord.xy - uCorte.xy) / uCorte.z;
  if (d < 1. && vProf < uProfJugador - 2.5) {
    float bayer = mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y) * 2., 4.) / 4.;
    if (bayer > smoothstep(1., .55, d) * .15 + d * .6) discard;
  }
}`;

// Engancha código GLSL a un material estándar de three sin perder luces ni sombras.
export function parchear(mat, { vsCab = '', vsFin = '', fsCab = '', color = '', corte = false }) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${corte ? GLSL_CORTE_VS : ''}\n${vsCab}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${corte ? 'vProf = -mvPosition.z;' : ''}\n${vsFin}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_RUIDO}\n${corte ? GLSL_CORTE_FS : ''}\n${fsCab}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${corte ? 'cortar();' : ''}\n${color}`);
  };
  mat.customProgramCacheKey = () => (corte ? 'c' : '') + color.length + vsFin.length;
  return mat;
}
