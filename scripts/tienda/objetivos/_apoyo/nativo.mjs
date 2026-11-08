// Ayudas de los objetivos que no son iOS: buscar el código de un commit, compilar
// con caché y crear simuladores propios. Solo crea y borra clones con el prefijo
// nivl-capturas-, y cada uno por su UDID: nunca toca los simuladores de otros.
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ_REPO = path.resolve(AQUI, '../../../..');
export const CACHE = path.join(RAIZ_REPO, '.tienda/cache');
export const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

export function correr(cmd, args, { cwd, env, log, archivoLog } = {}) {
  log?.(`$ ${cmd} ${args.join(' ')}`);
  const salida = archivoLog ? fs.openSync(archivoLog, 'w') : 'pipe';
  const r = spawnSync(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', salida, salida],
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 256,
  });
  if (archivoLog) fs.closeSync(salida);
  if (r.status !== 0) {
    const cola = archivoLog
      ? fs.readFileSync(archivoLog, 'utf8').split('\n').slice(-60).join('\n')
      : `${r.stdout ?? ''}\n${r.stderr ?? ''}`.slice(-6000);
    throw new Error(`Falló ${cmd} ${args.join(' ')} (código ${r.status})\n${cola}`);
  }
  return (r.stdout ?? '').trim();
}

const git = (...a) => correr('git', a, { cwd: RAIZ_REPO });

/** ctx.fuentes.tv, `--fuente-tv <sha>` o la variable NIVL_FUENTE_TV (y lo mismo con watch). */
export function fuentePedida(ctx, tipo) {
  if (ctx.fuentes?.[tipo]) return ctx.fuentes[tipo];
  const i = process.argv.indexOf(`--fuente-${tipo}`);
  if (i > 0) return process.argv[i + 1];
  return process.env[`NIVL_FUENTE_${tipo.toUpperCase()}`] || null;
}

/**
 * Dónde está el código nativo: el commit del encargo, o el de --fuente-<tipo>.
 * Devuelve {sha, sha7, origen} o {motivo} si ese commit no trae la carpeta.
 */
export function localizarFuente(ctx, tipo, marca) {
  const pedida = fuentePedida(ctx, tipo);
  const ref = pedida ?? ctx.commit;
  let sha;
  try {
    sha = git('rev-parse', '--verify', `${ref}^{commit}`);
  } catch {
    return { motivo: `no existe el commit ${ref}` };
  }
  const hay = spawnSync('git', ['cat-file', '-e', `${sha}:${marca}`], { cwd: RAIZ_REPO }).status === 0;
  if (!hay) {
    return {
      motivo: `el commit ${sha.slice(0, 7)} no trae ${marca}: esa app aún no está en esta rama (prueba con --fuente-${tipo} <sha>)`,
    };
  }
  return { sha, sha7: sha.slice(0, 7), origen: pedida ? `--fuente-${tipo}` : 'commit' };
}

/** Copia aparte del código nativo, separada de la del arnés de iOS. */
export function asegurarCopia(tipo, sha, sha7, log) {
  const dir = path.join(CACHE, `fuente-${tipo}-${sha7}`);
  if (!fs.existsSync(path.join(dir, '.git'))) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(CACHE, { recursive: true });
    git('worktree', 'prune');
    correr('git', ['worktree', 'add', '--detach', dir, sha], { cwd: RAIZ_REPO, log });
  }
  return dir;
}

export function huellaXcode() {
  return createHash('sha256').update(correr('xcodebuild', ['-version'])).digest('hex').slice(0, 8);
}

export function bundleIdDe(app) {
  return correr('plutil', ['-extract', 'CFBundleIdentifier', 'raw', path.join(app, 'Info.plist')]);
}

// ── Simuladores ─────────────────────────────────────────────────────

const simctl = (...a) => execFileSync('xcrun', ['simctl', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 * 64 }).trim();
export { simctl };

/** Por si el proceso muere con un clon en marcha. */
const vivos = new Set();
function borrarClon(udid) {
  try { simctl('shutdown', udid); } catch { /* ya apagado */ }
  try { simctl('delete', udid); } catch { /* ya borrado */ }
  vivos.delete(udid);
}
let limpiezaPuesta = false;
function ponerLimpieza() {
  if (limpiezaPuesta) return;
  limpiezaPuesta = true;
  process.on('exit', () => { for (const u of [...vivos]) borrarClon(u); });
  for (const s of ['SIGINT', 'SIGTERM']) process.once(s, () => process.exit(130));
}

/** El runtime instalado más nuevo de esa plataforma (`tvOS`, `watchOS`), o null. */
export function runtimeDe(plataforma) {
  const { runtimes } = JSON.parse(simctl('list', 'runtimes', '-j'));
  const lista = runtimes.filter((r) => r.isAvailable && r.platform === plataforma);
  lista.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  return lista[0] ?? null;
}

