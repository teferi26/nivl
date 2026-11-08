#!/usr/bin/env node
// Vídeos de tienda: graba la gira del arnés en un simulador y la convierte.
//
//   node scripts/tienda/video.mjs --objetivo iphone-69,ipad-13 [--commit HEAD] [--solo preview|largo] [--salida dir]
//
// preview.mp4 es el App Preview (lo valida validar.mjs). largo.mp4 es el recorrido
// completo para web y redes, sin límite de duración. Solo imagen de la app: sin
// marcos ni rótulos, lo exige Apple. simctl va fuera del sandbox.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { BUNDLE_ID, construir } from './harness/construir.mjs';
import { abrirEscena, aprobarEsquema, prepararYLanzar } from './harness/simulador.mjs';
import { objetivoPorId, REGLAS_PREVIEW } from './specs.mjs';
import { interpretarFfprobe, sondearVideo, validarVideo } from './validar.mjs';

const TIPO = 'com.apple.CoreSimulator.SimDeviceType.';

// iPhone Duo no se graba en su simulador: el interior es casi cuadrado y 886x1920
// (lo único que Apple admite para Duo) obligaría a recortar media pantalla.
export const DISPOSITIVOS = Object.freeze({
  'iphone-69': `${TIPO}iPhone-17-Pro-Max`,
  'iphone-63': `${TIPO}iPhone-17-Pro`,
  'iphone-duo-exterior': `${TIPO}iPhone-17-Pro-Max`,
  'iphone-duo-interior': `${TIPO}iPhone-17-Pro-Max`,
  'ipad-13': `${TIPO}iPad-Pro-13-inch-M5-12GB`,
});

export const SIN_VIDEO = Object.freeze({
  mac: 'NIVL no tiene app de Mac que grabar con simctl; una app de iPad en Mac no corre en el simulador.',
  'apple-tv': 'La app de tvOS no usa el arnés de la app iOS, que es lo único que este módulo sabe grabar.',
  'vision-pro': '3840x2160 no cabe en H.264 nivel 4.0, el único códec que este módulo produce; haría falta ProRes 422 HQ.',
  watch: 'Apple no admite App Preview en Apple Watch.',
  web: 'La web no tiene App Preview.',
});

export function videoDisponible(id) {
  if (DISPOSITIVOS[id]) return { ok: true, motivo: null };
  return { ok: false, motivo: SIN_VIDEO[id] ?? `objetivo desconocido: ${id}` };
}

export const FPS = 30;
// Holgura bajo el tope de 30 s de Apple: el contenedor redondea hacia arriba.
export const DURACION_MAX = 29.5;
export const LARGO_ANCHO = 1080;
// Lo mínimo que se quita del principio: la primera fracción puede venir a medio pintar.
export const CABEZA_S = 0.4;
const COLA_MS = 700;
const RETRASOS_MS = [8000, 25000, 60000];
const MARGEN_ARRANQUE_MS = 1000;
// Lo que se ve de la pantalla quieta antes de que empiece la gira.
const ANTES_DE_GIRA_MS = 300;

// La gira corta dura 20,8 s. Lo que falta hasta los 27 s se graba de verdad, con
// las mismas órdenes del arnés, en vez de ralentizar o congelar la imagen. Un
// desplazamiento al mismo punto hace de pausa porque el arnés atiende las órdenes
// en cola y aquí no puede haber esperas de este lado (ver grabarGira).
export const CODA_PREVIEW = Object.freeze([
  { accion: 'desplazar', y: 420, ms: 3200 },
  { accion: 'desplazar', y: 420, ms: 1000 },
  { accion: 'ir', ruta: '/(tabs)/habitos' },
  { accion: 'desplazar', y: 0, ms: 1400 },
]);

const par = (n) => Math.floor(n / 2) * 2;

