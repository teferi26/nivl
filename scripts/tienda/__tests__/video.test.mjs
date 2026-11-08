import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { IDS_OBJETIVOS } from '../specs.mjs';
import {
  convertirLargo,
  convertirPreview,
  DISPOSITIVOS,
  duracionPreview,
  filtroVideo,
  recorteCentrado,
  SIN_VIDEO,
  tamanoLargo,
  videoDisponible,
} from '../video.mjs';

test('recorte de iPhone 6,9: pierde lo mínimo y centrado', () => {
  assert.deepEqual(recorteCentrado(1320, 2868, 886, 1920), { w: 1320, h: 2860, x: 0, y: 4 });
});

test('recorte de iPad 13: la relación ya casa, no recorta', () => {
  assert.deepEqual(recorteCentrado(2064, 2752, 1200, 1600), { w: 2064, h: 2752, x: 0, y: 0 });
});

test('recorte cuando el origen es más ancho que el destino: quita de los lados', () => {
  assert.deepEqual(recorteCentrado(1000, 1000, 500, 1000), { w: 500, h: 1000, x: 250, y: 0 });
});

test('el recorte nunca desborda y siempre es par', () => {
  for (const [a, b] of [[1320, 2868], [1206, 2622], [2064, 2752], [1179, 2556], [1401, 2777]]) {
    for (const [c, d] of [[886, 1920], [1200, 1600]]) {
      const r = recorteCentrado(a, b, c, d);
      assert.ok(r.x + r.w <= a && r.y + r.h <= b, `${a}x${b} a ${c}x${d}`);
      for (const n of [r.w, r.h, r.x, r.y]) assert.equal(n % 2, 0);
    }
  }
});

test('largo: lado corto a 1080 sin deformar', () => {
  assert.deepEqual(tamanoLargo(1320, 2868), [1080, 2346]);
  assert.deepEqual(tamanoLargo(2064, 2752), [1080, 1440]);
  assert.deepEqual(tamanoLargo(1920, 886), [2340, 1080]);
});

test('duración dentro de los límites de Apple', () => {
  assert.equal(duracionPreview(27), 27);
  assert.equal(duracionPreview(45), 29.5);
  assert.equal(duracionPreview(3), 15);
});

test('el filtro fija 30 fps antes de recortar el principio y rellena el final', () => {
  const f = filtroVideo({ ancho: 1320, alto: 2868, destino: [886, 1920] });
  assert.match(f, /^fps=30:start_time=0,trim=start=0\.4,/);
  assert.match(f, /tpad=stop=-1:stop_mode=clone/);
  assert.match(f, /crop=1320:2860:0:4,scale=886:1920/);
  assert.match(f, /format=yuv420p$/);
});

test('todo objetivo de specs tiene dispositivo o motivo escrito', () => {
  for (const id of IDS_OBJETIVOS) {
    const d = videoDisponible(id);
    assert.ok(d.ok || d.motivo, id);
    assert.ok(Boolean(DISPOSITIVOS[id]) !== Boolean(SIN_VIDEO[id]), id);
  }
  assert.equal(videoDisponible('nada').ok, false);
});

test('una grabación de velocidad variable sale como App Preview válido', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-test-'));
  try {
    const cruda = path.join(dir, 'cruda.mov');
    // Velocidad variable y 16 s de contenido quieto: lo que peor se lleva con la tasa fija.
    execFileSync('ffmpeg', [
      '-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=gray:s=1320x2868:r=60:d=4',
      '-vf', "select='lt(t,1)+gt(t,3)'", '-fps_mode', 'vfr',
      '-c:v', 'libx264', '-preset', 'ultrafast', cruda,
    ]);
    const preview = path.join(dir, 'preview.mp4');
    const r = await convertirPreview({ cruda, destino: preview, objetivo: 'iphone-69', segundos: 16.4 });
    assert.equal(r.ancho, 886);
    assert.equal(r.alto, 1920);
    assert.ok(Math.abs(r.duracion - 16) < 0.1, `duración ${r.duracion}`);

    const largo = path.join(dir, 'largo.mp4');
    const l = await convertirLargo({ cruda, destino: largo, segundos: 6.4 });
    assert.equal(l.ancho, 1080);
    assert.equal(l.alto, 2346);
    assert.ok(Math.abs(l.duracion - 6) < 0.1, `duración ${l.duracion}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
