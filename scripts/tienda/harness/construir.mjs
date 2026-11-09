// Compila la app real de un commit con el arnés de datos ficticios para el
// simulador de iOS. Todo pasa en una copia (git worktree) dentro de
// .tienda/cache: ni src/ del repo ni el binario de producción se tocan.
//
//   import { construir } from './construir.mjs';
//   const { app, sha7 } = await construir({ commit: 'HEAD', cacheDir, log });
//
// Tres niveles de caché, de más caro a más barato:
//   nativo-<huella>/NIVL.app   lo compilado por xcodebuild. La huella sale del
//                              lockfile, el app.json preparado, los iconos y la
//                              versión de Xcode. Sirve para otros commits.
//   apps/<sha7>-<nativo>-<arnes>/NIVL.app   el nativo con el bundle de ese commit
//                              y esa versión del arnés. Si el arnés cambia solo
//                              se vuelve a empaquetar el JS (un par de minutos).
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = path.resolve(AQUI, '../../..');
const APP_ARNES = path.join(AQUI, 'app');
export const BUNDLE_ID = 'com.teferi.nivl.screenshots';
// Súbelo si cambia la forma de compilar: invalida los .app nativos guardados.
const RECETA_NATIVA = 2;
const DESTINO_ARNES = 'scripts/tienda-arnes';
const NPM = ['-y', 'npm@10.9.2'];

function hash(...partes) {
  const h = createHash('sha256');
  for (const p of partes) h.update(p);
  return h.digest('hex').slice(0, 12);
}

function archivosDe(dir, rel = '') {
  return fs.readdirSync(path.join(dir, rel), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) => {
      const r = path.join(rel, e.name);
      return e.isDirectory() ? archivosDe(dir, r) : [r];
    });
}

function hashDir(dir) {
  return hash(...archivosDe(dir).flatMap((r) => [r, fs.readFileSync(path.join(dir, r))]));
}

function correr(cmd, args, { cwd, env, log, archivoLog } = {}) {
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
      ? fs.readFileSync(archivoLog, 'utf8').split('\n').slice(-80).join('\n')
      : `${r.stdout ?? ''}\n${r.stderr ?? ''}`.slice(-6000);
    throw new Error(`Falló ${cmd} ${args.join(' ')} (código ${r.status})\n${cola}`);
  }
  return (r.stdout ?? '').trim();
}

/** El entorno del empaquetado y de prebuild: sin ninguna clave real. */
function entornoArnes() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (k.startsWith('EXPO_PUBLIC_') || k === 'EXPO_TOKEN' || k.startsWith('NIVL_SHOTS_')) delete env[k];
  }
  return {
    ...env,
    CI: '1',
    LANG: 'en_US.UTF-8',
    EXPO_NO_TELEMETRY: '1',
    EXPO_NO_DOTENV: '1',
    EXPO_NO_GIT_STATUS: '1',
    EXPO_PUBLIC_SCREENSHOT_MODE: '1',
    // src/lib/supabase.ts queda sustituido; estas dos solo existen para las
    // lecturas sueltas de process.env (coach, oráculo). El dominio .invalid
    // no resuelve nunca.
    EXPO_PUBLIC_SUPABASE_URL: 'https://arnes.invalid',
    EXPO_PUBLIC_SUPABASE_KEY: 'arnes-local-sin-clave',
    EXPO_PUBLIC_RC_IOS_KEY: 'arnes-sin-tienda',
    EXPO_PUBLIC_RC_ANDROID_KEY: '',
    EXPO_PUBLIC_PAYWALL: 'off',
  };
}

function asegurarCopia(sha, sha7, cacheDir, log) {
  const src = path.join(cacheDir, `src-${sha7}`);
  if (!fs.existsSync(path.join(src, 'package.json'))) {
    fs.rmSync(src, { recursive: true, force: true });
    correr('git', ['worktree', 'add', '--detach', src, sha], { cwd: RAIZ_REPO, log });
  }
  return src;
}

function asegurarDependencias(src, log) {
  const marca = path.join(src, 'node_modules/.arnes-npm-ci');
  const huella = hash(fs.readFileSync(path.join(src, 'package-lock.json')));
  if (fs.existsSync(marca) && fs.readFileSync(marca, 'utf8') === huella) return;
  // npm 10: el lockfile no casa con el resolutor de npm 11 (AGENTS.md).
  // Sin scripts: ninguno hace falta para compilar y uno bajaría la CLI de Supabase.
  correr('npx', [...NPM, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: src, log, env: { CI: '1' } });
  fs.writeFileSync(marca, huella);
}

