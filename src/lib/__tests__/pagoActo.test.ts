import { describe, expect, test } from '@jest/globals';
import { lineaFaltan, piezasCeremonia, rangoDeSalida } from '@/components/ui/ceremoniaTexto';
import { lineaEnJuego } from '@/components/hoy/enJuego';
import { decidir } from '../celebracionCola';
import { enJuegoHoy, reglasSinMarcarHoy } from '../closing';
import { dateKeyEnZona } from '../dates';
import { CARDIO_DAILY_CAP, CARDIO_SESSION_XP, cardioXp } from '../game';
import {
  anuncioActo,
  anuncioCardio,
  descuentoDeMision,
  kmES,
  numeroES,
  pagoDelModulo,
  primeraSesionQuePropaga,
  xpPagado,
} from '../pagoActo';
import { celebracionesEntre, estadoDe, RANGOS, type Celebracion } from '../progression';
import type { Quest } from '../types';

describe('cardio · la misión enlazada descuenta una sola vez al día', () => {
  const base = CARDIO_SESSION_XP;

  test('primera sesión con misión que paga más que la base: el módulo no cobra', () => {
    const eco = { xp: 50, xpMisiones: 50 };
    expect(pagoDelModulo(base, eco, true)).toBe(Math.max(0, base - 50));
  });

  test('primera sesión con la misión marcada a mano antes: también descuenta', () => {
    expect(descuentoDeMision({ xp: 0, xpMisiones: 25 }, true)).toBe(25);
  });

  test('segunda sesión del día: la misión ya pagada NO vuelve a descontar', () => {
    // La primera sesión descontada guarda 0 XP: el tope de cardio sigue entero.
    const baseSegunda = cardioXp('correr', 0);
    expect(pagoDelModulo(baseSegunda, { xp: 0, xpMisiones: 50 }, false)).toBe(baseSegunda);
  });

  test('segunda sesión tras un paseo: la misión se marca ahora y descuenta lo de ahora', () => {
    expect(primeraSesionQuePropaga(['caminar'])).toBe(true);
    expect(descuentoDeMision({ xp: 25, xpMisiones: 25 }, false)).toBe(25);
  });

  test('qué cuenta como primera', () => {
    expect(primeraSesionQuePropaga([])).toBe(true);
    expect(primeraSesionQuePropaga(['caminar', 'caminar'])).toBe(true);
    expect(primeraSesionQuePropaga(['correr'])).toBe(false);
    expect(primeraSesionQuePropaga(['caminar', 'bici'])).toBe(false);
  });

  test('sin eco, sin descuento', () => {
    expect(pagoDelModulo(base, null, true)).toBe(base);
  });
});

describe('xpPagado: lo que entró, no lo pedido', () => {
  test('recorte del servidor', () => {
    expect(xpPagado(40, 1000, 1010)).toBe(10);
  });
  test('nunca más de lo pedido ni negativo', () => {
    expect(xpPagado(40, 1000, 1200)).toBe(40);
    expect(xpPagado(40, 1000, 990)).toBe(0);
  });
});

