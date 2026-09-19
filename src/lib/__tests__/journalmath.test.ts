import { describe, expect, test } from '@jest/globals';
import { addDays } from '../dates';
import {
  EMOCIONES,
  MAX_EMOCIONES,
  MAX_VICTORIAS,
  completitud,
  entradaVacia,
  etiquetaEmocion,
  extracto,
  fechasFlashback,
  flashbacks,
  formatoHoras,
  limpiarEmociones,
  limpiarVictorias,
  pasoDeSueno,
  resumenTendencia,
  serieDe,
  type EntradaFechada,
} from '../journalmath';

function e(date: string, partial: Partial<EntradaFechada> = {}): EntradaFechada {
  return {
    date,
    mood: null,
    energy: null,
    emotions: [],
    sleep_hours: null,
    wins: [],
    text: null,
    lesson: null,
    gratitude: null,
    plan: null,
    ...partial,
  };
}

const HOY = '2026-09-19';

describe('EMOCIONES', () => {
  test('catorce palabras, siete por lado, con ids únicos en minúsculas', () => {
    expect(EMOCIONES).toHaveLength(14);
    expect(EMOCIONES.filter((x) => x.valence === 'up')).toHaveLength(7);
    expect(EMOCIONES.filter((x) => x.valence === 'down')).toHaveLength(7);
    expect(new Set(EMOCIONES.map((x) => x.id)).size).toBe(14);
    for (const x of EMOCIONES) expect(x.id).toBe(x.id.toLowerCase());
  });

  test('etiquetaEmocion conoce el vocabulario y no rompe con lo ajeno', () => {
    expect(etiquetaEmocion('frustrado')).toBe('Frustrado');
    expect(etiquetaEmocion('eufórico')).toBe('Eufórico');
    expect(etiquetaEmocion('  ')).toBe('');
  });

  test('limpiarEmociones normaliza, quita repetidas y respeta el tope', () => {
    expect(limpiarEmociones([' Cansado', 'cansado', '', 'feliz'])).toEqual(['cansado', 'feliz']);
    expect(limpiarEmociones(EMOCIONES.map((x) => x.id))).toHaveLength(MAX_EMOCIONES);
    expect(limpiarEmociones(null)).toEqual([]);
  });
});

describe('limpiarVictorias', () => {
  test('recorta, tira las vacías y quita repetidas sin mirar mayúsculas', () => {
    expect(limpiarVictorias(['  Entrené  pierna ', '', '   ', 'entrené pierna', 'Cerré la venta'])).toEqual([
      'Entrené pierna',
      'Cerré la venta',
    ]);
  });

  test('tope de diez, el del esquema', () => {
    const muchas = Array.from({ length: 15 }, (_, i) => `victoria ${i}`);
    expect(limpiarVictorias(muchas)).toHaveLength(MAX_VICTORIAS);
    expect(limpiarVictorias(muchas)[0]).toBe('victoria 0');
  });

  test('aguanta null y basura', () => {
    expect(limpiarVictorias(null)).toEqual([]);
    expect(limpiarVictorias([1 as unknown as string, 'vale'])).toEqual(['vale']);
  });
});

describe('sueño', () => {
  test('desde sin registrar arranca en 7, y luego va de media en media', () => {
    expect(pasoDeSueno(null, 1)).toBe(7);
    expect(pasoDeSueno(null, -1)).toBe(7);
    expect(pasoDeSueno(7, 1)).toBe(7.5);
    expect(pasoDeSueno(7, -1)).toBe(6.5);
  });

  test('no sale de 0–14', () => {
    expect(pasoDeSueno(14, 1)).toBe(14);
    expect(pasoDeSueno(0, -1)).toBe(0);
  });

  test('formato con coma y sin ",0"', () => {
    expect(formatoHoras(7.5)).toBe('7,5 h');
    expect(formatoHoras(8)).toBe('8 h');
  });
});

