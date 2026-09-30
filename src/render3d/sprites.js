// Personajes en pixel art dentro del 3D (HD-2D): planos que miran a la cámara, anclados en los pies,
// con filtrado por vecino más cercano y una sombra redonda en el suelo.
import * as THREE from 'three';
import vanessaUrl from '../assets/vanessa.png';
import vanessaInfo from '../assets/vanessa.json';

export const M_POR_PX = 0.05; // tamaño de un píxel del sprite en el mundo (Vanessa ≈ 1,6 m)

function cargar(url) {
  const t = new THREE.TextureLoader().load(url);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const texSombra = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 2, 16, 16, 15); gr.addColorStop(0, 'rgba(40,25,20,.55)'); gr.addColorStop(1, 'rgba(40,25,20,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();

export function crearSprite(escena, { url, info, tinte = null, escala = 1 }) {
  const tex = cargar(url);
  const [cw, ch] = info.celda;
  const mat = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, color: tinte || 0xffffff });
  const s = new THREE.Sprite(mat);
  s.center.set(0.5, 0.02);
  s.scale.set(cw * M_POR_PX * escala, ch * M_POR_PX * escala, 1);
  const sombra = new THREE.Mesh(new THREE.PlaneGeometry(1.2 * escala, 0.7 * escala), new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2; sombra.renderOrder = 1;
  escena.add(s, sombra);
  let filas = info.filas.length, cols = Math.max(...info.filas);
  tex.repeat.set(1 / cols, 1 / filas);
  return {
    s, sombra,
    ponerEn(x, z, y = 0) { s.position.set(x, y, z); sombra.position.set(x, 0.03, z); },
    fotograma(fila, col) {
      tex.offset.set(col / cols, 1 - (fila + 1) / filas);
    },
    visible(v) { s.visible = v; sombra.visible = v; },
  };
}

// Vanessa: filas 0 abajo, 1 arriba, 2 izquierda, 3 derecha; columnas 0-2 andar, 3-5 golpe
const FILA_DIR = [0, 1, 2, 3];
export function crearVanessa(escena) {
  const sp = crearSprite(escena, { url: vanessaUrl, info: vanessaInfo });
  return {
    ...sp,
    actualizar(j, f) {
      const fila = FILA_DIR[j.dir];
      let col;
      if (j.espada) { const t = 1 - j.espada / 18; col = 3 + Math.min(2, Math.floor(t * 3)); }
      else if (j.anda) col = [1, 0, 2, 0][Math.floor(j.anda / 8) % 4];
      else col = 0;
      sp.fotograma(fila, col);
      sp.visible(!(j.invuln && f % 6 < 3));
    },
  };
}
