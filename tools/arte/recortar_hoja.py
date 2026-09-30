"""Recorta una hoja de personaje generada (fondo liso) en fotogramas de pixel art limpios.

Uso: ~/.venvs/losbelones/bin/python tools/arte/recortar_hoja.py <hoja.png> <salida_dir> [--px=4] [--x0=410]

1. Quita el fondo: el color de las esquinas y todo lo que se le parece y está conectado a zonas grandes.
2. Busca los sprites (manchas grandes) a la derecha de x0 y los agrupa en filas y columnas.
3. Reduce cada uno a su rejilla de píxel real (px = tamaño del «píxel» de la hoja) por moda de color,
   y cuantiza a una paleta común para que todos los fotogramas compartan colores.
Escribe <salida>/f_<fila>_<col>.png, una hoja de control y hoja.json con las medidas.
"""
import sys, json, os
import numpy as np
from PIL import Image
from scipy import ndimage

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = dict(a[2:].split('=') for a in sys.argv[1:] if a.startswith('--'))
PX = float(opts.get('px', 4))
X0 = int(opts.get('x0', 410))
src, out = args[0], args[1]
os.makedirs(out, exist_ok=True)

im = np.asarray(Image.open(src).convert('RGB')).astype(np.int32)
H, W, _ = im.shape
esquinas = np.concatenate([im[:8, :8].reshape(-1, 3), im[:8, -8:].reshape(-1, 3), im[-8:, :8].reshape(-1, 3), im[-8:, -8:].reshape(-1, 3)])
fondo = np.median(esquinas, axis=0)
dist = np.sqrt(((im - fondo) ** 2).sum(axis=2))
casi = dist < float(opts.get('umbral', 26))
lab, n = ndimage.label(casi)
areas = ndimage.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
grande = np.zeros(n + 1, bool); grande[1:] = areas > 400
es_fondo = grande[lab]
# sombra del suelo: gris cálido poco saturado cerca del fondo → también fuera (la pintamos nosotros)
sat = im.max(axis=2) - im.min(axis=2)
sombra = (dist < 70) & (sat < 22) & (im.mean(axis=2) > 150)
fg = ~es_fondo & ~sombra
fg[:, :X0] = False
fg = ndimage.binary_opening(fg, iterations=1)

lab2, n2 = ndimage.label(ndimage.binary_dilation(fg, iterations=int(opts.get('juntar', 12))))
objs = ndimage.find_objects(lab2)
cajas = []
for k, sl in enumerate(objs):
    y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
    if (y1 - y0) > 90 and (x1 - x0) > 40:
        cajas.append([y0, y1, x0, x1])
# filas por centro vertical
cajas.sort(key=lambda c: (c[0] + c[1]) / 2)
filas = []
for c in cajas:
    cy = (c[0] + c[1]) / 2
    if filas and abs(cy - filas[-1][-1][4]) < 80: filas[-1].append(c + [cy])
    else: filas.append([c + [cy]])
for f in filas: f.sort(key=lambda c: c[2])
if 'filas' in opts:
    # rejilla fija: --filas=y0:y1,y0:y1… --cols=x0:x1,…  (más fiable que agrupar manchas sueltas)
    rango = lambda t: [tuple(int(v) for v in r.split(':')) for r in t.split(',')]
    filas = []
    for (ya, yb) in rango(opts['filas']):
        fila = []
        for (xa, xb) in rango(opts['cols']):
            ys, xs = np.nonzero(fg[ya:yb, xa:xb])
            if len(ys) < 50: continue
            fila.append([ya + ys.min(), ya + ys.max() + 1, xa + xs.min(), xa + xs.max() + 1, 0])
        filas.append(fila)

def reducir(rgb, mask):
    h, w = mask.shape
    gh, gw = int(round(h / PX)), int(round(w / PX))
    o = np.zeros((gh, gw, 4), np.uint8)
    for j in range(gh):
        for i in range(gw):
            ys, ye = int(j * PX), int(min(h, (j + 1) * PX)); xs, xe = int(i * PX), int(min(w, (i + 1) * PX))
            m = mask[ys:ye, xs:xe]
            if m.mean() < 0.5: continue
            c = rgb[ys:ye, xs:xe][m]
            # moda aproximada: el color más cercano a la mediana
            med = np.median(c, axis=0)
            o[j, i, :3] = c[np.argmin(((c - med) ** 2).sum(axis=1))]
            o[j, i, 3] = 255
    return o

