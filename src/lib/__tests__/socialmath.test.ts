import { describe, expect, test } from '@jest/globals';
import {
  clasificar,
  codigoLegible,
  codigoValido,
  errorDeCodigo,
  etiquetaPosicion,
  formatoValor,
  lineaRivalidad,
  mensajeInvitacion,
  misionesParaAdelantar,
  normalizarCodigo,
  posicionEntreAmigos,
  quienVaDelante,
  type Competidor,
} from '../socialmath';

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

describe('clasificar', () => {
  test('ordena de más a menos por la métrica elegida', () => {
    const lista = [
      c({ userId: 'a', xpWindow: 100, streakDays: 9, compliancePct: 50 }),
      c({ userId: 'b', xpWindow: 300, streakDays: 1, compliancePct: 90 }),
      c({ userId: 'c', xpWindow: 200, streakDays: 4, compliancePct: 70 }),
    ];
    expect(clasificar(lista, 'xp').map((x) => x.competidor.userId)).toEqual(['b', 'c', 'a']);
    expect(clasificar(lista, 'racha').map((x) => x.competidor.userId)).toEqual(['a', 'c', 'b']);
    expect(clasificar(lista, 'cumplimiento').map((x) => x.competidor.userId)).toEqual(['b', 'c', 'a']);
  });

  test('no muta la lista que recibe', () => {
    const lista = [c({ userId: 'a', xpWindow: 1 }), c({ userId: 'b', xpWindow: 2 })];
    clasificar(lista, 'xp');
    expect(lista.map((x) => x.userId)).toEqual(['a', 'b']);
  });

  test('sin dato va al final aunque el resto tenga un 0 %', () => {
    const lista = [
      c({ userId: 'sinplan', compliancePct: null, xpWindow: 900 }),
      c({ userId: 'cero', compliancePct: 0 }),
      c({ userId: 'bien', compliancePct: 80 }),
    ];
    const orden = clasificar(lista, 'cumplimiento');
    expect(orden.map((x) => x.competidor.userId)).toEqual(['bien', 'cero', 'sinplan']);
    expect(orden[2]!.valor).toBeNull();
  });

  test('con el mismo valor se comparte puesto y el siguiente salta (1, 2, 2, 4)', () => {
    const lista = [
      c({ userId: 'a', xpWindow: 500 }),
      c({ userId: 'b', xpWindow: 200 }),
      c({ userId: 'c', xpWindow: 200 }),
      c({ userId: 'd', xpWindow: 50 }),
    ];
    expect(clasificar(lista, 'xp').map((x) => x.posicion)).toEqual([1, 2, 2, 4]);
  });

  test('el desempate de XP mira cumplimiento, luego racha, luego XP total', () => {
    const lista = [
      c({ userId: 'a', xpWindow: 100, compliancePct: 60, streakDays: 9 }),
      c({ userId: 'b', xpWindow: 100, compliancePct: 80, streakDays: 1 }),
      c({ userId: 'c', xpWindow: 100, compliancePct: 80, streakDays: 5 }),
    ];
    expect(clasificar(lista, 'xp').map((x) => x.competidor.userId)).toEqual(['c', 'b', 'a']);
  });

  test('en cumplimiento, un 100 % de muchas misiones va delante de un 100 % de pocas', () => {
    const lista = [
      c({ userId: 'pocas', compliancePct: 100, completed: 3 }),
      c({ userId: 'muchas', compliancePct: 100, completed: 40 }),
    ];
    expect(clasificar(lista, 'cumplimiento')[0]!.competidor.userId).toBe('muchas');
  });

  test('el empate absoluto es estable: decide el nombre, venga como venga la lista', () => {
    const a = c({ userId: '1', name: 'Zoe', xpWindow: 10 });
    const b = c({ userId: '2', name: 'Ana', xpWindow: 10 });
    expect(clasificar([a, b], 'xp').map((x) => x.competidor.name)).toEqual(['Ana', 'Zoe']);
    expect(clasificar([b, a], 'xp').map((x) => x.competidor.name)).toEqual(['Ana', 'Zoe']);
  });
});

