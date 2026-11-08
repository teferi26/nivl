// NIVL · Arnés de recorrido web (Playwright).
//
// Abre cada ruta de la app en cada motor y ancho contra Metro (web) y el
// Supabase simulado, guarda una captura y anota lo que se ve roto: scroll
// horizontal del documento, textos recortados, interactivos fuera de la ventana,
// solapes, pantalla en blanco o +not-found, errores de consola. Después hace unas
// pruebas de teclado y ratón en una muestra de pantallas.
//
// REQUISITOS (no se arrancan desde aquí):
//   node e2e/web/mock-supabase.mjs                                 # :8102
//   EXPO_PUBLIC_SUPABASE_URL=http://localhost:8102 EXPO_PUBLIC_SUPABASE_KEY=mock \
//     EXPO_PUBLIC_GALERIA=1 npx expo start --web --port 8101       # :8101
//   Playwright en node_modules (sin guardarlo en package.json) y sus navegadores;
//   si no están en la ruta por defecto, exporta PLAYWRIGHT_BROWSERS_PATH.
//
// USO:
//   node e2e/web/recorrer.mjs --salida /tmp/recorrido
//   node e2e/web/recorrer.mjs --motor webkit --ancho 375 --ruta /perfil --modo general --salida /tmp/una
//
// PARÁMETROS (todos admiten varios valores separados por comas):
//   --base URL            por defecto http://localhost:8101
//   --motor chromium,webkit,firefox   por defecto los tres
//   --ancho 375,768,1280,1920         por defecto los cuatro
//   --ruta TEXTO          filtra por trozo de la ruta (/perfil, iron-, /kit)
//   --modo general,iron,focus,work,founder
//   --area MARCO,GENERAL,IRON_FOCUS,WORK_FOUNDER   (--ruta es un trozo de texto: con '/' casarían todas)
//   --salida DIR          capturas e informe.json (por defecto $TMPDIR/nivl-recorrido)
//   --concurrencia N      páginas a la vez (por defecto 3: otros compilan en el Mac)
//   --sin-interaccion     solo el recorrido de pantallas
//   --canal chrome        en el motor chromium, usa ese navegador instalado (chrome, msedge)
//   --sin-galeria         sin /kit (build con EXPO_PUBLIC_GALERIA=0, el de producción)
//   --solo-interaccion    solo las pruebas de teclado y ratón
//   --reanudar            conserva lo ya hecho en informe.json y repite solo lo que falte o falló
//
// La cuenta es ficticia (fixtures.mjs) y el simulado acepta cualquier contraseña.
// Las capturas y el informe van SIEMPRE fuera del repo.

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(AQUI, '..', '..', 'package.json'));
const playwright = require('playwright');

// ── Parámetros ──────────────────────────────────────────────────────────

function argumentos(argv) {
  const r = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const clave = argv[i].slice(2);
    if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) r[clave] = true;
    else r[clave] = argv[++i];
  }
  return r;
}
const args = argumentos(process.argv.slice(2));
const lista = (v, porDefecto) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : porDefecto);

const BASE = typeof args.base === 'string' ? args.base.replace(/\/$/, '') : 'http://localhost:8101';
const MOTORES = lista(args.motor, ['chromium', 'webkit', 'firefox']);
const ALTOS = { 375: 812, 768: 1024, 1280: 800, 1920: 1080 };
const ANCHOS = lista(args.ancho, Object.keys(ALTOS)).map(Number);
const FILTRO_RUTA = lista(args.ruta, null);
const FILTRO_MODO = lista(args.modo, null);
const FILTRO_AREA = lista(args.area, null);
const SALIDA = typeof args.salida === 'string' ? args.salida : join(process.env.TMPDIR ?? tmpdir(), 'nivl-recorrido');
const CONCURRENCIA = Math.max(1, Number(args.concurrencia) || 3);
const INFORME = join(SALIDA, 'informe.json');

const CORREO_FICTICIO = 'gladiador@nivl.test';
const CLAVE_FICTICIA = 'contrasena-ficticia-1';
const CAMPANA = '00000000-0000-4000-8000-000000000101';

// ── Matriz de rutas ─────────────────────────────────────────────────────
//
// `modos`: en qué mundos se abre (un grupo solo existe en el suyo; su layout
// redirige si el modo a la vista es otro). `sinSesion`: se abre sin sesión.
// `esperada`: la ruta donde debe acabar si no es la misma (redirecciones legítimas).

const MUNDOS_TODOS = ['general', 'iron', 'focus', 'work', 'founder'];
const r = (area, ruta, modos = ['general'], extra = {}) => ({ area, ruta, modos, ...extra });