describe('anuncios', () => {
  test('cardio: solo la misión', () => {
    expect(
      anuncioCardio({
        xpMision: 50,
        marcadas: ['Correr 5 km'],
        xpModulo: 0,
        pedidoModulo: 0,
        misionYaPagada: true,
        esCorreccion: false,
        topeDiario: CARDIO_DAILY_CAP,
      }),
    ).toBe('+50 XP de la misión «Correr 5 km» (marcada sola).');
  });

  test('cardio: solo el módulo (sin misión enlazada)', () => {
    expect(
      anuncioCardio({
        xpMision: 0,
        marcadas: [],
        xpModulo: 40,
        pedidoModulo: 40,
        misionYaPagada: false,
        esCorreccion: false,
        topeDiario: CARDIO_DAILY_CAP,
      }),
    ).toBe('+40 XP a FUE por la sesión.');
  });

  test('cardio: misión y módulo', () => {
    expect(
      anuncioCardio({
        xpMision: 25,
        marcadas: ['Correr'],
        xpModulo: 15,
        pedidoModulo: 15,
        misionYaPagada: true,
        esCorreccion: false,
        topeDiario: CARDIO_DAILY_CAP,
      }),
    ).toBe('+40 XP: 25 de la misión «Correr» (marcada sola) + 15 a FUE por la sesión.');
  });

  test('cardio: sin pago, por qué', () => {
    const comun = { xpMision: 0, marcadas: [], xpModulo: 0, topeDiario: CARDIO_DAILY_CAP };
    expect(anuncioCardio({ ...comun, pedidoModulo: 0, misionYaPagada: false, esCorreccion: true })).toMatch(/corrige/);
    expect(anuncioCardio({ ...comun, pedidoModulo: 40, misionYaPagada: false, esCorreccion: false })).toMatch(/tope diario/);
    expect(anuncioCardio({ ...comun, pedidoModulo: 0, misionYaPagada: true, esCorreccion: false })).toMatch(
      /ya estaba marcada y pagada/,
    );
    expect(anuncioCardio({ ...comun, pedidoModulo: 0, misionYaPagada: false, esCorreccion: false })).toMatch(
      /máximo de cardio \(60 XP\)/,
    );
  });

  test('acto genérico: vacío si no entró nada', () => {
    expect(anuncioActo({ xpMision: 0, marcadas: [], xpModulo: 0, deModulo: 'a VIT por el pesaje' })).toBe('');
    expect(anuncioActo({ xpMision: 0, marcadas: [], xpModulo: 5, deModulo: 'a VIT por el pesaje' })).toBe(
      '+5 XP a VIT por el pesaje.',
    );
  });

  test('sin guion largo en ningún texto', () => {
    const textos = [
      anuncioCardio({ xpMision: 1, marcadas: ['A', 'B'], xpModulo: 1, pedidoModulo: 1, misionYaPagada: false, esCorreccion: false, topeDiario: 60 }),
      anuncioCardio({ xpMision: 0, marcadas: [], xpModulo: 0, pedidoModulo: 1, misionYaPagada: false, esCorreccion: false, topeDiario: 60 }),
    ];
    for (const t of textos) expect(t).not.toMatch(/[—–]/);
  });
});

describe('números con coma', () => {
  test('km', () => {
    expect(kmES(12.5)).toBe('12,5 km');
    expect(kmES(5)).toBe('5 km');
    expect(kmES(5.25)).toBe('5,25 km');
    expect(kmES(null)).toBe('-');
    expect(kmES(Number.NaN)).toBe('-');
  });
  test('decimales a medida', () => {
    expect(numeroES(42.36, 1)).toBe('42,4');
    expect(numeroES(0, 1)).toBe('0');
  });
});

describe('reglas sin marcar hoy', () => {
  const reglas = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  test('sin juicio empezado no cuenta ninguna', () => {
    expect(reglasSinMarcarHoy({ reglas, marcadasHoy: new Set(), juicioEmpezado: false })).toBe(0);
  });
  test('cuenta las no marcadas', () => {
    expect(reglasSinMarcarHoy({ reglas, marcadasHoy: new Set(['a']), juicioEmpezado: true })).toBe(2);
  });
  test('entran en enJuegoHoy y en su línea', () => {
    const q: Quest = {
      id: 'q1', user_id: 'u', title: 'Leer', stat: 'INT', difficulty: 'media', days_of_week: [1, 2, 3, 4, 5, 6, 7],
      requires_evidence: false, active: true, is_penalty: false, penalty_date: null, penalty_xp: null, is_bonus: false,
      acquired_at: null, acquired_streak: null, created_at: '',
    } as Quest;
    const j = enJuegoHoy({ questsHoy: [q], completadasHoy: new Set(['q1']), streak: 3, stones: 0, reglasSinMarcar: 2 });
    expect(j.pendientes).toBe(0);
    expect(j.xpEnJuego).toBe(50);
    expect(lineaEnJuego(j, 3)?.texto).toBe('Te quedan reglas del contrato por marcar. Si no, −50 XP.');
  });
  test('con piedra, la línea avisa de que las reglas siguen costando', () => {
    const j = { pendientes: 2, faltanParaSalvar: 2, rachaEnRiesgo: false, gastariaPiedra: true, xpEnJuego: 25 };
    expect(lineaEnJuego(j, 4)?.texto).toBe(
      'Si no llegas, una piedra protegerá tu racha esta noche. Las reglas sin marcar costarían −25 XP.',
    );
  });
});