describe('etiquetas', () => {
  test('ordinal español', () => {
    expect(etiquetaPosicion(1)).toBe('1.º');
    expect(etiquetaPosicion(12)).toBe('12.º');
    expect(etiquetaPosicion(0)).toBe('1.º');
  });

  test('formato del valor por métrica', () => {
    expect(formatoValor(120, 'xp')).toBe('120 XP');
    expect(formatoValor(86, 'cumplimiento')).toBe('86 %');
    expect(formatoValor(1, 'racha')).toBe('1 día');
    expect(formatoValor(14, 'racha')).toBe('14 días');
    expect(formatoValor(null, 'cumplimiento')).toBe('—');
  });

  test('posición entre amigos: solo si hay alguien más y se me puede medir', () => {
    const yo = c({ userId: 'yo', isMe: true, xpWindow: 50 });
    expect(posicionEntreAmigos(clasificar([yo], 'xp'))).toBeNull();
    const otros = [yo, c({ userId: 'a', xpWindow: 90 }), c({ userId: 'b', xpWindow: 10 })];
    expect(posicionEntreAmigos(clasificar(otros, 'xp'))).toBe('2.º de 3');
    expect(posicionEntreAmigos(clasificar(otros, 'cumplimiento'))).toBeNull();
  });
});

describe('quienVaDelante', () => {
  const marta = c({ userId: 'm', name: 'Marta Ruiz', xpWindow: 420, compliancePct: 90, streakDays: 12 });
  const luis = c({ userId: 'l', name: 'Luis', xpWindow: 900, compliancePct: 95, streakDays: 30 });

  test('sin amigos no hay rival', () => {
    const yo = c({ userId: 'yo', isMe: true, xpWindow: 10 });
    expect(quienVaDelante(clasificar([yo], 'xp')).tipo).toBe('solo');
  });

  test('el rival es el inmediatamente superior, no el líder', () => {
    const yo = c({ userId: 'yo', isMe: true, xpWindow: 300 });
    const r = quienVaDelante(clasificar([yo, marta, luis], 'xp'));
    expect(r).toMatchObject({ tipo: 'persigue', diferencia: 120 });
    expect(r.tipo === 'persigue' && r.rival.userId).toBe('m');
  });

  test('si lidero, el rival es el segundo y la diferencia mi ventaja', () => {
    const yo = c({ userId: 'yo', isMe: true, xpWindow: 1000 });
    const r = quienVaDelante(clasificar([yo, marta, luis], 'xp'));
    expect(r).toMatchObject({ tipo: 'lider', diferencia: 100 });
    expect(r.tipo === 'lider' && r.rival.userId).toBe('l');
  });

  test('mismo valor es empate, vaya quien vaya pintado antes', () => {
    const yo = c({ userId: 'yo', isMe: true, xpWindow: 420 });
    expect(quienVaDelante(clasificar([yo, marta], 'xp')).tipo).toBe('empate');
  });

  test('sin misiones programadas no se me puede medir en cumplimiento', () => {
    const yo = c({ userId: 'yo', isMe: true, compliancePct: null });
    expect(quienVaDelante(clasificar([yo, marta], 'cumplimiento')).tipo).toBe('sin_dato');
  });

  test('si nadie más tiene dato, estoy solo en esa métrica', () => {
    const yo = c({ userId: 'yo', isMe: true, compliancePct: 70 });
    const otro = c({ userId: 'o', compliancePct: null });
    expect(quienVaDelante(clasificar([yo, otro], 'cumplimiento')).tipo).toBe('solo');
  });
});

