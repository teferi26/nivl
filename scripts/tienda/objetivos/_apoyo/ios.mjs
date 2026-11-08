// Objetivos que capturan el .app del arnés en un simulador con iOS: iPhone, iPad,
// iPhone Duo y Vision Pro (ahí corre la app de iPad en modo compatible). Cada
// objetivo es una llamada a crearObjetivoIos. El simulador lo crea el orquestador
// con ctx.crearSimulador y lo borra él, pase lo que pase.
import { createHash } from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { abrirEscena, aprobarEsquema, prepararYLanzar } from '../../harness/simulador.mjs';
import { BUNDLE_ID } from '../../harness/construir.mjs';
import { grabarVideos } from '../../video.mjs';
import { aplanar, dormir, medirPng, simctl } from './nativo.mjs';

export const TIPO = 'com.apple.CoreSimulator.SimDeviceType.';
const SRGB = '/System/Library/ColorSync/Profiles/sRGB Profile.icc';
const ejecutar = promisify(execFile);

/** El runtime instalado más nuevo que cumple el filtro, o null. */
export function buscarRuntime(filtro) {
  const { runtimes } = JSON.parse(simctl('list', 'runtimes', '-j'));
  return runtimes
    .filter((r) => r.isAvailable && filtro(r))
    .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0] ?? null;
}

export const iosNormal = (r) => /SimRuntime\.iOS-\d+-\d+$/.test(r.identifier);

/** Español de España en todo el sistema. Se escribe antes del primer arranque. */
function espanolAntesDeArrancar(udid) {
  const plist = path.join(process.env.HOME, 'Library/Developer/CoreSimulator/Devices', udid, 'data/Library/Preferences/.GlobalPreferences.plist');
  fs.mkdirSync(path.dirname(plist), { recursive: true });
  if (!fs.existsSync(plist)) execFileSync('plutil', ['-create', 'binary1', plist]);
  for (const [clave, tipo, valor] of [['AppleLanguages', '-json', '["es-ES"]'], ['AppleLocale', '-string', 'es_ES']]) {
    try { execFileSync('plutil', ['-remove', clave, plist], { stdio: 'ignore' }); } catch { /* no estaba */ }
    execFileSync('plutil', ['-insert', clave, tipo, valor, plist]);
  }
}

function comprobarIdioma(ctx, udid) {
  let leido = '';
  try {
    leido = simctl('spawn', udid, 'defaults', 'read', '.GlobalPreferences', 'AppleLanguages');
  } catch (e) {
    ctx.aviso(`no pude leer el idioma del simulador: ${String(e.message).split('\n')[0]}`);
    return;
  }
  if (!/es-ES/.test(leido)) ctx.aviso(`el simulador no quedó en es-ES: ${leido.replace(/\s+/g, ' ')}`);
}

function fotoCruda(udid, archivo, display) {
  simctl('io', udid, 'screenshot', '--type=png', ...(display ? [`--display=${display}`] : []), archivo);
}

/**
 * Repite la foto hasta que dos seguidas sean iguales, y así no sale un hueco de
 * carga ni un cambio a medias. Devuelve false si la pantalla nunca se queda quieta.
 */
async function fotoEstable(udid, archivo, display, { maxMs = 12000, pausaMs = 500 } = {}) {
  const fin = Date.now() + maxMs;
  let anterior = null;
  for (;;) {
    fotoCruda(udid, archivo, display);
    const h = createHash('sha256').update(fs.readFileSync(archivo)).digest('hex');
    if (h === anterior) return true;
    if (Date.now() > fin) return false;
    anterior = h;
    await dormir(pausaMs);
  }
}

/** sRGB y sin alfa: lo que pide App Store Connect. No cambia el tamaño. */
function normalizar(origen, destino) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  execFileSync('sips', ['--matchTo', SRGB, '-s', 'format', 'png', origen, '--out', origen], { stdio: 'ignore' });
  aplanar(origen, destino);
  return medirPng(destino);
}

