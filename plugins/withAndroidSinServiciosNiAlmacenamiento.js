// NIVL · Android: lo que las librerías declaran y NIVL no usa (P11 y P12).
//
// `blockedPermissions` (app.json) solo quita permisos. Esto cubre lo que allí
// no se puede expresar, en el manifiesto de la app (el que manda al fusionar):
//
//  1. Servicios en primer plano de expo-audio. NIVL solo reproduce sonidos
//     cortos en primer plano: nunca usa `setActiveForLockScreen` ni graba con
//     expo-audio (el dictado va por expo-speech-recognition). Sin esto, el
//     manifiesto final seguiría declarando dos servicios con
//     `foregroundServiceType` aunque se hayan quitado sus permisos.
//  2. Almacenamiento heredado, con tope. Expo y varias librerías lo piden sin
//     límite. expo-image-picker necesita WRITE_EXTERNAL_STORAGE para la cámara
//     solo por debajo de Android 10 (API 29), así que no se puede bloquear del
//     todo sin romper la cámara en Android 7 a 9 (minSdk 24).
//
// Comprobado después de compilar por `scripts/ci/comprobar-aab.mjs`.

const { withAndroidManifest } = require('expo/config-plugins');

const AUDIO = 'expo.modules.audio.service';
const SERVICIOS = [`${AUDIO}.AudioControlsService`, `${AUDIO}.AudioRecordingService`];

const TOPES = {
  'android.permission.READ_EXTERNAL_STORAGE': '32',
  'android.permission.WRITE_EXTERNAL_STORAGE': '28',
};

function aplicarTopes(manifest) {
  const permisos = manifest['uses-permission'] ?? [];
  for (const [nombre, tope] of Object.entries(TOPES)) {
    const atributos = {
      'android:name': nombre,
      'android:maxSdkVersion': tope,
      // Sin esto, una librería que lo pida sin tope gana al fusionar.
      'tools:replace': 'android:maxSdkVersion',
    };
    const existente = permisos.find((p) => p.$['android:name'] === nombre);
    if (existente) existente.$ = atributos;
    else permisos.push({ $: atributos });
  }
  manifest['uses-permission'] = permisos;
}

function quitarServicios(manifest) {
  const app = manifest.application?.[0];
  if (!app) throw new Error('withAndroidSinServiciosNiAlmacenamiento: manifiesto sin <application>');
  const servicios = app.service ?? [];
  for (const nombre of SERVICIOS) {
    if (servicios.some((s) => s.$['android:name'] === nombre)) continue;
    servicios.push({ $: { 'android:name': nombre, 'tools:node': 'remove' } });
  }
  app.service = servicios;
}

module.exports = function withAndroidSinServiciosNiAlmacenamiento(config) {
  return withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    aplicarTopes(manifest);
    quitarServicios(manifest);
    return c;
  });
};