fotos = []
for r, f in enumerate(filas):
    for c, (y0, y1, x0, x1, _) in enumerate(f):
        m = fg[y0:y1, x0:x1]
        fotos.append((r, c, reducir(im[y0:y1, x0:x1], m), (y0, y1, x0, x1)))

# paleta común (≤ 32 colores) con los píxeles de todos los fotogramas
todo = np.concatenate([p[2][p[2][..., 3] > 0][:, :3] for p in fotos])
NCOL = int(opts.get('colores', 40))
# k-medias sencillo en RGB (la mediana por cortes se comía los colores minoritarios: camiseta y vaquero)
rng = np.random.default_rng(1)
muestra = todo[rng.choice(len(todo), min(len(todo), 20000), replace=False)].astype(np.float64)
pal = muestra[rng.choice(len(muestra), NCOL, replace=False)]
for _ in range(25):
    k = np.argmin(((muestra[:, None] - pal[None]) ** 2).sum(axis=2), axis=1)
    for q in range(NCOL):
        if (k == q).any(): pal[q] = muestra[k == q].mean(axis=0)
pal = pal.round().astype(np.int32)

meta = {'px': PX, 'filas': len(filas), 'fotogramas': []}
alto_max = max(p[2].shape[0] for p in fotos); ancho_max = max(p[2].shape[1] for p in fotos)
for r, c, o, caja in fotos:
    a = o[..., 3] > 0
    rgb = o[..., :3].reshape(-1, 3).astype(np.int32)
    idx = np.argmin(((rgb[:, None, :] - pal[None]) ** 2).sum(axis=2), axis=1)
    o[..., :3] = pal[idx].reshape(o.shape[0], o.shape[1], 3)
    o[~a] = 0
    Image.fromarray(o).save(f'{out}/f_{r}_{c}.png')
    ys, xs = np.nonzero(a)
    meta['fotogramas'].append({'fila': r, 'col': c, 'w': o.shape[1], 'h': o.shape[0], 'pies': int(ys.max()) if len(ys) else 0, 'caja_hoja': [int(v) for v in caja]})
json.dump(meta, open(f'{out}/hoja.json', 'w'), indent=1)

# hoja de control: fotogramas ×4 sobre gris
cw, ch = ancho_max * 4 + 8, alto_max * 4 + 8
cols = max(len(f) for f in filas)
ctl = Image.new('RGB', (cw * cols, ch * len(filas)), (90, 96, 110))
for r, c, o, _ in fotos:
    big = Image.fromarray(o).resize((o.shape[1] * 4, o.shape[0] * 4), Image.NEAREST)
    ctl.paste(big, (c * cw + 4, r * ch + 4 + (alto_max - o.shape[0]) * 4), big)
ctl.save(f'{out}/control.png')
print(f'{len(filas)} filas, {[len(f) for f in filas]} fotogramas por fila, sprite máx {ancho_max}x{alto_max} px, paleta {len(pal)}')

# atlas: celdas iguales, pies abajo y el cuerpo centrado (el centro de los pies, no de la caja: el golpe
# alarga el sprite hacia delante y no debe desplazar al personaje)
if 'atlas' in opts:
    CW, CH = int(opts.get('celda_w', 80)), int(opts.get('celda_h', 48))
    ncol = max(len(f) for f in filas)
    atl = Image.new('RGBA', (CW * ncol, CH * len(filas)), (0, 0, 0, 0))
    info = {'celda': [CW, CH], 'pies': [CW // 2, CH - 1], 'filas': []}
    for r, f in enumerate(filas):
        info['filas'].append(len(f))
    for r, c, o, _ in fotos:
        a = o[..., 3] > 0
        ys, xs = np.nonzero(a)
        abajo = ys.max()
        pies = xs[ys >= abajo - 3]
        # cuerpo: columna media de los píxeles de la mitad inferior (piernas), más estable que los pies en zancada
        mitad = xs[ys >= (ys.min() + abajo) // 2]
        cx = int(round(np.median(mitad)))
        img = Image.fromarray(o)
        atl.paste(img, (c * CW + CW // 2 - cx, r * CH + CH - 1 - abajo), img)
    os.makedirs(os.path.dirname(opts['atlas']), exist_ok=True)
    atl.save(opts['atlas'])
    json.dump(info, open(opts['atlas'].replace('.png', '.json'), 'w'))
    print('atlas', opts['atlas'], atl.size)