/** El mayor recorte centrado, de lados pares, con la relación del destino. Puro. */
export function recorteCentrado(ancho, alto, destAncho, destAlto) {
  const relacion = destAncho / destAlto;
  let w = ancho;
  let h = alto;
  if (ancho / alto > relacion) w = Math.round(alto * relacion);
  else h = Math.round(ancho / relacion);
  w = par(w);
  h = par(h);
  return { w, h, x: par((ancho - w) / 2), y: par((alto - h) / 2) };
}

/** Lado corto a 1080 y el largo en proporción, siempre par. Puro. */
export function tamanoLargo(ancho, alto) {
  const escala = LARGO_ANCHO / Math.min(ancho, alto);
  return [par(Math.round(ancho * escala)), par(Math.round(alto * escala))];
}

/** Lo que dura el resultado: lo grabado, dentro de los límites de Apple. Puro. */
export function duracionPreview(segundosGrabados) {
  return Math.min(DURACION_MAX, Math.max(REGLAS_PREVIEW.duracionMin, segundosGrabados));
}

/**
 * Normaliza la grabación, que es de velocidad variable y acaba en el último cambio
 * de imagen: rellena a 30 fps fijos y alarga el último cuadro hasta el final real.
 * Sin conversión de gama: el archivo dice Display P3 pero los valores son sRGB
 * (medido contra una captura: convertirlos satura el oro). Puro.
 */
export function filtroVideo({ ancho, alto, destino: [dw, dh], cabeza = CABEZA_S }) {
  const r = recorteCentrado(ancho, alto, dw, dh);
  return [
    `fps=${FPS}:start_time=0`,
    `trim=start=${cabeza}`,
    'setpts=PTS-STARTPTS',
    'tpad=stop=-1:stop_mode=clone',
    `crop=${r.w}:${r.h}:${r.x}:${r.y}`,
    `scale=${dw}:${dh}:flags=lanczos:out_color_matrix=bt709:out_range=tv`,
    'setsar=1',
    'format=yuv420p',
  ].join(',');
}

const COLOR = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv'];
const FINAL = ['-map', '0:v:0', '-map', '1:a:0', '-movflags', '+faststart', '-shortest'];

/**
 * nal-hrd=cbr rellena hasta la tasa exigida aunque la imagen esté quieta: sin él
 * una pantalla estática queda muy por debajo de los 10 Mbps. El audio es ruido a
 * -86 dBFS, inaudible: el silencio digital ocupa 2 kbps y Apple pide 256. Puro.
 */
export function argsPreview({ cruda, destino, ancho, alto, tamano, duracion, cabeza }) {
  return [
    '-y', '-v', 'error', '-i', cruda,
    '-f', 'lavfi', '-i', 'anoisesrc=c=white:a=0.00005:r=48000:s=7,aformat=channel_layouts=stereo',
    '-t', String(duracion),
    '-vf', filtroVideo({ ancho, alto, destino: tamano, cabeza }),
    '-r', String(FPS), '-fps_mode', 'cfr',
    '-c:v', 'libx264', '-preset', 'medium', '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p',
    '-b:v', '11M', '-minrate', '11M', '-maxrate', '11M', '-bufsize', '11M',
    '-x264-params', 'nal-hrd=cbr:force-cfr=1:interlaced=0',
    ...COLOR,
    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2',
    ...FINAL,
    destino,
  ];
}

export function argsLargo({ cruda, destino, ancho, alto, tamano, duracion, cabeza }) {
  return [
    '-y', '-v', 'error', '-i', cruda,
    '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-t', String(duracion),
    '-vf', filtroVideo({ ancho, alto, destino: tamano, cabeza }),
    '-r', String(FPS), '-fps_mode', 'cfr',
    '-c:v', 'libx264', '-preset', 'medium', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '18',
    ...COLOR,
    '-c:a', 'aac', '-b:a', '128k',
    ...FINAL,
    destino,
  ];
}

function correr(cmd, args) {
  return new Promise((ok, mal) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', mal);
    p.on('close', (c) => (c === 0 ? ok() : mal(new Error(`${cmd} salió con ${c}: ${err.trim().slice(-800)}`))));
  });
}

