// Catálogo de baldosas del pueblo (16×16): nombre → índice en pueblo.png. Lo comparten el pintor del
// juego de baldosas provisional (tools/arte/tileset.mjs) y el generador de mapas de Tiled (tools/mapa/tiled.mjs).
// Si llega un juego de baldosas pintado a mano, basta con respetar estos huecos.
export const COLUMNAS = 16;
export const FACHADAS = [ // colores de fachada de la zona (se elige el más cercano al real de Street View)
  { id: 'blanco', c: '#f4f1ea' }, { id: 'crema', c: '#eee0c0' }, { id: 'ocre', c: '#e2bf7e' },
  { id: 'salmon', c: '#e9b397' }, { id: 'amarillo', c: '#efd06a' }, { id: 'gris', c: '#cfcdc8' }, { id: 'ladrillo', c: '#b9694c' },
];
// piezas de fachada, por color: 0 pared, 1 ventana, 2 ventana con persiana, 3 puerta, 4 escaparate, 5 garaje,
// 8 pared alta, 9 ventana alta, 10 ventana alta con persiana, 11 balcón
export const PIEZA = { pared: 0, ventana: 1, persiana: 2, puerta: 3, escaparate: 4, garaje: 5, paredAlta: 8, ventanaAlta: 9, persianaAlta: 10, balcon: 11 };

export const T = {
  vacio: 0,
  tierra: [1, 2, 3], hierba: [4, 5], asfalto: [6, 7],
  acera: 8, // + máscara de bordillo (N1 E2 S4 O8) → 8..23
  plaza: [24, 25], franja: 26, patio: 27, paso: 28,
  fachada: (color, pieza) => 32 + color * 16 + pieza, // 32..143
  teja: 144, // + máscara de bordes (N1 E2 S4 O8) → 144..159
  azotea: 160, // + máscara → 160..175
  muro: 176, // + máscara → 176..191
};
export const TOTAL = 192;
