import { describe, expect, test } from '@jest/globals';
import type { EntrenoMedido } from '../entrenoMedido';
import { elegirEntre, filtrarNuevos, mismoEntreno } from '../medicion/fusion';

const min = (m: number) => new Date(Date.UTC(2026, 2, 10, 10, m)).toISOString();

function entreno(parte: Partial<EntrenoMedido> & { externo_id: string }): EntrenoMedido {
  return {
    origen: 'watch',
    deporte: 'carrera',
    inicio: min(0),
    fin: min(30),
    duracion_s: 1800,
    distancia_m: null,
    kcal: null,
    fc_media: null,
    fc_max: null,
    desnivel_m: null,
    ruta: null,
    parciales: [],
    largo_piscina_m: null,
    ...parte,
  };
}

const RUTA = [
  { t: 0, lat: 40, lon: -3, alt: null },
  { t: 10, lat: 40.001, lon: -3, alt: null },
];

describe('mismoEntreno', () => {
  test('la misma llave es el mismo, aunque las horas no casen', () => {
    expect(mismoEntreno(entreno({ externo_id: 'a' }), entreno({ externo_id: 'a', inicio: min(40), fin: min(50) }))).toBe(true);
  });

  test('solape justo de la mitad de la más corta: el mismo', () => {
    const a = entreno({ externo_id: 'a', inicio: min(0), fin: min(40) });
    const b = entreno({ externo_id: 'b', inicio: min(30), fin: min(50) });
    expect(mismoEntreno(a, b)).toBe(true);
  });

  test('solape parcial por debajo de la mitad: distintos', () => {
    const a = entreno({ externo_id: 'a', inicio: min(0), fin: min(40) });
    const b = entreno({ externo_id: 'b', inicio: min(31), fin: min(51) });
    expect(mismoEntreno(a, b)).toBe(false);
  });

  test('uno dentro de otro: el mismo', () => {
    const a = entreno({ externo_id: 'a', inicio: min(0), fin: min(59) });
    const b = entreno({ externo_id: 'b', inicio: min(20), fin: min(25) });
    expect(mismoEntreno(a, b)).toBe(true);
  });

  test('sin solape o seguidos: distintos', () => {
    const a = entreno({ externo_id: 'a', inicio: min(0), fin: min(20) });
    expect(mismoEntreno(a, entreno({ externo_id: 'b', inicio: min(20), fin: min(40) }))).toBe(false);
    expect(mismoEntreno(a, entreno({ externo_id: 'c', inicio: min(30), fin: min(40) }))).toBe(false);
  });

  test('cardio y fuerza a la vez son actos distintos', () => {
    expect(mismoEntreno(entreno({ externo_id: 'a' }), entreno({ externo_id: 'b', deporte: 'fuerza' }))).toBe(false);
  });

  test('deportes distintos de la misma familia cuentan como el mismo', () => {
    expect(mismoEntreno(entreno({ externo_id: 'a' }), entreno({ externo_id: 'b', deporte: 'otro' }))).toBe(true);
  });

  test('fechas rotas no casan con nada', () => {
    expect(mismoEntreno(entreno({ externo_id: 'a', inicio: 'basura' }), entreno({ externo_id: 'b' }))).toBe(false);
  });

  test('un entreno que cruza medianoche solapa igual', () => {
    const a = entreno({ externo_id: 'a', inicio: '2026-03-10T23:50:00Z', fin: '2026-03-11T00:30:00Z' });
    const b = entreno({ externo_id: 'b', origen: 'salud', inicio: '2026-03-10T23:51:00Z', fin: '2026-03-11T00:29:00Z' });
    expect(mismoEntreno(a, b)).toBe(true);
  });
});

