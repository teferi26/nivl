// NIVL · IRON · Graba un MP4, un GIF y un PNG de cada ejercicio del motor.
//
// También una ficha PNG por ejercicio (<id>-ficha.png, 1080 de ancho).
// Cuadro a cuadro y sin depender del reloj: abre /kit/iron?solo=1 en Chrome
// sin cabeza, fija cada instante con window.__ironCuadro(ms) y hace captura
// del escenario. Después ffmpeg monta el MP4 (H.264, 30 fps, 3 vueltas) y el
// GIF (1 vuelta, paleta propia).
//
// Requisitos (no son dependencias del proyecto):
//   · una exportación web de desarrollo servida en local:
//       EXPO_PUBLIC_SUPABASE_URL=https://demo.supabase.co EXPO_PUBLIC_SUPABASE_KEY=demo \
//         npx expo export --platform web --dev --output-dir <dir>
//     y un servidor estático que devuelva index.html en cualquier ruta;
//   · Playwright instalado en algún sitio: PLAYWRIGHT_MODULE=<ruta a node_modules/playwright>;
//   · ffmpeg en el PATH.
//
//   node scripts/iron/grabar.mjs --url http://localhost:8099 --salida <carpeta> [--solo <id>[,<id>...]] [--ancho 720]

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const URL_BASE = args.url ?? 'http://localhost:8099';
const SALIDA = path.resolve(args.salida ?? 'iron-prototipo');
const ANCHO = Number(args.ancho ?? 720);
const FPS = 30;
const IDS = args.solo ? args.solo.split(',') : ['sentadilla-barra', 'press-banca', 'remo-mancuerna', 'curl-biceps-mancuerna', 'plancha'];

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');

fs.mkdirSync(SALIDA, { recursive: true });
const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: ANCHO + 40, height: 1400 }, deviceScaleFactor: 1 });

for (const id of IDS) {
  await pagina.goto(`${URL_BASE}/kit/iron?ejercicio=${id}&solo=1&ancho=${ANCHO}&t=0`);
  await pagina.waitForFunction(() => typeof globalThis.__ironCuadro === 'function', null, { timeout: 30000 });
  const { cicloMs, quieto } = await pagina.evaluate(() => ({ cicloMs: globalThis.__ironCiclo, quieto: globalThis.__ironQuieto }));
  const escenario = pagina.locator('#iron-escenario');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `iron-${id}-`));
  const cuadros = Math.round((cicloMs / 1000) * FPS);
  for (let i = 0; i < cuadros; i++) {
    await pagina.evaluate((ms) => globalThis.__ironCuadro(ms), (i * 1000) / FPS);
    await pagina.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await escenario.screenshot({ path: path.join(tmp, `c${String(i).padStart(4, '0')}.png`) });
  }
  const entrada = path.join(tmp, 'c%04d.png');
  const par = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-stream_loop', '2', '-framerate', String(FPS), '-i', entrada,
    '-vf', par, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', path.join(SALIDA, `${id}.mp4`)]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', entrada,
    '-vf', 'fps=20,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none',
    '-loop', '0', path.join(SALIDA, `${id}.gif`)]);
  // El PNG: la pose más exigente (la misma que se ve con «reducir movimiento»).
  await pagina.evaluate((ms) => globalThis.__ironCuadro(ms), quieto);
  await pagina.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await escenario.screenshot({ path: path.join(SALIDA, `${id}.png`) });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${id}: ${cuadros} cuadros (${cicloMs} ms)`);
}
// La ficha de cada ejercicio, a pantalla de móvil (432 × 2,5 = 1080 de ancho).
const movil = await navegador.newPage({ viewport: { width: 432, height: 1500 }, deviceScaleFactor: 2.5 });
for (const id of IDS) {
  await movil.goto(`${URL_BASE}/kit/iron?ejercicio=${id}&ficha=1`);
  const ficha = movil.locator('#iron-ficha');
  await ficha.waitFor({ timeout: 30000 });
  await movil.waitForTimeout(800);
  await ficha.screenshot({ path: path.join(SALIDA, `${id}-ficha.png`) });
  console.log(`${id}: ficha`);
}
await navegador.close();
