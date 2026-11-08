// Objetivo Apple Watch: la app SwiftUI de targets/watch en cada clase de tamaño
// con simulador, sin componer ni marco (Apple las quiere a pantalla completa).
// Va independiente del iPhone con el interruptor de demo de la app (-nivlDemo).
// Cada clase deja su carpeta, salida/<clase>/NN-escena.png: Apple exige un único
// tamaño por ficha y el validador se pasa carpeta a carpeta.
import fs from 'node:fs';
import path from 'node:path';
import {
  CACHE, asegurarCopia, bundleIdDe, compatible, conSimulador, correr, fotoSimulador,
  huellaXcode, lanzarAsentada, localizarFuente, runtimeDe, simctl,
} from './_apoyo/nativo.mjs';

const MARCA = 'targets/watch/NivlRelojApp.swift';
const NPM = ['-y', 'npm@10.9.2'];
const prefijo = 'com.apple.CoreSimulator.SimDeviceType.Apple-Watch-';

export const CLASES = [
  { id: 'ultra-4', tipo: `${prefijo}Ultra-4-49mm`, tam: [422, 514] },
  { id: 'series-12', tipo: `${prefijo}Series-12-46mm`, tam: [416, 496] },
  { id: 'ultra-2', tipo: `${prefijo}Ultra-2-49mm`, tam: [410, 502] },
  { id: 'series-9', tipo: `${prefijo}Series-9-45mm`, tam: [396, 484] },
  { id: 'se-3', tipo: `${prefijo}SE-3-44mm`, tam: [368, 448] },
  { id: 'series-3', tipo: `${prefijo}Series-3-42mm`, tam: [312, 390] },
];

const ESCENAS = [
  { id: 'hoy', args: [] },
  { id: 'racha', args: ['-nivlPagina', 'racha'] },
  { id: 'focus', args: ['-nivlPagina', 'focus'] },
  { id: 'descanso', args: ['-nivlPagina', 'descanso'] },
  { id: 'mision', args: ['-nivlMision', 'demo-1'] },
];

function compilar(ctx, f) {
  const destino = path.join(CACHE, 'apps-nativas', `watch-${f.sha7}-${huellaXcode()}`, 'NivlReloj.app');
  if (fs.existsSync(path.join(destino, 'Info.plist'))) {
    ctx.log(`app de reloj en caché: ${destino}`);
    return destino;
  }
  const dir = asegurarCopia('watch', f.sha, f.sha7, ctx.log);
  const env = { CI: '1', LANG: 'en_US.UTF-8', EXPO_NO_TELEMETRY: '1', EXPO_NO_DOTENV: '1', EXPO_NO_GIT_STATUS: '1' };
  if (!fs.existsSync(path.join(dir, 'node_modules/.bin/expo'))) {
    correr('npx', [...NPM, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: dir, env, log: ctx.log });
  }
  // El proyecto del reloj lo genera @bacons/apple-targets; el nativo no se guarda en el repo.
  correr('npx', ['expo', 'prebuild', '--platform', 'ios', '--clean', '--no-install'], { cwd: dir, env, log: ctx.log });
  const archivoLog = path.join(CACHE, `xcodebuild-watch-${f.sha7}.log`);
  ctx.log(`compilando Apple Watch; registro en ${archivoLog}`);
  correr('xcodebuild', [
    '-project', 'ios/NIVL.xcodeproj', '-target', 'NivlReloj', '-configuration', 'Release',
    '-sdk', 'watchsimulator', `ARCHS=${process.arch === 'arm64' ? 'arm64' : 'x86_64'}`,
    'ONLY_ACTIVE_ARCH=YES', 'CODE_SIGNING_ALLOWED=NO', 'build',
  ], { cwd: dir, env, log: ctx.log, archivoLog });
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.cpSync(path.join(dir, 'ios/build/Release-watchsimulator/NivlReloj.app'), destino, { recursive: true, verbatimSymlinks: true });
  return destino;
}

export default {
  id: 'watch',
  familia: 'watch',
  nota: 'App SwiftUI de targets/watch con su modo demo; una carpeta por clase de tamaño, sin diseño.',

  disponible(ctx) {
    const f = localizarFuente(ctx, 'watch', MARCA);
    if (f.motivo) return { ok: false, motivo: f.motivo };
    const runtime = runtimeDe('watchOS');
    if (!runtime) return { ok: false, motivo: 'no hay runtime de watchOS instalado en Xcode' };
    return { ok: true };
  },

  async capturar(ctx) {
    const f = localizarFuente(ctx, 'watch', MARCA);
    if (f.motivo) throw new Error(f.motivo);
    const app = compilar(ctx, f);
    const bundle = bundleIdDe(app);
    const runtime = runtimeDe('watchOS');
    // ctx.escenas habla de las pantallas del móvil: aquí mandan las de la app del reloj.
    const escenas = ctx.muestra ? ESCENAS.slice(0, 1) : ESCENAS;
    // Una muestra se queda en la primera clase: cada clase es un arranque de simulador.
    const clases = CLASES.filter((c) => (ctx.clases ? ctx.clases.includes(c.id) : true)).slice(0, ctx.muestra && !ctx.clases ? 1 : undefined);
    const hechas = [];

    for (const clase of clases) {
      const c = compatible(runtime, clase.tipo);
      if (!c.ok) {
        const aviso = `sin simulador para ${clase.id} (${clase.tam.join('x')}): ${c.motivo}`;
        if (ctx.aviso) ctx.aviso(aviso);
        else ctx.log(aviso);
        continue;
      }
      await conSimulador({ ctx, nombre: `watch-${clase.id}`, tipo: clase.tipo, runtime }, async (udid) => {
        try {
          simctl('status_bar', udid, 'override', '--time', '9:41');
        } catch (e) {
          ctx.log(`${clase.id}: watchOS no admite fijar la hora; sale la del Mac (${String(e.stderr ?? e).trim().split('\n')[1] ?? ''})`);
        }
        simctl('install', udid, app);
        for (const [i, e] of escenas.entries()) {
          const archivo = path.join(ctx.salida, clase.id, `${String(i + 1).padStart(2, '0')}-${e.id}.png`);
          fs.mkdirSync(path.dirname(archivo), { recursive: true });
          await lanzarAsentada(udid, bundle, ['-nivlDemo', 'YES', ...e.args, '-AppleLanguages', '(es)', '-AppleLocale', 'es_ES'], `${archivo}.espera.png`, { minMs: 4000, maxMs: 25000 });
          const { ancho, alto } = fotoSimulador(udid, archivo);
          if (ancho !== clase.tam[0] || alto !== clase.tam[1]) throw new Error(`${clase.id}: ${ancho}x${alto}, se esperaba ${clase.tam.join('x')}`);
          ctx.log(`${clase.id} ${e.id}: ${ancho}x${alto}`);
          hechas.push({ archivo, ancho, alto, escena: e.id, tipo: 'cruda', clase: clase.id, fuente: f.sha7 });
        }
      });
    }
    return hechas;
  },
};
