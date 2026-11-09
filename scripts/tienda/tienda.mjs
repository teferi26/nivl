#!/usr/bin/env node
// Un comando para sacar las capturas y vídeos de tienda de un commit:
//
//   node scripts/tienda/tienda.mjs --commit <sha> [--muestra] [--objetivos a,b] [--sin-video] [--final]
//     [--fuente-tv <sha>] [--fuente-watch <sha>]
//
// Construye la app con el arnés de datos ficticios y, objetivo a objetivo, captura,
// compone, valida y graba. Deja todo en .tienda/salida/<sha7>/ con su informe.json.
// Salida: 0 correcto, 1 algo falló o no cumple, 2 error de uso. Hace falta salir del
// sandbox (simctl, xcodebuild, Chrome). Nada de esto sube a App Store Connect.
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { abrirNavegador, componer } from './componer.mjs';
import { construir } from './harness/construir.mjs';
import { escenas as ESCENAS_ARNES } from './harness/escenas.mjs';
import { IDS_OBJETIVOS, objetivoPorId } from './specs.mjs';
import { validarDirectorio } from './validar.mjs';
import { grabarVideos, videoDisponible } from './video.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = path.resolve(AQUI, '../..');

// Las de la ficha, en orden, hasta 10. Fuera además: pro (con la tienda cerrada dice
// «no disponible») y avance (su rejilla de 28 días se pinta rota en la app).
// Fuera: amigos (su titular es el de arena) y
// amigos-seguridad (denunciar y bloquear es para la revisión de Apple, no para vender).
export const ESCENAS_TIENDA = Object.freeze(['hoy', 'coach', 'rueda', 'iron-hoy', 'focus-hoy', 'work-hoy', 'founder-hoy', 'arena', 'habitos', 'campanas']);
export const ESCENAS_MUESTRA = Object.freeze(['hoy', 'coach']);

const USO = 'Uso: node scripts/tienda/tienda.mjs --commit <sha> [--muestra] [--objetivos a,b] [--sin-video] [--final] [--fuente-tv <sha>] [--fuente-watch <sha>]';

/** Puro. Devuelve las opciones o lanza un Error con el motivo. */
export function leerArgumentos(argv) {
  const o = { commit: null, muestra: false, objetivos: null, sinVideo: false, final: false, fuentes: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--muestra') o.muestra = true;
    else if (a === '--sin-video') o.sinVideo = true;
    else if (a === '--final') o.final = true;
    else if (a === '--commit' || a === '--objetivos' || a === '--fuente-tv' || a === '--fuente-watch') {
      const v = argv[++i];
      if (!v || v.startsWith('--')) throw new Error(`${a} necesita un valor`);
      if (a === '--commit') o.commit = v;
      else if (a === '--fuente-tv') o.fuentes.tv = v;
      else if (a === '--fuente-watch') o.fuentes.watch = v;
      else o.objetivos = v.split(',').map((s) => s.trim()).filter(Boolean);
    } else throw new Error(`Opción desconocida: ${a}`);
  }
  if (!o.commit) throw new Error('Falta --commit');
  if (o.final && (o.muestra || o.objetivos || o.sinVideo)) {
    throw new Error('--final exige todos los objetivos y los vídeos: no admite --muestra, --objetivos ni --sin-video');
  }
  return o;
}

/** Las salidas de specs que produce un objetivo. Sin `salidas`, la suya propia. */
export const salidasDe = (objetivo) => objetivo.salidas ?? [objetivo.id];

/** Puro. Escoge por id de objetivo o por id de salida (duo o iphone-duo-exterior). */
export function seleccionar(objetivos, pedidos) {
  if (!pedidos) return objetivos;
  const elegidos = new Set();
  for (const p of pedidos) {
    const o = objetivos.find((x) => x.id === p || salidasDe(x).includes(p));
    if (!o) throw new Error(`Objetivo desconocido: ${p}. Hay: ${objetivos.map((x) => x.id).join(', ')}`);
    elegidos.add(o);
  }
  return objetivos.filter((o) => elegidos.has(o));
}