const RUTAS = [
  // Marco: acceso, arranque, galería.
  r('MARCO', '/login', ['general'], { sinSesion: true }),
  r('MARCO', '/auth/confirmar', ['general'], { sinSesion: true }),
  r('MARCO', '/auth/restablecer', ['general'], { sinSesion: true }),
  r('MARCO', '/c/CODIGO1', ['general'], { sinSesion: true, destinoLibre: true }),
  r('MARCO', '/onboarding'),
  r('MARCO', '/', MUNDOS_TODOS, { destinoLibre: true }),
  r('MARCO', '/no-existe-esta-ruta', ['general'], { notFoundEsperado: true }),
  r('MARCO', '/kit', ['general'], { sinSesion: true }),
  r('MARCO', '/kit/pantallas', ['general'], { sinSesion: true }),
  r('MARCO', '/kit/iron', ['general'], { sinSesion: true }),
  r('MARCO', '/kit/focus', ['general'], { sinSesion: true }),
  r('MARCO', '/kit/work', ['general'], { sinSesion: true }),
  r('MARCO', '/kit/general', ['general'], { sinSesion: true }),
  r('MARCO', '/kit/rueda', ['general'], { sinSesion: true }),
  r('MARCO', '/kit/web', ['general'], { sinSesion: true }),

  // General: pestañas.
  r('GENERAL', '/agenda'),
  r('GENERAL', '/arena'),
  r('GENERAL', '/avance'),
  r('GENERAL', '/coach'),
  r('GENERAL', '/habitos'),
  r('GENERAL', '/mazmorras'),
  r('GENERAL', '/perfil'),
  // Perfil solo existe en NIVL: con otro mundo a la vista su layout devuelve a
  // ese mundo (irAPerfil cambia antes a General). Se comprueba que no rompa.
  r('GENERAL', '/perfil', ['iron', 'focus', 'work', 'founder'], { destinoLibre: true }),

  // General: secundarias (y las que se abren desde cada mundo, en su mundo).
  r('GENERAL', '/amigos', MUNDOS_TODOS),
  r('GENERAL', '/pro', MUNDOS_TODOS),
  r('GENERAL', '/avances'),
  r('GENERAL', '/compra'),
  r('GENERAL', '/contrato'),
  r('GENERAL', '/creador'),
  r('GENERAL', '/diario'),
  r('GENERAL', `/dungeon/${CAMPANA}`),
  r('GENERAL', '/fotos'),
  r('GENERAL', '/informe'),
  r('GENERAL', '/memoria'),
  r('GENERAL', '/metricas'),
  r('GENERAL', '/moderacion'),
  r('GENERAL', '/moderacion/denuncia-1', ['general'], { destinoLibre: true }),
  r('GENERAL', '/oraculo'),
  r('GENERAL', '/resumen'),

  // IRON y FOCUS.
  r('IRON_FOCUS', '/iron-hoy', ['iron']),
  r('IRON_FOCUS', '/iron-rutinas', ['iron']),
  r('IRON_FOCUS', '/iron-dieta', ['iron']),
  r('IRON_FOCUS', '/iron-coach', ['iron']),
  r('IRON_FOCUS', '/iron-pesos', ['iron', 'general'], { destinoLibre: true }), // Pesos vive ya dentro de Entreno.
  r('IRON_FOCUS', '/iron/catalogo', ['iron']),
  r('IRON_FOCUS', '/iron/press-banca', ['iron'], { destinoLibre: true }),
  r('IRON_FOCUS', '/gym', ['iron', 'general']),
  r('IRON_FOCUS', '/cardio', ['iron', 'general']),
  r('IRON_FOCUS', '/dieta', ['iron', 'general']),
  r('IRON_FOCUS', '/nutricion', ['iron', 'general']),
  r('IRON_FOCUS', '/focus-hoy', ['focus']),
  r('IRON_FOCUS', '/focus-temario', ['focus']),
  r('IRON_FOCUS', '/focus-examenes', ['focus']),
  r('IRON_FOCUS', '/focus-coach', ['focus']),
  r('IRON_FOCUS', '/temario', ['focus', 'general']),
  r('IRON_FOCUS', '/examenes', ['focus', 'general']),
  r('IRON_FOCUS', '/foco', ['focus', 'general']),

  // WORK y FOUNDER.
  r('WORK_FOUNDER', '/work-hoy', ['work']),
  r('WORK_FOUNDER', '/work-agenda', ['work']),
  r('WORK_FOUNDER', '/work-economia', ['work']),
  r('WORK_FOUNDER', '/work-coach', ['work']),
  r('WORK_FOUNDER', '/founder-hoy', ['founder']),
  r('WORK_FOUNDER', '/founder-agenda', ['founder']),
  r('WORK_FOUNDER', '/founder-economia', ['founder']),
  r('WORK_FOUNDER', '/founder-coach', ['founder']),
  r('WORK_FOUNDER', '/economia', ['work', 'founder', 'general']),
  r('WORK_FOUNDER', '/finanzas', ['work', 'founder', 'general']),
];

// ── Lo que se mira dentro de la página ──────────────────────────────────

