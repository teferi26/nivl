// Orden del dueño (02/10/2026): ningún texto de la IA lleva «—» ni «–».
import { assertEquals } from 'jsr:@std/assert@1';
import { FiltroGuiones, sinGuiones, sinGuionesProfundo, tieneGuiones } from './singuiones.ts';

const CASOS: [string, string][] = [
  ['Hoy toca pierna — y nada de excusas.', 'Hoy toca pierna, y nada de excusas.'],
  ['Hoy toca pierna—y nada de excusas.', 'Hoy toca pierna, y nada de excusas.'],
  ['Sentadilla 8–12 repeticiones.', 'Sentadilla 8-12 repeticiones.'],
  ['Ganaste 3 — 1 el duelo.', 'Ganaste 3-1 el duelo.'],
  ['De 07:00–09:00 trabajo profundo.', 'De 07:00-09:00 trabajo profundo.'],
  ['— Primera orden\n— Segunda orden', '- Primera orden\n- Segunda orden'],
  ['Hoy — pierna, cardio y diario.', 'Hoy: pierna, cardio y diario.'],
  ['El plan de hoy —\n1. Pierna', 'El plan de hoy:\n1. Pierna'],
  ['Cumpliste la misión —', 'Cumpliste la misión'],
  ['La racha — que llevas 12 días cuidando — se mantiene.', 'La racha, que llevas 12 días cuidando, se mantiene.'],
  ['Bien — .', 'Bien.'],
  ['Sin guiones aquí.', 'Sin guiones aquí.'],
];

Deno.test('sinGuiones: inicio, medio y final, rangos, viñetas y etiquetas', () => {
  for (const [entrada, esperado] of CASOS) {
    const salida = sinGuiones(entrada);
    assertEquals(salida, esperado, entrada);
    assertEquals(tieneGuiones(salida), false, entrada);
  }
});

Deno.test('sinGuiones: nunca deja U+2014/U+2013 ni dobles espacios ni comas dobles', () => {
  const raros = ['——', '— — —', 'a—— b', '–', 'x –– y –', '\n—\n–\n', 'uno — , dos', '(— nota —)'];
  for (const r of raros) {
    const s = sinGuiones(r);
    assertEquals(tieneGuiones(s), false, JSON.stringify(r));
    assertEquals(/ {2,}/.test(s), false, JSON.stringify(s));
    assertEquals(/,\s*,/.test(s), false, JSON.stringify(s));
  }
});

Deno.test('Streaming: un guion partido entre fragmentos sale igual que saneando el texto entero', () => {
  const textos = [
    'Hoy toca pierna — y nada de excusas.\nSentadilla 8–12.\n— Primera\nFin —',
    'La racha — que llevas 12 días — sigue.\nDe 07:00–09:00.',
  ];
  for (const texto of textos) {
    for (let paso = 1; paso <= 5; paso++) {
      const f = new FiltroGuiones();
      let out = '';
      for (let i = 0; i < texto.length; i += paso) out += f.push(texto.slice(i, i + paso));
      out += f.fin();
      assertEquals(out, sinGuiones(texto), `paso ${paso}`);
      assertEquals(tieneGuiones(out), false);
    }
  }
});

Deno.test('Streaming: el guion justo en el borde de dos deltas', () => {
  const f = new FiltroGuiones();
  const out = f.push('Hoy toca pierna ') + f.push('—') + f.push(' y nada de excusas.') + f.fin();
  assertEquals(out, 'Hoy toca pierna, y nada de excusas.');
});

Deno.test('sinGuionesProfundo: entradas de herramientas (títulos, planes, diario)', () => {
  const v = sinGuionesProfundo({ titulo: 'Pierna — fuerza', bloques: [{ nota: '8–12 reps' }], n: 3, ok: true });
  assertEquals(v, { titulo: 'Pierna: fuerza', bloques: [{ nota: '8-12 reps' }], n: 3, ok: true });
});
