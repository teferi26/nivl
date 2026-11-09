#!/usr/bin/env node
// Material de Google Play: compone las capturas crudas del emulador (artefacto de
// screenshots-android.yml) y genera el gráfico destacado.
//
//   node scripts/tienda/android-play.mjs --crudas <dir> --salida <dir>
//
// Las crudas vienen de la app real en Android; aquí solo se les pone el diseño.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { abrirNavegador, aplanar, buscarEnNodeModules, cabeceraPng, componer } from './componer.mjs';

const ESCENAS = ['01-hoy', '02-coach', '03-rueda', '04-iron-hoy', '05-focus-hoy', '06-work-hoy', '07-founder-hoy', '08-avance'];
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };

const fuente = (familia, peso, ruta) => {
  const b64 = fs.readFileSync(buscarEnNodeModules(ruta)).toString('base64');
  return `@font-face{font-family:'${familia}';font-weight:${peso};src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
};

/** Gráfico destacado de Play, 1024x500: marca, titular y escudo, sin precios ni promesas. */
function htmlGrafico() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
${fuente('Playfair Display', 700, '@expo-google-fonts/playfair-display/700Bold/PlayfairDisplay_700Bold.ttf')}
${fuente('Outfit', 500, '@expo-google-fonts/outfit/500Medium/Outfit_500Medium.ttf')}
${fuente('Outfit', 700, '@expo-google-fonts/outfit/700Bold/Outfit_700Bold.ttf')}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1024px;height:500px;overflow:hidden;background:#09090B}
body{position:relative;background-image:radial-gradient(60% 90% at 78% 50%,rgba(201,169,97,.08) 0%,rgba(201,169,97,0) 100%),linear-gradient(180deg,#121214 0%,#09090B 55%,#050506 100%)}
.texto{position:absolute;left:72px;top:0;height:500px;width:600px;display:flex;flex-direction:column;justify-content:center}
.marca{font:700 22px Outfit;letter-spacing:.34em;color:#C9A961}
h1{margin-top:26px;font:700 74px/1.08 'Playfair Display';color:#EDEAE3}
.hilo{margin-top:30px;width:96px;height:2px;background:#C9A961}
p{margin-top:26px;font:500 25px/1.35 Outfit;color:#B8B4AB}
svg{position:absolute;left:720px;top:102px}
</style></head><body>
<div class="texto"><div class="marca">NIVL</div><h1>Sube de nivel<br>cada día</h1><div class="hilo"></div><p>Hábitos, modos y un coach, por suscripción.</p></div>
<svg width="256" height="296" viewBox="0 0 120 138" aria-hidden="true">
<path d="M60 4 L114 20 V62 C114 100 88 122 60 134 C32 122 6 100 6 62 V20 Z" fill="#151517" stroke="#C9A961" stroke-width="2"/>
<text x="60" y="86" text-anchor="middle" font-family="Playfair Display" font-weight="700" font-size="58" fill="#EDEAE3">N</text>
</svg></body></html>`;
}

const crudas = arg('--crudas');
const salida = arg('--salida');
if (!salida) { console.error('Uso: --salida <dir> [--crudas <dir>]'); process.exit(2); }
fs.mkdirSync(salida, { recursive: true });
const navegador = await abrirNavegador();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nivl-play-'));
try {
  if (crudas) {
    for (const nombre of ESCENAS) {
      const destino = path.join(salida, `${nombre}.png`);
      await componer({ cruda: path.join(crudas, `${nombre}.png`), objetivo: 'android', escena: nombre, destino, navegador });
    }
  }
  const html = path.join(tmp, 'grafico.html');
  fs.writeFileSync(html, htmlGrafico());
  const { png } = await navegador.fotografiar({ url: pathToFileURL(html).href, ancho: 1024, alto: 500, script: 'document.fonts.ready.then(() => document.fonts.size)' });
  const crudo = path.join(tmp, 'grafico.png');
  fs.writeFileSync(crudo, png);
  await aplanar(crudo, path.join(salida, 'grafico-destacado.png'));
} finally {
  await navegador.cerrar().catch(() => {});
  fs.rmSync(tmp, { recursive: true, force: true });
}

// Medidas y alfa, comprobadas sobre los archivos ya escritos.
let mal = 0;
for (const nombre of fs.readdirSync(salida).filter((n) => n.endsWith('.png')).sort()) {
  const c = await cabeceraPng(path.join(salida, nombre));
  const esperado = nombre === 'grafico-destacado.png' ? [1024, 500] : [1080, 1920];
  const bien = c.ancho === esperado[0] && c.alto === esperado[1] && c.colorType === 2 && c.profundidad === 8;
  if (!bien) mal += 1;
  console.log(`${bien ? 'ok ' : 'MAL'} ${nombre}: ${c.ancho}x${c.alto}, tipo de color ${c.colorType}, ${c.profundidad * 3} bits`);
}
process.exit(mal ? 1 : 0);
