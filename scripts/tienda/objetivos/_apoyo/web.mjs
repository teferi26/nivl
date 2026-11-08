// Captura la versión web de un commit con el arnés de datos ficticios: expo export
// en la copia del arnés, servidor estático local y Chrome sin cabeza. Lo usan los
// objetivos web y mac. Sin barra de direcciones: se fotografía solo la página.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { abrirNavegador } from '../../componer.mjs';
import { CACHE, aplanar, correr, dormir, medirPng } from './nativo.mjs';

export const ANCHO = 1440;
export const ALTO = 900;
export const ESCALA = 2;

// Las escenas que se abren con su URL. Las que piden pasos (hojas) se dirigen con
// control.ts, que es solo de móvil. Por eso se lee el guion completo.
const GUION = JSON.parse(fs.readFileSync(new URL('../../harness/app/escenas.json', import.meta.url), 'utf8'));
const TODAS = GUION.escenas.filter((e) => !e.pasos);
const MUESTRA = ['hoy', 'coach', 'arena'];

/** `/(tabs)/coach` se sirve como `/coach`: los grupos no salen en la URL. */
export const urlDe = (ruta) => ruta.replace(/\/\([^)]+\)/g, '') || '/';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg',
};

/** El entorno del arnés: ninguna clave real entra en el paquete web. */
function entorno() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (k.startsWith('EXPO_PUBLIC_') || k === 'EXPO_TOKEN' || k.startsWith('NIVL_SHOTS_')) delete env[k];
  }
  return {
    ...env, CI: '1', LANG: 'en_US.UTF-8', EXPO_NO_TELEMETRY: '1', EXPO_NO_DOTENV: '1', EXPO_NO_GIT_STATUS: '1',
    EXPO_PUBLIC_SCREENSHOT_MODE: '1', EXPO_PUBLIC_SUPABASE_URL: 'https://arnes.invalid',
    EXPO_PUBLIC_SUPABASE_KEY: 'arnes-local-sin-clave', EXPO_PUBLIC_RC_IOS_KEY: '',
    EXPO_PUBLIC_RC_ANDROID_KEY: '', EXPO_PUBLIC_PAYWALL: 'off',
  };
}

function hashArnes(dir) {
  const h = createHash('sha256');
  for (const n of fs.readdirSync(dir).sort()) h.update(n).update(fs.readFileSync(path.join(dir, n)));
  return h.digest('hex').slice(0, 10);
}

/** ctx.raiz es la copia del commit ya preparada por construir() del arnés. */
export function exportarWeb(ctx) {
  const arnes = path.join(ctx.raiz, 'scripts/tienda-arnes');
  if (!fs.existsSync(path.join(arnes, 'entry.js'))) throw new Error(`${ctx.raiz} no tiene el arnés: la prepara construir()`);
  const destino = path.join(CACHE, `web-${ctx.sha7}-${hashArnes(arnes)}`);
  if (fs.existsSync(path.join(destino, 'index.html'))) {
    ctx.log(`web en caché: ${destino}`);
    return destino;
  }
  const archivoLog = path.join(CACHE, `web-export-${ctx.sha7}.log`);
  ctx.log(`expo export de la web; registro en ${archivoLog}`);
  fs.rmSync(destino, { recursive: true, force: true });
  correr('npx', ['expo', 'export', '--platform', 'web', '--output-dir', destino], { cwd: ctx.raiz, env: entorno(), log: ctx.log, archivoLog });
  return destino;
}