describe('completitud', () => {
  test('una entrada vacía: 0 de 7', () => {
    const c = completitud(e(HOY));
    expect(c).toMatchObject({ hechas: 0, total: 7 });
    expect(entradaVacia(e(HOY))).toBe(true);
  });

  test('cuenta cada pregunta una vez', () => {
    const c = completitud(
      e(HOY, { mood: 4, energy: 3, emotions: ['feliz'], sleep_hours: 7.5, wins: ['Entrené'], plan: 'Llamar a las 9' }),
    );
    expect(c.hechas).toBe(4);
    expect(c.porSeccion).toEqual({
      sentir: true,
      sueno: true,
      victorias: true,
      vivido: false,
      leccion: false,
      gratitud: false,
      manana: true,
    });
  });

  test('los espacios y las victorias en blanco no cuentan; dormir 0 horas sí', () => {
    const c = completitud(e(HOY, { text: '   ', wins: ['  ', ''], sleep_hours: 0 }));
    expect(c.hechas).toBe(1);
    expect(c.porSeccion.sueno).toBe(true);
  });

  test('una emoción sola ya responde a "cómo me sentí"', () => {
    expect(completitud(e(HOY, { emotions: ['frustrado'] })).porSeccion.sentir).toBe(true);
  });

  test('una entrada antigua (sin columnas nuevas) no rompe', () => {
    const vieja = { mood: 3, energy: null, text: 'Un día normal', plan: null };
    expect(completitud(vieja).hechas).toBe(2);
  });
});

describe('resumenTendencia', () => {
  test('sin entradas: todo null, racha 0', () => {
    const r = resumenTendencia([], HOY);
    expect(r.animo).toEqual({ actual: null, anterior: null, delta: null });
    expect(r.sueno.actual).toBeNull();
    expect(r.racha).toBe(0);
    expect(r.emociones).toEqual([]);
  });

  test('media de los últimos 7 días contra los 7 anteriores, con su delta', () => {
    const entries = [
      e(HOY, { mood: 5 }),
      e(addDays(HOY, -1), { mood: 4 }),
      e(addDays(HOY, -6), { mood: 3 }),
      e(addDays(HOY, -7), { mood: 2 }),
      e(addDays(HOY, -10), { mood: 3 }),
      e(addDays(HOY, -13), { mood: 1 }),
      // Fuera de las dos ventanas: no cuenta.
      e(addDays(HOY, -14), { mood: 5 }),
    ];
    const r = resumenTendencia(entries, HOY);
    expect(r.animo).toEqual({ actual: 4, anterior: 2, delta: 2 });
  });

  test('con menos de tres datos en una ventana no hay media ni delta', () => {
    const entries = [
      e(HOY, { mood: 5 }),
      e(addDays(HOY, -1), { mood: 4 }),
      e(addDays(HOY, -8), { mood: 2 }),
      e(addDays(HOY, -9), { mood: 2 }),
      e(addDays(HOY, -10), { mood: 2 }),
    ];
    const r = resumenTendencia(entries, HOY);
    expect(r.animo.actual).toBeNull();
    expect(r.animo.anterior).toBe(2);
    expect(r.animo.delta).toBeNull();
  });

  test('los nulos no cuentan como dato: cada métrica tiene su propia muestra', () => {
    const entries = [
      e(HOY, { mood: 4, energy: null, sleep_hours: 7 }),
      e(addDays(HOY, -1), { mood: 4, energy: 2, sleep_hours: 8 }),
      e(addDays(HOY, -2), { mood: 4, energy: null, sleep_hours: 7.5 }),
    ];
    const r = resumenTendencia(entries, HOY);
    expect(r.animo.actual).toBe(4);
    expect(r.energia.actual).toBeNull();
    expect(r.sueno.actual).toBe(7.5);
  });

  test('redondea a un decimal', () => {
    const entries = [e(HOY, { mood: 5 }), e(addDays(HOY, -1), { mood: 4 }), e(addDays(HOY, -2), { mood: 4 })];
    expect(resumenTendencia(entries, HOY).animo.actual).toBe(4.3);
  });

  test('racha: días seguidos hasta hoy', () => {
    const entries = [e(HOY), e(addDays(HOY, -1)), e(addDays(HOY, -2)), e(addDays(HOY, -4))];
    expect(resumenTendencia(entries, HOY).racha).toBe(3);
  });

  test('racha: si hoy aún no se ha escrito, sigue viva desde ayer', () => {
    const entries = [e(addDays(HOY, -1)), e(addDays(HOY, -2))];
    expect(resumenTendencia(entries, HOY).racha).toBe(2);
  });

  test('racha: un hueco ayer y anteayer la deja en cero', () => {
    expect(resumenTendencia([e(addDays(HOY, -2)), e(addDays(HOY, -3))], HOY).racha).toBe(0);
  });

  test('racha: cruza el cambio de mes y no cuenta dos veces un día repetido', () => {
    const hoy = '2026-03-02';
    const entries = [e('2026-03-02'), e('2026-03-02'), e('2026-03-01'), e('2026-02-28'), e('2026-02-27')];
    expect(resumenTendencia(entries, hoy).racha).toBe(4);
  });

  test('ignora fechas corruptas y futuras', () => {
    const entries = [e('no-es-fecha', { mood: 5 }), e(addDays(HOY, 1), { mood: 5 }), e(HOY, { mood: 1 })];
    const r = resumenTendencia(entries, HOY);
    expect(r.racha).toBe(1);
    expect(r.animo.actual).toBeNull();
  });

  test('emociones: las tres más repetidas en 14 días, con su cuenta', () => {
    const entries = [
      e(HOY, { emotions: ['cansado', 'motivado'] }),
      e(addDays(HOY, -1), { emotions: ['cansado', 'estresado'] }),
      e(addDays(HOY, -5), { emotions: ['cansado', 'motivado', 'feliz'] }),
      e(addDays(HOY, -13), { emotions: ['estresado'] }),
      // Día 15: fuera.
      e(addDays(HOY, -14), { emotions: ['triste', 'triste', 'triste'] }),
    ];
    expect(resumenTendencia(entries, HOY).emociones).toEqual([
      { id: 'cansado', label: 'Cansado', count: 3 },
      { id: 'motivado', label: 'Motivado', count: 2 },
      { id: 'estresado', label: 'Estresado', count: 2 },
    ]);
  });

  test('emociones: aguanta entradas antiguas sin la columna', () => {
    const vieja = { date: HOY, mood: 3, energy: 3, text: 'x', plan: null } as EntradaFechada;
    expect(resumenTendencia([vieja], HOY).emociones).toEqual([]);
  });
});