/** Se ejecuta en el navegador. Devuelve hechos, no opiniones. */
function auditarPagina() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const TOPE = 30;
  const memoVisible = new WeakMap();

  function ancestroVisible(n) {
    if (!n || n.nodeType !== 1) return true;
    if (memoVisible.has(n)) return memoVisible.get(n);
    const c = getComputedStyle(n);
    const v = c.display !== 'none' && c.visibility !== 'hidden' && c.visibility !== 'collapse' && Number(c.opacity) >= 0.02 && n.getAttribute('aria-hidden') !== 'true' && ancestroVisible(n.parentElement);
    memoVisible.set(n, v);
    return v;
  }
  function visible(el) {
    const q = el.getBoundingClientRect();
    return q.width >= 2 && q.height >= 2 && ancestroVisible(el);
  }
  const rect = (q) => ({ x: Math.round(q.left), y: Math.round(q.top), w: Math.round(q.width), h: Math.round(q.height) });
  const nombre = (el) => (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || el.getAttribute('data-testid') || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 60);
  const quien = (el) => ({ tag: el.tagName.toLowerCase(), rol: el.getAttribute('role'), texto: nombre(el), rect: rect(el.getBoundingClientRect()) });
  const esScroller = (c, eje) => ['auto', 'scroll'].includes(eje === 'x' ? c.overflowX : c.overflowY);

  /** ¿Hay un ancestro que deje llegar hasta aquí desplazando en ese eje? */
  function scrollerEn(el, eje) {
    for (let n = el.parentElement; n; n = n.parentElement) {
      if (n === document.body || n === document.documentElement) continue;
      const c = getComputedStyle(n);
      if (!esScroller(c, eje)) continue;
      if ((eje === 'x' ? n.scrollWidth - n.clientWidth : n.scrollHeight - n.clientHeight) > 1) return n;
    }
    return null;
  }
  /** La parte de `q` que queda a la vista dentro de sus scrollers. Null si nada. */
  function recorteVisible(el, q) {
    let l = Math.max(0, q.left);
    let t = Math.max(0, q.top);
    let d = Math.min(W, q.right);
    let b = Math.min(H, q.bottom);
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const c = getComputedStyle(n);
      const xCorta = c.overflowX !== 'visible';
      const yCorta = c.overflowY !== 'visible';
      if (!xCorta && !yCorta) continue;
      const a = n.getBoundingClientRect();
      if (xCorta) {
        l = Math.max(l, a.left);
        d = Math.min(d, a.right);
      }
      if (yCorta) {
        t = Math.max(t, a.top);
        b = Math.min(b, a.bottom);
      }
    }
    return d - l >= 2 && b - t >= 2 ? { l, t, d, b } : null;
  }

  const res = {};
  const raiz = document.documentElement;
  const textoCuerpo = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
  res.titulo = document.title;
  res.ruta = location.pathname + location.search;
  res.textoInicio = textoCuerpo.slice(0, 200);
  res.longitudTexto = textoCuerpo.length;
  res.imagenes = document.querySelectorAll('img, svg, canvas').length;
  res.scrollDoc = { sw: raiz.scrollWidth, cw: raiz.clientWidth, bsw: document.body.scrollWidth, sy: raiz.scrollHeight, ch: raiz.clientHeight };
  const minusculas = textoCuerpo.toLowerCase();
  res.notFound = minusculas.includes('fuera de la arena');
  res.errorBoundary = minusculas.includes('el sistema ha fallado');
  // Los huecos de carga llevan etiqueta «Cargando…»; las barras de nivel también son progressbar.
  res.progreso = Array.from(document.querySelectorAll('[role="progressbar"]')).filter((e) => visible(e) && /cargando/i.test(e.getAttribute('aria-label') || '')).length;
  res.modales = Array.from(document.querySelectorAll('[aria-modal="true"], [role="dialog"]')).filter(visible).map(quien).slice(0, 5);

  // Textos.
  const fuera = [];
  const recortados = [];
  const elipsis = [];
  const padres = new Set();
  const paseo = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (t.nodeValue && t.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  while (paseo.nextNode()) {
    const t = paseo.currentNode;
    const el = t.parentElement;
    if (!el || padres.has(el) || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
    padres.add(el);
    if (!visible(el)) continue;
    const rango = document.createRange();
    rango.selectNodeContents(el);
    const q = rango.getBoundingClientRect();
    if (q.width < 2 || q.height < 2) continue;
    const c = getComputedStyle(el);
    const fs = parseFloat(c.fontSize) || 14;
    const texto = (el.innerText || t.nodeValue).replace(/\s+/g, ' ').trim().slice(0, 70);
    const rectText = rect(q);
    if ((q.right > W + 1 || q.left < -1) && !scrollerEn(el, 'x')) {
      fuera.push({ texto, rect: rectText });
      continue;
    }
    // Solo si de verdad se está comiendo texto: con Cinzel el alto de la fuente
    // supera la interlínea y scrollHeight miente unos píxeles aunque quepa todo.
    const unaLinea = c.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1;
    const multilinea = c.webkitLineClamp && c.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + fs * 0.7;
    if (unaLinea || multilinea) {
      elipsis.push({ texto, rect: rectText, w: el.clientWidth, sw: el.scrollWidth });
      continue;
    }
    // Recorte por un ancestro con overflow:hidden. Se para en el primer scroller:
    // lo que hay más allá se alcanza desplazando.
    const margenY = Math.max(4, fs * 0.45);
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const a = getComputedStyle(n);
      if (n !== el && (esScroller(a, 'x') || esScroller(a, 'y'))) break;
      if (a.overflowX === 'visible' && a.overflowY === 'visible') continue;
      const caja = n.getBoundingClientRect();
      if (caja.width < 2 || caja.height < 2) continue;
      const cortaX = a.overflowX !== 'visible' && (q.right > caja.right + 2 || q.left < caja.left - 2);
      const cortaY = a.overflowY !== 'visible' && (q.bottom > caja.bottom + margenY || q.top < caja.top - margenY);
      if (cortaX || cortaY) {
        recortados.push({ texto, rect: rectText, por: rect(caja), eje: cortaX ? 'x' : 'y' });
        break;
      }
    }
  }
  res.textoFuera = fuera.slice(0, TOPE);
  res.textoRecortado = recortados.slice(0, TOPE);
  res.elipsis = elipsis.slice(0, TOPE);

  // Interactivos.
  const SEL = 'a[href],button,input:not([type=hidden]),textarea,select,[role=button],[role=link],[role=tab],[role=switch],[role=checkbox],[role=radio],[role=menuitem],[tabindex="0"]';
  const interactivos = Array.from(document.querySelectorAll(SEL)).filter(visible);
  res.interactivos = interactivos.length;
  const interFuera = [];
  const solapes = [];
  const INTER_CERCA = 'a[href],button,input,textarea,select,[role=button],[role=link],[role=tab],[role=switch],[role=checkbox],[role=radio],[role=menuitem],[tabindex="0"]';
  for (const el of interactivos) {
    const q = el.getBoundingClientRect();
    const fueraX = q.right > W + 1 || q.left < -1;
    const fueraY = q.top >= H || q.bottom <= 0;
    if ((fueraX && !scrollerEn(el, 'x')) || (fueraY && !scrollerEn(el, 'y'))) {
      interFuera.push(quien(el));
      continue;
    }
    if (getComputedStyle(el).pointerEvents === 'none') continue;
    const parte = recorteVisible(el, q);
    if (!parte) continue;
    const cx = (parte.l + parte.d) / 2;
    const cy = (parte.t + parte.b) / 2;
    const tapa = document.elementFromPoint(cx, cy);
    if (!tapa) continue;
    if (el === tapa || el.contains(tapa) || tapa.contains(el)) continue;
    const dueno = tapa.closest(INTER_CERCA);
    if (dueno && (dueno === el || dueno.contains(el) || el.contains(dueno))) continue;
    solapes.push({ el: quien(el), tapa: quien(dueno || tapa) });
  }
  res.interactivoFuera = interFuera.slice(0, TOPE);
  res.solapes = solapes.slice(0, TOPE);
  return res;
}