/** Deja la copia como el commit más el arnés. Idempotente. */
function prepararCopia(src, sha) {
  correr('git', ['checkout', sha, '--', 'package.json', 'app.json', 'metro.config.js'], { cwd: src });
  const destino = path.join(src, DESTINO_ARNES);
  fs.rmSync(destino, { recursive: true, force: true });
  fs.cpSync(APP_ARNES, destino, { recursive: true });

  const fPkg = path.join(src, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(fPkg, 'utf8'));
  pkg.main = `${DESTINO_ARNES}/entry.js`;
  fs.writeFileSync(fPkg, JSON.stringify(pkg, null, 2) + '\n');

  const fApp = path.join(src, 'app.json');
  const app = JSON.parse(fs.readFileSync(fApp, 'utf8'));
  app.expo.ios.bundleIdentifier = BUNDLE_ID;
  app.expo.ios.associatedDomains = [];
  app.expo.ios.entitlements = {};
  app.expo.updates = { enabled: false };
  app.expo.extra = { router: {} };
  delete app.expo.owner;
  delete app.expo.runtimeVersion;
  app.expo.experiments = { ...app.expo.experiments, typedRoutes: false };
  // El reloj se compila aparte (objetivos/watch.mjs): con -sdk iphonesimulator
  // sus objetivos no compilan y la app de capturas no los necesita.
  app.expo.plugins = (app.expo.plugins ?? []).filter((p) => (Array.isArray(p) ? p[0] : p) !== '@bacons/apple-targets');
  fs.writeFileSync(fApp, JSON.stringify(app, null, 2) + '\n');

  const fMetro = path.join(src, 'metro.config.js');
  fs.copyFileSync(fMetro, path.join(destino, 'metro.original.js'));
  // El config original se carga desde su sitio (__dirname cuenta).
  fs.renameSync(path.join(destino, 'metro.original.js'), path.join(src, 'metro.original.config.js'));
  fs.writeFileSync(fMetro, `module.exports = require('./${DESTINO_ARNES}/metro-arnes.js')(require('./metro.original.config.js'), __dirname);\n`);
  return JSON.stringify(app);
}

function compilarNativo(src, destinoApp, cacheDir, log) {
  const env = entornoArnes();
  correr('npx', ['expo', 'prebuild', '--platform', 'ios', '--clean', '--no-install'], { cwd: src, env, log });
  correr('pod', ['install', '--project-directory=ios'], { cwd: src, env, log, archivoLog: path.join(cacheDir, 'pod-install.log') });
  const derived = path.join(cacheDir, 'derived');
  const archivoLog = path.join(cacheDir, 'xcodebuild.log');
  log(`xcodebuild en marcha; registro en ${archivoLog}`);
  correr('xcodebuild', [
    '-workspace', 'ios/NIVL.xcworkspace', '-scheme', 'NIVL',
    '-configuration', 'Release', '-sdk', 'iphonesimulator',
    '-destination', 'generic/platform=iOS Simulator',
    '-derivedDataPath', derived,
    `ARCHS=${process.arch === 'arm64' ? 'arm64' : 'x86_64'}`, 'ONLY_ACTIVE_ARCH=YES',
    // Xcode 27 rechaza pods con objetivo por debajo de iOS 15 (RNSVG, SDWebImage...).
    // Por línea de comandos manda sobre todos los pods y no toca el Podfile.
    'IPHONEOS_DEPLOYMENT_TARGET=16.0',
    'CODE_SIGNING_ALLOWED=NO', 'build',
  ], { cwd: src, env: { ...env, SKIP_BUNDLING: '1', RCT_NO_LAUNCH_PACKAGER: '1' }, log, archivoLog });
  const hecho = path.join(derived, 'Build/Products/Release-iphonesimulator/NIVL.app');
  fs.rmSync(path.dirname(destinoApp), { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destinoApp), { recursive: true });
  fs.cpSync(hecho, destinoApp, { recursive: true, verbatimSymlinks: true });
}

