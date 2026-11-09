#!/usr/bin/env node
// Capturas de la pantalla de compra para el Review Screenshot de App Store Connect:
// una por producto, 1320x2868, sin marco ni texto comercial.
//
//   node scripts/tienda/revision-compra.mjs --commit <sha> --salida <dir>
//
// Es la app real en simulador con datos ficticios. La tienda NO es StoreKit: el
// arnés sirve el catálogo con los precios de planesmodo.ts (ver harness/app/purchases.ts).
// Hay que decirlo así en la nota de revisión.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { construir } from './harness/construir.mjs';
import { escenas } from './harness/escenas.mjs';
import { abrirEscena, aprobarEsquema, capturar, prepararYLanzar } from './harness/simulador.mjs';
import { leerImagen } from './validar.mjs';

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const commit = arg('--commit');
const salida = arg('--salida');
if (!commit || !salida) { console.error('Uso: --commit <sha> --salida <dir>'); process.exit(2); }
const sim = (...a) => execFileSync('xcrun', ['simctl', ...a], { encoding: 'utf8' }).trim();
const log = (m) => console.log(`[revision] ${m}`);

const { app } = await construir({ commit, log });
const nombre = `nivl-capturas-compra-${process.pid}`;
const runtime = JSON.parse(sim('list', 'runtimes', '-j')).runtimes.find((r) => r.identifier === 'com.apple.CoreSimulator.SimRuntime.iOS-27-2');
const udid = sim('create', nombre, 'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max', runtime.identifier);
try {
  aprobarEsquema(udid);
  sim('bootstatus', udid, '-b');
  sim('status_bar', udid, 'override', '--time', '9:41', '--batteryState', 'charged', '--batteryLevel', '100', '--cellularBars', '4', '--wifiBars', '3');
  await prepararYLanzar(udid, app);
  fs.mkdirSync(salida, { recursive: true });
  for (const e of escenas.filter((x) => x.id.startsWith('compra-'))) {
    await abrirEscena(udid, e.id);
    const crudo = path.join(salida, `.${e.id}.png`);
    capturar(udid, crudo);
    const destino = path.join(salida, `${e.id.replace('compra-', '')}.png`);
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', crudo, '-frames:v', '1', '-vf', 'format=rgb24', '-update', '1', destino]);
    fs.rmSync(crudo);
    const i = leerImagen(fs.readFileSync(destino));
    if (i.ancho !== 1320 || i.alto !== 2868 || i.alfa) throw new Error(`${destino}: ${i.ancho}x${i.alto}, alfa ${i.alfa}`);
    log(`${path.basename(destino)}: ${i.ancho}x${i.alto}`);
  }
} finally {
  try { sim('shutdown', udid); } catch { /* ya apagado */ }
  sim('delete', udid);
}