/** Espera a que acaben la red al simulado y los cambios de contenido del DOM. */
async function esperarQuieto(page, enVuelo, maxMs = 12_000) {
  const inicio = Date.now();
  await page.evaluate(() => (document.fonts?.ready ? document.fonts.ready.then(() => true) : true)).catch(() => {});
  await page
    .evaluate(() => {
      window.__ultimoCambio = Date.now();
      new MutationObserver(() => {
        window.__ultimoCambio = Date.now();
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    })
    .catch(() => {});
  while (Date.now() - inicio < maxMs) {
    await page.waitForTimeout(150);
    const parado = await page.evaluate(() => Date.now() - window.__ultimoCambio).catch(() => 0);
    const hayContenido = await page.evaluate(() => (document.body.innerText || '').trim().length > 0).catch(() => false);
    if (parado > 700 && enVuelo.n === 0 && hayContenido) return true;
  }
  return false;
}

// ── Ruido de consola ────────────────────────────────────────────────────

const RUIDO = [
  /realtime/i,
  /localhost:8102.*(websocket|ws)/i,
  /ws:\/\/localhost:8102/i,
  /WebSocket connection to/i,
  /can.t establish a connection to the server at ws:/i,
  /Failed to load resource.*\b406\b/i, // .single() sin filas: es como responde el simulado.
  /the server responded with a status of 406/i,
  /favicon/i,
];
const esRuido = (texto) => RUIDO.some((x) => x.test(texto));

// ── Una combinación ─────────────────────────────────────────────────────

const slug = (s) => s.replace(/^\//, '').replace(/[^a-zA-Z0-9-]+/g, '_') || 'raiz';
const sembrarModo = (modo) => {
  const uid = '00000000-0000-4000-8000-000000000001';
  try {
    localStorage.setItem(`nivl.modo.activo.${uid}`, modo);
    // La tarjeta «Novedad: elige tus modos» taparía todas las pantallas.
    localStorage.setItem(`nivl.modos.novedad.${uid}`, '1');
  } catch {
    // Sin almacenamiento en about:blank.
  }
};

async function nuevoContexto(browser, ancho, sesion, modo) {
  const ctx = await browser.newContext({
    viewport: { width: ancho, height: ALTOS[ancho] ?? 900 },
    storageState: sesion ?? undefined,
    reducedMotion: 'reduce',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
  });
  await ctx.addInitScript(sembrarModo, modo);
  return ctx;
}

function vigilar(page) {
  const log = { consola: [], paginas: [], red: [], enVuelo: { n: 0 } };
  const esApi = (u) => u.includes(':8102/') && !u.includes('/realtime/');
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (esRuido(t)) return;
    log.consola.push(t.slice(0, 400));
    // React deja sin rellenar el %s: el argumento dice qué prop es.
    if (t.startsWith('React does not recognize')) {
      m.args()[1]?.jsonValue().then((v) => log.consola.push(`Prop desconocida en el DOM: ${v}`), () => {});
    }
  });
  page.on('pageerror', (e) => {
    const t = String(e?.message ?? e);
    if (!esRuido(t)) log.paginas.push(t.slice(0, 400));
  });
  page.on('request', (q) => {
    if (esApi(q.url())) log.enVuelo.n++;
  });
  const fin = (q) => {
    if (esApi(q.url())) log.enVuelo.n = Math.max(0, log.enVuelo.n - 1);
  };
  page.on('requestfinished', fin);
  page.on('requestfailed', fin);
  page.on('response', (q) => {
    if (esApi(q.url()) && (q.status() === 404 || q.status() >= 500)) log.red.push(`${q.status()} ${q.url().replace(/^https?:\/\/[^/]+/, '')}`.slice(0, 200));
  });
  return log;
}

function incidencias(c, h, log, listo) {
  const out = [];
  const add = (tipo, detalle) => out.push({ tipo, ...detalle });
  const pathFinal = h.ruta.split('?')[0];
  const esperado = c.ruta.split('?')[0];
  if (h.errorBoundary) add('error_boundary', { texto: h.textoInicio });
  if (h.notFound && !c.notFoundEsperado) add('not_found', { texto: h.textoInicio });
  if (!h.notFound && c.notFoundEsperado) add('falta_not_found', { texto: h.textoInicio });
  if (h.longitudTexto < 5 && h.imagenes === 0) add('blanco', { texto: h.textoInicio });
  if (!listo) add('sin_asentarse', { texto: h.textoInicio.slice(0, 80) });
  if (h.progreso > 0 && listo) add('cargando', { n: h.progreso });
  if (pathFinal !== esperado && !c.destinoLibre) add('redirigida', { a: pathFinal });
  if (h.scrollDoc.sw > h.scrollDoc.cw + 1 || h.scrollDoc.bsw > h.scrollDoc.cw + 1) add('scroll_horizontal', { ...h.scrollDoc });
  for (const x of h.textoFuera) add('texto_fuera', x);
  for (const x of h.textoRecortado) add('texto_recortado', x);
  for (const x of h.elipsis) add('elipsis', x);
  for (const x of h.interactivoFuera) add('interactivo_fuera', x);
  for (const x of h.solapes) add('solape', x);
  for (const x of [...new Set(log.consola)]) add(/^(Accessing element\.ref|React does not recognize|Prop desconocida)/.test(x) ? 'aviso_react' : 'consola', { texto: x });
  for (const x of [...new Set(log.paginas)]) add('pageerror', { texto: x });
  for (const x of [...new Set(log.red)]) add('red', { texto: x });
  return out;
}

async function recorrerUna(browser, c, sesion) {
  const inicio = Date.now();
  const ctx = await nuevoContexto(browser, c.ancho, c.sinSesion ? null : sesion, c.modo);
  try {
    const page = await ctx.newPage();
    const log = vigilar(page);
    await page.goto(BASE + c.ruta, { waitUntil: 'load', timeout: 180_000 });
    const listo = await esperarQuieto(page, log.enVuelo);
    const h = await page.evaluate(auditarPagina);
    const captura = join(c.motor, String(c.ancho), `${c.modo}__${slug(c.ruta)}.png`);
    mkdirSync(dirname(join(SALIDA, captura)), { recursive: true });
    await page.screenshot({ path: join(SALIDA, captura), timeout: 30_000 });
    return {
      ...c,
      url_final: h.ruta,
      captura,
      ms: Date.now() - inicio,
      interactivos: h.interactivos,
      modales: h.modales,
      texto: h.textoInicio,
      incidencias: incidencias(c, h, log, listo),
    };
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ── Sesión ──────────────────────────────────────────────────────────────

/** Login de verdad por el formulario (con Enter). Devuelve el storageState. */
async function iniciarSesion(browser, motor) {
  const ctx = await nuevoContexto(browser, 1280, null, 'general');
  try {
    const page = await ctx.newPage();
    const log = vigilar(page);
    await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 240_000 });
    await esperarQuieto(page, log.enVuelo);
    await page.locator('input:not([type=password]):visible').first().fill(CORREO_FICTICIO);
    const clave = page.locator('input[type=password]:visible').first();
    await clave.fill(CLAVE_FICTICIA);
    await clave.press('Enter');
    let entro = false;
    try {
      await page.waitForFunction(() => !location.pathname.startsWith('/login'), null, { timeout: 30_000 });
      entro = true;
    } catch {
      // Enter no envió: lo apunta la prueba de interacción; aquí se entra con el botón.
      await page.getByRole('button', { name: /entrar/i }).first().click();
      await page.waitForFunction(() => !location.pathname.startsWith('/login'), null, { timeout: 30_000 });
    }
    await esperarQuieto(page, log.enVuelo);
    return { estado: await ctx.storageState(), enterEnvia: entro };
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ── Pruebas de interacción ──────────────────────────────────────────────

const CAPTOR_FOCO = () => {
  const a = document.activeElement;
  if (!a || a === document.body || a === document.documentElement) return null;
  const q = a.getBoundingClientRect();
  const c = getComputedStyle(a);
  const contorno = c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0;
  const sombra = c.boxShadow && c.boxShadow !== 'none';
  return {
    tag: a.tagName.toLowerCase(),
    rol: a.getAttribute('role'),
    texto: (a.getAttribute('aria-label') || a.innerText || a.placeholder || '').replace(/\s+/g, ' ').trim().slice(0, 50),
    rect: { x: Math.round(q.left), y: Math.round(q.top), w: Math.round(q.width), h: Math.round(q.height) },
    dentroVentana: q.width > 0 && q.bottom > 0 && q.top < innerHeight && q.right > 0 && q.left < innerWidth,
    contorno,
    sombra: !!sombra,
    focusVisible: a.matches(':focus-visible'),
    outline: `${c.outlineStyle} ${c.outlineWidth} ${c.outlineColor}`,
  };
};

async function pruebaTab(page, motor, etiqueta, salidaCaptura) {
  const pasos = [];
  const recorrer = async (tecla, n) => {
    pasos.length = 0;
    for (let i = 0; i < n; i++) {
      await page.keyboard.press(tecla);
      await page.waitForTimeout(40);
      pasos.push(await page.evaluate(CAPTOR_FOCO));
      if (i === 3) await page.screenshot({ path: salidaCaptura }).catch(() => {});
    }
  };
  await recorrer('Tab', 22);
  let tecla = 'Tab';
  const claves = () => new Set(pasos.filter(Boolean).map((p) => `${p.tag}|${p.rol}|${p.texto}|${p.rect.x},${p.rect.y}`));
  if (claves().size < 3 && motor === 'webkit') {
    // Safari solo tabula por controles de formulario salvo con Opción o la preferencia.
    await page.evaluate(() => document.activeElement?.blur?.());
    await recorrer('Alt+Tab', 22);
    tecla = 'Alt+Tab';
  }
  const conFoco = pasos.filter(Boolean);
  const sinAnillo = conFoco.filter((p) => !p.contorno && !p.sombra);
  const fueraVentana = conFoco.filter((p) => !p.dentroVentana);
  return {
    prueba: 'tab_recorre_y_foco_visible',
    etiqueta,
    tecla,
    ok: claves().size >= 3 && sinAnillo.length === 0 && fueraVentana.length === 0,
    distintos: claves().size,
    sin_anillo: sinAnillo.slice(0, 8),
    fuera_ventana: fueraVentana.slice(0, 8),
    muestra: conFoco.slice(0, 5),
    captura: salidaCaptura.slice(SALIDA.length + 1),
  };
}

const scrollTotal = () => {
  let suma = window.scrollY;
  for (const el of document.querySelectorAll('*')) if (el.scrollTop > 0) suma += el.scrollTop;
  return suma;
};

async function pruebaRueda(page, etiqueta, ancho) {
  await page.mouse.move(ancho / 2, 420);
  const antes = await page.evaluate(scrollTotal);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(450);
  const despues = await page.evaluate(scrollTotal);
  return { prueba: 'rueda_desplaza', etiqueta, ok: despues > antes, antes, despues };
}

async function pruebaHover(page, etiqueta) {
  const candidatos = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('[role=button],a[href],button,[role=link],[role=tab]')) {
      const q = el.getBoundingClientRect();
      if (q.width < 20 || q.height < 16 || q.top < 0 || q.bottom > innerHeight || q.left < 0 || q.right > innerWidth) continue;
      out.push({ x: q.left + q.width / 2, y: q.top + q.height / 2, texto: (el.getAttribute('aria-label') || el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40) });
    }
    return out.slice(0, 10);
  });
  const foto = (p) => {
    const raiz = document.elementFromPoint(p.x, p.y);
    if (!raiz) return null;
    const dueno = raiz.closest('[role=button],a[href],button,[role=link],[role=tab]') || raiz;
    const cuerpo = [dueno, ...dueno.querySelectorAll('*')].slice(0, 12);
    return {
      cursor: getComputedStyle(raiz).cursor,
      firma: cuerpo.map((e) => { const c = getComputedStyle(e); return [c.backgroundColor, c.color, c.opacity, c.transform, c.borderTopColor, c.textDecorationLine, c.boxShadow].join('|'); }).join(';'),
    };
  };
  const filas = [];
  await page.mouse.move(1, 1);
  for (const p of candidatos) {
    await page.mouse.move(1, 1);
    await page.waitForTimeout(60);
    const a = await page.evaluate(foto, p);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(200);
    const b = await page.evaluate(foto, p);
    filas.push({ texto: p.texto, cursor: b?.cursor, cambia: a?.firma !== b?.firma });
  }
  const sinCursor = filas.filter((f) => f.cursor !== 'pointer');
  const sinCambio = filas.filter((f) => !f.cambia);
  return { prueba: 'hover_en_pulsables', etiqueta, ok: sinCursor.length === 0 && sinCambio.length === 0, n: filas.length, sin_cursor: sinCursor, sin_cambio: sinCambio };
}

