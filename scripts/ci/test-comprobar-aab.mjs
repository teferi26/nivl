#!/usr/bin/env node
// Pruebas de scripts/ci/comprobar-aab.mjs: node scripts/ci/test-comprobar-aab.mjs

import assert from 'node:assert/strict';
import { fallosFirma, fallosManifiesto } from './comprobar-aab.mjs';

const manifiesto = (cuerpo, sdk = 36) => `<manifest package="com.teferi.nivl" android:versionName="1.1.0">
  <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="${sdk}"/>
  ${cuerpo}
</manifest>`;

const limpio = manifiesto(`
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:maxSdkVersion="28" android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
  <uses-permission android:maxSdkVersion="32" android:name="android.permission.READ_EXTERNAL_STORAGE"/>
  <service android:name="expo.modules.notifications.service.ExpoFirebaseMessagingService" android:exported="false"/>`);

assert.deepEqual(fallosManifiesto(limpio, { version: '1.1.0' }), []);

for (const [cuerpo, esperado] of [
  ['<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>', /SYSTEM_ALERT_WINDOW/],
  ['<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>', /FOREGROUND_SERVICE/],
  ['<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE"/>', /MICROPHONE/],
  ['<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>', /LOCATION/],
  ['<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>', /sin tope/],
  ['<uses-permission android:maxSdkVersion="33" android:name="android.permission.READ_EXTERNAL_STORAGE"/>', /sin tope/],
  ['<service android:foregroundServiceType="microphone" android:name="x.Y"/>', /primer plano: x\.Y/],
]) {
  const fallos = fallosManifiesto(manifiesto(cuerpo));
  assert.equal(fallos.length, 1, cuerpo);
  assert.match(fallos[0], esperado);
}

assert.match(fallosManifiesto(manifiesto('', 35))[0], /targetSdkVersion 35/);
assert.match(fallosManifiesto(manifiesto(''), { version: '1.2.0' })[0], /versionName 1\.1\.0/);

assert.deepEqual(fallosFirma('jar verified.\n  X.509, CN=NIVL, OU=Upload'), []);
assert.match(fallosFirma('jar is unsigned.')[0], /no está firmado/);
assert.match(fallosFirma('jar verified.\n  X.509, CN=Android Debug, O=Android')[0], /depuración/);

console.log('comprobar-aab: todo correcto');
