// Modos F1 · reglas puras: filtro de Hoy por modo, misión con dos modos,
// elección del onboarding, filas de user_modes y mode_xp, cabecera del coach.
import {
  activadosDeFilas,
  alternarModo,
  cabeceraModo,
  eleccionValida,
  filasUserModes,
  filtrarPorModo,
  misionEnModo,
  modosDeMision,
  modosDisponibles,
  modosSugeridos,
  modoValido,
  MODOS,
  NOMBRE_MODO,
  opcionesEtiquetas,
  xpPorModo,
} from '../tipos';

type Q = { id: string; modes?: string[] | null; is_penalty?: boolean };

const pierna: Q = { id: 'pierna', modes: ['iron'] };
const tema4: Q = { id: 'tema4', modes: ['focus'] };
// Una misión con dos modos: se marca una vez y cuenta en los dos.
const pitch: Q = { id: 'pitch', modes: ['work', 'founder'] };
const leer: Q = { id: 'leer', modes: [] };
const viejo: Q = { id: 'viejo' }; // servidor sin la columna `modes`
const pena: Q = { id: 'pena', modes: [], is_penalty: true };
const TODAS = [pierna, tema4, pitch, leer, viejo, pena];

describe('filtro de Hoy por modo', () => {
  it('General lo enseña todo, en el mismo orden y la misma lista', () => {
    expect(filtrarPorModo(TODAS, 'general')).toBe(TODAS);
  });

  it('cada modo enseña solo sus misiones (y la penalización del día)', () => {
    const ids = (m: Parameters<typeof filtrarPorModo>[1]) => filtrarPorModo(TODAS, m).map((q) => q.id);
    expect(ids('iron')).toEqual(['pierna', 'pena']);
    expect(ids('focus')).toEqual(['tema4', 'pena']);
    expect(ids('work')).toEqual(['pitch', 'pena']);
    expect(ids('founder')).toEqual(['pitch', 'pena']);
  });

  it('sin etiquetas o sin la columna, la misión solo está en General', () => {
    for (const m of ['iron', 'focus', 'work', 'founder'] as const) {
      expect(misionEnModo(leer, m)).toBe(false);
      expect(misionEnModo(viejo, m)).toBe(false);
    }
    expect(misionEnModo(leer, 'general')).toBe(true);
    expect(misionEnModo(viejo, 'general')).toBe(true);
  });
});

describe('misión con dos modos', () => {
  it('es la MISMA fila en los dos modos y en General', () => {
    const enWork = filtrarPorModo(TODAS, 'work').find((q) => q.id === 'pitch');
    const enFounder = filtrarPorModo(TODAS, 'founder').find((q) => q.id === 'pitch');
    const enGeneral = filtrarPorModo(TODAS, 'general').find((q) => q.id === 'pitch');
    expect(enWork).toBe(pitch);
    expect(enFounder).toBe(pitch);
    expect(enGeneral).toBe(pitch);
  });

  it('marcada una vez, sale hecha en todos sus modos', () => {
    const hechas = new Set(['pitch']);
    for (const m of ['general', 'work', 'founder'] as const) {
      const vista = filtrarPorModo(TODAS, m).map((q) => ({ id: q.id, hecha: hechas.has(q.id) }));
      expect(vista).toContainEqual({ id: 'pitch', hecha: true });
    }
  });

  it('las etiquetas se limpian: sin basura, sin repetir, en orden', () => {
    expect(modosDeMision({ modes: ['founder', 'work', 'work', 'general', 'gym', 3] })).toEqual(['work', 'founder']);
    expect(modosDeMision({ modes: null })).toEqual([]);
    expect(modosDeMision({})).toEqual([]);
  });

  it('alternar pone y quita en el orden canónico', () => {
    expect(alternarModo([], 'founder')).toEqual(['founder']);
    expect(alternarModo(['founder'], 'iron')).toEqual(['iron', 'founder']);
    expect(alternarModo(['iron', 'founder'], 'iron')).toEqual(['founder']);
  });
});

describe('selector y modo activo', () => {
  it('General siempre está y va primero', () => {
    expect(modosDisponibles([])).toEqual(['general']);
    expect(modosDisponibles(['founder', 'iron'])).toEqual(['general', 'iron', 'founder']);
  });

  it('un modo guardado que ya no está activado vuelve a General', () => {
    expect(modoValido('iron', ['iron'])).toBe('iron');
    expect(modoValido('iron', ['focus'])).toBe('general');
    expect(modoValido('basura', ['focus'])).toBe('general');
    expect(modoValido(null, [])).toBe('general');
  });

  it('los nombres son la marca', () => {
    expect(MODOS.map((m) => NOMBRE_MODO[m])).toEqual(['NIVL', 'IRON', 'FOCUS', 'WORK', 'FOUNDER']);
  });
});

describe('onboarding y tablas', () => {
  it('hace falta al menos un modo además de General', () => {
    expect(eleccionValida([])).toBe(false);
    expect(eleccionValida(['iron'])).toBe(true);
  });

  it('el perfil de uso propone un modo', () => {
    expect(modosSugeridos('deportista')).toEqual(['iron']);
    expect(modosSugeridos('estudiante')).toEqual(['focus']);
    expect(modosSugeridos('trabajador')).toEqual(['work']);
    expect(modosSugeridos('emprendedor')).toEqual(['founder']);
    expect(modosSugeridos('general')).toEqual([]);
    expect(modosSugeridos(null)).toEqual([]);
  });

  it('user_modes: las cuatro filas, encendidas las elegidas', () => {
    expect(filasUserModes('u', ['focus', 'iron'])).toEqual([
      { user_id: 'u', mode: 'iron', enabled: true },
      { user_id: 'u', mode: 'focus', enabled: true },
      { user_id: 'u', mode: 'work', enabled: false },
      { user_id: 'u', mode: 'founder', enabled: false },
    ]);
    expect(
      activadosDeFilas([
        { mode: 'founder', enabled: true },
        { mode: 'iron', enabled: false },
        { mode: 'focus' },
        { mode: 'general', enabled: true },
      ]),
    ).toEqual(['focus', 'founder']);
    expect(activadosDeFilas(null)).toEqual([]);
  });

  it('mode_xp: XP por modo, 0 sin fila (bigint llega como texto)', () => {
    expect(xpPorModo([{ mode: 'iron', xp: 250 }, { mode: 'work', xp: '1200' }, { mode: 'x', xp: 9 }])).toEqual({
      iron: 250,
      focus: 0,
      work: 1200,
      founder: 0,
    });
  });
});

describe('cabecera del coach', () => {
  it('con el interruptor apagado no va nada', () => {
    expect(cabeceraModo('iron', false)).toEqual({});
  });

  it('General no lleva cabecera (el prompt de hoy)', () => {
    expect(cabeceraModo('general', true)).toEqual({});
  });

  it('un modo encendido va en x-nivl-modo', () => {
    expect(cabeceraModo('focus', true)).toEqual({ 'x-nivl-modo': 'focus' });
  });
});

describe('formulario de misión', () => {
  it('ofrece los activados (o los cuatro) y marca el modo a la vista', () => {
    expect(opcionesEtiquetas(['iron'], 'iron')).toEqual({ opciones: ['iron'], porDefecto: ['iron'] });
    expect(opcionesEtiquetas([], 'general')).toEqual({ opciones: ['iron', 'focus', 'work', 'founder'], porDefecto: [] });
    expect(opcionesEtiquetas(['work', 'founder'], 'general').porDefecto).toEqual([]);
  });
});