// Lo que no se puede capturar de verdad en este Mac: no se sustituye por otro
// dispositivo y --final no lo exige, pero queda escrito en informe.json.
export const NO_CAPTURABLES = Object.freeze({
  mac: 'NIVL no tiene app nativa de Mac y no hay simulador de macOS; la web a tamaño de escritorio sería otro producto. Una app de iPad en Mac usa las capturas de iPad.',
  'iphone-duo-interior': 'El simulador de Duo arranca plegado y simctl no lo despliega: la pantalla interior sale en negro.',
});

/** Puro. Los ids de specs que ningún objetivo disponible cubre y que sí se pueden capturar. */
export function faltanParaFinal(disponibles, ids = IDS_OBJETIVOS) {
  const cubiertos = new Set(disponibles.flatMap(salidasDe));
  return ids.filter((id) => !cubiertos.has(id) && !NO_CAPTURABLES[id]);
}

/** Puro. ¿Ese tamaño es uno de los que Apple admite para esa salida? */
export function tamanoAdmitido(especificacion, ancho, alto) {
  const { vertical = [], apaisado = [] } = especificacion?.capturas ?? {};
  return [...vertical, ...apaisado].some(([a, b]) => a === ancho && b === alto);
}

/** Puro. Los clones de esta ejecución llevan el pid al final del nombre. */
export const esDeEstaEjecucion = (nombre, pid) => new RegExp(`^nivl-capturas-.+-${pid}$`).test(nombre);

function sh(cmd, args = [], { cwd, env, timeout } = {}) {
  const r = spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, timeout, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
  if (r.status !== 0) throw new Error(`Falló ${cmd} ${args.join(' ')}: ${(r.stderr || r.stdout || r.error || '').toString().slice(-2000)}`);
  return r.stdout.trim();
}

const simctl = (...a) => execFileSync('xcrun', ['simctl', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1024 * 1024 * 64 }).trim();

function borrarSimulador(udid) {
  try { simctl('shutdown', udid); } catch { /* ya apagado */ }
  try { simctl('delete', udid); } catch { /* ya borrado */ }
}

/** Solo por UDID y solo los clones de este pid: los de otros chats no se tocan. */
function limpiarSimuladores() {
  let devices = {};
  try { ({ devices } = JSON.parse(simctl('list', 'devices', '-j'))); } catch { return; }
  for (const d of Object.values(devices).flat()) {
    if (esDeEstaEjecucion(d.name, process.pid)) borrarSimulador(d.udid);
  }
}

let limpiado = false;
function limpiarUnaVez() {
  if (limpiado) return;
  limpiado = true;
  limpiarSimuladores();
}

function ponerLimpieza() {
  process.on('exit', limpiarUnaVez);
  for (const [senal, codigo] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) {
    process.on(senal, () => {
      console.error(`\n[tienda] ${senal}: borrando los simuladores de esta ejecución`);
      limpiarUnaVez();
      process.exit(codigo);
    });
  }
}

async function cargarObjetivos() {
  const dir = path.join(AQUI, 'objetivos');
  const archivos = fs.readdirSync(dir).filter((n) => n.endsWith('.mjs') && !n.startsWith('_')).sort();
  const objetivos = [];
  for (const a of archivos) objetivos.push((await import(pathToFileURL(path.join(dir, a)).href)).default);
  return objetivos;
}

function archivosDe(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((e) => {
    const r = path.join(dir, e.name);
    return e.isDirectory() ? archivosDe(r) : [r];
  });
}

const sha256 = (archivo) => createHash('sha256').update(fs.readFileSync(archivo)).digest('hex');

const textoError = (e) => String(e?.message ?? e).split('\n').slice(0, 6).join(' ').slice(0, 800);

