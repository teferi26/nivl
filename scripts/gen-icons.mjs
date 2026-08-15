// Genera los iconos de NIVL desde cero (sin dependencias externas).
// Identidad: chevron ascendente dentro de una ventana de esquinas cortadas,
// la misma gramática visual que SystemWindow. Paleta de src/lib/theme.ts.
//
//   node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'images');

// ── Codificador PNG mínimo (RGBA8) ─────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10,11,12 = compression/filter/interlace = 0
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filtro None
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Utilidades de dibujo ───────────────────────────────────────────
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
// Cobertura antialiaseada: 1 dentro de la forma, 0 fuera.
const cover = (d, aa) => 1 - smoothstep(-aa, aa, d);

function hex(h) {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

// Distancia con signo a un segmento de grosor r.
function sdSegment(px, py, ax, ay, bx, by, r) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
  const dx = pax - bax * h;
  const dy = pay - bay * h;
  return Math.hypot(dx, dy) - r;
}

// Octógono (cuadrado con esquinas cortadas): la firma de SystemWindow.
function sdOctagon(px, py, s, cut) {
  const ax = Math.abs(px);
  const ay = Math.abs(py);
  return Math.max(Math.max(ax - s, ay - s), (ax + ay - cut) * Math.SQRT1_2);
}

// Chevron ascendente: dos brazos con vértice arriba.
function sdChevron(px, py, apexY, armX, armY, r) {
  return Math.min(
    sdSegment(px, py, 0, apexY, -armX, armY, r),
    sdSegment(px, py, 0, apexY, armX, armY, r),
  );
}

const CYAN = hex('#37C8F0');
const CYAN_TEXT = hex('#8FD9F2');
const BG_TOP = hex('#0B1526');
const BG_BOT = hex('#04070F');

/**
 * Pinta el glifo de NIVL.
 * @param {number} size  lado en píxeles
 * @param {object} opts
 *   background: 'gradient' | 'solid' | 'none'
 *   frame: boolean         dibuja la ventana de esquinas cortadas
 *   mono: boolean          todo blanco (icono de notificación / monocromo)
 *   scale: number          escala del contenido (1 = a sangre)
 */
function render(size, opts = {}) {
  const { background = 'gradient', frame = true, mono = false, scale = 1 } = opts;
  const buf = Buffer.alloc(size * size * 4);
  const aa = 1.6 / (size / 2); // ancho de banda AA en unidades normalizadas

  // Geometría en coordenadas normalizadas [-1,1], y hacia arriba.
  const S = 0.760 * scale;
  const CUT = 1.265 * scale; // recorte suave: cuadrado con esquinas cortadas, no octógono
  const FRAME_T = 0.040 * scale;
  const APEX_Y = 0.330 * scale;
  const ARM_X = 0.450 * scale;
  const ARM_Y = -0.150 * scale;
  const CHEV_R = 0.108 * scale;
  const TICK_Y = -0.360 * scale;
  const TICK_X = 0.230 * scale;
  const TICK_R = 0.052 * scale;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = ((x + 0.5) / size) * 2 - 1;
      const py = 1 - ((y + 0.5) / size) * 2; // y hacia arriba

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      // Fondo
      if (background === 'gradient' || background === 'solid') {
        const t = background === 'solid' ? 1 : smoothstep(-1, 1, py);
        r = BG_BOT[0] + (BG_TOP[0] - BG_BOT[0]) * t;
        g = BG_BOT[1] + (BG_TOP[1] - BG_BOT[1]) * t;
        b = BG_BOT[2] + (BG_TOP[2] - BG_BOT[2]) * t;
        a = 255;
      }

      const put = (col, alpha) => {
        if (alpha <= 0) return;
        const k = clamp(alpha, 0, 1);
        const na = a / 255 + k * (1 - a / 255);
        if (na <= 0) return;
        // Composición source-over en espacio premultiplicado.
        r = (r * (a / 255) * (1 - k) + col[0] * k) / na;
        g = (g * (a / 255) * (1 - k) + col[1] * k) / na;
        b = (b * (a / 255) * (1 - k) + col[2] * k) / na;
        a = na * 255;
      };

      const glyph = mono ? [255, 255, 255] : CYAN;
      const glyphHot = mono ? [255, 255, 255] : CYAN_TEXT;

      // Resplandor del chevron (solo sobre fondo).
      if (!mono && background !== 'none') {
        const dGlow = sdChevron(px, py, APEX_Y, ARM_X, ARM_Y, CHEV_R);
        const glow = Math.exp(-Math.max(0, dGlow) * 7.5) * 0.42;
        put(CYAN, glow);
      }

      // Marco de esquinas cortadas.
      if (frame) {
        const dOct = Math.abs(sdOctagon(px, py, S, CUT)) - FRAME_T;
        put(glyph, cover(dOct, aa) * (mono ? 1 : 0.72));
      }

      // Chevron principal.
      const dChev = sdChevron(px, py, APEX_Y, ARM_X, ARM_Y, CHEV_R);
      put(glyphHot, cover(dChev, aa));

      // Barra inferior: el "suelo" del que se asciende.
      const dTick = sdSegment(px, py, -TICK_X, TICK_Y, TICK_X, TICK_Y, TICK_R);
      put(glyph, cover(dTick, aa) * (mono ? 1 : 0.85));

      const o = (y * size + x) * 4;
      buf[o] = Math.round(clamp(r, 0, 255));
      buf[o + 1] = Math.round(clamp(g, 0, 255));
      buf[o + 2] = Math.round(clamp(b, 0, 255));
      buf[o + 3] = Math.round(clamp(a, 0, 255));
    }
  }
  return encodePNG(size, size, buf);
}

function solid(size, color) {
  const [r, g, b] = hex(color);
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = r;
    buf[i * 4 + 1] = g;
    buf[i * 4 + 2] = b;
    buf[i * 4 + 3] = 255;
  }
  return encodePNG(size, size, buf);
}

const targets = [
  // Icono de la app (iOS y Android legacy): opaco, a sangre.
  ['icon.png', () => render(1024, { background: 'gradient', frame: true })],
  // Adaptive icon de Android: el glifo debe caber en el 66% central.
  [
    'android-icon-foreground.png',
    () => render(1024, { background: 'none', frame: true, scale: 0.62 }),
  ],
  ['android-icon-background.png', () => solid(1024, '#060B16')],
  [
    'android-icon-monochrome.png',
    () => render(1024, { background: 'none', frame: true, mono: true, scale: 0.62 }),
  ],
  // Splash: solo el glifo sobre el fondo del tema.
  ['splash-icon.png', () => render(512, { background: 'none', frame: true })],
  // Notificaciones Android: silueta blanca, el sistema la tiñe.
  [
    'notification-icon.png',
    () => render(192, { background: 'none', frame: false, mono: true, scale: 0.9 }),
  ],
  ['favicon.png', () => render(64, { background: 'gradient', frame: true })],
];

for (const [name, make] of targets) {
  const png = make();
  writeFileSync(join(OUT, name), png);
  console.log(`${name.padEnd(32)} ${(png.length / 1024).toFixed(1)} KB`);
}
