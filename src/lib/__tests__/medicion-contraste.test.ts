import { describe, expect, test } from '@jest/globals';
import { dateKey } from '../dates';
import type { EntrenoMedido } from '../entrenoMedido';
import {
  CLAVES_CONTRASTE,
  contrastar,
  type ActividadVentana,
  type DatosContraste,
  type Declarado,
} from '../medicion/contraste';

// Horas locales a propósito: así los casos de medianoche valen en cualquier zona.
const local = (dia: number, hora: number, minuto = 0) => new Date(2026, 2, dia, hora, minuto).toISOString();
const DIA = '2026-03-10';

function entreno(parte: Partial<EntrenoMedido> = {}): EntrenoMedido {
  return {
    origen: 'watch',
    externo_id: 'uuid-1',
    deporte: 'carrera',
    inicio: local(10, 10),
    fin: local(10, 10, 30),
    duracion_s: 1800,
    distancia_m: 5000,
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

const declarado = (parte: Partial<Declarado> = {}): Declarado => ({
  tipo: 'cardio',
  deporte: 'carrera',
  fecha: DIA,
  duracion_min: 30,
  distancia_km: 5,
  ...parte,
});

const actividad = (parte: Partial<ActividadVentana> = {}): ActividadVentana => ({
  kcal_activas: null,
  pasos: null,
  fc_media: null,
  fc_max: null,
  muestras_fc: null,
  ...parte,
});

const conEntreno = (...entrenos: EntrenoMedido[]): DatosContraste => ({ entrenos, actividad: null });
const estado = (d: Declarado, datos: DatosContraste | null) => contrastar(d, datos).estado;

describe('sin reloj es neutro', () => {
  test('sin entrenos ni actividad', () => {
    expect(contrastar(declarado(), { entrenos: [], actividad: null })).toEqual({
      estado: 'sin_datos',
      detalle: { clave: CLAVES_CONTRASTE.sinDatos, valores: {} },
    });
  });

  test('datos a null, enteros o campo a campo', () => {
    expect(estado(declarado(), null)).toBe('sin_datos');
    expect(estado(declarado(), { entrenos: [], actividad: actividad() })).toBe('sin_datos');
  });

  test('la propia fila apuntada a mano no se confirma a sí misma', () => {
    const fila = entreno({ origen: 'manual', externo_id: 'manual:abc' });
    expect(estado(declarado(), conEntreno(fila))).toBe('sin_datos');
  });
});

describe('medido', () => {
  test('mismo deporte y cifras que casan', () => {
    const r = contrastar(declarado(), conEntreno(entreno()));
    expect(r.estado).toBe('medido');
    expect(r.detalle).toEqual({
      clave: CLAVES_CONTRASTE.medido,
      valores: { origen: 'watch', deporte: 'carrera' },
    });
  });

  test('sin cifras declaradas basta con el entreno', () => {
    expect(estado(declarado({ duracion_min: null, distancia_km: null }), conEntreno(entreno()))).toBe('medido');
  });

  test('tolerancia de duración: 25 % dentro, más fuera', () => {
    const d = (duracion_min: number) => declarado({ duracion_min, distancia_km: null });
    expect(estado(d(37), conEntreno(entreno()))).toBe('medido');
    expect(estado(d(23), conEntreno(entreno()))).toBe('medido');
    expect(estado(d(38), conEntreno(entreno()))).toBe('coherente');
    expect(estado(d(22), conEntreno(entreno()))).toBe('coherente');
  });

  test('tolerancia de distancia: 15 % dentro, más fuera', () => {
    const d = (distancia_km: number) => declarado({ duracion_min: null, distancia_km });
    expect(estado(d(5.7), conEntreno(entreno()))).toBe('medido');
    expect(estado(d(4.3), conEntreno(entreno()))).toBe('medido');
    expect(estado(d(5.8), conEntreno(entreno()))).toBe('coherente');
  });

  test('quien cuenta las pausas también casa con la hora de reloj', () => {
    const conPausa = entreno({ inicio: local(10, 10), fin: local(10, 11), duracion_s: 2400, distancia_m: null });
    expect(estado(declarado({ duracion_min: 60, distancia_km: null }), conEntreno(conPausa))).toBe('medido');
  });

  test('sin distancia medida (cinta) no desmiente la declarada', () => {
    expect(estado(declarado(), conEntreno(entreno({ distancia_m: null })))).toBe('medido');
  });

  test('cifras declaradas absurdas valen como no declaradas', () => {
    const d = declarado({ duracion_min: Number.NaN, distancia_km: -3 });
    expect(estado(d, conEntreno(entreno()))).toBe('medido');
    expect(estado(declarado({ duracion_min: 0, distancia_km: 0 }), conEntreno(entreno()))).toBe('medido');
  });

  test('con dos entrenos basta con que case uno', () => {
    const corto = entreno({ externo_id: 'c', duracion_s: 300, distancia_m: 800 });
    expect(estado(declarado(), conEntreno(corto, entreno()))).toBe('medido');
  });

  test('piscina y aguas abiertas son la misma natación', () => {
    const nado = entreno({ deporte: 'aguas_abiertas', distancia_m: null });
    expect(estado(declarado({ deporte: 'piscina', distancia_km: null }), conEntreno(nado))).toBe('medido');
  });

  test('un tipo genérico no desmiente', () => {
    expect(estado(declarado(), conEntreno(entreno({ deporte: 'otro' })))).toBe('medido');
    expect(estado(declarado({ deporte: 'otro' }), conEntreno(entreno()))).toBe('medido');
  });

  test('gimnasio con entreno de fuerza', () => {
    const fuerza = entreno({ deporte: 'fuerza', distancia_m: null });
    const gym = declarado({ tipo: 'gym', deporte: 'fuerza', distancia_km: null });
    expect(estado(gym, conEntreno(fuerza))).toBe('medido');
    expect(estado({ ...gym, deporte: null }, conEntreno(fuerza))).toBe('medido');
  });

  test('una misión sin deporte vale con cualquier entreno', () => {
    const mision = declarado({ tipo: 'mision', deporte: null, duracion_min: null, distancia_km: null });
    expect(estado(mision, conEntreno(entreno({ deporte: 'fuerza' })))).toBe('medido');
  });

  test('un entreno medido gana a uno tecleado que también casa', () => {
    const tecleado = entreno({ origen: 'manual', externo_id: 'hk-1' });
    const r = contrastar(declarado(), conEntreno(tecleado, entreno({ externo_id: 'hk-2', origen: 'salud' })));
    expect(r).toMatchObject({ estado: 'medido', detalle: { valores: { origen: 'salud' } } });
  });
});

describe('coherente, nunca una acusación', () => {
  test('hay entreno pero las cifras no casan', () => {
    const r = contrastar(declarado({ duracion_min: 90, distancia_km: 20 }), conEntreno(entreno()));
    expect(r.estado).toBe('coherente');
    expect(r.detalle.clave).toBe(CLAVES_CONTRASTE.cifrasAproximadas);
  });

  test('un entreno introducido a mano en otra app llega a coherente, no a medido', () => {
    const r = contrastar(declarado(), conEntreno(entreno({ origen: 'manual', externo_id: 'hk-uuid' })));
    expect(r.estado).toBe('coherente');
    expect(r.detalle.clave).toBe(CLAVES_CONTRASTE.introducidoAMano);
  });

  test('pulso elevado con muestras suficientes', () => {
    const datos = { entrenos: [], actividad: actividad({ fc_media: 130, muestras_fc: 20 }) };
    expect(contrastar(declarado(), datos)).toEqual({
      estado: 'coherente',
      detalle: { clave: CLAVES_CONTRASTE.actividad, valores: { motivo: 'fc' } },
    });
  });

  test('pulso elevado con muy pocas muestras no sirve', () => {
    expect(estado(declarado(), { entrenos: [], actividad: actividad({ fc_media: 130, muestras_fc: 2 }) })).toBe('sin_datos');
    expect(estado(declarado(), { entrenos: [], actividad: actividad({ fc_media: 130 }) })).toBe('sin_datos');
  });

  test('kcal o pasos por encima del umbral', () => {
    expect(estado(declarado(), { entrenos: [], actividad: actividad({ kcal_activas: 500 }) })).toBe('coherente');
    expect(estado(declarado(), { entrenos: [], actividad: actividad({ pasos: 12000 }) })).toBe('coherente');
  });

  test('un día normal no llega a los umbrales', () => {
    const normal = actividad({ kcal_activas: 250, pasos: 6000, fc_media: 75, muestras_fc: 200 });
    expect(estado(declarado(), { entrenos: [], actividad: normal })).toBe('sin_datos');
  });

  test('los pasos no dicen nada de una sesión de fuerza', () => {
    const gym = declarado({ tipo: 'gym', deporte: 'fuerza', distancia_km: null });
    expect(estado(gym, { entrenos: [], actividad: actividad({ pasos: 15000 }) })).toBe('sin_datos');
    expect(estado(gym, { entrenos: [], actividad: actividad({ kcal_activas: 500 }) })).toBe('coherente');
  });

  test('valores absurdos de actividad no cuentan', () => {
    const absurda = actividad({ kcal_activas: 900000, pasos: 5000000, fc_media: 900, muestras_fc: 50 });
    expect(estado(declarado(), { entrenos: [], actividad: absurda })).toBe('sin_datos');
    const rota = actividad({ kcal_activas: Number.NaN, pasos: -5, fc_media: Number.POSITIVE_INFINITY, muestras_fc: 50 });
    expect(estado(declarado(), { entrenos: [], actividad: rota })).toBe('sin_datos');
  });
});

describe('deporte o familia que no casan', () => {
  test('carrera declarada, bici medida: neutro', () => {
    expect(estado(declarado(), conEntreno(entreno({ deporte: 'bici' })))).toBe('sin_datos');
  });

  test('gimnasio declarado, carrera medida: neutro', () => {
    expect(estado(declarado({ tipo: 'gym', deporte: 'fuerza' }), conEntreno(entreno()))).toBe('sin_datos');
  });

  test('cardio declarado, fuerza medida: neutro', () => {
    expect(estado(declarado({ deporte: null }), conEntreno(entreno({ deporte: 'fuerza' })))).toBe('sin_datos');
  });

  test('sin entreno que case, la actividad aún puede dar coherente', () => {
    const datos = { entrenos: [entreno({ deporte: 'bici' })], actividad: actividad({ kcal_activas: 600 }) };
    expect(contrastar(declarado(), datos).detalle.clave).toBe(CLAVES_CONTRASTE.actividad);
  });
});

describe('el día es el local', () => {
  test('otro día no cuenta', () => {
    expect(estado(declarado({ fecha: '2026-03-11' }), conEntreno(entreno()))).toBe('sin_datos');
  });

  test('a las 00:30 es hoy, no ayer como diría el ISO en UTC', () => {
    const madrugada = entreno({ inicio: local(11, 0, 5), fin: local(11, 0, 30), duracion_s: 1500, distancia_m: null });
    const d = declarado({ duracion_min: null, distancia_km: null });
    expect(estado({ ...d, fecha: '2026-03-11' }, conEntreno(madrugada))).toBe('medido');
    expect(estado({ ...d, fecha: dateKey(new Date(2026, 2, 10)) }, conEntreno(madrugada))).toBe('sin_datos');
  });

  test('un entreno que cruza medianoche vale para los dos días y para ninguno más', () => {
    const cruza = entreno({ inicio: local(10, 23, 50), fin: local(11, 0, 20), distancia_m: null });
    const d = declarado({ distancia_km: null });
    expect(estado({ ...d, fecha: '2026-03-10' }, conEntreno(cruza))).toBe('medido');
    expect(estado({ ...d, fecha: '2026-03-11' }, conEntreno(cruza))).toBe('medido');
    expect(estado({ ...d, fecha: '2026-03-09' }, conEntreno(cruza))).toBe('sin_datos');
    expect(estado({ ...d, fecha: '2026-03-12' }, conEntreno(cruza))).toBe('sin_datos');
  });

  test('una fecha declarada corrupta es neutra, no un fallo', () => {
    expect(estado(declarado({ fecha: 'basura' }), conEntreno(entreno()))).toBe('sin_datos');
  });

  test('un entreno con fechas rotas se ignora', () => {
    expect(estado(declarado(), conEntreno(entreno({ inicio: 'x', fin: 'y' })))).toBe('sin_datos');
  });
});
