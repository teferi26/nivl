import { VIBRACIONES, type EventoVibracion, type Paso } from '../hapticsMap';

const EVENTOS: EventoVibracion[] = [
  'seleccion',
  'mision',
  'misionExtra',
  'diaPerfecto',
  'nivel',
  'rango',
  'rachaHito',
  'penalizacion',
  'destructiva',
  'recuperacion',
  'ruedaAbre',
  'modoGeneral',
  'modoIron',
  'modoFocus',
  'modoWork',
  'modoFounder',
];

describe('mapa de vibraciones (SISTEMA §9)', () => {
  it('cubre exactamente los eventos del contrato', () => {
    expect(Object.keys(VIBRACIONES).sort()).toEqual([...EVENTOS].sort());
  });

  it('nunca usa la notificación de error', () => {
    for (const pasos of Object.values(VIBRACIONES)) {
      for (const p of pasos) expect(p.tipo as string).not.toBe('error');
    }
  });

  it('todo evento tiene al menos un paso', () => {
    for (const e of EVENTOS) expect(VIBRACIONES[e].length).toBeGreaterThan(0);
  });

  it('los retardos no decrecen y no son negativos', () => {
    for (const pasos of Object.values(VIBRACIONES)) {
      for (let i = 0; i < pasos.length; i++) {
        expect(pasos[i].tras).toBeGreaterThanOrEqual(i === 0 ? 0 : pasos[i - 1].tras);
      }
    }
  });

  it('coincide con la tabla de §9', () => {
    const esperado: Partial<Record<EventoVibracion, Paso[]>> = {
      seleccion: [{ tipo: 'seleccion', tras: 0 }],
      mision: [{ tipo: 'success', tras: 0 }],
      misionExtra: [
        { tipo: 'success', tras: 0 },
        { tipo: 'light', tras: 120 },
      ],
      diaPerfecto: [
        { tipo: 'medium', tras: 0 },
        { tipo: 'medium', tras: 90 },
        { tipo: 'medium', tras: 180 },
      ],
      nivel: [{ tipo: 'heavy', tras: 0 }],
      rango: [
        { tipo: 'heavy', tras: 0 },
        { tipo: 'heavy', tras: 140 },
      ],
      rachaHito: [
        { tipo: 'success', tras: 0 },
        { tipo: 'medium', tras: 120 },
      ],
      penalizacion: [{ tipo: 'warning', tras: 0 }],
      destructiva: [{ tipo: 'rigid', tras: 0 }],
      recuperacion: [{ tipo: 'success', tras: 0 }],
    };
    for (const [e, pasos] of Object.entries(esperado)) expect(VIBRACIONES[e as EventoVibracion]).toEqual(pasos);
  });

  it('cada modo de la rueda encaja con un golpe fuerte al final de la recarga (600 ms)', () => {
    for (const e of ['modoGeneral', 'modoIron', 'modoFocus', 'modoWork', 'modoFounder'] as const) {
      const ultimo = VIBRACIONES[e][VIBRACIONES[e].length - 1];
      expect(ultimo).toEqual({ tipo: 'heavy', tras: 600 });
    }
  });
});