/** Una salida sin reglas en specs (web) no se valida; las clases de reloj, carpeta a carpeta. */
function validarSalida(salida, dirTienda, log) {
  if (!objetivoPorId(salida)) return [{ dir: dirTienda, ok: true, nota: 'sin reglas de Apple: no se valida' }];
  const subcarpetas = fs.existsSync(dirTienda)
    ? fs.readdirSync(dirTienda, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(dirTienda, e.name))
    : [];
  return (subcarpetas.length ? subcarpetas : [dirTienda]).map((dir) => {
    const r = validarDirectorio(dir, salida);
    log(`validación ${path.relative(path.dirname(dirTienda), dir)}: ${r.ok ? 'correcta' : `NO CUMPLE: ${r.errores.join('; ')}`}`);
    return { dir, ...r };
  });
}

/** Captura, compone, valida y graba un objetivo. Anota todo en `resultado`. */
async function procesarObjetivo(objetivo, base, opciones, navegador, resultado) {
  const { rutas, log: logGeneral } = base;
  const log = (m) => logGeneral(`[${objetivo.id}] ${m}`);
  const salidas = salidasDe(objetivo);
  resultado.avisos = [];
  resultado.simuladores = [];
  resultado.pendientes = [];
  for (const s of salidas) {
    for (const raiz of ['crudas', 'tienda', ...(opciones.sinVideo ? [] : ['videos'])]) fs.rmSync(path.join(rutas[raiz], s), { recursive: true, force: true });
  }
  const propios = new Set();
  const ctx = {
    ...base.comun,
    salida: path.join(rutas.crudas, objetivo.id),
    salidaVideos: path.join(rutas.videos, objetivo.id),
    crudasDe: (s) => path.join(rutas.crudas, s),
    videosDe: (s) => path.join(rutas.videos, s),
    log,
    aviso(m) { log(`AVISO: ${m}`); resultado.avisos.push(m); },
    pendiente(salida, motivo) { log(`PENDIENTE ${salida}: ${motivo}`); resultado.pendientes.push({ salida, motivo }); },
    crearSimulador(nombre, tipo, runtime) {
      const completo = `nivl-capturas-${nombre}-${process.pid}`;
      const udid = simctl('create', completo, tipo, runtime.identifier);
      propios.add(udid);
      resultado.simuladores.push({ nombre: completo, udid, tipo, runtime: runtime.identifier, version: runtime.version, compilacion: runtime.buildversion });
      log(`simulador ${completo} (${udid}) con ${runtime.identifier}`);
      return { udid, nombre: completo };
    },
    liberarSimuladores() {
      for (const u of propios) borrarSimulador(u);
      propios.clear();
    },
  };

  try {
    let crudas = await objetivo.capturar(ctx);
    // Muestra: un solo tamaño de reloj.
    const primeraClase = crudas.find((c) => c.clase)?.clase;
    if (opciones.muestra && primeraClase) crudas = crudas.filter((c) => !c.clase || c.clase === primeraClase);
    resultado.crudas = crudas.length;
    if (!crudas.length) throw new Error('el objetivo no devolvió ninguna captura');

    for (const c of crudas) {
      const salida = c.salida ?? objetivo.id;
      if (objetivoPorId(salida) && !tamanoAdmitido(objetivoPorId(salida), c.ancho, c.alto)) {
        ctx.aviso(`la cruda ${path.basename(c.archivo)} mide ${c.ancho}x${c.alto}, que no es un tamaño de Apple para ${salida}: la composición la encaja en el marco`);
        c.reescalada = true;
      }
      const relativo = path.join(c.clase ?? '', path.basename(c.archivo));
      const destino = path.join(rutas.tienda, salida, relativo.replace(/\.[a-z]+$/i, '.png'));
      const hecha = await componer({ cruda: c.archivo, objetivo: salida, escena: c.escena, destino, navegador });
      log(`compuesta ${path.relative(rutas.salida, hecha.archivo)} (${hecha.ancho}x${hecha.alto})`);
    }

    const conCapturas = salidas.filter((s) => crudas.some((c) => (c.salida ?? objetivo.id) === s));
    const validaciones = conCapturas.flatMap((s) => validarSalida(s, path.join(rutas.tienda, s), log).map((v) => ({ salida: s, clase: 'capturas', ...v })));

    if (opciones.sinVideo) resultado.videos = { omitidos: 'pedido con --sin-video' };
    else if (objetivo.grabar) {
      const hechos = await objetivo.grabar(ctx);
      resultado.videos = { hechos: hechos.length };
    } else {
      const motivos = {};
      let hechos = 0;
      for (const s of salidas) {
        const d = videoDisponible(s);
        if (!d.ok) { motivos[s] = d.motivo; continue; }
        hechos += (await grabarVideos({ ...ctx, salidaVideos: ctx.videosDe(s) }, s)).length;
      }
      resultado.videos = { hechos, sinVideo: motivos };
    }
    if (!opciones.sinVideo) {
      for (const s of salidas) {
        const dir = path.join(rutas.videos, s);
        if (!objetivoPorId(s) || !fs.existsSync(path.join(dir, 'preview.mp4'))) continue;
        const r = validarDirectorio(dir, s);
        log(`validación vídeos ${s}: ${r.ok ? 'correcta' : `NO CUMPLE: ${r.errores.join('; ')}`}`);
        validaciones.push({ salida: s, clase: 'videos', dir, ...r });
      }
    }
    resultado.validaciones = validaciones.map((v) => ({
      salida: v.salida, clase: v.clase, dir: path.relative(rutas.salida, v.dir), ok: v.ok, nota: v.nota, errores: v.errores ?? [],
      detalle: (v.archivos ?? []).filter((a) => a.errores?.length).map((a) => ({ archivo: path.basename(a.archivo), errores: a.errores })),
    }));
    resultado.crudasReescaladas = crudas.filter((c) => c.reescalada).map((c) => path.basename(c.archivo));
    resultado.ok = validaciones.every((v) => v.ok);
  } finally {
    ctx.liberarSimuladores();
  }
}