const hayHoja = (page) => page.evaluate(() => Array.from(document.querySelectorAll('[aria-modal="true"], [role="dialog"]')).some((e) => e.getBoundingClientRect().width > 0));

async function abrirYCerrarEscape(page, nombre, abrir) {
  const antes = await hayHoja(page);
  await abrir();
  await page.waitForTimeout(700);
  const abierta = await hayHoja(page);
  if (!abierta) return { prueba: 'escape_cierra_hoja', etiqueta: nombre, ok: false, nota: 'no se pudo abrir la hoja', antes };
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  const sigue = await hayHoja(page);
  return { prueba: 'escape_cierra_hoja', etiqueta: nombre, ok: !sigue, sigue_abierta: sigue };
}

async function pruebasDeUnMotor(browser, motor, sesion, resultado) {
  const dirI = join(SALIDA, motor, 'interaccion');
  mkdirSync(dirI, { recursive: true });
  const anotar = (x) => resultado.push({ motor, ...x });
  const seguro = async (nombre, ancho, fn) => {
    try {
      await fn();
    } catch (e) {
      anotar({ prueba: nombre, etiqueta: `${ancho}`, ok: false, nota: `fallo del arnés: ${String(e.message ?? e).slice(0, 200)}`, arnes: true });
    }
  };
  const abrirPagina = async (ancho, ruta, conSesion = true, modo = 'general') => {
    const ctx = await nuevoContexto(browser, ancho, conSesion ? sesion : null, modo);
    const page = await ctx.newPage();
    const log = vigilar(page);
    await page.goto(BASE + ruta, { waitUntil: 'load', timeout: 180_000 });
    await esperarQuieto(page, log.enVuelo);
    return { ctx, page, log };
  };

  for (const ancho of [1280, 375]) {
    // Login: teclado.
    await seguro('login', ancho, async () => {
      const { ctx, page, log } = await abrirPagina(ancho, '/login', false);
      try {
        anotar({ ...(await pruebaTab(page, motor, `login ${ancho}`, join(dirI, `tab-login-${ancho}.png`))), ancho });
        await page.reload({ waitUntil: 'load' });
        await esperarQuieto(page, log.enVuelo);

        // Espacio y Enter en la pestaña Entrar/Crear cuenta.
        const pestanas = page.locator('[role=tab]:visible');
        if ((await pestanas.count()) >= 2) {
          // El registro corto tiene los mismos campos que el login: manda la pestaña marcada.
          const marcada = () => pestanas.nth(1).getAttribute('aria-selected');
          const n0 = await marcada();
          await pestanas.nth(1).focus();
          await page.keyboard.press('Enter');
          await page.waitForTimeout(350);
          const n1 = await marcada();
          anotar({ prueba: 'enter_activa', etiqueta: `pestaña de login ${ancho}`, ancho, ok: n0 !== 'true' && n1 === 'true', n0, n1 });
          await pestanas.first().click();
          await page.waitForTimeout(350);
          const n2 = await marcada();
          await pestanas.nth(1).focus();
          await page.keyboard.press('Space');
          await page.waitForTimeout(350);
          const n3 = await marcada();
          anotar({ prueba: 'espacio_activa', etiqueta: `pestaña de login ${ancho}`, ancho, ok: n2 !== 'true' && n3 === 'true', n2, n3, rol: 'tab' });
          await pestanas.first().click();
          await page.waitForTimeout(350);
        }

        // Enter envía el login, con los dos campos rellenos a teclado.
        await page.locator('input:not([type=password]):visible').first().focus();
        await page.keyboard.type(CORREO_FICTICIO);
        await page.keyboard.press('Tab');
        const enClave = await page.evaluate(() => document.activeElement?.type === 'password');
        if (!enClave) await page.locator('input[type=password]:visible').first().focus();
        await page.keyboard.type(CLAVE_FICTICIA);
        await page.keyboard.press('Enter');
        const envia = await page
          .waitForFunction(() => !location.pathname.startsWith('/login'), null, { timeout: 15_000 })
          .then(() => true)
          .catch(() => false);
        anotar({ prueba: 'enter_envia_login', etiqueta: `login ${ancho}`, ancho, ok: envia, tab_salta_a_clave: enClave });
      } finally {
        await ctx.close().catch(() => {});
      }
    });

    // Hoy (General): teclado, ratón, hojas.
    await seguro('hoy', ancho, async () => {
      const { ctx, page, log } = await abrirPagina(ancho, '/');
      try {
        anotar({ ...(await pruebaTab(page, motor, `hoy ${ancho}`, join(dirI, `tab-hoy-${ancho}.png`))), ancho });
        await page.reload({ waitUntil: 'load' });
        await esperarQuieto(page, log.enVuelo);
        anotar({ ...(await pruebaHover(page, `hoy ${ancho}`)), ancho });
        anotar({ ...(await pruebaRueda(page, `hoy ${ancho}`, ancho)), ancho });
        await page.evaluate(() => {
          for (const el of document.querySelectorAll('*')) if (el.scrollTop > 0) el.scrollTop = 0;
        });

        // Enter en un enlace de la navegación lleva a otra pantalla.
        const antes = await page.evaluate(() => location.pathname);
        const enlace = page.locator('[role=tab]:visible, a[href]:visible', { hasText: 'Avance' }).first();
        if (await enlace.count()) {
          await enlace.focus();
          await page.keyboard.press('Enter');
          const cambia = await page.waitForFunction((a) => location.pathname !== a, antes, { timeout: 6_000 }).then(() => true).catch(() => false);
          anotar({ prueba: 'enter_activa', etiqueta: `navegación ${ancho}`, ancho, ok: cambia, de: antes, a: await page.evaluate(() => location.pathname) });
          await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 180_000 });
          await esperarQuieto(page, log.enVuelo);
        } else {
          anotar({ prueba: 'enter_activa', etiqueta: `navegación ${ancho}`, ancho, ok: false, nota: 'no hay un destino Avance visible en la navegación' });
        }

        // Espacio y Escape: la hoja de completar una misión.
        const mision = page.getByText('Caminar treinta minutos').first();
        if (await mision.count()) {
          const r1 = await abrirYCerrarEscape(page, `completar misión ${ancho} (clic)`, () => mision.click());
          anotar({ ...r1, ancho });
          if (await hayHoja(page)) await page.reload({ waitUntil: 'load' });
          await esperarQuieto(page, log.enVuelo);
          const pulsable = page.locator('[role=button]:visible, [role=checkbox]:visible', { hasText: 'Caminar treinta minutos' }).first();
          if (await pulsable.count()) {
            await pulsable.focus();
            await page.keyboard.press('Space');
            await page.waitForTimeout(700);
            anotar({ prueba: 'espacio_activa', etiqueta: `misión ${ancho}`, ancho, ok: await hayHoja(page) });
            if (await hayHoja(page)) {
              await page.keyboard.press('Escape');
              await page.waitForTimeout(600);
            }
          } else {
            anotar({ prueba: 'espacio_activa', etiqueta: `misión ${ancho}`, ancho, ok: false, nota: 'la misión no es un pulsable con rol' });
          }
        } else {
          anotar({ prueba: 'escape_cierra_hoja', etiqueta: `completar misión ${ancho}`, ancho, ok: false, nota: 'no aparece la misión de los datos ficticios' });
        }
      } finally {
        await ctx.close().catch(() => {});
      }
    });

    // Onboarding: cada paso, avanzando con su botón.
    await seguro('onboarding', ancho, async () => {
      const { ctx, page, log } = await abrirPagina(ancho, '/onboarding');
      try {
        const pasos = [];
        const firmaPaso = () => page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300));
        for (let i = 0; i < 16; i++) {
          const listo = await esperarQuieto(page, log.enVuelo, 6_000);
          const h = await page.evaluate(auditarPagina);
          const captura = join(motor, 'interaccion', `onboarding-${ancho}-${String(i).padStart(2, '0')}.png`);
          await page.screenshot({ path: join(SALIDA, captura) });
          const c = { ruta: h.ruta.split('?')[0], destinoLibre: true };
          pasos.push({ paso: i, ruta: h.ruta, texto: h.textoInicio.slice(0, 90), captura, incidencias: incidencias(c, h, log, listo).filter((x) => !TIPOS_INFORMATIVOS.has(x.tipo)) });
          if (!h.ruta.startsWith('/onboarding')) break;
          const antes = await firmaPaso();
          const avanzar = page.getByRole('button', { name: /^(continuar|siguiente|empezar|saltar|omitir|ahora no|seguir|entrar en la arena|acepto|aceptar|crear mi|listo|sellar|firmar)/i }).last();
          if (!(await avanzar.count())) break;
          await avanzar.click({ timeout: 3_000 }).catch(() => {});
          await page.waitForTimeout(600);
          if ((await firmaPaso()) === antes) {
            // El paso pide elegir algo antes de seguir: la primera opción.
            const opcion = page.locator('[role=radio]:visible, [role=checkbox]:visible').first();
            if (!(await opcion.count())) break;
            await opcion.click({ timeout: 3_000 }).catch(() => {});
            await page.waitForTimeout(300);
            await avanzar.click({ timeout: 3_000 }).catch(() => {});
            await page.waitForTimeout(600);
            if ((await firmaPaso()) === antes) break;
          }
        }
        anotar({ prueba: 'onboarding_recorrido', etiqueta: `onboarding ${ancho}`, ancho, ok: pasos.every((p) => p.incidencias.length === 0), n: pasos.length, pasos });
      } finally {
        await ctx.close().catch(() => {});
      }
    });

    // Otra hoja: el alta en Agenda.
    await seguro('agenda', ancho, async () => {
      const { ctx, page } = await abrirPagina(ancho, '/agenda');
      try {
        const boton = page.getByRole('button', { name: /añadir|nuevo|crear|evento/i }).first();
        if (await boton.count()) anotar({ ...(await abrirYCerrarEscape(page, `alta en agenda ${ancho}`, () => boton.click())), ancho });
        else anotar({ prueba: 'escape_cierra_hoja', etiqueta: `alta en agenda ${ancho}`, ancho, ok: false, nota: 'no se encuentra el botón de alta' });
      } finally {
        await ctx.close().catch(() => {});
      }
    });

    // Una pantalla larga: la rueda.
    await seguro('perfil', ancho, async () => {
      const { ctx, page } = await abrirPagina(ancho, '/perfil');
      try {
        anotar({ ...(await pruebaRueda(page, `perfil ${ancho}`, ancho)), ancho });
      } finally {
        await ctx.close().catch(() => {});
      }
    });

    // Coach: Enter envía el mensaje.
    await seguro('coach', ancho, async () => {
      const { ctx, page } = await abrirPagina(ancho, '/coach');
      try {
        const campo = page.locator('textarea:visible, input:not([type=file]):visible').last();
        if (await campo.count()) {
          let peticiones = 0;
          page.on('request', (q) => {
            if (q.url().includes('/functions/v1/coach')) peticiones++;
          });
          await campo.focus();
          await page.keyboard.type('Mensaje de prueba');
          const antes = await campo.inputValue();
          await page.keyboard.press('Enter');
          await page.waitForTimeout(900);
          const despues = await campo.inputValue().catch(() => '');
          anotar({ prueba: 'enter_envia_coach', etiqueta: `coach ${ancho}`, ancho, ok: peticiones > 0, peticiones, antes, despues });
        } else {
          anotar({ prueba: 'enter_envia_coach', etiqueta: `coach ${ancho}`, ancho, ok: false, ruta: page.url(), texto: (await page.locator('body').innerText()).slice(0, 400), nota: 'no hay campo de texto visible' });
        }
      } finally {
        await ctx.close().catch(() => {});
      }
    });
  }
}

