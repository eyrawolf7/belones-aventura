// Vecinos de Los Belones. `lugar` va relativo al rótulo de una calle real (o en baldosas).
// Los textos se parten en páginas con «|». Habla del Campo de Cartagena, con cariño.
export const inicio = { i: 259, j: 412 };
// zona de prueba HD-2D: la plaza, la calle Mayor de Botica a la carretera y el principio de Botica
export const zona = {
  i0: 215, j0: 392, i1: 290, j1: 440,
  // pavimento de la plaza trazado sobre la ortofoto PNOA (baldosas; referencias/orto/plaza.jpg)
  plazas: [[[245, 410.6], [280, 410.9], [280, 414.4], [270.5, 414.8], [268.5, 420], [262.5, 421.6], [246, 421.2], [245, 416]]],
};

export const vecinos = [
  {
    id: 'abuela', nombre: 'Abuela Fina', voz: 2, lugar: { calle: 'Plaza de la Iglesia', di: -3, dj: 1 }, mover: 'quieto',
    aspecto: { piel: 1, pelo: 'moño', colorPelo: 'canoso', ropa: '#3b3b4f', falda: true, delantal: true },
    texto: '¡Vanessa, hija! Ya has llegao. Qué alta estás, pijo.|Este verano la Fuente Grande no echa agua. Dicen que ni en tiempos de mi abuelo se había visto.|Anda, date una vuelta por el pueblo, que te conozcan. Y cuidao con los alacranes de los solares.',
  },
  {
    id: 'paco', nombre: 'Paco el de la boina', voz: 0, lugar: { calle: 'Plaza de la Iglesia', di: 4, dj: -1 }, mover: 'quieto',
    aspecto: { piel: 2, pelo: 'boina', colorPelo: 'canoso', ropa: '#6d5a44', baston: true },
    texto: 'Acho, zagala. ¿Tú eres la nieta de la Fina?|Aquí donde me ves, yo bajé a la mina del Cabezo Rajao con quince años.|Cuando la fuente se seca, algo pasa allá arriba. Eso lo sabíamos todos.',
  },
  {
    id: 'encarna', nombre: 'Encarna', voz: 4, lugar: { i: 236, j: 407 }, mover: 'pasear', radio: 4,
    aspecto: { piel: 1, pelo: 'corto', colorPelo: 'castaño', ropa: '#c9546a', delantal: true },
    texto: '¡Buenos días, reina! Voy a por el pan al Guitarrilla, que como llegue tarde no quedan toñas.|Si vas pa la calle Botica, saluda a mi Antonio de mi parte.',
  },
  {
    id: 'nano', nombre: 'Nano', voz: 6, lugar: { i: 228, j: 418 }, mover: 'pasear', radio: 6,
    aspecto: { piel: 3, pelo: 'gorra', colorPelo: 'negro', ropa: '#3a8fd0', nino: true },
    texto: '¡Eh! ¿Echamos una carrera hasta la iglesia?|…Bueno, otro día. Que me ha dicho mi madre que en el solar de atrás hay un alacrán gordísimo.',
  },
];
