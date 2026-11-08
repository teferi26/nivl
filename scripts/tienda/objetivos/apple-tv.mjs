// Objetivo Apple TV: la app SwiftUI de tv/ en «Apple TV 4K (3rd generation)»,
// 3840x2160, con los datos de demostración que la propia app trae (Demo.swift).
// Sin cuenta ni red. El simulador no tiene mando, así que cada escena es un
// lanzamiento con sus argumentos (-pestana, -estado), como en el QA de tv/README.md.
import fs from 'node:fs';
import path from 'node:path';
import {
  CACHE, asegurarCopia, bundleIdDe, compatible, conSimulador, correr, fotoSimulador,
  huellaXcode, lanzarAsentada, localizarFuente, runtimeDe, simctl,
} from './_apoyo/nativo.mjs';

const MARCA = 'tv/NIVLTV.xcodeproj/project.pbxproj';
const DISPOSITIVO = 'com.apple.CoreSimulator.SimDeviceType.Apple-TV-4K-3rd-generation-4K';

// `id` es además la escena del compositor (entreno y arena son alias de gym y amigos).
// Son las de esta app: ctx.escenas habla de las pantallas del móvil.
const ESCENAS = [
  { id: 'entreno', args: ['-pestana', 'entreno', '-estado', 'serie'] },
  { id: 'arena', args: ['-pestana', 'arena'] },
  { id: 'resumen', args: ['-pestana', 'semana'] },
];

function compilar(ctx, f) {
  const destino = path.join(CACHE, 'apps-nativas', `tv-${f.sha7}-${huellaXcode()}`, 'NIVLTV.app');
  if (fs.existsSync(path.join(destino, 'Info.plist'))) {
    ctx.log(`app de TV en caché: ${destino}`);
    return destino;
  }
  const dir = asegurarCopia('tv', f.sha, f.sha7, ctx.log);
  const derivados = path.join(CACHE, `derived-tv-${f.sha7}`);
  const archivoLog = path.join(CACHE, `xcodebuild-tv-${f.sha7}.log`);
  ctx.log(`compilando Apple TV; registro en ${archivoLog}`);
  correr('xcodebuild', [
    '-project', 'NIVLTV.xcodeproj', '-scheme', 'NIVLTV', '-configuration', 'Release',
    '-sdk', 'appletvsimulator', '-destination', 'generic/platform=tvOS Simulator',
    '-derivedDataPath', derivados, `ARCHS=${process.arch === 'arm64' ? 'arm64' : 'x86_64'}`,
    'ONLY_ACTIVE_ARCH=YES', 'CODE_SIGNING_ALLOWED=NO', 'build',
  ], { cwd: path.join(dir, 'tv'), log: ctx.log, archivoLog });
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.cpSync(path.join(derivados, 'Build/Products/Release-appletvsimulator/NIVLTV.app'), destino, { recursive: true, verbatimSymlinks: true });
  return destino;
}

export default {
  id: 'apple-tv',
  familia: 'tv',
  nota: 'App SwiftUI de tv/ con sus datos de demostración.',

  disponible(ctx) {
    const f = localizarFuente(ctx, 'tv', MARCA);
    if (f.motivo) return { ok: false, motivo: f.motivo };
    const runtime = runtimeDe('tvOS');
    if (!runtime) return { ok: false, motivo: 'no hay runtime de tvOS instalado en Xcode' };
    const c = compatible(runtime, DISPOSITIVO);
    return c.ok ? { ok: true } : c;
  },

  async capturar(ctx) {
    const f = localizarFuente(ctx, 'tv', MARCA);
    if (f.motivo) throw new Error(f.motivo);
    const app = compilar(ctx, f);
    const bundle = bundleIdDe(app);
    const runtime = runtimeDe('tvOS');

    return conSimulador({ ctx, nombre: 'tv', tipo: DISPOSITIVO, runtime }, async (udid) => {
      // tvOS no admite `simctl ui appearance`; la app ya fuerza el modo oscuro.
      simctl('install', udid, app);
      const hechas = [];
      for (const [i, e] of ESCENAS.entries()) {
        const archivo = path.join(ctx.salida, `${String(i + 1).padStart(2, '0')}-${e.id}.png`);
        fs.mkdirSync(ctx.salida, { recursive: true });
        await lanzarAsentada(udid, bundle, [...e.args, '-AppleLanguages', '(es)', '-AppleLocale', 'es_ES'], `${archivo}.espera.png`, { minMs: 4000, maxMs: 30000 });
        const { ancho, alto } = fotoSimulador(udid, archivo);
        if (ancho !== 3840 || alto !== 2160) throw new Error(`Apple TV: ${ancho}x${alto}, se esperaba 3840x2160`);
        ctx.log(`${e.id}: ${ancho}x${alto}`);
        hechas.push({ archivo, ancho, alto, escena: e.id, tipo: 'cruda', fuente: f.sha7 });
      }
      return hechas;
    });
  },
};
