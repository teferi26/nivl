#!/usr/bin/env node
// El arnés de datos ficticios en Android, sin cuenta ni red. Lo lanza
// .github/workflows/screenshots-android.yml en un checkout desechable:
//   node scripts/tienda/harness/android.mjs --construir --apk <salida.apk>
//   node scripts/tienda/harness/android.mjs --capturar  --apk <app.apk> --salida <dir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BUNDLE_ID, entornoArnes, prepararCopia } from './construir.mjs';

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
export const ESCENAS = ['hoy', 'coach', 'rueda', 'iron-hoy', 'focus-hoy', 'work-hoy', 'founder-hoy', 'avance'];
const ANCHO = 1080;
const ALTO = 1920;

function construir(apk) {
  const raiz = process.cwd();
  prepararCopia(raiz, 'HEAD');
  const env = { ...process.env, ...entornoArnes(), CI: '1' };
  const correr = (cmd, args, cwd = raiz) => execFileSync(cmd, args, { cwd, env, stdio: 'inherit' });
  correr('npx', ['expo', 'prebuild', '--platform', 'android', '--clean', '--no-install']);
  correr('./gradlew', [':app:assembleRelease', '-PreactNativeArchitectures=x86_64', '--no-daemon', '--stacktrace'], path.join(raiz, 'android'));
  fs.mkdirSync(path.dirname(path.resolve(apk)), { recursive: true });
  fs.copyFileSync(path.join(raiz, 'android/app/build/outputs/apk/release/app-release.apk'), apk);
}

const adb = (...a) => execFileSync('adb', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const shell = (cmd) => adb('shell', cmd);
const demo = (extra) => shell(`am broadcast -a com.android.systemui.demo ${extra}`);
const estados = () => adb('logcat', '-d', '-v', 'raw', '-s', 'ReactNativeJS:I').split('\n').filter((l) => l.startsWith('TIENDA_ESTADO '));

async function esperarToken(token, limiteMs = 90000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) {
    for (const l of estados().reverse()) {
      const e = JSON.parse(l.slice('TIENDA_ESTADO '.length));
      if (e.token === token && e.listo) {
        if (e.error) throw new Error(`El arnés falló en ${token}: ${e.error}`);
        return e;
      }
    }
    await dormir(400);
  }
  throw new Error(`Sin respuesta del arnés (${token})`);
}

function dimensiones(buf) {
  if (buf.toString('latin1', 1, 4) !== 'PNG') throw new Error('La captura no es PNG');
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

async function capturar(apk, salida) {
  fs.mkdirSync(salida, { recursive: true });
  shell('cmd uimode night yes');
  shell('settings put global sysui_demo_allowed 1');
  demo('-e command enter');
  demo('-e command clock -e hhmm 0941');
  demo('-e command battery -e level 100 -e plugged false');
  demo('-e command network -e wifi show -e level 4 -e fully true -e mobile hide');
  demo('-e command notifications -e visible false');
  adb('install', '-r', '-g', apk);
  try { shell(`cmd locale set-app-locales ${BUNDLE_ID} --locales es-ES`); } catch { /* la app ya va en español con los idiomas apagados */ }
  adb('logcat', '-c');
  shell(`monkey -p ${BUNDLE_ID} -c android.intent.category.LAUNCHER 1`);
  await dormir(25000);
  let n = 0;
  for (const id of ESCENAS) {
    n += 1;
    const token = `${process.pid}-${n}`;
    shell(`am start -a android.intent.action.VIEW -d 'nivl://__tienda/escena?id=${id}&token=${token}' ${BUNDLE_ID}`);
    const e = await esperarToken(token);
    await dormir(1500);
    const png = execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 });
    const [w, h] = dimensiones(png);
    if (w !== ANCHO || h !== ALTO) throw new Error(`${id}: ${w}x${h}, se esperaba ${ANCHO}x${ALTO}`);
    fs.writeFileSync(path.join(salida, `${String(n).padStart(2, '0')}-${id}.png`), png);
    console.log(`${id}: ${w}x${h}; avisos: ${JSON.stringify(e.avisos ?? [])}`);
  }
}

if (process.argv.includes('--construir')) construir(arg('--apk'));
else if (process.argv.includes('--capturar')) {
  const salida = arg('--salida');
  try {
    await capturar(arg('--apk'), salida);
  } finally {
    // Solo hay datos ficticios: el diagnóstico puede ir en el artefacto.
    fs.mkdirSync(salida, { recursive: true });
    try { fs.writeFileSync(path.join(salida, 'logcat.txt'), adb('logcat', '-d', '-s', 'ReactNativeJS:V', 'AndroidRuntime:E')); } catch { /* emulador caído */ }
    try { fs.writeFileSync(path.join(salida, 'ultima-pantalla.png'), execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 })); } catch { /* emulador caído */ }
  }
}