function empaquetarJs(src, app, cacheDir, log) {
  const salida = path.join(cacheDir, 'bundle');
  fs.rmSync(salida, { recursive: true, force: true });
  fs.mkdirSync(salida, { recursive: true });
  correr('npx', [
    'expo', 'export:embed', '--platform', 'ios', '--dev', 'false', '--minify', 'false',
    '--entry-file', `${DESTINO_ARNES}/entry.js`,
    '--bundle-output', path.join(salida, 'main.jsbundle'),
    '--assets-dest', salida, '--bytecode',
  ], { cwd: src, env: entornoArnes(), log, archivoLog: path.join(cacheDir, 'bundle.log') });
  const js = fs.readFileSync(path.join(salida, 'main.jsbundle'));
  if (js.subarray(0, 8).toString('hex') !== 'c61fbc03c103191f') throw new Error('El bundle no salió como bytecode de Hermes');
  fs.cpSync(salida, app, { recursive: true, force: true });
}

/**
 * El SDK de iOS 27 exige el ciclo de vida UIScene al arrancar y Expo 54 aún no lo
 * usa: la app muere nada más abrir. La comprobación mira el SDK grabado en el
 * ejecutable, así que en este .app de simulador se graba el 26. Solo en el arnés.
 */
function declararSdkCompatible(app, log) {
  const bin = path.join(app, 'NIVL');
  const info = correr('vtool', ['-show-build', bin]);
  const sdk = /sdk\s+(\d+)/.exec(info)?.[1];
  if (!sdk || Number(sdk) < 27) return;
  log(`el ejecutable declara el SDK ${sdk}: se graba el 26 para que arranque sin UIScene`);
  correr('vtool', ['-set-build-version', 'iossim', '16.0', '26.0', '-replace', '-output', bin, bin]);
  correr('codesign', ['--force', '--sign', '-', bin]);
}

/**
 * @param {{commit: string, cacheDir?: string, log?: (m: string) => void}} o
 * @returns {Promise<{app: string, sha7: string, sha: string, src: string}>}
 */
export async function construir({ commit, cacheDir = path.join(RAIZ_REPO, '.tienda/cache'), log = () => {} }) {
  if (process.platform !== 'darwin') throw new Error('El arnés de iOS solo compila en macOS');
  cacheDir = path.resolve(cacheDir);
  fs.mkdirSync(cacheDir, { recursive: true });
  const sha = correr('git', ['rev-parse', '--verify', `${commit}^{commit}`], { cwd: RAIZ_REPO });
  const sha7 = sha.slice(0, 7);

  const src = asegurarCopia(sha, sha7, cacheDir, log);
  log(`copia del commit en ${src}`);
  asegurarDependencias(src, log);
  const appJson = prepararCopia(src, sha);

  const xcode = correr('xcodebuild', ['-version']);
  const iconos = path.join(src, 'assets/images');
  const huellaNativa = hash(
    String(RECETA_NATIVA), xcode, appJson,
    fs.readFileSync(path.join(src, 'package-lock.json')),
    hashDir(iconos),
  );
  const huellaArnes = hash(hashDir(APP_ARNES), fs.readFileSync(fileURLToPath(import.meta.url)));
  const nativo = path.join(cacheDir, `nativo-${huellaNativa}`, 'NIVL.app');
  const final = path.join(cacheDir, 'apps', `${sha7}-${huellaNativa.slice(0, 6)}-${huellaArnes}`, 'NIVL.app');

  if (fs.existsSync(path.join(final, 'main.jsbundle'))) {
    log(`app en caché: ${final}`);
    return { app: final, sha7, sha, src };
  }
  if (fs.existsSync(path.join(nativo, 'Info.plist'))) log(`nativo en caché: ${nativo}`);
  else compilarNativo(src, nativo, cacheDir, log);

  fs.rmSync(path.dirname(final), { recursive: true, force: true });
  fs.mkdirSync(path.dirname(final), { recursive: true });
  fs.cpSync(nativo, final, { recursive: true, verbatimSymlinks: true });
  declararSdkCompatible(final, log);
  empaquetarJs(src, final, cacheDir, log);
  log(`app lista: ${final}`);
  return { app: final, sha7, sha, src };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--commit');
  const commit = i > 0 ? process.argv[i + 1] : 'HEAD';
  const r = await construir({ commit, log: (m) => console.log(`[construir] ${m}`) });
  console.log(JSON.stringify(r));
}