function medidas(ruta) {
  const datos = sondearVideo(ruta);
  if (datos.error) throw new Error(`${ruta}: ${datos.error}`);
  return interpretarFfprobe(datos);
}

/** Convierte una grabación en App Preview y falla si validar.mjs no lo da por bueno. */
export async function convertirPreview({ cruda, destino, objetivo, segundos, cabeza = CABEZA_S, log = () => {} }) {
  const o = typeof objetivo === 'string' ? objetivoPorId(objetivo) : objetivo;
  const tamano = o.preview?.[o.orientacion]?.[0];
  if (!tamano) throw new Error(`${o.id} no admite App Preview en ${o.orientacion}`);
  const { ancho, alto } = medidas(cruda);
  const util = segundos - cabeza;
  const duracion = duracionPreview(util);
  if (duracion !== util) log(`preview ${o.id}: ajustado a ${duracion} s desde ${util.toFixed(2)} s`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  await correr('ffmpeg', argsPreview({ cruda, destino, ancho, alto, tamano, duracion, cabeza }));
  const meta = medidas(destino);
  const errores = validarVideo(meta, o);
  if (errores.length) throw new Error(`preview de ${o.id} no cumple: ${errores.join('; ')}`);
  return { archivo: destino, ancho: meta.ancho, alto: meta.alto, duracion: meta.duracion, bitrate: meta.bitrate, tipo: 'preview' };
}

export async function convertirLargo({ cruda, destino, segundos, cabeza = CABEZA_S }) {
  const { ancho, alto } = medidas(cruda);
  const tamano = tamanoLargo(ancho, alto);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  await correr('ffmpeg', argsLargo({ cruda, destino, ancho, alto, tamano, duracion: segundos - cabeza, cabeza }));
  const meta = medidas(destino);
  return { archivo: destino, ancho: meta.ancho, alto: meta.alto, duracion: meta.duracion, bitrate: meta.bitrate, tipo: 'largo' };
}

// ── El simulador ────────────────────────────────────────────────────

const simctl = (...a) => execFileSync('xcrun', ['simctl', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Arranca simctl recordVideo y resuelve cuando ya tiene el primer cuadro. */
function iniciarGrabacion(udid, archivo) {
  const p = spawn('xcrun', ['simctl', 'io', udid, 'recordVideo', '--codec=h264', '--mask=ignored', '--force', archivo], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let err = '';
  const cerrado = new Promise((ok) => p.on('close', ok));
  const listo = new Promise((ok, mal) => {
    p.stderr.on('data', (d) => {
      err += d;
      if (/Recording started/i.test(err)) ok();
    });
    p.on('error', mal);
    cerrado.then((c) => mal(new Error(`recordVideo acabó antes de empezar (${c}): ${err.trim()}`)));
    setTimeout(() => mal(new Error('recordVideo no empezó en 20 s')), 20000).unref();
  });
  return {
    listo,
    async parar() {
      p.kill('SIGINT');
      const vencido = Symbol('vencido');
      const r = await Promise.race([cerrado, dormir(30000).then(() => vencido)]);
      if (r === vencido) {
        p.kill('SIGKILL');
        throw new Error('recordVideo no cerró el archivo en 30 s');
      }
      if (!fs.existsSync(archivo) || fs.statSync(archivo).size === 0) throw new Error(`recordVideo no escribió ${archivo}`);
    },
  };
}

let contador = 0;
const nuevoToken = () => `video-${process.pid}-${Date.now()}-${++contador}`;

function enviar(udid, { accion, ...params }, token) {
  const q = Object.entries({ ...params, token }).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  simctl('openurl', udid, `nivl://__tienda/${accion}?${q}`);
}

function leerEstado(archivo) {
  try { return JSON.parse(fs.readFileSync(archivo, 'utf8')); } catch { return null; }
}

async function esperarFin(archivo, token, limiteMs) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) {
    const e = leerEstado(archivo);
    if (e?.token === token && e.listo) {
      if (e.error) throw new Error(`El arnés falló: ${e.error}`);
      return e;
    }
    await dormir(100);
  }
  throw new Error(`Sin respuesta del arnés en ${limiteMs} ms`);
}

/** Cuándo empezó el arnés a atender la gira, según la hora de escritura de su estado. */
async function atendidaEn(archivo, token, limiteMs = 60000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) {
    if (leerEstado(archivo)?.token === token) return fs.statSync(archivo).mtimeMs;
    await dormir(50);
  }
  throw new Error('El arnés no atendió la gira');
}

/** Un intento de grabación. null si la gira arrancó antes de que la grabación estuviera lista. */
async function intentarGrabar(udid, archivo, { gira, coda, retraso, log }) {
  await abrirEscena(udid, 'hoy');
  const estado = path.join(simctl('get_app_container', udid, BUNDLE_ID, 'data'), 'Documents/tienda-estado.json');
  const tokenGira = nuevoToken();
  let tokenFinal = tokenGira;
  enviar(udid, { accion: 'gira', nombre: gira, retraso }, tokenGira);
  // Se lee antes de mandar lo demás: al acabar la gira, la siguiente orden pisa este estado.
  const arranque = (await atendidaEn(estado, tokenGira)) + retraso;
  for (const paso of coda) {
    tokenFinal = nuevoToken();
    enviar(udid, paso, tokenFinal);
  }
  const limite = 120000 + retraso;
  const grabacion = iniciarGrabacion(udid, archivo);
  let parada = false;
  try {
    await grabacion.listo;
    const inicio = Date.now();
    if (arranque - inicio < MARGEN_ARRANQUE_MS) {
      parada = true;
      await grabacion.parar();
      await esperarFin(estado, tokenFinal, limite);
      return null;
    }
    const final = await esperarFin(estado, tokenFinal, limite);
    await dormir(COLA_MS);
    const segundos = (Date.now() - inicio) / 1000;
    parada = true;
    await grabacion.parar();
    const cabeza = (arranque - inicio - ANTES_DE_GIRA_MS) / 1000;
    log(`gira ${gira}: grabación ${segundos.toFixed(2)} s, se quitan ${cabeza.toFixed(2)} s del principio`);
    if (final.avisos?.length) log(`avisos del arnés: ${JSON.stringify(final.avisos)}`);
    return { segundos, cabeza };
  } finally {
    if (!parada) await grabacion.parar().catch(() => {});
  }
}

/**
 * Graba una gira y dice cuántos segundos reales duró y cuántos sobran al principio.
 * Todas las órdenes se envían ANTES de grabar, con la gira en espera: openurl tarda
 * de 1 a 15 s con el Mac cargado, y si tardara durante la grabación se vería como
 * imagen parada. Si no da tiempo, se repite con más margen.
 */
export async function grabarGira(udid, archivo, { gira, coda = [], log = () => {} }) {
  for (const retraso of RETRASOS_MS) {
    const r = await intentarGrabar(udid, archivo, { gira, coda, retraso, log });
    if (r) return r;
    log(`gira ${gira}: ${retraso} ms de margen no bastaron, se repite`);
  }
  throw new Error(`No se pudo grabar la gira ${gira}: las órdenes tardan demasiado en llegar`);
}

function runtimeIos() {
  const { runtimes } = JSON.parse(simctl('list', 'runtimes', '-j'));
  const validos = runtimes.filter((r) => r.isAvailable && /SimRuntime\.iOS-\d+-\d+$/.test(r.identifier));
  if (!validos.length) throw new Error('No hay ningún runtime de iOS instalado');
  return validos.at(-1).identifier;
}

/** Corre fn(udid) en ctx.udid si lo hay; si no, en un clon propio que borra al acabar. */
async function conSimulador(ctx, id, fn) {
  if (ctx.udid) return fn(ctx.udid);
  const nombre = `nivl-capturas-video-${id}-${process.pid}`;
  const udid = simctl('create', nombre, DISPOSITIVOS[id], runtimeIos());
  ctx.log?.(`simulador ${nombre} (${udid})`);
  try {
    aprobarEsquema(udid);
    simctl('bootstatus', udid, '-b');
    await prepararYLanzar(udid, ctx.app, { esperaMs: 8000 });
    return await fn(udid);
  } finally {
    try { simctl('shutdown', udid); } catch { /* ya apagado */ }
    simctl('delete', udid);
  }
}

function comprobar(id) {
  const d = videoDisponible(id);
  if (!d.ok) throw new Error(`${id} no tiene vídeo: ${d.motivo}`);
}

const idDe = (objetivo) => (typeof objetivo === 'string' ? objetivo : objetivo.id);
const carpeta = (ctx) => ctx.salidaVideos ?? ctx.salida;

function temporal() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nivl-video-'));
}

