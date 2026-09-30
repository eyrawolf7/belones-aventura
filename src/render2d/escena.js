// Render 2D con Phaser: mapa de Tiled del pueblo real + personajes y árboles ordenados por profundidad.
// El render solo LEE sim.estado (docs/CONTRATO.md). Resolución interna 384×216, píxel nítido.
import Phaser from 'phaser';
import { hojaPersonaje, PALETAS, CW, CH } from './personajes.js';

export const ANCHO = 384, ALTO = 216;
const SUB = 16;

function texArbol(tipo) {
  const c = document.createElement('canvas'); c.width = 48; c.height = 64; const g = c.getContext('2d');
  const p = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  let s = tipo.length * 7 + 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  if (tipo === 'palmera') {
    p(22, 20, 4, 44, '#2b1d16'); p(23, 20, 2, 44, '#9a7a52'); for (let y = 24; y < 64; y += 4) p(23, y, 2, 1, '#7a5c3a');
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      for (let t = 0; t < 20; t++) { const x = 24 + Math.cos(a) * t, y = 18 + Math.sin(a) * t * 0.55 + (t * t) / 40; p(x | 0, y | 0, 2, 2, t % 3 ? '#4f8a36' : '#6aa844'); if (t > 3) p((x - Math.sin(a) * 2) | 0, (y + 2) | 0, 1, 1, '#3d6e2a'); }
    }
    p(21, 16, 6, 5, '#6b4a2a');
  } else {
    const [osc, med, luz, tronco] = tipo === 'eucalipto' ? ['#4f7a3a', '#7aa352', '#aac878', '#e4dccb'] : ['#3d6e32', '#5f9a42', '#8fc460', '#7a5a3c'];
    p(21, 38, 6, 26, '#2b1d16'); p(22, 38, 4, 26, tronco); p(22, 38, 1, 26, '#ffffff33');
    // copa: bolitas de hojas con contorno, más claras arriba a la izquierda (el sol)
    for (let k = 0; k < 26; k++) { const x = 6 + r() * 36, y = 6 + r() * 30, rr = 5 + r() * 5; g.fillStyle = '#2b3a22'; g.beginPath(); g.arc(x, y + 1, rr + 1, 0, 7); g.fill(); }
    for (let k = 0; k < 26; k++) { const x = 6 + r() * 36, y = 6 + r() * 30, rr = 5 + r() * 5; g.fillStyle = y < 18 && x < 28 ? luz : y > 28 ? osc : med; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); }
    for (let k = 0; k < 60; k++) p((6 + r() * 36) | 0, (6 + r() * 26) | 0, 1, 1, r() < 0.5 ? luz : osc);
  }
  return c;
}

export function crearRender2D(padre, mundo, { zona, alListo }) {
  const i0 = zona.i0, j0 = zona.j0;
  let estado = null, datos = null;
  const cam = { x: 0, iniciada: false };
  const ref = { escena: null };

  class Pueblo extends Phaser.Scene {
    preload() {
      this.load.tilemapTiledJSON('zona', 'mapas/zona.tmj');
      this.load.image('pueblo', 'mapas/pueblo.png');
    }
    create() {
      ref.escena = this;
      const mapa = this.make.tilemap({ key: 'zona' });
      const ts = mapa.addTilesetImage('pueblo', 'pueblo');
      mapa.createLayer('suelo', ts, 0, 0).setDepth(-2);
      mapa.createLayer('edificios', ts, 0, 0).setDepth(-1);
      this.cameras.main.setBounds(0, 0, mapa.widthInPixels, mapa.heightInPixels).setRoundPixels(true);
      this.cameras.main.setBackgroundColor('#d9b47a');
      for (const [id, pal] of Object.entries(PALETAS)) this.textures.addSpriteSheet(id, hojaPersonaje(pal), { frameWidth: CW, frameHeight: CH });
      for (const t of ['eucalipto', 'palmera', 'ficus']) this.textures.addCanvas('arbol-' + t, texArbol(t));
      // sombra redonda
      const sc = document.createElement('canvas'); sc.width = 12; sc.height = 5; const sg = sc.getContext('2d'); sg.fillStyle = 'rgba(40,25,20,.35)'; sg.beginPath(); sg.ellipse(6, 2.5, 6, 2.5, 0, 0, 7); sg.fill();
      this.textures.addCanvas('sombra', sc);
      // árboles del mapa
      for (const o of mapa.getObjectLayer('objetos').objects) {
        if (o.type !== 'arbol') continue;
        const r = o.properties?.find((p) => p.name === 'radio')?.value || 1;
        const tipo = r >= 3 ? 'eucalipto' : (o.id * 7) % 3 === 0 ? 'palmera' : 'ficus';
        const a = this.add.image(o.x, o.y + 2, 'arbol-' + tipo).setOrigin(0.5, 1).setDepth(o.y);
        if (tipo === 'eucalipto') a.setScale(1.25);
      }
      this.jugador = this.add.sprite(0, 0, 'vanessa', 0).setOrigin(0.5, 1);
      this.sombraJ = this.add.image(0, 0, 'sombra').setDepth(-0.5);
      this.vecinos = new Map();
      alListo?.();
    }
    update() {
      if (!estado) return;
      const e = estado, j = e.jugador;
      const x = j.x / SUB - i0 * 16, y = j.y / SUB - j0 * 16;
      this.jugador.setPosition(Math.round(x), Math.round(y) + 1).setDepth(y);
      this.sombraJ.setPosition(Math.round(x), Math.round(y));
      const paso = j.anda ? [1, 0, 2, 0][Math.floor(j.anda / 8) % 4] : 0;
      this.jugador.setFrame(j.dir * 3 + paso);
      this.jugador.setVisible(!(j.invuln && e.f % 6 < 3));
      for (const v of e.vecinos) {
        let s = this.vecinos.get(v.id);
        if (!s) { s = this.add.sprite(0, 0, PALETAS[v.id] ? v.id : 'abuela', 0).setOrigin(0.5, 1); s.sombra = this.add.image(0, 0, 'sombra').setDepth(-0.5); this.vecinos.set(v.id, s); }
        const vx = v.x / SUB - i0 * 16, vy = v.y / SUB - j0 * 16;
        s.setPosition(Math.round(vx), Math.round(vy) + 1).setDepth(vy).setFrame(v.dir * 3 + (v.anda ? [1, 0, 2, 0][Math.floor(v.anda / 8) % 4] : 0));
        s.sombra.setPosition(Math.round(vx), Math.round(vy));
      }
      // cámara: sigue a Vanessa con suavidad; con diálogo, sube un poco para que no la tape la caja
      const cm = this.cameras.main;
      const ox = x - ANCHO / 2, oy = y - 12 - ALTO / 2 + (e.dialogo ? 34 : 0);
      if (!cam.iniciada) { cm.scrollX = ox; cm.scrollY = oy; cam.iniciada = true; }
      cm.scrollX += (ox - cm.scrollX) * 0.18; cm.scrollY += (oy - cm.scrollY) * 0.18;
      cam.x = cm.scrollX + i0 * 16;
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: padre, width: ANCHO, height: ALTO, pixelArt: true, roundPixels: true,
    backgroundColor: '#1d1420', scene: Pueblo, banner: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true },
  });
  return {
    game, cam,
    pintar(e, d) { estado = e; datos = d; },
    forzar() { if (ref.escena) { ref.escena.update(); game.renderer.render?.(ref.escena.sys.displayList, ref.escena.cameras.main); } },
  };
}
