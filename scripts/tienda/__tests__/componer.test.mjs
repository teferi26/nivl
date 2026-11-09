import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OBJETIVOS, esReloj, maquetar } from '../plantilla/maquetas.mjs';
import { ALIAS, TEXTOS, normalizarEscena, textoDe } from '../plantilla/textos.mjs';
import { TEMA, cssTema, mezclarTema } from '../plantilla/tema.mjs';

const SALIDAS = {
  'iphone-69': [1320, 2868],
  'iphone-63': [1206, 2622],
  'duo-exterior': [1398, 2034],
  'duo-interior': [2007, 2853],
  'ipad-13': [2064, 2752],
  mac: [2880, 1800],
  'apple-tv': [3840, 2160],
  vision: [3840, 2160],
  web: [2880, 1800],
  'web-social': [1200, 630],
};

test('cada objetivo sale al tamaño exacto', () => {
  assert.deepEqual(Object.keys(OBJETIVOS).sort(), Object.keys(SALIDAS).sort());
  for (const [id, [w, h]] of Object.entries(SALIDAS)) {
    const m = maquetar(id, w, h);
    assert.equal(m.W, w, id);
    assert.equal(m.H, h, id);
  }
});

test('acepta los ids de specs.mjs', async () => {
  const { OBJETIVOS: SPECS } = await import('../specs.mjs');
  for (const o of SPECS) {
    if (esReloj(o.id)) continue;
    const [w, h] = o.capturas.ideal;
    const m = maquetar(o.id, w, h);
    assert.deepEqual([m.W, m.H], [w, h], o.id);
  }
});

test('la pantalla siempre sangra por abajo, venga la cruda que venga', () => {
  for (const id of Object.keys(OBJETIVOS)) {
    for (const [w, h] of [[1320, 2868], [2880, 1800], [1000, 1000]]) {
      const m = maquetar(id, w, h);
      assert.ok(m.marcoTop + m.marcoAlto > m.H, `${id} ${w}x${h}`);
      assert.ok(m.pantallaAlto >= m.marcoAlto, `${id} ${w}x${h}`);
    }
  }
});

test('el meandro repite un número entero de unidades', () => {
  for (const [id, [w, h]] of Object.entries(SALIDAS)) {
    const m = maquetar(id, w, h);
    assert.equal(m.meandroAncho % m.meandroUnidad, 0, id);
  }
});

test('el reloj no se compone', () => {
  assert.ok(esReloj('watch-ultra'));
  assert.ok(!esReloj('mac'));
});

test('los textos cumplen las reglas de la marca', () => {
  for (const [id, { titular, sub }] of Object.entries(TEXTOS)) {
    assert.equal(titular.length, 2, id);
    assert.equal(sub.length, 2, id);
    const todo = [...titular, ...sub].join(' ');
    assert.doesNotMatch(todo, /[—–]/, `${id}: guion largo`);
    assert.doesNotMatch(todo, /cazador|mazmorra|solo leveling/i, `${id}: vocabulario`);
    assert.doesNotMatch(todo, /€|\beuros?\b|\bgratis\b|\bmejor que\b/i, `${id}: precio o comparativa`);
    for (const l of titular) assert.notEqual(l, l.toUpperCase(), `${id}: titular en caja de frase (Ónix)`);
    for (const l of titular) assert.ok(l.length <= 18, `${id}: «${l}» demasiado largo`);
  }
});

test('la escena se reconoce con número, extensión o alias', () => {
  assert.equal(normalizarEscena('03-Coach.png'), 'coach');
  assert.equal(textoDe('01-hoy'), TEXTOS.hoy);
  for (const [alias, destino] of Object.entries(ALIAS)) assert.equal(textoDe(alias), TEXTOS[destino], alias);
  assert.throws(() => textoDe('inventada'), /No hay titular/);
});

test('el tema mezcla solo lo que cambia y llega al CSS', () => {
  const tema = mezclarTema(TEMA, { color: { titular: '#eeeeee' }, tipos: { titular: { familia: 'Otra' } }, marca: 'X' });
  assert.equal(tema.color.titular, '#eeeeee');
  assert.equal(tema.color.fondo, TEMA.color.fondo);
  assert.equal(tema.tipos.titular.peso, TEMA.tipos.titular.peso);
  assert.equal(TEMA.color.titular, '#f5f2ec', 'no muta el tema base');
  const css = cssTema(tema);
  assert.match(css, /--colorTitular:#eeeeee/);
  assert.match(css, /--titularFamilia:'Otra'/);
});

test('el tema base usa solo colores de Ónix', () => {
  const permitidos = ['#09090b', '#2a2a2c', '#4a494c', '#c9a961', '#f5f2ec', '#b8b4ab'];
  for (const [clave, valor] of Object.entries(TEMA.color)) {
    if (clave === 'degradado' || clave === 'velo') continue;
    assert.ok(permitidos.includes(valor), `${clave}: ${valor}`);
  }
  assert.equal(TEMA.motivos.arcos, false);
  assert.equal(TEMA.motivos.meandro, false);
});
