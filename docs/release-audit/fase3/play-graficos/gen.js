// Gráficos de Google Play con el escudo final (coordinacion-winter-arc/logo-propuestas/final/gen.js).
// Uso: node gen.js && render con Chrome headless (ver LEEME.md).
const fs = require('fs');
const path = require('path');
const raiz = path.resolve(__dirname, '../../../..').split(path.sep).join('/');
const F = `file:///${raiz}/node_modules/@expo-google-fonts/`;
const BONE = '#E9E3D5', IRON = '#5E5E5E', BLACK = '#050505';
const fonts = `@font-face{font-family:Cinzel;src:url('${F}cinzel/700Bold/Cinzel_700Bold.ttf')}@font-face{font-family:Outfit;src:url('${F}outfit/500Medium/Outfit_500Medium.ttf')}`;
const escudo = (stroke = 30) => `
  <path d="M500 70 L815 152 V500 C815 715 675 845 500 925 C325 845 185 715 185 500 V152 Z" fill="none" stroke="${BONE}" stroke-width="${stroke}" stroke-linejoin="round"/>
  <path d="M500 128 L760 196 V500 C760 680 645 790 500 860 C355 790 240 680 240 500 V196 Z" fill="none" stroke="${IRON}" stroke-width="${stroke * 0.3}" stroke-linejoin="round"/>
  <text x="500" y="640" font-family="Cinzel" font-size="400" fill="${BONE}" text-anchor="middle">N</text>`;
const page = (w, h, body) => `<!doctype html><meta charset="utf-8"><style>${fonts}html,body{margin:0;background:${BLACK};overflow:hidden}</style><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${BLACK}"/>${body}</svg>`;
const out = {
  // Gráfico destacado: lo importante dentro del centro (Play puede recortar bordes y superponer el botón de vídeo).
  'play-grafico-destacado-1024x500': [1024, 500, `
    <g transform="translate(300 250) scale(0.30) translate(-500 -497)">${escudo(34)}</g>
    <text x="640" y="248" font-family="Cinzel" font-size="112" letter-spacing="14" fill="${BONE}" text-anchor="middle">NIVL</text>
    <rect x="560" y="276" width="160" height="5" fill="${IRON}"/>
    <text x="640" y="330" font-family="Outfit" font-size="26" letter-spacing="5" fill="${BONE}" text-anchor="middle">UN 1 % MEJOR CADA DÍA</text>`],
};
for (const [k, [w, h, b]] of Object.entries(out)) fs.writeFileSync(path.join(__dirname, `_${k}.html`), page(w, h, b));
console.log(Object.entries(out).map(([k, v]) => `${k} ${v[0]}x${v[1]}`).join('\n'));
