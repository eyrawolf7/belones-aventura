// Fuente de mapa de bits propia de Belones.
//
// Cada glifo se define con 9 filas: 0-6 son la altura de las mayúsculas (la línea base está bajo la
// fila 6), 7-8 son los descendentes. Las minúsculas ocupan las filas 2-6. Encima hay 3 filas de
// margen para las tildes de las mayúsculas, así que cada línea mide ALTO_LINEA = 12 px:
//   y + 0..2  tildes de mayúsculas      y + 3..9  mayúsculas      y + 10..11  descendentes
// La `y` que recibe texto() es la parte de arriba de esa celda de 12 px.
//
// Se pinta con un atlas precalculado (un canvas oculto por color, en caché) y drawImage, así que
// pintar texto cuesta un drawImage por letra. medir() y partirLineas() no necesitan canvas (valen
// para la simulación y para pruebas en Node).

export const ALTO_LINEA = 12;
export const ARRIBA = 3; // filas de margen encima de las mayúsculas
const ESPACIADO = 1;

// Glifos base: '#' = píxel. Las filas que faltan al final se rellenan vacías.
const G = {
  ' ': ['...'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['....#', '....#', '....#', '....#', '#...#', '#...#', '.###.'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.###.', '#...#', '#....', '.###.', '....#', '#...#', '.###.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],

  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['....', '....', '.###', '#...', '#...', '#...', '.###'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  f: ['..##', '.#..', '####', '.#..', '.#..', '.#..', '.#..'],
  g: ['.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['#', '.', '#', '#', '#', '#', '#'],
  j: ['..#', '...', '..#', '..#', '..#', '..#', '..#', '..#', '##.'],
  k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'],
  l: ['#.', '#.', '#.', '#.', '#.', '#.', '.#'],
  m: ['.....', '.....', '####.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '####.', '#....', '#....'],
  q: ['.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '....#'],
  r: ['....', '....', '#.##', '##..', '#...', '#...', '#...'],
  s: ['....', '....', '.###', '#...', '.##.', '...#', '###.'],
  t: ['.#..', '.#..', '####', '.#..', '.#..', '.#..', '..##'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],

  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],

  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '¡': ['.', '.', '#', '.', '#', '#', '#', '#', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '¿': ['.....', '.....', '..#..', '.....', '..#..', '.#...', '#....', '#...#', '.###.'],
  '"': ['#.#', '#.#'],
  "'": ['#', '#'],
  '`': ['#.', '.#'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '(': ['..#', '.#.', '#..', '#..', '#..', '.#.', '..#'],
  ')': ['#..', '.#.', '..#', '..#', '..#', '.#.', '#..'],
  '[': ['###', '#..', '#..', '#..', '#..', '#..', '###'],
  ']': ['###', '..#', '..#', '..#', '..#', '..#', '###'],
  '{': ['..##', '.#..', '.#..', '#...', '.#..', '.#..', '..##'],
  '}': ['##..', '..#.', '..#.', '...#', '..#.', '..#.', '##..'],
  '*': ['.....', '..#..', '#.#.#', '.###.', '#.#.#', '..#..', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  ',': ['..', '..', '..', '..', '..', '..', '.#', '#.'],
  '-': ['....', '....', '....', '####'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '\\': ['#....', '#....', '.#...', '..#..', '...#.', '....#', '....#'],
  ':': ['.', '.', '.', '#', '.', '.', '#'],
  ';': ['..', '..', '..', '.#', '..', '..', '.#', '#.'],
  '<': ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'],
  '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
  '=': ['....', '....', '####', '....', '####'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'],
  '^': ['..#..', '.#.#.', '#...#'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '|': ['#', '#', '#', '#', '#', '#', '#', '#'],
  '~': ['.....', '.....', '.##.#', '#..#.'],
  '«': ['.....', '.....', '..#.#', '.#.#.', '#.#..', '.#.#.', '..#.#'],
  '»': ['.....', '.....', '#.#..', '.#.#.', '..#.#', '.#.#.', '#.#..'],
  '—': ['......', '......', '......', '......', '######'],
  '–': ['.....', '.....', '.....', '.....', '#####'],
  '…': ['.....', '.....', '.....', '.....', '.....', '.....', '#.#.#'],
  '♥': ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
  '★': ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'],
  '▼': ['.....', '.....', '#####', '.###.', '..#..'],
  '►': ['#...', '##..', '###.', '####', '###.', '##..', '#...'],
  '·': ['.', '.', '.', '.', '#'],
  '°': ['.#.', '#.#', '.#.'],
  'º': ['.#.', '#.#', '.#.', '...', '###'],
  'ª': ['.##', '#.#', '.##', '...', '###'],
};

// Marcas diacríticas: filas relativas al glifo (fila -3 es la de más arriba de la celda).
const MARCAS = {
  agudo: ['.#', '#.'],
  dieresis: ['#.#'],
  virgulilla: ['.##.#', '#..#.'],
};

// Letras compuestas: [base, marca, columna, fila de arriba de la marca, ancho mínimo].
const COMPUESTAS = {
  á: ['a', 'agudo', 2, -1], é: ['e', 'agudo', 2, -1], ó: ['o', 'agudo', 2, -1],
  ú: ['u', 'agudo', 2, -1], í: ['i', 'agudo', 0, -1], ü: ['u', 'dieresis', 1, 0],
  ñ: ['n', 'virgulilla', 0, -1],
  Á: ['A', 'agudo', 2, -3], É: ['E', 'agudo', 2, -3], Í: ['I', 'agudo', 1, -3],
  Ó: ['O', 'agudo', 2, -3], Ú: ['U', 'agudo', 2, -3], Ü: ['U', 'dieresis', 1, -2],
  Ñ: ['N', 'virgulilla', 0, -3],
  à: ['a', 'grave', 1, -1], è: ['e', 'grave', 1, -1], ç: ['c', 'cedilla', 1, 7],
};
MARCAS.grave = ['#.', '.#'];
MARCAS.cedilla = ['.#', '#.'];

// Bitmap de 12 filas (fila 0 = y de la celda) por carácter: {ancho, px: [[x, y], ...]}
const GLIFOS = new Map();

function construir(filas, marca) {
  let ancho = Math.max(...filas.map((f) => f.length));
  const px = [];
  filas.forEach((f, r) => {
    for (let c = 0; c < f.length; c++) if (f[c] === '#') px.push([c, r + ARRIBA]);
  });
  if (marca) {
    const [nombre, col, fila] = marca;
    const m = MARCAS[nombre];
    m.forEach((f, r) => {
      for (let c = 0; c < f.length; c++) if (f[c] === '#') px.push([col + c, fila + r + ARRIBA]);
      ancho = Math.max(ancho, col + f.length);
    });
  }
  return { ancho, px };
}

for (const [ch, filas] of Object.entries(G)) GLIFOS.set(ch, construir(filas));
for (const [ch, [base, marca, col, fila]] of Object.entries(COMPUESTAS)) {
  GLIFOS.set(ch, construir(G[base], [marca, col, fila]));
}
const DESCONOCIDO = construir(['###', '#.#', '..#', '.#.', '.#.', '...', '.#.']);

function glifo(ch) {
  return GLIFOS.get(ch) || DESCONOCIDO;
}

/** Ancho en px de una línea (sin saltos de línea). `espacio` = px extra entre letras (a escala 1). */
export function medir(texto, escala = 1, espacio = 0) {
  let w = 0;
  let n = 0;
  const paso = ESPACIADO + espacio;
  for (const ch of String(texto)) {
    if (ch === '\n') continue;
    w += glifo(ch).ancho + paso;
    n++;
  }
  if (n) w -= paso;
  return w * escala;
}

/** Corta el texto por palabras para que ninguna línea pase de anchoMax px (escala 1). Respeta \n. */
export function partirLineas(texto, anchoMax) {
  const lineas = [];
  for (const parrafo of String(texto).split('\n')) {
    const palabras = parrafo.split(' ');
    let actual = '';
    for (const p of palabras) {
      const prueba = actual ? actual + ' ' + p : p;
      if (!actual || medir(prueba) <= anchoMax) {
        actual = prueba;
      } else {
        lineas.push(actual);
        actual = p;
      }
      // Palabra más larga que la línea: se parte a la fuerza.
      while (medir(actual) > anchoMax && [...actual].length > 1) {
        const letras = [...actual];
        let k = letras.length - 1;
        while (k > 1 && medir(letras.slice(0, k).join('')) > anchoMax) k--;
        lineas.push(letras.slice(0, k).join(''));
        actual = letras.slice(k).join('');
      }
    }
    lineas.push(actual);
  }
  return lineas;
}

// ---- Atlas ------------------------------------------------------------------------------------

let atlasBlanco = null; // {canvas, pos: Map(ch -> x)}
const atlasColor = new Map();

function nuevoCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function crearAtlas() {
  const lista = [...GLIFOS.entries(), ['�', DESCONOCIDO]];
  const ancho = lista.reduce((s, [, g]) => s + g.ancho + 1, 0);
  const canvas = nuevoCanvas(ancho, ALTO_LINEA);
  const c = canvas.getContext('2d');
  c.fillStyle = '#fff';
  const pos = new Map();
  let x = 0;
  for (const [ch, g] of lista) {
    pos.set(ch, x);
    for (const [px, py] of g.px) c.fillRect(x + px, py, 1, 1);
    x += g.ancho + 1;
  }
  atlasBlanco = { canvas, pos };
}

function atlas(color) {
  if (!atlasBlanco) crearAtlas();
  let a = atlasColor.get(color);
  if (!a) {
    const { canvas: base } = atlasBlanco;
    a = nuevoCanvas(base.width, base.height);
    const c = a.getContext('2d');
    c.drawImage(base, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, a.width, a.height);
    atlasColor.set(color, a);
  }
  return a;
}

function pintarLinea(ctx, str, x, y, color, escala, espacio = 0) {
  const img = atlas(color);
  const pos = atlasBlanco.pos;
  let cx = x;
  for (const ch of str) {
    const g = GLIFOS.get(ch);
    const clave = g ? ch : '�';
    const gg = g || DESCONOCIDO;
    if (gg.px.length) {
      ctx.drawImage(img, pos.get(clave), 0, gg.ancho, ALTO_LINEA, cx, y, gg.ancho * escala, ALTO_LINEA * escala);
    }
    cx += (gg.ancho + ESPACIADO + espacio) * escala;
  }
}

const VECINOS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

/**
 * Pinta una línea de texto. `y` es la parte de arriba de la celda de ALTO_LINEA px.
 * Opciones: sombra (color o null; sombra de 1 px abajo a la derecha, por escala), escala (entero),
 * alinear ('izq' | 'centro' | 'der'), contorno (color o null: borde alrededor), grosor (px del
 * contorno; por defecto = escala), espacio (px extra entre letras, a escala 1).
 * Devuelve el ancho pintado.
 */
export function texto(ctx, str, x, y, color = '#fff', {
  sombra = '#0008', escala = 1, alinear = 'izq', contorno = null, grosor = escala, espacio = 0,
} = {}) {
  str = String(str);
  const w = medir(str, escala, espacio);
  let x0 = x;
  if (alinear === 'centro') x0 = x - Math.floor(w / 2);
  else if (alinear === 'der') x0 = x - w;
  x0 = Math.round(x0);
  y = Math.round(y);
  const suave = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  if (sombra) {
    const d = contorno ? 2 : 1;
    pintarLinea(ctx, str, x0 + (contorno ? 0 : escala), y + (contorno ? grosor + escala : d * escala), sombra, escala, espacio);
  }
  if (contorno) {
    for (const [dx, dy] of VECINOS) pintarLinea(ctx, str, x0 + dx * grosor, y + dy * grosor, contorno, escala, espacio);
  }
  pintarLinea(ctx, str, x0, y, color, escala, espacio);
  ctx.imageSmoothingEnabled = suave;
  return w;
}

/** Lista de caracteres cubiertos (para pruebas). */
export const CARACTERES = [...GLIFOS.keys()].join('');
