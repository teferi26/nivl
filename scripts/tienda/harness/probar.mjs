// Prueba de extremo a extremo del arnés en un clon propio (nivl-capturas-harness):
//   node scripts/tienda/harness/probar.mjs [--commit HEAD] [--salida dir] [--conservar]
// Crea el simulador, captura cada escena, ejecuta las giras y lo borra al final.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { BUNDLE_ID, construir } from './construir.mjs';
import { escenas } from './escenas.mjs';
import { abrirEscena, aprobarEsquema, capturar, lanzarGira, prepararYLanzar } from './simulador.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const conservar = process.argv.includes('--conservar');
const salida = path.resolve(arg('--salida', '.tienda/prueba-arnes'));
const NOMBRE = 'nivl-capturas-harness';
const sim = (...a) => execFileSync('xcrun', ['simctl', ...a], { encoding: 'utf8' }).trim();
const log = (m) => console.log(`[probar] ${m}`);

const { app } = await construir({ commit: arg('--commit', 'HEAD'), log });
const lista = JSON.parse(sim('list', 'devices', '-j')).devices;
let udid = Object.values(lista).flat().find((d) => d.name === NOMBRE)?.udid;
if (!udid) udid = sim('create', NOMBRE, 'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max', 'com.apple.CoreSimulator.SimRuntime.iOS-27-2');
log(`simulador ${udid}`);
try {
  aprobarEsquema(udid);
  sim('bootstatus', udid, '-b');
  await prepararYLanzar(udid, app);
  capturar(udid, path.join(salida, '00-arranque.png'));
  let ultimo = null;
  let n = 1;
  for (const e of escenas) {
    const t = Date.now();
    ultimo = await abrirEscena(udid, e.id);
    capturar(udid, path.join(salida, `${String(n++).padStart(2, '0')}-${e.id}.png`));
    log(`${e.id}: ${Date.now() - t} ms`);
  }
  for (const g of ['corta', 'larga']) {
    const r = await lanzarGira(udid, g);
    log(`gira ${g}: ${r.duracionRealMs} ms`);
    ultimo = r;
  }
  log(`avisos del arnés: ${JSON.stringify(ultimo?.avisos ?? [])}`);
  // La orden también vale con la app cerrada (arranque en frío).
  sim('terminate', udid, BUNDLE_ID);
  await abrirEscena(udid, 'perfil', { limiteMs: 60000 });
  capturar(udid, path.join(salida, '90-frio-perfil.png'));
  // El plan gratis de /pro no se queda pegado al volver al coach.
  await abrirEscena(udid, 'pro');
  await abrirEscena(udid, 'coach');
  capturar(udid, path.join(salida, '91-coach-tras-pro.png'));
} finally {
  if (conservar) log(`conservado ${udid}`);
  else {
    sim('shutdown', udid);
    sim('delete', udid);
    log('simulador borrado');
  }
}