describe('elegirEntre', () => {
  const reloj = entreno({ externo_id: 'w', origen: 'watch' });
  const gps = entreno({ externo_id: 'g', origen: 'iphone_gps', ruta: RUTA, kcal: 100 });
  const salud = entreno({ externo_id: 's', origen: 'salud', ruta: RUTA, kcal: 100, fc_media: 140 });
  const mano = entreno({ externo_id: 'm', origen: 'manual', kcal: 100 });

  test('reloj, luego GPS, luego Salud, luego a mano', () => {
    expect(elegirEntre(reloj, gps)).toBe(reloj);
    expect(elegirEntre(gps, reloj)).toBe(reloj);
    expect(elegirEntre(salud, gps)).toBe(gps);
    expect(elegirEntre(mano, salud)).toBe(salud);
  });

  test('con igual origen gana el que tiene ruta, aunque tenga menos campos', () => {
    const conRuta = entreno({ externo_id: 'a', origen: 'salud', ruta: RUTA });
    const sinRuta = entreno({ externo_id: 'b', origen: 'salud', kcal: 1, fc_media: 140, fc_max: 150 });
    expect(elegirEntre(sinRuta, conRuta)).toBe(conRuta);
  });

  test('con igual ruta gana el que tiene más campos', () => {
    const pobre = entreno({ externo_id: 'a', kcal: 1 });
    const rico = entreno({ externo_id: 'b', kcal: 1, fc_media: 140 });
    expect(elegirEntre(pobre, rico)).toBe(rico);
  });

  test('en empate se queda el primero', () => {
    const a = entreno({ externo_id: 'a' });
    const b = entreno({ externo_id: 'b' });
    expect(elegirEntre(a, b)).toBe(a);
  });
});

describe('filtrarNuevos', () => {
  const reloj = entreno({ externo_id: 'w' });
  const otraApp = entreno({ externo_id: 's', origen: 'salud' });

  test('sin conocidos pasa todo lo distinto', () => {
    const tarde = entreno({ externo_id: 't', inicio: min(40), fin: min(59) });
    expect(filtrarNuevos([reloj, tarde], [])).toEqual([reloj, tarde]);
  });

  test('lo que ya se conoce no se vuelve a guardar', () => {
    expect(filtrarNuevos([reloj], [reloj])).toEqual([]);
  });

  test('un duplicado de otro origen se descarta aunque tenga mejor origen', () => {
    expect(filtrarNuevos([reloj], [otraApp])).toEqual([]);
    expect(filtrarNuevos([otraApp], [reloj])).toEqual([]);
  });

  test('un duplicado que no pudo cobrar no deja al bueno sin evaluar', () => {
    const generico = entreno({ externo_id: 'g', origen: 'salud', deporte: 'otro' });
    const corto = entreno({ externo_id: 'c', origen: 'salud', duracion_s: 200 });
    expect(filtrarNuevos([reloj], [generico])).toEqual([reloj]);
    expect(filtrarNuevos([reloj], [corto])).toEqual([reloj]);
  });

  test('entre dos que no cobran, el duplicado se descarta', () => {
    const a = entreno({ externo_id: 'a', deporte: 'otro' });
    const b = entreno({ externo_id: 'b', origen: 'salud', deporte: 'otro' });
    expect(filtrarNuevos([b], [a])).toEqual([]);
  });

  test('misma llave: fuera siempre, aunque el conocido no cobrara', () => {
    const generico = entreno({ externo_id: 'w', deporte: 'otro' });
    expect(filtrarNuevos([reloj], [generico])).toEqual([]);
  });

  test('lo apuntado a mano no tapa lo medido', () => {
    const apuntado = entreno({ externo_id: 'manual:1', origen: 'manual' });
    expect(filtrarNuevos([reloj], [apuntado])).toEqual([reloj]);
    expect(filtrarNuevos([apuntado], [reloj])).toEqual([]);
  });

  test('dentro del lote queda un representante, el mejor', () => {
    expect(filtrarNuevos([otraApp, reloj], [])).toEqual([reloj]);
    expect(filtrarNuevos([reloj, otraApp], [])).toEqual([reloj]);
  });

  test('dentro del lote, el que puede cobrar gana a uno genérico de mejor origen', () => {
    const generico = entreno({ externo_id: 'g', deporte: 'otro' });
    expect(filtrarNuevos([generico, otraApp], [])).toEqual([otraApp]);
    expect(filtrarNuevos([otraApp, generico], [])).toEqual([otraApp]);
  });

  test('reimportar un lote da el mismo resultado: nada nuevo', () => {
    const lote = filtrarNuevos([reloj, otraApp], []);
    expect(filtrarNuevos([reloj, otraApp], lote)).toEqual([]);
  });

  test('vacíos', () => {
    expect(filtrarNuevos([], [reloj])).toEqual([]);
    expect(filtrarNuevos([], [])).toEqual([]);
  });
});