// ── Informe ─────────────────────────────────────────────────────────────

const TIPOS_INFORMATIVOS = new Set(['elipsis', 'aviso_react']);

function firmaDe(i) {
  const base = i.texto ?? i.el?.texto ?? i.a ?? '';
  const limpia = String(base).replace(/[0-9]+/g, '#').slice(0, 50);
  const tapa = i.tapa?.texto ? ` <- ${String(i.tapa.texto).replace(/[0-9]+/g, '#').slice(0, 30)}` : '';
  return `${i.tipo}: ${limpia}${tapa}`;
}

function agrupar(combinaciones) {
  const firmas = new Map();
  for (const c of combinaciones) {
    for (const i of c.incidencias ?? []) {
      const clave = `${c.area}|${c.ruta}|${c.modo}|${firmaDe(i)}`;
      let f = firmas.get(clave);
      if (!f) {
        f = { area: c.area, ruta: c.ruta, modo: c.modo, tipo: i.tipo, firma: firmaDe(i), n: 0, motores: new Set(), anchos: new Set(), ejemplo: i, captura: c.captura };
        firmas.set(clave, f);
      }
      f.n++;
      f.motores.add(c.motor);
      f.anchos.add(c.ancho);
    }
  }
  const lista = [...firmas.values()].map((f) => ({ ...f, motores: [...f.motores], anchos: [...f.anchos].sort((a, b) => a - b) }));
  lista.sort((a, b) => a.area.localeCompare(b.area) || a.tipo.localeCompare(b.tipo) || a.ruta.localeCompare(b.ruta));
  const porArea = {};
  for (const f of lista) {
    porArea[f.area] ??= {};
    porArea[f.area][f.tipo] = (porArea[f.area][f.tipo] ?? 0) + 1;
  }
  return { porArea, firmas: lista };
}

