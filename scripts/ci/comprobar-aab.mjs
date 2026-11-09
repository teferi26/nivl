#!/usr/bin/env node
// NIVL · Comprueba un AAB antes de subirlo a Play (P11, P12, H7 de la lista de salida).
//
//   node scripts/ci/comprobar-aab.mjs nivl.aab bundletool.jar [--version 1.1.0]
//
// Falla (salida 1) si el manifiesto fusionado declara algo que NIVL no debe
// llevar, si el AAB no está firmado o lo firma una clave de depuración, o si
// no cumple el SDK objetivo. Solo lee: no sube nada. Necesita Java y `jarsigner`.

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SDK_OBJETIVO_MIN = 36;

const PROHIBIDOS = [
  /^android\.permission\.SYSTEM_ALERT_WINDOW$/,
  /^android\.permission\.FOREGROUND_SERVICE/,
  /^android\.permission\.READ_MEDIA_/,
  /^android\.permission\.SCHEDULE_EXACT_ALARM$/,
  /^android\.permission\.USE_EXACT_ALARM$/,
  /^android\.permission\.ACCESS_(FINE|COARSE|BACKGROUND)_LOCATION$/,
  /^android\.permission\.health\./,
  /^com\.google\.android\.gms\.permission\.AD_ID$/,
];

/** Tope que debe llevar cada permiso de almacenamiento heredado. */
const TOPES = {
  'android.permission.READ_EXTERNAL_STORAGE': 32,
  'android.permission.WRITE_EXTERNAL_STORAGE': 28,
};

const atributo = (etiqueta, nombre) => etiqueta.match(new RegExp(`android:${nombre}="([^"]*)"`))?.[1];

/** Puro: de la salida de `bundletool dump manifest`, la lista de fallos. */
export function fallosManifiesto(xml, { version } = {}) {
  const fallos = [];
  const permisos = xml.match(/<uses-permission(?:-sdk-23)?\b[^>]*>/g) ?? [];
  for (const p of permisos) {
    const nombre = atributo(p, 'name');
    if (!nombre) continue;
    if (PROHIBIDOS.some((re) => re.test(nombre))) fallos.push(`permiso prohibido: ${nombre}`);
    if (nombre in TOPES) {
      const tope = Number(atributo(p, 'maxSdkVersion'));
      if (!tope || tope > TOPES[nombre]) fallos.push(`${nombre} sin tope de API ${TOPES[nombre]}`);
    }
  }
  for (const s of xml.match(/<service\b[^>]*>/g) ?? []) {
    if (atributo(s, 'foregroundServiceType')) fallos.push(`servicio en primer plano: ${atributo(s, 'name')}`);
  }
  const usesSdk = xml.match(/<uses-sdk\b[^>]*>/)?.[0] ?? '';
  const objetivo = Number(atributo(usesSdk, 'targetSdkVersion'));
  if (!objetivo || objetivo < SDK_OBJETIVO_MIN) fallos.push(`targetSdkVersion ${objetivo || 'ausente'}, se exige ${SDK_OBJETIVO_MIN}`);
  if (version) {
    const v = atributo(xml.match(/<manifest\b[^>]*>/)?.[0] ?? '', 'versionName');
    if (v !== version) fallos.push(`versionName ${v ?? 'ausente'}, se esperaba ${version}`);
  }
  return fallos;
}

/** Puro: de la salida de `jarsigner -verify -verbose -certs`, los fallos de firma. */
export function fallosFirma(salida) {
  if (!/jar verified/i.test(salida)) return ['el AAB no está firmado o la firma no verifica'];
  if (/CN=Android Debug/i.test(salida)) return ['firmado con la clave de depuración'];
  return [];
}

function principal(argv) {
  const [aab, jar, ...resto] = argv;
  if (!aab || !jar) {
    console.error('Uso: comprobar-aab.mjs <nivl.aab> <bundletool.jar> [--version X.Y.Z]');
    return 2;
  }
  const i = resto.indexOf('--version');
  const version = i >= 0 ? resto[i + 1] : undefined;
  const leer = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28 });

  const manifiesto = leer('java', ['-jar', jar, 'dump', 'manifest', `--bundle=${aab}`]);
  const config = leer('java', ['-jar', jar, 'dump', 'config', `--bundle=${aab}`]);
  const firma = leer('jarsigner', ['-verify', '-verbose', '-certs', aab]);
  const fallos = [...fallosManifiesto(manifiesto, { version }), ...fallosFirma(firma)];

  const permisos = (manifiesto.match(/<uses-permission(?:-sdk-23)?\b[^>]*>/g) ?? []).map((p) => {
    const tope = atributo(p, 'maxSdkVersion');
    return `  ${atributo(p, 'name')}${tope ? ` (hasta API ${tope})` : ''}`;
  });
  console.log(`Permisos del AAB:\n${permisos.join('\n')}`);
  // Google lo exige para actualizaciones desde el 01/02/2027: se avisa, no se bloquea.
  if (!/alignment/i.test(config)) console.log('::warning::El AAB no declara alineación de 16 KB en su configuración.');

  if (fallos.length) {
    for (const f of fallos) console.log(`::error::${f}`);
    return 1;
  }
  console.log('AAB correcto: firmado, sin permisos prohibidos ni servicios en primer plano.');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(principal(process.argv.slice(2)));