describe('serieDe', () => {
  test('cronológica, sin nulos y con tope', () => {
    const entries = [e('2026-09-03', { mood: 3 }), e('2026-09-01', { mood: 1 }), e('2026-09-02'), e('2026-09-04', { mood: 5 })];
    expect(serieDe(entries, 'mood')).toEqual([1, 3, 5]);
    expect(serieDe(entries, 'mood', 2)).toEqual([3, 5]);
  });
});

describe('flashbacks', () => {
  test('las tres fechas: 7 días, mismo día del mes pasado, mismo día del año pasado', () => {
    expect(fechasFlashback('2026-09-19')).toEqual({ semana: '2026-09-12', mes: '2026-08-19', anio: '2025-09-19' });
  });

  test('recorta al largo del mes: 31 de marzo → 28 de febrero', () => {
    expect(fechasFlashback('2026-03-31').mes).toBe('2026-02-28');
    expect(fechasFlashback('2024-03-31').mes).toBe('2024-02-29');
    expect(fechasFlashback('2026-07-31').mes).toBe('2026-06-30');
  });

  test('enero mira a diciembre del año anterior', () => {
    expect(fechasFlashback('2026-01-15').mes).toBe('2025-12-15');
    expect(fechasFlashback('2026-01-03').semana).toBe('2025-12-27');
  });

  test('29 de febrero → 28 de febrero del año anterior', () => {
    expect(fechasFlashback('2024-02-29').anio).toBe('2023-02-28');
  });

  test('devuelve solo las que existen, en orden semana · mes · año', () => {
    const entries = [
      e('2025-09-19', { text: 'Hace un año empezaba.' }),
      e('2026-09-12', { wins: ['Primera venta'] }),
      e('2026-09-13', { text: 'No toca.' }),
    ];
    const out = flashbacks(entries, HOY);
    expect(out.map((f) => f.id)).toEqual(['semana', 'anio']);
    expect(out[0]!.titulo).toBe('Hace una semana');
    expect(out[1]!.entry.text).toBe('Hace un año empezaba.');
  });

  test('una entrada vacía no es un recuerdo', () => {
    expect(flashbacks([e('2026-09-12')], HOY)).toEqual([]);
  });

  test('con un hoy corrupto no lanza', () => {
    expect(flashbacks([e('2026-09-12', { mood: 3 })], 'ayer')).toEqual([]);
  });
});

describe('extracto', () => {
  test('lo corto pasa tal cual, colapsando saltos', () => {
    expect(extracto('Un día\n\nnormal.')).toBe('Un día normal.');
    expect(extracto(null)).toBe('');
  });

  test('lo largo se corta en palabra y lleva puntos suspensivos', () => {
    const largo = 'palabra '.repeat(40);
    const out = extracto(largo, 120);
    expect(out.length).toBeLessThanOrEqual(121);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/\s…$/);
  });
});
