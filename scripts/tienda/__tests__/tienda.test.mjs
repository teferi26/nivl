// node --test scripts/tienda/__tests__/tienda.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { esDeEstaEjecucion, faltanParaFinal, leerArgumentos, seleccionar, tamanoAdmitido } from '../tienda.mjs';
import { objetivoPorId } from '../specs.mjs';

const duo = { id: 'duo', salidas: ['iphone-duo-exterior', 'iphone-duo-interior'] };
const mac = { id: 'mac' };

test('leerArgumentos entiende todas las opciones', () => {
  assert.deepEqual(leerArgumentos(['--commit', 'abc', '--muestra', '--objetivos', 'a, b', '--sin-video']), {
    commit: 'abc', muestra: true, objetivos: ['a', 'b'], sinVideo: true, final: false,
    fuentes: {},
  });
});

test('leerArgumentos recoge las fuentes de TV y reloj', () => {
  assert.deepEqual(leerArgumentos(['--commit', 'a', '--fuente-tv', 'd3e', '--fuente-watch', 'bf4']).fuentes, { tv: 'd3e', watch: 'bf4' });
  assert.throws(() => leerArgumentos(['--commit', 'a', '--fuente-tv']), /necesita un valor/);
});

test('leerArgumentos rechaza lo que no cuadra', () => {
  assert.throws(() => leerArgumentos([]), /Falta --commit/);
  assert.throws(() => leerArgumentos(['--commit']), /necesita un valor/);
  assert.throws(() => leerArgumentos(['--commit', 'a', '--nada']), /desconocida/);
  for (const extra of [['--muestra'], ['--sin-video'], ['--objetivos', 'mac']]) {
    assert.throws(() => leerArgumentos(['--commit', 'a', '--final', ...extra]), /--final exige/);
  }
});

test('seleccionar acepta el id del objetivo y el de su salida, sin repetir', () => {
  const todos = [duo, mac];
  assert.deepEqual(seleccionar(todos, null), todos);
  assert.deepEqual(seleccionar(todos, ['iphone-duo-interior', 'duo']), [duo]);
  assert.throws(() => seleccionar(todos, ['tostadora']), /Objetivo desconocido/);
});

test('faltanParaFinal nombra las salidas sin objetivo', () => {
  assert.deepEqual(faltanParaFinal([duo], ['iphone-duo-exterior', 'mac']), ['mac']);
  assert.deepEqual(faltanParaFinal([duo, mac], ['iphone-duo-exterior', 'mac']), []);
});

test('tamanoAdmitido mira las listas de Apple', () => {
  const o = objetivoPorId('iphone-69');
  assert.equal(tamanoAdmitido(o, 1320, 2868), true);
  assert.equal(tamanoAdmitido(o, 1320, 2800), false);
  assert.equal(tamanoAdmitido(null, 1, 1), false);
});

test('la limpieza solo reconoce los clones de este pid', () => {
  assert.equal(esDeEstaEjecucion('nivl-capturas-duo-123', 123), true);
  assert.equal(esDeEstaEjecucion('nivl-capturas-video-iphone-69-123', 123), true);
  assert.equal(esDeEstaEjecucion('nivl-capturas-duo-1234', 123), false);
  assert.equal(esDeEstaEjecucion('nivl-capturas-harness', 123), false);
  assert.equal(esDeEstaEjecucion('iPhone 17 Pro-123', 123), false);
});
