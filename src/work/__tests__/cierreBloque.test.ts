import { nuevoBloque, terminar, cierreDe, type CierreBloque } from '../bloque';
import { ejecutarCierre, fundirResultado, normalizarGuardado, type DepsCierre, type PerfilXp } from '../cierreBloque';

const HOY = '2026-10-21';
const T0 = 1_000_000_000_000;
type Q = { id: string; title: string; is_penalty: boolean };
const perfil = (xp: number): PerfilXp => ({ xp_total: xp, streak_days: 0, protection_stones: 0 });

function cierre(minutos: number, objetivo = 50, questId: string | null = 'q1', fecha = HOY): CierreBloque {
  const e = nuevoBloque({ clientId: 'c1', ahora: T0, fecha, inicioMin: 600, objetivoMin: objetivo, questId });
  return cierreDe(terminar(e, T0 + minutos * 60_000))!;
}

function deps(over: Partial<DepsCierre<PerfilXp, Q>> = {}) {
  const log: string[] = [];
  const d: DepsCierre<PerfilXp, Q> = {
    registrar: async () => {
      log.push('registrar');
      return true;
    },
    perfil: async () => perfil(1000),
    misiones: async () => [{ id: 'q1', title: 'Propuesta', is_penalty: false }],
    completar: async (p) => {
      log.push('completar');
      return { awarded: true, xp: 50, profile: { ...p, xp_total: p.xp_total + 50 } };
    },
    fijarActoHecho: async () => {
      log.push('fijarActo');
    },
    propagar: async (p) => {
      log.push('propagar');
      return { xp: 0, marcadas: [], profile: p };
    },
    ...over,
  };
  return { d, log };
}

describe('ejecutarCierre', () => {
  it('sigue el orden del contrato y fija el acto antes de propagar', async () => {
    const { d, log } = deps();
    const r = await ejecutarCierre(cierre(50), HOY, false, d);
    expect(log).toEqual(['registrar', 'completar', 'fijarActo', 'propagar']);
    expect(r).toMatchObject({ minutos: 50, guardado: true, cuenta: true, xp: 50, marcadas: ['Propuesta'], reintentar: false });
  });

  it('un bloque corto guarda horas y no paga ni propaga', async () => {
    const { d, log } = deps();
    const r = await ejecutarCierre(cierre(12), HOY, false, d);
    expect(log).toEqual(['registrar']);
    expect(r).toMatchObject({ guardado: true, cuenta: false, xp: 0 });
  });

  it('por debajo del mínimo no registra nada', async () => {
    const { d, log } = deps();
    await ejecutarCierre(cierre(3), HOY, false, d);
    expect(log).toEqual([]);
  });

  it('un bloque de ayer guarda sus horas pero no paga la misión de hoy', async () => {
    const { d, log } = deps();
    await ejecutarCierre(cierre(50, 50, 'q1', '2026-10-20'), HOY, false, d);
    expect(log).toEqual(['registrar']);
  });

  it('no propaga dos veces', async () => {
    const { d, log } = deps();
    await ejecutarCierre(cierre(50), HOY, true, d);
    expect(log).toEqual(['registrar', 'completar']);
  });

  it('no paga una misión de penalización', async () => {
    const { d, log } = deps({ misiones: async () => [{ id: 'q1', title: 'x', is_penalty: true }] });
    await ejecutarCierre(cierre(50), HOY, false, d);
    expect(log).not.toContain('completar');
  });

  it('una misión ya pagada no suma', async () => {
    const { d } = deps({ completar: async (p) => ({ awarded: false, xp: 0, profile: p }) });
    const r = await ejecutarCierre(cierre(50), HOY, false, d);
    expect(r).toMatchObject({ xp: 0, marcadas: [] });
  });

  it('cuenta lo que entró de verdad, no lo calculado (tope diario)', async () => {
    const { d } = deps({ completar: async (p) => ({ awarded: true, xp: 50, profile: { ...p, xp_total: p.xp_total + 10 } }) });
    const r = await ejecutarCierre(cierre(50), HOY, false, d);
    expect(r.xp).toBe(10);
  });

  it('sin red al guardar, sigue y deja el cierre para reintentar', async () => {
    const { d, log } = deps({
      registrar: async () => {
        throw new Error('sin red');
      },
    });
    const r = await ejecutarCierre(cierre(50), HOY, false, d);
    expect(r).toMatchObject({ guardado: false, reintentar: true, xp: 50 });
    expect(log).toContain('completar');
  });

  it('sin perfil no fija el acto: se podrá propagar al reintentar', async () => {
    const { d, log } = deps({
      perfil: async () => {
        throw new Error('sin red');
      },
    });
    const r = await ejecutarCierre(cierre(50), HOY, false, d);
    expect(r.reintentar).toBe(true);
    expect(log).toEqual(['registrar']);
  });

  it('un fallo al propagar no tumba lo pagado', async () => {
    const { d } = deps({
      propagar: async () => {
        throw new Error('x');
      },
    });
    const r = await ejecutarCierre(cierre(50), HOY, false, d);
    expect(r.xp).toBe(50);
    expect(r.reintentar).toBe(false);
  });

  it('suma lo que paga el acto', async () => {
    const { d } = deps({ propagar: async (p) => ({ xp: 25, marcadas: ['Fija'], profile: { ...p, xp_total: p.xp_total + 25 } }) });
    const r = await ejecutarCierre(cierre(50), HOY, false, d);
    expect(r).toMatchObject({ xp: 75, marcadas: ['Propuesta', 'Fija'] });
  });
});

describe('fundirResultado', () => {
  const base = { minutos: 50, guardado: false, cuenta: true, xp: 50, marcadas: ['A'], reintentar: true, antes: perfil(0), despues: perfil(50) };
  it('un reintento no olvida lo pagado ni lo repite', () => {
    const r = fundirResultado(base, { ...base, guardado: true, xp: 0, marcadas: ['A'], reintentar: false, antes: perfil(50), despues: perfil(50) });
    expect(r).toMatchObject({ guardado: true, xp: 50, marcadas: ['A'], reintentar: false });
    expect(r.antes?.xp_total).toBe(0);
  });
});

describe('normalizarGuardado', () => {
  it('descarta lo que no sirve', () => {
    expect(normalizarGuardado(null)).toBeNull();
    expect(normalizarGuardado({ estado: { fase: 'x' } })).toBeNull();
  });
  it('recupera un bloque guardado', () => {
    const estado = nuevoBloque({ clientId: 'c', ahora: T0, fecha: HOY, inicioMin: 1, objetivoMin: 50 });
    const g = normalizarGuardado(JSON.parse(JSON.stringify({ estado, actoHecho: true, resultado: null, visto: false })));
    expect(g).toMatchObject({ actoHecho: true, resultado: null, visto: false });
    expect(g?.estado.clientId).toBe('c');
  });
});
