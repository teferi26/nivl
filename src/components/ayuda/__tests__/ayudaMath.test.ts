// NIVL · Ayuda contextual: qué pista se enseña y qué se recuerda.
import fs from 'fs';
import path from 'path';
import {
  apagarTodas,
  descartarPista,
  esIdPistaValido,
  ESTADO_INICIAL,
  estaDescartada,
  ganadoraDelGrupo,
  parsearEstado,
  pistaVisible,
  reactivarTodas,
  serializarEstado,
  type RegistroPista,
} from '../ayudaMath';

const registros: RegistroPista[] = [
  { id: 'hoy.b', grupo: 'hoy', prioridad: 2 },
  { id: 'hoy.a', grupo: 'hoy', prioridad: 1 },
  { id: 'otro.x', grupo: 'otro', prioridad: 0 },
];

describe('parsearEstado', () => {
  it('vacío o roto es el estado inicial', () => {
    for (const crudo of [null, '', 'no es json', 'null', '7']) expect(parsearEstado(crudo)).toEqual(ESTADO_INICIAL);
  });

  it('se queda con lo válido y sin repetidos', () => {
    expect(parsearEstado('{"descartadas":["a.b",3,"a.b"],"apagadas":"si"}')).toEqual({ descartadas: ['a.b'], apagadas: false });
  });

  it('ida y vuelta', () => {
    const estado = apagarTodas(descartarPista(ESTADO_INICIAL, 'hoy.a'));
    expect(parsearEstado(serializarEstado(estado))).toEqual(estado);
  });
});

describe('descartar, apagar y reactivar', () => {
  it('descartar es idempotente y no toca el original', () => {
    const una = descartarPista(ESTADO_INICIAL, 'hoy.a');
    expect(ESTADO_INICIAL.descartadas).toEqual([]);
    expect(estaDescartada(una, 'hoy.a')).toBe(true);
    expect(descartarPista(una, 'hoy.a')).toBe(una);
  });

  it('reactivar enciende y vuelve a enseñar las cerradas', () => {
    expect(reactivarTodas(apagarTodas(descartarPista(ESTADO_INICIAL, 'hoy.a')))).toEqual(ESTADO_INICIAL);
  });

  it('sin cambios devuelve el mismo objeto (no se reescribe el almacén)', () => {
    expect(reactivarTodas(ESTADO_INICIAL)).toBe(ESTADO_INICIAL);
    const apagado = apagarTodas(ESTADO_INICIAL);
    expect(apagarTodas(apagado)).toBe(apagado);
  });
});

describe('grupos', () => {
  it('gana la de menor prioridad, sin importar el orden de montaje', () => {
    expect(ganadoraDelGrupo(ESTADO_INICIAL, registros, 'hoy')).toBe('hoy.a');
  });

  it('al cerrar la primera sale la siguiente, y al cerrarlas todas ninguna', () => {
    const una = descartarPista(ESTADO_INICIAL, 'hoy.a');
    expect(ganadoraDelGrupo(una, registros, 'hoy')).toBe('hoy.b');
    expect(ganadoraDelGrupo(descartarPista(una, 'hoy.b'), registros, 'hoy')).toBeNull();
  });

  it('con la misma prioridad gana la primera montada', () => {
    const iguales: RegistroPista[] = [
      { id: 'a.uno', grupo: 'g', prioridad: 0 },
      { id: 'a.dos', grupo: 'g', prioridad: 0 },
    ];
    expect(ganadoraDelGrupo(ESTADO_INICIAL, iguales, 'g')).toBe('a.uno');
  });
});

describe('pistaVisible', () => {
  it('solo una por grupo; los grupos no compiten entre sí', () => {
    expect(pistaVisible(ESTADO_INICIAL, registros, 'hoy.a', 'hoy')).toBe(true);
    expect(pistaVisible(ESTADO_INICIAL, registros, 'hoy.b', 'hoy')).toBe(false);
    expect(pistaVisible(ESTADO_INICIAL, registros, 'otro.x', 'otro')).toBe(true);
  });

  it('sin grupo no compite con nadie', () => {
    expect(pistaVisible(ESTADO_INICIAL, registros, 'suelta.a')).toBe(true);
    expect(pistaVisible(descartarPista(ESTADO_INICIAL, 'suelta.a'), registros, 'suelta.a')).toBe(false);
  });

  it('apagadas, ninguna', () => {
    const apagado = apagarTodas(ESTADO_INICIAL);
    expect(pistaVisible(apagado, registros, 'hoy.a', 'hoy')).toBe(false);
    expect(pistaVisible(apagado, registros, 'suelta.a')).toBe(false);
  });
});

describe('convención de ids', () => {
  it('pantalla.tema o modo.pantalla.tema', () => {
    for (const id of ['hoy.primer-dia', 'iron.gym.primera-serie', 'focus.temario.plan']) expect(esIdPistaValido(id)).toBe(true);
    for (const id of ['hoy', 'Hoy.PrimerDia', 'hoy.primer_dia', 'a.b.c.d', 'hoy..x', 'hoy.-x', '']) expect(esIdPistaValido(id)).toBe(false);
  });

  it('las pistas de la app la cumplen y no repiten id', () => {
    const fuente = path.resolve(__dirname, '..', '..', '..');
    const ids: string[] = [];
    const recorrer = (dir: string) => {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
          if (f !== '__tests__') recorrer(p);
        } else if (f.endsWith('.tsx')) {
          for (const m of fs.readFileSync(p, 'utf8').matchAll(/<Pista\s+id="([^"]+)"/g)) ids.push(m[1]!);
        }
      }
    };
    recorrer(fuente);
    expect(ids.filter((id) => !esIdPistaValido(id))).toEqual([]);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });
});