/** ¿Ese tipo de dispositivo puede usar ese runtime? {ok, motivo}. */
export function compatible(runtime, idTipo) {
  const hay = (runtime.supportedDeviceTypes ?? []).some((d) => d.identifier === idTipo);
  return hay ? { ok: true } : { ok: false, motivo: `${idTipo} no funciona con ${runtime.name}` };
}

/** Crea y arranca un clon, ejecuta fn(udid) y lo borra pase lo que pase. */
export async function conSimulador({ ctx, nombre, tipo, runtime }, fn) {
  ponerLimpieza();
  // Con el orquestador, el clon queda anotado en informe.json.
  let udid;
  if (ctx.crearSimulador) ({ udid } = ctx.crearSimulador(nombre, tipo, runtime));
  else {
    const completo = `nivl-capturas-${nombre}-${process.pid}`;
    udid = simctl('create', completo, tipo, runtime.identifier);
    ctx.log(`simulador ${completo} (${udid})`);
  }
  vivos.add(udid);
  try {
    simctl('bootstatus', udid, '-b');
    return await fn(udid);
  } finally {
    borrarClon(udid);
  }
}

// ── Imagen ──────────────────────────────────────────────────────────

/** PNG en RGB de 8 bits: App Store Connect rechaza el canal alfa. */
export function aplanar(origen, destino) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.tmp.png`;
  correr('ffmpeg', ['-y', '-v', 'error', '-i', origen, '-frames:v', '1', '-vf', 'format=rgb24', '-update', '1', tmp]);
  fs.renameSync(tmp, destino);
}

export function medirPng(archivo) {
  const c = Buffer.alloc(33);
  const f = fs.openSync(archivo, 'r');
  fs.readSync(f, c, 0, 33, 0);
  fs.closeSync(f);
  return { ancho: c.readUInt32BE(16), alto: c.readUInt32BE(20), colorType: c[25] };
}

/**
 * Espera a que la pantalla deje de cambiar, comparando capturas seguidas: en un
 * Mac cargado un arranque tarda lo que quiere. Con cronómetros en pantalla no se
 * estabiliza nunca y acaba al llegar a maxMs.
 */
export async function esperarEstable(udid, tmp, { minMs = 3000, maxMs = 25000, pausaMs = 1200 } = {}) {
  const inicio = Date.now();
  await dormir(minMs);
  let anterior = null;
  while (Date.now() - inicio < maxMs) {
    simctl('io', udid, 'screenshot', '--type=png', tmp);
    const h = createHash('sha256').update(fs.readFileSync(tmp)).digest('hex');
    if (h === anterior) return true;
    anterior = h;
    await dormir(pausaMs);
  }
  return false;
}

/** ¿Sigue en marcha ese proceso de la app dentro del simulador? */
function appViva(udid, bundle, pid) {
  const lista = simctl('spawn', udid, 'launchctl', 'list');
  return lista.split('\n').some((l) => l.includes(`UIKitApplication:${bundle}`) && l.trim().startsWith(`${pid}\t`));
}

/**
 * Lanza la app con sus argumentos y espera a que se asiente. Cerrar y abrir de
 * golpe (`launch --terminate-running-process`) dejó el Apple TV en la pantalla de
 * inicio sin ningún cierre inesperado: se cierra aparte, se deja un respiro y se
 * comprueba que el proceso lanzado sigue vivo; si no, se reintenta.
 */
export async function lanzarAsentada(udid, bundle, args, tmp, opciones = {}) {
  for (let intento = 1; intento <= 3; intento += 1) {
    try { simctl('terminate', udid, bundle); } catch { /* no estaba abierta */ }
    await dormir(1500);
    const pid = /:\s*(\d+)/.exec(simctl('launch', udid, bundle, ...args))?.[1];
    if (!pid) throw new Error(`simctl launch no dio el proceso de ${bundle}`);
    await esperarEstable(udid, tmp, opciones);
    fs.rmSync(tmp, { force: true });
    if (appViva(udid, bundle, pid)) return;
    await dormir(1000);
  }
  throw new Error(`${bundle} no se queda abierta tras 3 intentos (${args.join(' ')})`);
}

/** Captura por simctl y la deja sin alfa; devuelve {ancho, alto}. */
export function fotoSimulador(udid, destino, extra = []) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.simctl.png`;
  simctl('io', udid, 'screenshot', '--type=png', ...extra, tmp);
  aplanar(tmp, destino);
  fs.rmSync(tmp, { force: true });
  return medirPng(destino);
}
