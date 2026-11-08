import { readFileSync } from 'fs';
import { join } from 'path';
import { coachEnPausa, DIAS_PARA_PAUSA, diasSinResponder } from '../coachpausa';
import { objetivosDePausa } from '../coachpausaObjetivos';

const MADRID = 'Europe/Madrid';

test('el espejo Deno es idéntico y el módulo no importa nada', () => {
  const raiz = join(__dirname, '..', '..', '..');
  const app = readFileSync(join(raiz, 'src/lib/coachpausa.ts'), 'utf8');
  const deno = readFileSync(join(raiz, 'supabase/functions/_shared/coachpausa.ts'), 'utf8');
  expect(deno).toBe(app);
  expect(app).not.toMatch(/^import /m);
});

test('el límite son 3 días', () => expect(DIAS_PARA_PAUSA).toBe(3));

describe('justo en el límite', () => {
  const ultima = '2026-10-05T07:00:00Z'; // lunes 09:00 en Madrid
  test('un segundo antes de los 3 días, activo', () => {
    const ahora = new Date('2026-10-08T06:59:59Z');
    expect(diasSinResponder(ultima, ahora, MADRID)).toBe(2);
    expect(coachEnPausa(ultima, ahora, MADRID)).toBe(false);
  });
  test('a los 3 días exactos, en pausa', () => {
    const ahora = new Date('2026-10-08T07:00:00Z');
    expect(diasSinResponder(ultima, ahora, MADRID)).toBe(3);
    expect(coachEnPausa(ultima, ahora, MADRID)).toBe(true);
  });
  test('cruzar tres medianoches no basta si no han pasado tres días', () => {
    const noche = '2026-10-05T21:00:00Z'; // lunes 23:00 en Madrid
    expect(coachEnPausa(noche, new Date('2026-10-07T22:30:00Z'), MADRID)).toBe(false); // jueves 00:30
  });
});

describe('cambio de hora', () => {
  test('otoño (el domingo dura 25 h): 3 días son 73 h', () => {
    const ultima = '2026-10-24T07:00:00Z'; // sábado 09:00 CEST
    expect(coachEnPausa(ultima, new Date('2026-10-27T07:59:59Z'), MADRID)).toBe(false);
    expect(coachEnPausa(ultima, new Date('2026-10-27T08:00:00Z'), MADRID)).toBe(true); // martes 09:00 CET
  });
  test('primavera (el domingo dura 23 h): 3 días son 71 h', () => {
    const ultima = '2026-03-28T08:00:00Z'; // sábado 09:00 CET
    expect(coachEnPausa(ultima, new Date('2026-03-31T06:59:59Z'), MADRID)).toBe(false);
    expect(coachEnPausa(ultima, new Date('2026-03-31T07:00:00Z'), MADRID)).toBe(true); // martes 09:00 CEST
  });
});

describe('zona horaria', () => {
  test('el mismo par de instantes depende de la zona del usuario', () => {
    // Madrid cambia de hora en medio y Tokio no.
    const ultima = '2026-10-24T07:00:00Z';
    const ahora = new Date('2026-10-27T07:30:00Z');
    expect(diasSinResponder(ultima, ahora, MADRID)).toBe(2);
    expect(diasSinResponder(ultima, ahora, 'Asia/Tokyo')).toBe(3);
  });
  test('una zona inválida cuenta por horas y no rompe', () => {
    const ultima = '2026-10-05T07:00:00Z';
    expect(coachEnPausa(ultima, new Date('2026-10-08T06:59:59Z'), 'Marte/Olympus')).toBe(false);
    expect(coachEnPausa(ultima, new Date('2026-10-08T07:00:00Z'), 'Marte/Olympus')).toBe(true);
  });
  test('sin zona, UTC', () => {
    expect(diasSinResponder('2026-10-05T07:00:00Z', new Date('2026-10-09T07:00:00Z'), null)).toBe(4);
  });
});

describe('sin dato', () => {
  const ahora = new Date('2026-10-08T07:00:00Z');
  test.each([[null], [undefined], [''], ['no es una fecha']])('%p: activo', (v) => {
    expect(diasSinResponder(v, ahora, MADRID)).toBe(0);
    expect(coachEnPausa(v, ahora, MADRID)).toBe(false);
  });
  test('una fecha futura (reloj desfasado): activo', () => {
    expect(coachEnPausa('2026-10-30T07:00:00Z', ahora, MADRID)).toBe(false);
  });
});

describe('objetivosDePausa', () => {
  test('goals primero, luego el objetivo del onboarding, sin repetir', () => {
    expect(
      objetivosDePausa(
        [{ title: 'Correr 10 km' }, { title: '  Ahorrar  3000 ' }],
        [{ payload: { goal: 'correr 10 KM' } }, { payload: { goal: 'Aprobar' } }],
      ),
    ).toEqual(['Correr 10 km', 'Ahorrar 3000', 'Aprobar']);
  });
  test('sin objetivos o con datos raros, lista vacía', () => {
    expect(objetivosDePausa([], [])).toEqual([]);
    expect(objetivosDePausa([{ title: 7 }], [{ payload: null }, {}])).toEqual([]);
  });
  test('como mucho cinco', () => {
    const muchos = Array.from({ length: 9 }, (_, i) => ({ title: `Objetivo ${i}` }));
    expect(objetivosDePausa(muchos, [])).toHaveLength(5);
  });
});
