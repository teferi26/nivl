import { describe, expect, test } from '@jest/globals';
import {
  conInsignias,
  estadoLudus,
  LUDUS_MAX,
  LUDUS_MIN,
  lineaLudus,
  llevaInsignia,
  mensajeLudus,
  NOTA_LUDUS_MAX,
  normalizarNota,
  OBJETIVOS_LUDUS,
  parseMiLudus,
  puedeLudus,
  SIN_LUDUS,
  type MiLudus,
} from '../elite';
import { enabled, FEATURES } from '../features';
import { PROFILE_KINDS } from '../kinds';
import { clasificar, type Competidor } from '../socialmath';

function c(partial: Partial<Competidor> & { userId: string }): Competidor {
  return {
    name: partial.userId,
    isMe: false,
    xpWindow: 0,
    compliancePct: null,
    completed: 0,
    streakDays: 0,
    xpTotal: 0,
    ...partial,
  };
}

const miembro: MiLudus = {
  eligible: true,
  group: { name: 'Ludus Capua', goal: 'deportista', capacity: 8, members: 6 },
  requested: false,
  requestedGoal: null,
};

describe('Élite · quién entra en un ludus', () => {
  test('solo Élite y dueño', () => {
    expect(puedeLudus('elite')).toBe(true);
    expect(puedeLudus('owner')).toBe(true);
    expect(puedeLudus('pro')).toBe(false);
    expect(puedeLudus('free')).toBe(false);
    expect(puedeLudus(null)).toBe(false);
  });

  test('estado: fuera, miembro, pedido, libre', () => {
    expect(estadoLudus('pro', miembro)).toBe('fuera');
    // El cliente cree que es Élite pero el servidor dice que no: fuera.
    expect(estadoLudus('elite', { ...miembro, eligible: false })).toBe('fuera');
    expect(estadoLudus('elite', null)).toBe('fuera');
    expect(estadoLudus('elite', miembro)).toBe('miembro');
    expect(estadoLudus('elite', { ...miembro, group: null, requested: true })).toBe('pedido');
    expect(estadoLudus('owner', { ...miembro, group: null })).toBe('libre');
  });

  test('los objetivos son los cinco perfiles de uso', () => {
    expect([...OBJETIVOS_LUDUS]).toEqual([...PROFILE_KINDS]);
    expect(OBJETIVOS_LUDUS.length).toBe(5);
  });

  test('capacidad de 5 a 8, como el CHECK de la 0026', () => {
    expect(LUDUS_MIN).toBe(5);
    expect(LUDUS_MAX).toBe(8);
  });
});

describe('Élite · lo que llega del servidor', () => {
  test('una respuesta vacía o rota es "sin ludus"', () => {
    expect(parseMiLudus(null)).toEqual(SIN_LUDUS);
    expect(parseMiLudus('x')).toEqual(SIN_LUDUS);
    expect(parseMiLudus({})).toEqual(SIN_LUDUS);
  });

  test('un ludus bien formado', () => {
    expect(
      parseMiLudus({
        eligible: true,
        group: { name: ' Ludus Capua ', goal: 'deportista', capacity: 6, members: 4 },
        requested: false,
        requested_goal: null,
      }),
    ).toEqual({
      eligible: true,
      group: { name: 'Ludus Capua', goal: 'deportista', capacity: 6, members: 4 },
      requested: false,
      requestedGoal: null,
    });
  });

  test('objetivo desconocido cae en general; capacidad fuera de rango se acota', () => {
    const r = parseMiLudus({ eligible: true, group: { name: '', goal: 'cazador', capacity: 40, members: -3 } });
    expect(r.group).toEqual({ name: 'Tu ludus', goal: 'general', capacity: 8, members: 0 });
    expect(parseMiLudus({ eligible: true, group: { goal: 'general', capacity: 2 } }).group?.capacity).toBe(5);
  });

  test('la petición guarda su objetivo', () => {
    const r = parseMiLudus({ eligible: true, group: null, requested: true, requested_goal: 'estudiante' });
    expect(r.requested).toBe(true);
    expect(r.requestedGoal).toBe('estudiante');
  });
});

describe('Élite · textos', () => {
  test('la nota se limpia y se corta en 280', () => {
    expect(normalizarNota('  entreno   de\nfuerza  ')).toBe('entreno de fuerza');
    expect(normalizarNota('a'.repeat(400)).length).toBe(NOTA_LUDUS_MAX);
  });

  test('línea del ludus', () => {
    expect(lineaLudus(miembro.group!)).toBe('Deportista · 6 de 8 gladiadores');
    expect(lineaLudus({ ...miembro.group!, members: 1 })).toBe('Deportista · 1 de 8 gladiador');
  });

  test('cada motivo tiene su frase, sin exclamaciones ni "escuadra"', () => {
    for (const m of ['no_elite', 'objetivo_invalido', 'ya_en_ludus', 'otro', null]) {
      const t = mensajeLudus(m);
      expect(t.length).toBeGreaterThan(0);
      expect(t).not.toMatch(/!|escuadra/i);
    }
  });
});

describe('Élite · la insignia es estética', () => {
  test('la insignia no mueve el ranking', () => {
    const lista = [
      c({ userId: 'a', xpWindow: 300, compliancePct: 80 }),
      c({ userId: 'b', xpWindow: 500, compliancePct: 60 }),
      c({ userId: 'c', xpWindow: 300, compliancePct: 90 }),
    ];
    // Cualquier combinación de insignias: el orden, los puestos y los valores
    // son los del ranking sin ellas.
    for (const insignias of [new Set<string>(), new Set(['a']), new Set(['c']), new Set(['a', 'b', 'c'])]) {
      for (const metrica of ['xp', 'cumplimiento', 'racha'] as const) {
        const base = clasificar(lista, metrica);
        const con = conInsignias(base, insignias);
        expect(con.map((x) => [x.competidor.userId, x.posicion, x.valor])).toEqual(
          base.map((x) => [x.competidor.userId, x.posicion, x.valor]),
        );
        expect(con.map((x) => x.insignia)).toEqual(base.map((x) => insignias.has(x.competidor.userId)));
      }
    }
    const insignias = new Set(['a']);
    expect(llevaInsignia(insignias, 'a')).toBe(true);
    expect(llevaInsignia(insignias, 'b')).toBe(false);
  });
});

describe('Acceso anticipado', () => {
  const flags = { oraculo_2: { minTier: 'elite' as const, note: 'prueba' } };

  test('una clave fuera de la lista está abierta a todos', () => {
    expect(enabled('lo_que_sea', 'free', flags)).toBe(true);
  });

  test('por nivel: owner ≥ élite > pro > gratis', () => {
    expect(enabled('oraculo_2', 'elite', flags)).toBe(true);
    expect(enabled('oraculo_2', 'owner', flags)).toBe(true);
    expect(enabled('oraculo_2', 'pro', flags)).toBe(false);
    expect(enabled('oraculo_2', 'free', flags)).toBe(false);
    expect(enabled('oraculo_2', null, flags)).toBe(false);
  });

  test('hoy no hay nada en acceso anticipado', () => {
    expect(Object.keys(FEATURES)).toEqual([]);
  });
});
