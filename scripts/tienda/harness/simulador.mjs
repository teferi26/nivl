// Ayudas para dirigir un simulador YA creado con la app del arnés. Solo tocan el
// dispositivo que se les pasa. Se apoya en simctl; fuera del sandbox.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BUNDLE_ID } from './construir.mjs';
import { urlEscena, urlGira } from './escenas.mjs';

const simctl = (...a) => execFileSync('xcrun', ['simctl', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
let contador = 0;

/**
 * Sin esto iOS pregunta «¿Abrir en NIVL?» en la primera openurl de cada esquema.
 * Se escribe la aprobación en el propio dispositivo (hay que hacerlo apagado o
 * antes de la primera openurl, y es del clon: no toca otros simuladores).
 */
export function aprobarEsquema(udid) {
  const dir = path.join(process.env.HOME, 'Library/Developer/CoreSimulator/Devices', udid, 'data/Library/Preferences');
  fs.mkdirSync(dir, { recursive: true });
  const plist = path.join(dir, 'com.apple.launchservices.schemeapproval.plist');
  const clave = 'com.apple.CoreSimulator.CoreSimulatorBridge-->nivl';
  if (!fs.existsSync(plist)) execFileSync('plutil', ['-create', 'xml1', plist]);
  try { execFileSync('plutil', ['-remove', clave.replaceAll('.', '\\.'), plist], { stdio: 'ignore' }); } catch { /* no estaba */ }
  execFileSync('plutil', ['-insert', clave.replaceAll('.', '\\.'), '-string', BUNDLE_ID, plist]);
}

/** Barra de estado de foto, oscuro, instalar y lanzar en español. Espera a Hoy. */
export async function prepararYLanzar(udid, app, { esperaMs = 6000 } = {}) {
  simctl('ui', udid, 'appearance', 'dark');
  simctl('status_bar', udid, 'override', '--time', '9:41', '--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3', '--cellularMode', 'active', '--cellularBars', '4', '--batteryState', 'discharging', '--batteryLevel', '100');
  simctl('install', udid, app);
  simctl('launch', '--terminate-running-process', udid, BUNDLE_ID, '-AppleLanguages', '(es)', '-AppleLocale', 'es_ES');
  await dormir(esperaMs);
}

function archivoEstado(udid) {
  return path.join(simctl('get_app_container', udid, BUNDLE_ID, 'data'), 'Documents/tienda-estado.json');
}

async function esperarToken(udid, token, limiteMs) {
  const archivo = archivoEstado(udid);
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) {
    try {
      const e = JSON.parse(fs.readFileSync(archivo, 'utf8'));
      if (e.token === token && e.listo) {
        if (e.error) throw new Error(`El arnés falló: ${e.error}`);
        return e;
      }
    } catch (err) {
      if (String(err).includes('arnés falló')) throw err;
    }
    await dormir(150);
  }
  throw new Error(`Sin respuesta del arnés en ${limiteMs} ms (token ${token})`);
}

const nuevoToken = () => `${process.pid}-${Date.now()}-${++contador}`;

/** Abre una escena y resuelve cuando ya está asentada: la captura se puede hacer. */
export async function abrirEscena(udid, id, { limiteMs = 30000 } = {}) {
  const token = nuevoToken();
  simctl('openurl', udid, urlEscena(id, token));
  return esperarToken(udid, token, limiteMs);
}

/** Lanza una gira y devuelve una promesa que acaba cuando la gira termina. */
export function lanzarGira(udid, nombre, { retraso = 0, limiteMs = 120000 } = {}) {
  const token = nuevoToken();
  simctl('openurl', udid, urlGira(nombre, { retraso, token }));
  return esperarToken(udid, token, limiteMs);
}

export function capturar(udid, archivo) {
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  simctl('io', udid, 'screenshot', '--type=png', archivo);
}