/** Una pantalla apagada se fotografía negra entera. */
function esNegra(png) {
  const crudo = execFileSync('ffmpeg', ['-v', 'error', '-i', png, '-frames:v', '1', '-vf', 'scale=16:16,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 4096 });
  return crudo.every((v) => v <= 2);
}

async function prepararVision(udid, app) {
  for (const orden of [['ui', udid, 'appearance', 'dark'], ['status_bar', udid, 'override', '--time', '9:41']]) {
    try { simctl(...orden); } catch { /* visionOS no tiene ni barra ni modo oscuro */ }
  }
  simctl('install', udid, app);
  simctl('launch', '--terminate-running-process', udid, BUNDLE_ID, '-AppleLanguages', '(es)', '-AppleLocale', 'es_ES');
  await dormir(12000);
}

/**
 * @param {{
 *   id: string, familia: string, tipo: string, filtroRuntime: (r: object) => boolean,
 *   pantallas?: {salida: string, display?: number}[], nota?: string, vision?: boolean, sinVideo?: boolean,
 *   grabar?: (ctx: object, sesion: {udid: string}) => Promise<object[]>,
 * }} def `pantallas` reparte las fotos en varias salidas de specs.mjs (iPhone Duo).
 */
export function crearObjetivoIos(def) {
  const pantallas = def.pantallas ?? [{ salida: def.id }];
  const sesion = { udid: null };

  return {
    id: def.id,
    familia: def.familia,
    nota: def.nota,
    salidas: pantallas.map((p) => p.salida),

    disponible(ctx) {
      if (!ctx.app) return { ok: false, motivo: 'no se ha construido el .app del arnés' };
      const runtime = buscarRuntime(def.filtroRuntime);
      if (!runtime) return { ok: false, motivo: `no hay runtime instalado para ${def.tipo}` };
      if (!(runtime.supportedDeviceTypes ?? []).some((d) => d.identifier === def.tipo)) {
        return { ok: false, motivo: `${def.tipo} no funciona con ${runtime.name}` };
      }
      return { ok: true };
    },

    async capturar(ctx) {
      const runtime = buscarRuntime(def.filtroRuntime);
      const { udid } = ctx.crearSimulador(def.id, def.tipo, runtime);
      sesion.udid = udid;
      aprobarEsquema(udid);
      espanolAntesDeArrancar(udid);
      // Asíncrono: arrancar tarda minutos y una llamada síncrona retrasaría las señales.
      await ejecutar('xcrun', ['simctl', 'bootstatus', udid, '-b']);
      comprobarIdioma(ctx, udid);
      if (def.vision) await prepararVision(udid, ctx.app);
      // Solo la hora: el iPad pinta además el día real en español. Con fecha ISO en
      // --time saldría el día fijo, pero en inglés («Thu 12 Nov»), y eso es peor.
      else await prepararYLanzar(udid, ctx.app, { esperaMs: 8000 });

      const activas = pantallas.map((p) => ({ ...p, carpeta: ctx.crudasDe(p.salida), viva: true }));
      const hechas = [];
      for (const [i, escena] of ctx.escenas.entries()) {
        await abrirEscena(udid, escena.id, { limiteMs: 60000 });
        for (const p of activas.filter((a) => a.viva)) {
          const archivo = path.join(p.carpeta, `${String(i + 1).padStart(2, '0')}-${escena.id}.png`);
          const tmp = `${archivo}.simctl.png`;
          fs.mkdirSync(p.carpeta, { recursive: true });
          const estable = await fotoEstable(udid, tmp, p.display);
          if (pantallas.length > 1 && esNegra(tmp)) {
            fs.rmSync(tmp, { force: true });
            p.viva = false;
            ctx.pendiente(p.salida, `la pantalla ${p.display} sale en negro: la app no se abre ahí y simctl no puede desplegar el dispositivo`);
            continue;
          }
          if (!estable) ctx.aviso(`${p.salida}/${escena.id}: la pantalla no se quedó quieta en 12 s`);
          const { ancho, alto } = normalizar(tmp, archivo);
          fs.rmSync(tmp, { force: true });
          ctx.log(`${p.salida}/${escena.id}: ${ancho}x${alto}${estable ? '' : ' (sin asentar)'}`);
          hechas.push({ archivo, ancho, alto, escena: escena.id, tipo: 'cruda', salida: p.salida });
        }
      }
      return hechas;
    },

    // Sin esto el orquestador anota el motivo que da video.mjs (Vision Pro).
    ...(def.sinVideo ? {} : {
      async grabar(ctx) {
        if (def.grabar) return def.grabar(ctx, sesion);
        const hechos = [];
        for (const salida of this.salidas) {
          hechos.push(...await grabarVideos({ ...ctx, udid: sesion.udid, salidaVideos: ctx.videosDe(salida) }, salida));
        }
        return hechos;
      },
    }),
  };
}
