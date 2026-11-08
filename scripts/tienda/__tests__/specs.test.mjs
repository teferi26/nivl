import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ASC_PREVIEW_TYPES,
  ASC_SCREENSHOT_DISPLAY_TYPES,
  FUENTES,
  IDS_OBJETIVOS,
  NO_VERIFICADO,
  objetivoPorId,
  OBJETIVOS,
  REGLAS_CAPTURAS,
  REGLAS_PREVIEW,
  VERIFICACION,
} from '../specs.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));

describe('specs', () => {
  it('tiene los tamaños ideales leídos de Apple', () => {
    const ideales = Object.fromEntries(OBJETIVOS.map((o) => [o.id, o.capturas.ideal]));
    assert.deepEqual(ideales, {
      'iphone-69': [1320, 2868],
      'iphone-63': [1206, 2622],
      'iphone-duo-exterior': [1398, 2034],
      'iphone-duo-interior': [2007, 2853],
      'ipad-13': [2064, 2752],
      mac: [2880, 1800],
      'apple-tv': [3840, 2160],
      'vision-pro': [3840, 2160],
      watch: [422, 514],
    });
  });

  it('los ids son únicos y objetivoPorId los encuentra', () => {
    assert.equal(new Set(IDS_OBJETIVOS).size, OBJETIVOS.length);
    for (const id of IDS_OBJETIVOS) assert.equal(objetivoPorId(id).id, id);
    assert.equal(objetivoPorId('nokia'), null);
  });

  it('el ideal siempre está entre los tamaños admitidos en su orientación', () => {
    for (const o of OBJETIVOS) {
      const lista = o.capturas[o.orientacion].map((t) => t.join('x'));
      assert.ok(lista.includes(o.capturas.ideal.join('x')), o.id);
    }
  });

  it('la tabla apaisada es la vertical girada donde hay ambas', () => {
    for (const o of OBJETIVOS.filter((x) => x.capturas.vertical.length && x.capturas.apaisado.length)) {
      assert.deepEqual(o.capturas.apaisado, o.capturas.vertical.map(([a, b]) => [b, a]), o.id);
    }
  });

  it('los valores de ASC asignados existen en el enum', () => {
    for (const o of OBJETIVOS) {
      const tipos = [o.asc.screenshotDisplayType, ...Object.values(o.asc.screenshotDisplayTypePorTamano ?? {})];
      for (const t of tipos.filter(Boolean)) assert.ok(ASC_SCREENSHOT_DISPLAY_TYPES.includes(t), t);
      if (o.asc.previewType) assert.ok(ASC_PREVIEW_TYPES.includes(o.asc.previewType), o.asc.previewType);
    }
  });

  it('iPhone Duo no tiene valor en la API', () => {
    assert.equal(objetivoPorId('iphone-duo-exterior').asc.screenshotDisplayType, null);
    assert.equal(objetivoPorId('iphone-duo-interior').asc.previewType, null);
    assert.ok(![...ASC_SCREENSHOT_DISPLAY_TYPES, ...ASC_PREVIEW_TYPES].some((t) => /DUO/.test(t)));
  });

  it('recoge las reglas generales', () => {
    assert.equal(REGLAS_CAPTURAS.maxPorTamano, 10);
    assert.equal(REGLAS_PREVIEW.duracionMin, 15);
    assert.equal(REGLAS_PREVIEW.duracionMax, 30);
    assert.equal(REGLAS_PREVIEW.video.nivelMax, 40);
    assert.equal(REGLAS_PREVIEW.maxPorTamano, 3);
  });

  it('deja constancia de lo no verificado con su fuente', () => {
    assert.ok(VERIFICACION.some((v) => v.estado === NO_VERIFICADO && /Duo/.test(v.tema)));
    assert.ok(VERIFICACION.some((v) => v.estado === NO_VERIFICADO && /Mac/.test(v.tema)));
    for (const v of VERIFICACION) assert.ok(Object.values(FUENTES).includes(v.fuente), v.tema);
  });

  it('no lleva guiones largos', () => {
    for (const f of ['../specs.mjs', '../validar.mjs', 'specs.test.mjs', 'validar.test.mjs']) {
      const texto = readFileSync(path.join(aqui, f), 'utf8');
      for (const raya of [0x2013, 0x2014]) assert.ok(!texto.includes(String.fromCodePoint(raya)), f);
    }
  });
});