function inventario(rutas, salidas) {
  const lista = [];
  for (const raiz of ['crudas', 'tienda', 'videos']) {
    for (const s of salidas) {
      for (const a of archivosDe(path.join(rutas[raiz], s))) {
        if (!/\.(png|jpe?g|mp4|mov|m4v)$/i.test(a) || a.includes('.simctl.')) continue;
        lista.push({ archivo: path.relative(rutas.salida, a), bytes: fs.statSync(a).size, sha256: sha256(a) });
      }
    }
  }
  return lista;
}

/** Devuelve el código de salida. */
export async function ejecutar(opciones) {
  const log = (m) => console.log(`[tienda] ${m}`);
  const sha = sh('git', ['rev-parse', '--verify', `${opciones.commit}^{commit}`], { cwd: RAIZ_REPO });
  const sha7 = sha.slice(0, 7);
  const salida = path.join(RAIZ_REPO, '.tienda/salida', sha7);
  const rutas = { salida, crudas: path.join(salida, 'crudas'), tienda: path.join(salida, 'tienda'), videos: path.join(salida, 'videos') };
  for (const d of Object.values(rutas)) fs.mkdirSync(d, { recursive: true });

  const elegidos = seleccionar(await cargarObjetivos(), opciones.objetivos);
  const informe = {
    commit: sha, sha7, version: null, fecha: new Date().toISOString(), final: false, muestra: opciones.muestra, sinVideo: opciones.sinVideo, fuentes: opciones.fuentes ?? {},
    app: null, escenas: null, validacion: { ok: false }, objetivos: [], saltados: [], fallos: [], archivos: [],
  };
  const escribirInforme = () => fs.writeFileSync(path.join(salida, 'informe.json'), `${JSON.stringify(informe, null, 2)}\n`);

  let navegador = null;
  let codigo = 0;
  try {
    const { app, src } = await construir({ commit: sha, log });
    informe.app = path.relative(RAIZ_REPO, app);
    try { informe.version = JSON.parse(fs.readFileSync(path.join(src, 'app.json'), 'utf8')).expo?.version ?? null; } catch { /* no es crítico */ }

    const ids = opciones.muestra ? ESCENAS_MUESTRA : ESCENAS_TIENDA;
    const escenas = ids.map((id) => {
      const e = ESCENAS_ARNES.find((x) => x.id === id);
      if (!e) throw new Error(`El arnés no tiene la escena ${id}`);
      return e;
    });
    informe.escenas = ids;
    const comun = { commit: sha, sha7, raiz: src, app, muestra: opciones.muestra, escenas, sh, fuentes: opciones.fuentes ?? {} };

    const disponibles = [];
    for (const o of elegidos) {
      let d;
      try { d = await o.disponible({ ...comun, log: () => {} }); } catch (e) { d = { ok: false, motivo: textoError(e) }; }
      if (d.ok) disponibles.push(o);
      else {
        log(`[${o.id}] no disponible: ${d.motivo}`);
        informe.saltados.push({ id: o.id, salidas: salidasDe(o), motivo: d.motivo });
      }
    }

    if (opciones.final) {
      const faltan = faltanParaFinal(disponibles);
      const saltadosDeVerdad = informe.saltados.filter((s) => !NO_CAPTURABLES[s.id]);
      if (faltan.length || saltadosDeVerdad.length) {
        informe.fallos.push({ id: 'final', error: `--final exige todos los objetivos y faltan: ${faltan.join(', ') || saltadosDeVerdad.map((s) => s.id).join(', ')}` });
        log(informe.fallos[0].error);
        return 1;
      }
    }

    const base = { rutas, log, comun };
    for (const o of disponibles) {
      for (const s of salidasDe(o)) informe.objetivos.push({ id: s, familia: o.familia, objetivo: o.id, nota: o.nota });
      const resultado = { id: o.id, ok: false };
      (informe.resultados ??= []).push(resultado);
      const inicio = Date.now();
      try {
        // Un Chrome por objetivo: en una tanda larga el proceso puede morir
        // (actualizaciones de Chrome) y no debe arrastrar a los siguientes.
        await navegador?.cerrar().catch(() => {});
        navegador = await abrirNavegador();
        try {
          await procesarObjetivo(o, base, opciones, navegador, resultado);
        } catch (e) {
          // Los simuladores fallan a veces al lanzar la app: un reintento limpio.
          log(`[${o.id}] reintento tras: ${textoError(e)}`);
          await navegador.cerrar().catch(() => {});
          navegador = await abrirNavegador();
          await procesarObjetivo(o, base, opciones, navegador, resultado);
        }
      } catch (e) {
        resultado.ok = false;
        resultado.error = textoError(e);
        informe.fallos.push({ id: o.id, error: resultado.error });
        log(`[${o.id}] FALLÓ: ${resultado.error}`);
      }
      resultado.segundos = Math.round((Date.now() - inicio) / 1000);
      if (!resultado.ok) codigo = 1;
    }

    const resultados = informe.resultados ?? [];
    const pendientes = resultados.flatMap((r) => r.pendientes ?? []).filter((p) => !NO_CAPTURABLES[p.salida]);
    informe.noCapturables = NO_CAPTURABLES;
    informe.validacion = { ok: resultados.length > 0 && resultados.every((r) => r.ok) };
    informe.final = opciones.final && informe.validacion.ok && pendientes.length === 0;
    if (opciones.final && pendientes.length) codigo = 1;
    informe.archivos = inventario(rutas, elegidos.flatMap(salidasDe));
    return codigo;
  } catch (e) {
    informe.fallos.push({ id: 'general', error: textoError(e) });
    log(`FALLÓ: ${e?.stack ?? e}`);
    return 1;
  } finally {
    if (navegador) await navegador.cerrar().catch(() => {});
    limpiarUnaVez();
    escribirInforme();
    log(`informe: ${path.join(salida, 'informe.json')}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let opciones;
  try {
    opciones = leerArgumentos(process.argv.slice(2));
  } catch (e) {
    console.error(`${e.message}\n${USO}`);
    process.exit(2);
  }
  ponerLimpieza();
  try {
    process.exitCode = await ejecutar(opciones);
  } catch (e) {
    console.error(e?.message ?? e);
    process.exitCode = e?.message?.startsWith('Objetivo desconocido') ? 2 : 1;
  }
}
