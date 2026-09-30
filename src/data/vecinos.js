// Vecinos de Los Belones. `lugar` va relativo al rótulo de una calle real (o en baldosas).
// Los textos se parten en páginas con «|». Habla del Campo de Cartagena, con cariño.
export const inicio = { calle: 'Plaza de la Iglesia', di: 0, dj: 2 };

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
    id: 'encarna', nombre: 'Encarna', voz: 4, lugar: { calle: 'Calle Mayor', di: 2, dj: 1 }, mover: 'pasear', radio: 4,
    aspecto: { piel: 1, pelo: 'corto', colorPelo: 'castaño', ropa: '#c9546a', delantal: true },
    texto: '¡Buenos días, reina! Voy a por el pan al Guitarrilla, que como llegue tarde no quedan toñas.|Si vas pa la avenida de la Fuente, saluda a mi Antonio de mi parte.',
  },
  {
    id: 'nano', nombre: 'Nano', voz: 6, lugar: { calle: 'Avenida de la Fuente', di: 0, dj: 1 }, mover: 'pasear', radio: 6,
    aspecto: { piel: 3, pelo: 'gorra', colorPelo: 'negro', ropa: '#3a8fd0', nino: true },
    texto: '¡Eh! ¿Echamos una carrera hasta la iglesia?|…Bueno, otro día. Que me ha dicho mi madre que en el solar de atrás hay un alacrán gordísimo.',
  },
];