describe('día en la zona del perfil', () => {
  // 2026-10-04 23:30 UTC: en Madrid ya es día 5; en Nueva York, aún día 4.
  const instante = new Date(Date.UTC(2026, 9, 4, 23, 30));
  test('zonas distintas, días distintos', () => {
    expect(dateKeyEnZona('Europe/Madrid', instante)).toBe('2026-10-05');
    expect(dateKeyEnZona('America/New_York', instante)).toBe('2026-10-04');
  });
  test('sin zona o zona inválida: la del dispositivo', () => {
    const d = new Date(2026, 0, 15, 12);
    expect(dateKeyEnZona(null, d)).toBe('2026-01-15');
    expect(dateKeyEnZona('Zona/Inventada', d)).toBe('2026-01-15');
  });
});

describe('ceremonia', () => {
  const perfil = (xp: number) => ({ xp_total: xp, streak_days: 0, protection_stones: 0 });

  test('«Faltan 0 niveles» nunca sale', () => {
    expect(lineaFaltan(0, 0)).toBeNull();
    expect(lineaFaltan(0, null)).toBeNull();
    expect(lineaFaltan(0, 40)).toBe('Faltan 40 días activos');
    expect(lineaFaltan(0, 1)).toBe('Falta 1 día activo');
    expect(lineaFaltan(1, null)).toBe('Falta 1 nivel');
    expect(lineaFaltan(3, 40)).toBe('Faltan 3 niveles y 40 días activos');
    expect(lineaFaltan(1, 1)).toBe('Faltan 1 nivel y 1 día activo');
  });

  test('subir varios niveles de golpe enseña el nivel de antes de verdad', () => {
    const antes = estadoDe(perfil(0), []);
    const despues = estadoDe(perfil(2000), []);
    const [c] = celebracionesEntre(antes, despues, { fecha: '2026-10-04' }).filter((x) => x.tipo === 'nivel' || x.tipo === 'grado');
    expect(c).toBeDefined();
    if (c!.tipo === 'nivel') expect(c!.desde).toBe(antes.nivel);
    if (c!.tipo === 'grado') expect(c!.desde).toBe(antes.grado);
    const salto: Celebracion = { tipo: 'nivel', clave: 'nivel:6', intensidad: 'media', nivel: 6, xpEnNivel: 0, xpSiguiente: 100, desde: 3 };
    expect(piezasCeremonia(salto)).toMatchObject({ viejo: '3', nuevo: '6' });
    const grado: Celebracion = { tipo: 'grado', clave: 'grado:E:3', intensidad: 'media', rango: 'E', nombre: 'X', grado: 3, desde: 1 };
    expect(piezasCeremonia(grado)).toMatchObject({ viejo: 'I', nuevo: 'III' });
  });

  test('rango: sale el rango de antes, aunque se salten dos', () => {
    const r = RANGOS[2]!;
    const c: Celebracion = {
      tipo: 'rango', clave: `rango:${r.id}`, intensidad: 'epica', rango: r.id, nombre: r.nombre, titulo: r.titulo,
      marco: r.marco, corona: r.corona, lema: r.lema, desde: RANGOS[0]!.id,
    };
    expect(rangoDeSalida(c)).toBe(RANGOS[0]!.id);
    expect(piezasCeremonia(c).viejo).toBe(RANGOS[0]!.id);
    // Sin `desde`, el inmediatamente anterior.
    expect(rangoDeSalida({ ...c, desde: undefined })).toBe(RANGOS[1]!.id);
  });

  test('nivel sin desde: el anterior', () => {
    const c: Celebracion = { tipo: 'nivel', clave: 'nivel:5', intensidad: 'media', nivel: 5, xpEnNivel: 0, xpSiguiente: 100 };
    expect(piezasCeremonia(c).viejo).toBe('4');
  });
});

describe('cola de celebraciones: la racha de la tarjeta es la que se ve', () => {
  test('rachaVista manda sobre streak_days en el estado', () => {
    const perfilDespues = { xp_total: 500, streak_days: 6, protection_stones: 0 };
    const m = decidir('a', {
      perfilAntes: { xp_total: 0, streak_days: 6, protection_stones: 0 },
      perfilDespues,
      logrosNuevos: [],
      extra: [],
      resumen: [],
      rachaVista: 7,
      cerrada: true,
    }, new Set());
    expect(m?.estado?.racha).toBe(7);
    const sin = decidir('b', { perfilAntes: perfilDespues, perfilDespues: { ...perfilDespues, xp_total: 900 }, logrosNuevos: [], extra: [], resumen: ['x'], cerrada: true }, new Set());
    expect(sin?.estado?.racha).toBe(6);
  });
});