async function hacerPreview(ctx, udid, id, tmp) {
  const cruda = path.join(tmp, 'preview.mov');
  const t = await grabarGira(udid, cruda, { gira: 'corta', coda: CODA_PREVIEW, log: ctx.log });
  const r = await convertirPreview({ cruda, destino: path.join(carpeta(ctx), 'preview.mp4'), objetivo: id, ...t, log: ctx.log });
  ctx.log?.(`preview ${id}: ${r.duracion.toFixed(2)} s, ${r.ancho}x${r.alto}, ${(r.bitrate / 1e6).toFixed(2)} Mbps`);
  return r;
}

async function hacerLargo(ctx, udid, id, tmp) {
  const cruda = path.join(tmp, 'largo.mov');
  const t = await grabarGira(udid, cruda, { gira: 'larga', log: ctx.log });
  const r = await convertirLargo({ cruda, destino: path.join(carpeta(ctx), 'largo.mp4'), ...t });
  ctx.log?.(`largo ${id}: ${r.duracion.toFixed(2)} s, ${r.ancho}x${r.alto}`);
  return r;
}

/**
 * Los dos vídeos en un solo arranque de simulador. Es lo que debe usar el
 * orquestador. ctx necesita app y salida (o salidaVideos); con ctx.udid usa ese
 * simulador, que ya debe tener la app instalada y abierta.
 */
