#!/usr/bin/env node
// Compositor del diseño comercial de la tienda. Toma una captura cruda y saca
// el PNG final (fondo de arcos, titular, marco fino y captura sangrando), con
// Google Chrome sin cabeza por DevTools sobre tubería: sin puertos, sin red.
//
//   node scripts/tienda/componer.mjs --cruda x.png --objetivo iphone-69 --escena hoy --destino y.png
//   node scripts/tienda/componer.mjs --muestra <carpeta> [--escena hoy]
//
// Desde código: componer({cruda, objetivo, escena, destino}). Para una tanda,
// abre uno con abrirNavegador() y pásalo como `navegador` a cada llamada.

import { spawn, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { OBJETIVOS, PATH_MEANDRO, esReloj, maquetar } from './plantilla/maquetas.mjs';
import { normalizarEscena, textoDe } from './plantilla/textos.mjs';
import { TEMA, cssTema, mezclarTema } from './plantilla/tema.mjs';

const ejecutar = promisify(execFile);
const AQUI = dirname(fileURLToPath(import.meta.url));
const PLANTILLA = join(AQUI, 'plantilla');
const CHROME = process.env.NIVL_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

let cacheTema;
/** El tema base, con los cambios del módulo de NIVL_TIENDA_TEMA si lo hay. */
export function temaActivo() {
  cacheTema ??= (async () => {
    const ruta = process.env.NIVL_TIENDA_TEMA;
    if (!ruta) return TEMA;
    const modulo = await import(pathToFileURL(resolve(ruta)).href);
    return mezclarTema(TEMA, modulo.default ?? {});
  })();
  return cacheTema;
}

/** Sube desde `inicio` hasta dar con node_modules/<ruta> (las worktrees heredan el del repo). */
export function buscarEnNodeModules(ruta, inicio = AQUI) {
  let dir = resolve(inicio);
  for (;;) {
    const candidato = join(dir, 'node_modules', ruta);
    if (existsSync(candidato)) return candidato;
    const padre = dirname(dir);
    if (padre === dir) throw new Error(`No encuentro ${ruta} en ningún node_modules. Ejecuta npm ci.`);
    dir = padre;
  }
}

let cacheFuentes;
async function cssFuentes(tema) {
  cacheFuentes ??= Promise.all(
    tema.archivosFuente.map(async ({ familia, peso, ruta }) => {
      const b64 = (await readFile(isAbsolute(ruta) ? ruta : buscarEnNodeModules(ruta))).toString('base64');
      return `@font-face{font-family:'${familia}';font-weight:${peso};font-style:normal;src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
    }),
  ).then((css) => css.join('\n'));
  return cacheFuentes;
}

// ── Navegador ────────────────────────────────────────────────────────────

class Navegador {
  #hijo;
  #perfil;
  #id = 0;
  #pendientes = new Map();
  #oyentes = new Set();
  #resto = '';
  #stderr = '';
  #cerrado = false;

  static async abrir() {
    if (!existsSync(CHROME)) throw new Error(`No está Chrome en ${CHROME} (o define NIVL_CHROME).`);
    const n = new Navegador();
    n.#perfil = await mkdtemp(join(tmpdir(), 'nivl-componer-'));
    n.#hijo = spawn(
      CHROME,
      [
        '--headless=new',
        '--remote-debugging-pipe',
        `--user-data-dir=${n.#perfil}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-sync',
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-default-apps',
        '--hide-scrollbars',
        '--mute-audio',
        '--force-color-profile=srgb',
        '--font-render-hinting=none',
        'about:blank',
      ],
      { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] },
    );
    n.#hijo.stderr.on('data', (d) => {
      n.#stderr = (n.#stderr + d).slice(-2000);
    });
    n.#hijo.stdio[4].on('data', (d) => n.#recibir(d));
    n.#hijo.stdio[3].on('error', () => {});
    n.#hijo.on('exit', () => n.#fallarTodo('Chrome se ha cerrado'));
    n.#hijo.on('error', (e) => n.#fallarTodo(`Chrome no arranca: ${e.message}`));
    await n.enviar('Browser.getVersion');
    return n;
  }

  #fallarTodo(motivo) {
    this.#cerrado = true;
    for (const p of this.#pendientes.values()) p.rechazar(new Error(`${motivo}. ${this.#stderr}`));
    this.#pendientes.clear();
  }

  #recibir(trozo) {
    this.#resto += trozo.toString('utf8');
    let corte;
    while ((corte = this.#resto.indexOf('\0')) !== -1) {
      const msg = JSON.parse(this.#resto.slice(0, corte));
      this.#resto = this.#resto.slice(corte + 1);
      if (msg.id && this.#pendientes.has(msg.id)) {
        const p = this.#pendientes.get(msg.id);
        this.#pendientes.delete(msg.id);
        clearTimeout(p.reloj);
        if (msg.error) p.rechazar(new Error(`${p.metodo}: ${msg.error.message}`));
        else p.resolver(msg.result);
      } else if (msg.method) {
        for (const o of this.#oyentes) o(msg);
      }
    }
  }

  enviar(metodo, params = {}, sessionId) {
    if (this.#cerrado) return Promise.reject(new Error(`Chrome cerrado. ${this.#stderr}`));
    const id = ++this.#id;
    return new Promise((resolver, rechazar) => {
      const reloj = setTimeout(() => {
        this.#pendientes.delete(id);
        rechazar(new Error(`Tiempo agotado en ${metodo}`));
      }, 90_000);
      this.#pendientes.set(id, { resolver, rechazar, reloj, metodo });
      this.#hijo.stdio[3].write(`${JSON.stringify({ id, method: metodo, params, ...(sessionId ? { sessionId } : {}) })}\0`);
    });
  }

  esperarEvento(metodo, sessionId, ms = 60_000) {
    return new Promise((resolver, rechazar) => {
      const oyente = (msg) => {
        if (msg.method === metodo && msg.sessionId === sessionId) {
          clearTimeout(reloj);
          this.#oyentes.delete(oyente);
          resolver(msg.params);
        }
      };
      const reloj = setTimeout(() => {
        this.#oyentes.delete(oyente);
        rechazar(new Error(`Tiempo agotado esperando ${metodo}`));
      }, ms);
      this.#oyentes.add(oyente);
    });
  }

  /** Abre `url` a ese tamaño, evalúa `script` y devuelve {resultado, png}. */
  async fotografiar({ url, ancho, alto, script }) {
    const { targetId } = await this.enviar('Target.createTarget', { url: 'about:blank' });
    try {
      const { sessionId } = await this.enviar('Target.attachToTarget', { targetId, flatten: true });
      await this.enviar('Page.enable', {}, sessionId);
      await this.enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: false }, sessionId);
      const cargada = this.esperarEvento('Page.loadEventFired', sessionId);
      const nav = await this.enviar('Page.navigate', { url }, sessionId);
      if (nav.errorText) throw new Error(`No carga la plantilla: ${nav.errorText}`);
      await cargada;
      let resultado;
      if (script) {
        const r = await this.enviar('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true }, sessionId);
        if (r.exceptionDetails) throw new Error(`Fallo en la plantilla: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
        resultado = r.result.value;
      }
      const { data } = await this.enviar(
        'Page.captureScreenshot',
        { format: 'png', fromSurface: true, clip: { x: 0, y: 0, width: ancho, height: alto, scale: 1 } },
        sessionId,
      );
      return { resultado, png: Buffer.from(data, 'base64') };
    } finally {
      await this.enviar('Target.closeTarget', { targetId }).catch(() => {});
    }
  }

  async cerrar() {
    if (!this.#hijo) return;
    const hijo = this.#hijo;
    this.#hijo = undefined;
    if (!this.#cerrado) {
      const fin = new Promise((r) => hijo.once('exit', r));
      hijo.kill('SIGTERM');
      await Promise.race([fin, new Promise((r) => setTimeout(r, 3000))]);
      if (hijo.exitCode === null) hijo.kill('SIGKILL');
    }
    this.#cerrado = true;
    await rm(this.#perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
  }
}

export const abrirNavegador = () => Navegador.abrir();

// ── Página ───────────────────────────────────────────────────────────────

const escapar = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function partir(trozos, cuantas) {
  const lineas = cuantas === 1 ? [trozos.join(' ')] : trozos;
  return lineas.map((l) => `<span class="linea">${escapar(l)}</span>`).join('');
}

function svgArcos({ W, H, arcos }) {
  const { cx, cy, rx, ratio } = arcos;
  const paths = rx
    .map((r) => {
      const ry = Math.round(r * ratio);
      return `<path d="M${cx - r} ${cy}A${r} ${ry} 0 0 1 ${cx + r} ${cy}"/>`;
    })
    .join('');
  return `<svg class="arcos" viewBox="0 0 ${W} ${H}" aria-hidden="true">${paths}</svg>`;
}

function svgMeandro({ meandroUnidad: u, meandroAncho: ancho, W, trazo }, motivos) {
  if (!motivos.meandro) {
    if (!motivos.hilo) return '';
    return `<span class="hilo" style="width:${Math.round(W * 0.12)}px;height:${Math.max(2, trazo)}px"></span>`;
  }
  const k = u / 10;
  return (
    `<svg class="meandro" width="${ancho}" height="${u}" viewBox="0 0 ${ancho} ${u}" aria-hidden="true">` +
    `<defs><pattern id="g" width="${u}" height="${u}" patternUnits="userSpaceOnUse">` +
    `<path transform="scale(${k})" stroke-width="1" d="${PATH_MEANDRO}"/></pattern></defs>` +
    `<rect width="${ancho}" height="${u}" fill="url(#g)"/></svg>`
  );
}

const rellenar = (plantilla, valores) => plantilla.replace(/\{\{(\w+)\}\}/g, (_, k) => valores[k] ?? '');

async function paginaHtml(m, texto, cruda) {
  const tema = await temaActivo();
  const [base, estilos, fuentes] = await Promise.all([
    readFile(join(PLANTILLA, 'base.html'), 'utf8'),
    readFile(join(PLANTILLA, 'estilos.css'), 'utf8'),
    cssFuentes(tema),
  ]);
  const px = ['W', 'H', 'padTop', 'margen', 'cabeceraAncho', 'marcaFs', 'marcaGap', 'tituloFs', 'subGap', 'subFs', 'meandroGap', 'marcoTop', 'marcoIzq', 'marcoAncho', 'marcoAlto', 'radio', 'radioInterior', 'bisel', 'trazo', 'pantallaAlto'];
  const variables = [
    ...px.map((k) => `--${k}:${m[k]}px`),
    `--tituloLh:${m.tituloLh}`,
    `--subLh:${m.subLh}`,
    `--arco:${m.arcos.trazo}px`,
  ].join(';');
  return rellenar(base, {
    FUENTES: fuentes,
    TEMA: cssTema(tema),
    MARCA: tema.marca,
    ESTILOS: estilos,
    CLASE: `${m.modo} marco-${m.marcoTipo}`,
    VARIABLES: variables,
    ARCOS: tema.motivos.arcos ? svgArcos(m) : '',
    TITULO: partir(texto.titular, m.lineas),
    SUB: partir(texto.sub, m.subLineas),
    MEANDRO: svgMeandro(m, tema.motivos),
    CRUDA: pathToFileURL(resolve(cruda)).href,
  });
}

// ── Imagen ───────────────────────────────────────────────────────────────

/** Tamaño de cualquier imagen que entienda ffprobe. */
async function medir(ruta) {
  const { stdout } = await ejecutar('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', ruta]);
  const [ancho, alto] = stdout.trim().split(',').map(Number);
  if (!ancho || !alto) throw new Error(`No puedo medir ${ruta}`);
  return { ancho, alto };
}

/** Cabecera IHDR del PNG. colorType 2 = RGB sin alfa; 6 = RGBA. */
export async function cabeceraPng(ruta) {
  const f = await open(ruta, 'r');
  try {
    const { buffer } = await f.read(Buffer.alloc(33), 0, 33, 0);
    if (buffer.toString('latin1', 1, 4) !== 'PNG') throw new Error(`${ruta} no es PNG`);
    return { ancho: buffer.readUInt32BE(16), alto: buffer.readUInt32BE(20), profundidad: buffer[24], colorType: buffer[25] };
  } finally {
    await f.close();
  }
}

export async function aplanar(origen, destino) {
  await ejecutar('ffmpeg', ['-y', '-v', 'error', '-i', origen, '-frames:v', '1', '-vf', 'format=rgb24', '-update', '1', destino]);
}

async function comprobarSalida(destino, ancho, alto) {
  const c = await cabeceraPng(destino);
  if (c.ancho !== ancho || c.alto !== alto) throw new Error(`${destino}: sale ${c.ancho}x${c.alto} y debía ser ${ancho}x${alto}`);
  if (c.colorType !== 2 || c.profundidad !== 8) throw new Error(`${destino}: PNG con colorType ${c.colorType} y ${c.profundidad} bits; debe ser RGB de 8 bits sin alfa`);
  return c;
}

/**
 * Compone una captura. Devuelve {archivo, ancho, alto, escena, objetivo, tipo:'tienda'}
 * (tipo 'cruda' si es Apple Watch, que se copia sin alfa y sin diseño).
 */
export async function componer({ cruda, objetivo, escena, destino, navegador }) {
  await mkdir(dirname(resolve(destino)), { recursive: true });

  if (esReloj(objetivo)) {
    const { ancho, alto } = await medir(cruda);
    await aplanar(cruda, destino);
    await comprobarSalida(destino, ancho, alto);
    return { archivo: destino, ancho, alto, escena, objetivo, tipo: 'cruda' };
  }

  const textoDelTema = (await temaActivo()).textos?.[normalizarEscena(escena)];
  const texto = textoDelTema ?? textoDe(escena);
  const original = await medir(cruda);
  const m = maquetar(objetivo, original.ancho, original.alto);
  const propio = !navegador;
  const nav = navegador ?? (await abrirNavegador());
  const tmp = await mkdtemp(join(tmpdir(), 'nivl-pagina-'));
  try {
    const html = join(tmp, 'pagina.html');
    await writeFile(html, await paginaHtml(m, texto, cruda));
    const { resultado, png } = await nav.fotografiar({
      url: pathToFileURL(html).href,
      ancho: m.W,
      alto: m.H,
      script: await readFile(join(PLANTILLA, 'ajuste.js'), 'utf8'),
    });
    if (resultado.problemas.length) {
      throw new Error(`${objetivo}/${escena}: ${resultado.problemas.join('; ')}`);
    }
    const crudo = join(tmp, 'captura.png');
    await writeFile(crudo, png);
    await aplanar(crudo, destino);
    await comprobarSalida(destino, m.W, m.H);
    return { archivo: destino, ancho: m.W, alto: m.H, escena, objetivo, tipo: 'tienda' };
  } finally {
    await rm(tmp, { recursive: true, force: true });
    if (propio) await nav.cerrar();
  }
}

// ── Muestra: pantalla inventada para maquetar sin arnés ──────────────────

/** Tamaño de la cruda de muestra por objetivo (el del propio dispositivo). */
function tamanoMuestra(objetivo, retratoWeb) {
  if (objetivo === 'web-social') return retratoWeb ? { ancho: 1320, alto: 2868 } : { ancho: 2880, alto: 1800 };
  if (objetivo === 'web' && retratoWeb) return { ancho: 1320, alto: 2868 };
  const { ancho, alto } = OBJETIVOS[objetivo];
  return { ancho, alto };
}

export async function crearMuestra({ ancho, alto, destino, navegador }) {
  const base = await readFile(join(PLANTILLA, 'muestra.html'), 'utf8');
  const u = Math.round(Math.min(ancho, alto) / 26);
  const fila = Math.round(u * 3);
  const filas = Array.from({ length: Math.ceil(alto / fila) }, (_, i) => `<div class="r">Fila ${i + 1} de contenido inventado</div>`).join('');
  const html = rellenar(base, { W: ancho, H: alto, P: u, G: Math.round(u / 2), T: Math.round(u * 1.4), R: u, B: Math.max(2, Math.round(u / 18)), C: u * 4, FILA: fila, FILAS: filas });
  const tmp = await mkdtemp(join(tmpdir(), 'nivl-muestra-'));
  try {
    const pag = join(tmp, 'm.html');
    await writeFile(pag, html);
    const { png } = await navegador.fotografiar({ url: pathToFileURL(pag).href, ancho, alto });
    await writeFile(destino, png);
    return destino;
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function tandaMuestra(dir, escena) {
  await mkdir(dir, { recursive: true });
  const navegador = await abrirNavegador();
  try {
    const casos = [
      ...Object.keys(OBJETIVOS).map((objetivo) => ({ objetivo, retrato: false, nombre: objetivo })),
      { objetivo: 'web', retrato: true, nombre: 'web-retrato' },
      { objetivo: 'web-social', retrato: true, nombre: 'web-social-retrato' },
    ];
    for (const { objetivo, retrato, nombre } of casos) {
      const { ancho, alto } = tamanoMuestra(objetivo, retrato);
      const cruda = join(dir, `cruda-${nombre}.png`);
      await crearMuestra({ ancho, alto, destino: cruda, navegador });
      const r = await componer({ cruda, objetivo, escena, destino: join(dir, `${nombre}.png`), navegador });
      const c = await cabeceraPng(r.archivo);
      console.log(`${nombre}: ${c.ancho}x${c.alto} colorType ${c.colorType}`);
    }
  } finally {
    await navegador.cerrar();
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────

function argumentos(lista) {
  const a = {};
  for (let i = 0; i < lista.length; i += 1) {
    if (lista[i].startsWith('--')) {
      a[lista[i].slice(2)] = lista[i + 1] && !lista[i + 1].startsWith('--') ? lista[(i += 1)] : true;
    }
  }
  return a;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = argumentos(process.argv.slice(2));
  try {
    if (a.muestra) {
      await tandaMuestra(resolve(String(a.muestra === true ? 'muestra-tienda' : a.muestra)), a.escena ?? 'coach');
    } else if (a.cruda && a.objetivo && a.escena && a.destino) {
      const r = await componer(a);
      console.log(JSON.stringify(r));
    } else {
      console.error(`Uso: componer.mjs --cruda x.png --objetivo <id> --escena <id> --destino y.png\n     componer.mjs --muestra <carpeta> [--escena <id>]\nObjetivos: ${Object.keys(OBJETIVOS).join(', ')}, watch-*`);
      process.exitCode = 2;
    }
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