describe('lineaRivalidad', () => {
  const marta = c({ userId: 'm', name: 'Marta Ruiz', xpWindow: 420, compliancePct: 90, streakDays: 12 });

  test('misiones difíciles para adelantar: hay que superar, no igualar', () => {
    expect(misionesParaAdelantar(120)).toBe(2);
    expect(misionesParaAdelantar(100)).toBe(2);
    expect(misionesParaAdelantar(99)).toBe(1);
    expect(misionesParaAdelantar(0)).toBe(1);
  });

  test('persiguiendo en XP: nombre corto, diferencia y camino', () => {
    const yo = c({ userId: 'yo', isMe: true, xpWindow: 300 });
    expect(lineaRivalidad(clasificar([yo, marta], 'xp'), 'xp', 'semana')).toBe(
      'Marta te saca 120 XP esta semana. Dos misiones difíciles y pasas delante.',
    );
  });

  test('una distancia enorme no promete un atajo', () => {
    const yo = c({ userId: 'yo', isMe: true, xpWindow: 0 });
    const lejos = c({ userId: 'x', name: 'Iker', xpWindow: 5000 });
    const linea = lineaRivalidad(clasificar([yo, lejos], 'xp'), 'xp', 'mes');
    expect(linea).toContain('este mes');
    expect(linea).toContain('día a día');
  });

  test('liderando, empatando y a solas', () => {
    const lider = c({ userId: 'yo', isMe: true, xpWindow: 500 });
    expect(lineaRivalidad(clasificar([lider, marta], 'xp'), 'xp', 'semana')).toBe(
      'Lideras esta semana. Marta te sigue a 80 XP.',
    );
    const igual = c({ userId: 'yo', isMe: true, streakDays: 12 });
    expect(lineaRivalidad(clasificar([igual, marta], 'racha'), 'racha', 'semana')).toContain('misma racha');
    expect(lineaRivalidad(clasificar([lider], 'xp'), 'xp', 'semana')).toContain('Invita');
  });

  test('cumplimiento y racha hablan en sus unidades', () => {
    const yo = c({ userId: 'yo', isMe: true, compliancePct: 82, streakDays: 7 });
    expect(lineaRivalidad(clasificar([yo, marta], 'cumplimiento'), 'cumplimiento', 'mes')).toContain('8 puntos');
    expect(lineaRivalidad(clasificar([yo, marta], 'racha'), 'racha', 'semana')).toContain('5 días');
  });

  test('un nombre vacío no rompe la frase', () => {
    const yo = c({ userId: 'yo', isMe: true, xpWindow: 0 });
    const sinNombre = c({ userId: 'x', name: '   ', xpWindow: 50 });
    expect(lineaRivalidad(clasificar([yo, sinNombre], 'xp'), 'xp', 'semana')).toMatch(/^Tu rival te saca 50 XP/);
  });
});

describe('código de amigo', () => {
  test('normaliza lo que llega pegado de un mensaje', () => {
    expect(normalizarCodigo(' abcd-2345 ')).toBe('ABCD2345');
    expect(normalizarCodigo('abcd 2345 · extra')).toBe('ABCD2345');
  });

  test('valida largo y alfabeto (sin 0, 1, O, I)', () => {
    expect(codigoValido('ABCD2345')).toBe(true);
    expect(codigoValido('ABCD234')).toBe(false);
    expect(codigoValido('ABCD2340')).toBe(false);
    expect(codigoValido('ABCDI345')).toBe(false);
  });

  test('explica por qué no vale sin gastar un intento del servidor', () => {
    expect(errorDeCodigo('ABC')).toContain('Faltan 5');
    expect(errorDeCodigo('ABCD2O45')).toContain('no usan');
    expect(errorDeCodigo('abcd2345', 'ABCD2345')).toContain('es el tuyo');
    expect(errorDeCodigo('abcd-2345', 'ZZZZ9999')).toBeNull();
  });

  test('legible en dos bloques y mensaje de invitación con el código íntegro', () => {
    expect(codigoLegible('ABCD2345')).toBe('ABCD 2345');
    expect(codigoLegible('ABC')).toBe('ABC');
    expect(mensajeInvitacion('ABCD2345')).toBe(
      'Mídete conmigo en NIVL. Mi código: ABCD2345 · https://nivl.app',
    );
  });
});