let estado = { combinaciones: [], interaccion: [], problemas_arnes: [] };
function guardar(final = false) {
  const combinaciones = estado.combinaciones;
  const conProblema = combinaciones.filter((c) => (c.incidencias ?? []).some((i) => !TIPOS_INFORMATIVOS.has(i.tipo))).length;
  const salida = {
    meta: { base: BASE, fecha: new Date().toISOString(), final, motores: MOTORES, anchos: ANCHOS, total: combinaciones.length, con_problema: conProblema },
    resumen: agrupar(combinaciones),
    interaccion: estado.interaccion,
    interaccion_fallos: estado.interaccion.filter((x) => !x.ok),
    problemas_arnes: estado.problemas_arnes,
    combinaciones,
  };
  writeFileSync(INFORME, JSON.stringify(salida, null, 1));
}

// ── Principal ───────────────────────────────────────────────────────────

const clave = (c) => `${c.motor}|${c.ancho}|${c.modo}|${c.ruta}`;

function matriz(motor) {
  const out = [];
  for (const ancho of ANCHOS) {
    for (const e of RUTAS) {
      if (FILTRO_RUTA && !FILTRO_RUTA.some((f) => e.ruta.includes(f))) continue;
      if (FILTRO_AREA && !FILTRO_AREA.includes(e.area)) continue;
      if (args['sin-galeria'] && e.ruta.startsWith('/kit')) continue;
      for (const modo of e.modos) {
        if (FILTRO_MODO && !FILTRO_MODO.includes(modo)) continue;
        out.push({ ...e, modos: undefined, motor, ancho, modo });
      }
    }
  }
  return out;
}