export async function grabarVideos(ctx, objetivo, { preview = true, largo = true } = {}) {
  const id = idDe(objetivo);
  comprobar(id);
  const tmp = temporal();
  try {
    return await conSimulador(ctx, id, async (udid) => {
      const hechos = [];
      if (preview) hechos.push(await hacerPreview(ctx, udid, id, tmp));
      if (largo) hechos.push(await hacerLargo(ctx, udid, id, tmp));
      return hechos;
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export async function grabarPreview(ctx, objetivo) {
  return (await grabarVideos(ctx, objetivo, { largo: false }))[0];
}

export async function grabarLargo(ctx, objetivo) {
  return (await grabarVideos(ctx, objetivo, { preview: false }))[0];
}

async function principal(argv) {
  const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const ids = arg('--objetivo', '').split(',').filter(Boolean);
  if (!ids.length) {
    console.error('Uso: node scripts/tienda/video.mjs --objetivo a,b [--commit HEAD] [--solo preview|largo] [--salida dir]');
    return 2;
  }
  const solo = arg('--solo');
  const log = (m) => console.log(`[video] ${m}`);
  const { app, sha7 } = await construir({ commit: arg('--commit', 'HEAD'), log });
  for (const id of ids) {
    const salida = path.resolve(arg('--salida', `.tienda/salida/${sha7}/videos`), id);
    await grabarVideos({ app, salida, log }, id, { preview: solo !== 'largo', largo: solo !== 'preview' });
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { console.error(e); process.exitCode = 1; });
}