function servir(dir) {
  const srv = http.createServer((req, res) => {
    const limpia = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = path.join(dir, limpia);
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dir, 'index.html');
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

const LEER = `(() => ({
  fuentes: document.fonts.status,
  texto: document.body.innerText,
  error: /Unmatched Route|No se pudo|ARNES_SIN_RED/.test(document.body.innerText),
  externas: performance.getEntriesByType('resource').map((r) => r.name).filter((n) => !n.startsWith(location.origin) && !n.startsWith('data:')),
  avisos: globalThis.__TIENDA__?.avisos ?? [],
  ruta: location.pathname,
}))()`;

async function fotografiar(nav, base, escena, archivo) {
  const { targetId } = await nav.enviar('Target.createTarget', { url: 'about:blank' });
  try {
    const { sessionId } = await nav.enviar('Target.attachToTarget', { targetId, flatten: true });
    const s = (m, p = {}) => nav.enviar(m, p, sessionId);
    await s('Page.enable');
    await s('Emulation.setDeviceMetricsOverride', { width: ANCHO, height: ALTO, deviceScaleFactor: ESCALA, mobile: false });
    await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
    if (escena.plan) {
      // bootstrap.js crea __TIENDA__: se le fija el plan en cuanto exista.
      await s('Page.addScriptToEvaluateOnNewDocument', {
        source: `Object.defineProperty(globalThis,'__TIENDA__',{configurable:true,get(){return this.__t},set(v){v.plan=${JSON.stringify(escena.plan)};this.__t=v}})`,
      });
    }
    const cargada = nav.esperarEvento('Page.loadEventFired', sessionId);
    await s('Page.navigate', { url: `${base}${urlDe(escena.ruta)}` });
    await cargada;

    // Estable = fuentes cargadas y el mismo texto durante tres lecturas seguidas.
    let previo = '';
    let iguales = 0;
    let datos;
    const fin = Date.now() + 40000;
    while (Date.now() < fin && iguales < 3) {
      await dormir(700);
      const r = await s('Runtime.evaluate', { expression: LEER, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`Web ${escena.id}: ${r.exceptionDetails.text}`);
      datos = r.result.value;
      iguales = datos.fuentes === 'loaded' && datos.texto.length > 40 && datos.texto === previo ? iguales + 1 : 0;
      previo = datos.texto;
    }
    if (iguales < 3) throw new Error(`Web ${escena.id}: la página no se asienta (${datos?.texto?.length ?? 0} caracteres)`);
    if (datos.error) throw new Error(`Web ${escena.id}: pantalla de error en ${datos.ruta}`);
    await dormir(1500); // Animaciones de entrada.
    const { data } = await s('Page.captureScreenshot', { format: 'png', fromSurface: true, clip: { x: 0, y: 0, width: ANCHO, height: ALTO, scale: 1 } });
    const tmp = `${archivo}.chrome.png`;
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    fs.writeFileSync(tmp, Buffer.from(data, 'base64'));
    aplanar(tmp, archivo);
    fs.rmSync(tmp, { force: true });
    return { ruta: datos.ruta, externas: datos.externas, avisos: datos.avisos };
  } finally {
    await nav.enviar('Target.closeTarget', { targetId }).catch(() => {});
  }
}

/** @returns lista de capturas crudas de {ANCHO*ESCALA}x{ALTO*ESCALA}. */
export async function capturarWeb(ctx, { origen }) {
  const dist = exportarWeb(ctx);
  const pedidas = ctx.escenas?.map((e) => e.id ?? e);
  const escenas = pedidas?.length ? TODAS.filter((e) => pedidas.includes(e.id)) : TODAS.filter((e) => !ctx.muestra || MUESTRA.includes(e.id));
  if (!escenas.length) throw new Error('ninguna de las escenas pedidas se abre por URL');
  const srv = await servir(dist);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const nav = await abrirNavegador();
  try {
    const hechas = [];
    for (const [i, e] of escenas.entries()) {
      const archivo = path.join(ctx.salida, `${String(i + 1).padStart(2, '0')}-${e.id}.png`);
      const info = await fotografiar(nav, base, e, archivo);
      const { ancho, alto } = medirPng(archivo);
      if (info.externas.length) ctx.log(`${e.id}: peticiones externas ${info.externas.join(', ')}`);
      // ExpoLinking solo existe en nativo: en la web ese aviso del arranque es lo esperado.
      const avisos = info.avisos.filter((a) => !a.includes('ExpoLinking'));
      if (avisos.length) ctx.log(`${e.id}: avisos del arnés ${avisos.join(' | ')}`);
      ctx.log(`${e.id}: ${ancho}x${alto} en ${info.ruta}`);
      hechas.push({ archivo, ancho, alto, escena: e.id, tipo: 'cruda', origen });
    }
    return hechas;
  } finally {
    await nav.cerrar();
    srv.close();
  }
}