async function enParalelo(trabajos, n, fn) {
  let i = 0;
  const hilo = async () => {
    while (i < trabajos.length) await fn(trabajos[i++]);
  };
  await Promise.all(Array.from({ length: Math.min(n, trabajos.length) }, hilo));
}

async function principal() {
  mkdirSync(SALIDA, { recursive: true });
  if (args.reanudar && existsSync(INFORME)) {
    const previo = JSON.parse(readFileSync(INFORME, 'utf8'));
    estado.combinaciones = (previo.combinaciones ?? []).filter((c) => !c.fallo_arnes);
    estado.interaccion = previo.interaccion ?? [];
  }
  const hechas = new Set(estado.combinaciones.map(clave));
  for (const motor of MOTORES) {
    let browser;
    try {
      // Chromium: se prefiere el headless completo (es el mismo motor que Chrome y
      // no depende de que esté descargado el `headless_shell`).
      browser = await playwright[motor].launch({ timeout: 60_000, ...(motor === 'chromium' ? { channel: typeof args.canal === 'string' ? args.canal : 'chromium' } : {}) });
    } catch (e) {
      estado.problemas_arnes.push({ motor, error: `no arranca: ${String(e.message ?? e).slice(0, 300)}` });
      console.error(`[${motor}] no arranca`);
      guardar();
      continue;
    }
    try {
      let sesion;
      try {
        const r0 = await iniciarSesion(browser, motor);
        sesion = r0.estado;
        console.log(`[${motor}] sesión lista (Enter envió el login: ${r0.enterEnvia})`);
      } catch (e) {
        estado.problemas_arnes.push({ motor, error: `login: ${String(e.message ?? e).slice(0, 300)}` });
        console.error(`[${motor}] sin sesión: ${e.message}`);
        guardar();
        continue;
      }
      if (!args['solo-interaccion']) {
        const trabajos = matriz(motor).filter((c) => !hechas.has(clave(c)));
        console.log(`[${motor}] ${trabajos.length} combinaciones`);
        let hecho = 0;
        await enParalelo(trabajos, CONCURRENCIA, async (c) => {
          let fila;
          for (let intento = 1; intento <= 2 && !fila; intento++) {
            try {
              fila = await recorrerUna(browser, c, sesion);
            } catch (e) {
              if (intento === 2) fila = { ...c, fallo_arnes: String(e.message ?? e).slice(0, 300), incidencias: [{ tipo: 'fallo_arnes', texto: String(e.message ?? e).slice(0, 200) }] };
            }
          }
          estado.combinaciones.push(fila);
          hecho++;
          if (hecho % 10 === 0) {
            guardar();
            console.log(`[${motor}] ${hecho}/${trabajos.length}`);
          }
        });
        guardar();
      }
      if (!args['sin-interaccion']) {
        estado.interaccion = estado.interaccion.filter((x) => x.motor !== motor);
        await pruebasDeUnMotor(browser, motor, sesion, estado.interaccion);
        guardar();
      }
    } finally {
      await browser.close().catch(() => {});
    }
  }
  guardar(true);
  console.log(`Informe: ${INFORME}`);
  const fallos = estado.interaccion.filter((x) => !x.ok).length;
  console.log(`Combinaciones: ${estado.combinaciones.length}. Fallos de interacción: ${fallos}. Problemas del arnés: ${estado.problemas_arnes.length}.`);
}

principal().catch((e) => {
  console.error(e);
  guardar();
  process.exit(1);
});
