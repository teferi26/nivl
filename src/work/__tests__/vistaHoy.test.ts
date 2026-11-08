import { nuevoBloque, pausar, terminar } from '../bloque';
import type { ResultadoBloque } from '../cierreBloque';
import type { EventoTrabajo } from '../tipos';
import {
  bloqueEnCurso,
  desenlaceBloque,
  duracionCercana,
  formatoReloj,
  minutosParaContar,
  proximaReunion,
  vistaBloque,
  vistaWorkHoy,
  type EntradaVistaWork,
  type MisionEntrada,
} from '../vistaHoy';

const HOY = '2026-10-21';
const T0 = 1_000_000_000_000;

const m = (id: string, extra: Partial<MisionEntrada> = {}): MisionEntrada => ({
  id,
  titulo: id,
  hecha: false,
  penalizacion: false,
  xp: 50,
  diaPrioridad: HOY,
  rango: 1,
  creadaEn: null,
  ...extra,
});

const entrada = (c: Partial<EntradaVistaWork> = {}): EntradaVistaWork => ({
  fecha: HOY,
  ahoraMin: 600,
  ahoraMs: T0,
  misiones: [],
  plan: [],
  eventos: [],
  entregas: [],
  sesiones: [],
  bloque: null,
  disponible: true,
  ...c,
});

const ev = (titulo: string, inicio: number | null, fin: number | null): EventoTrabajo => ({ id: titulo, titulo, fecha: HOY, inicio, fin, origen: 'manual' });

describe('vistaWorkHoy', () => {
  it('si las misiones no se leyeron, ni pide plan ni ofrece huecos ni pinta la tarjeta', () => {
    const v = vistaWorkHoy(entrada({ misionesFiables: false }));
    expect(v).toMatchObject({ pedirPlan: false, huecos: 0, preparando: false, ocultarAhora: true });
    expect(vistaWorkHoy(entrada()).ocultarAhora).toBe(false);
  });

  it('sin nada planificado pide el plan', () => {
    const v = vistaWorkHoy(entrada());
    expect(v.pedirPlan).toBe(true);
    expect(v.preparando).toBe(false);
    expect(v.huecos).toBe(3);
  });

  it('sin la migración no pide lo que no se podría guardar', () => {
    const v = vistaWorkHoy(entrada({ disponible: false }));
    expect(v.pedirPlan).toBe(false);
    expect(v.preparando).toBe(true);
    expect(v.huecos).toBe(0);
  });

  it('la primera prioridad es la de Ahora y se puede empezar y soltar', () => {
    const v = vistaWorkHoy(entrada({ misiones: [m('a', { rango: 1 }), m('b', { rango: 2 })] }));
    expect(v.ahora.accion).toBe('empezar_bloque');
    expect(v.ahora.questId).toBe('a');
    expect(v.prioridades[0]).toMatchObject({ id: 'a', actual: true, puedeEmpezar: true, puedeSoltar: true });
    expect(v.prioridades[1]).toMatchObject({ actual: false });
    expect(v.huecos).toBe(1);
  });

  it('una misión fija se puede empezar pero no soltar', () => {
    const v = vistaWorkHoy(entrada({ misiones: [m('fija', { diaPrioridad: null, rango: null })] }));
    expect(v.prioridades[0]).toMatchObject({ puedeEmpezar: true, puedeSoltar: false });
  });

  it('la hecha ni se empieza ni se suelta', () => {
    const v = vistaWorkHoy(entrada({ misiones: [m('a', { hecha: true })] }));
    expect(v.prioridades[0]).toMatchObject({ actual: false, puedeEmpezar: false, puedeSoltar: false });
    expect(v.ahora.tipo).toBe('cerrado');
    expect(v.pedirPlan).toBe(false);
  });

  it('una prioridad de otro día no se enseña', () => {
    const v = vistaWorkHoy(entrada({ misiones: [m('vieja', { diaPrioridad: '2026-10-14' })] }));
    expect(v.prioridades).toEqual([]);
    expect(v.pedirPlan).toBe(true);
  });

  it('la penalización va aparte y no es atacable', () => {
    const v = vistaWorkHoy(entrada({ misiones: [m('p', { penalizacion: true, diaPrioridad: null, bloqueada: true })] }));
    expect(v.prioridades).toEqual([]);
    expect(v.penalizaciones[0]).toMatchObject({ bloqueada: true, puedeEmpezar: false });
  });

  it('con un bloque en marcha no se empieza otro y la suya no se suelta', () => {
    const bloque = nuevoBloque({ clientId: 'c', ahora: T0, fecha: HOY, inicioMin: 600, objetivoMin: 50, questId: 'a', titulo: 'a' });
    const v = vistaWorkHoy(entrada({ misiones: [m('a'), m('b', { rango: 2 })], bloque, ahoraMs: T0 + 60_000 }));
    expect(v.bloqueActivo).toBe(true);
    expect(v.ahora.accion).toBe('seguir_bloque');
    expect(v.prioridades.every((f) => !f.puedeEmpezar)).toBe(true);
    expect(v.prioridades.find((f) => f.id === 'a')?.puedeSoltar).toBe(false);
    expect(v.prioridades.find((f) => f.id === 'b')?.puedeSoltar).toBe(true);
  });

  it('un bloque terminado ya no está en curso', () => {
    const b = terminar(nuevoBloque({ clientId: 'c', ahora: T0, fecha: HOY, inicioMin: 600, objetivoMin: 50 }), T0 + 60_000);
    expect(bloqueEnCurso(b, T0)).toBeNull();
    expect(vistaWorkHoy(entrada({ bloque: b })).bloqueActivo).toBe(false);
  });
});

describe('duracionCercana', () => {
  it.each([
    [null, 50],
    [10, 25],
    [25, 25],
    [37, 25],
    [50, 50],
    [89, 50],
    [90, 90],
    [180, 90],
  ])('%s → %s', (sug, esp) => {
    expect(duracionCercana(sug)).toBe(esp);
  });
});

describe('proximaReunion', () => {
  it('sin eventos con hora, nada', () => {
    expect(proximaReunion([ev('Todo el día', null, null)], HOY, 600)).toBeNull();
  });
  it('coge la siguiente, ignorando las pasadas y otros días', () => {
    const r = proximaReunion([ev('pasada', 500, 550), ev('luego', 700, 730), { ...ev('otro día', 610, 620), fecha: '2026-10-22' }], HOY, 600);
    expect(r).toMatchObject({ titulo: 'luego', enCurso: false, faltan: 100 });
  });
  it('detecta la que está en curso', () => {
    expect(proximaReunion([ev('ahora', 590, 630)], HOY, 600)).toMatchObject({ enCurso: true, faltan: 0, fin: 630 });
  });
});

describe('la pantalla del bloque', () => {
  const b = nuevoBloque({ clientId: 'c', ahora: T0, fecha: HOY, inicioMin: 600, objetivoMin: 50, questId: 'q', titulo: 't' });

  it('formatoReloj redondea hacia arriba y no pasa de minutos', () => {
    expect(formatoReloj(0)).toBe('00:00');
    expect(formatoReloj(1)).toBe('00:01');
    expect(formatoReloj(25 * 60_000)).toBe('25:00');
    expect(formatoReloj(90 * 60_000)).toBe('90:00');
  });

  it('cuenta desde el 80 % con un mínimo de 25', () => {
    expect(minutosParaContar(25)).toBe(25);
    expect(minutosParaContar(50)).toBe(40);
    expect(minutosParaContar(90)).toBe(72);
  });

  it('dice qué pasaría si se para ahora', () => {
    expect(vistaBloque(b, T0 + 3 * 60_000)).toMatchObject({ seGuarda: false, yaCuenta: false, minutosHechos: 3 });
    expect(vistaBloque(b, T0 + 12 * 60_000)).toMatchObject({ seGuarda: true, yaCuenta: false });
    expect(vistaBloque(b, T0 + 40 * 60_000)).toMatchObject({ seGuarda: true, yaCuenta: true, restanteMin: 10, reloj: '10:00' });
  });

  it('en pausa no corre', () => {
    const p = pausar(b, T0 + 10 * 60_000);
    expect(vistaBloque(p, T0 + 30 * 60_000)).toMatchObject({ fase: 'pausado', minutosHechos: 10 });
  });
});

describe('desenlaceBloque', () => {
  const r: ResultadoBloque = { minutos: 50, guardado: true, cuenta: true, xp: 0, marcadas: [], reintentar: false, antes: null, despues: null };
  it('dice lo que pasó de verdad', () => {
    expect(desenlaceBloque({ ...r, xp: 50, marcadas: ['x'] }, true)).toBe('pagado');
    expect(desenlaceBloque({ ...r, xp: 50, marcadas: ['x'], reintentar: true }, true)).toBe('pagado');
    expect(desenlaceBloque({ ...r, reintentar: true }, true)).toBe('pendiente');
    expect(desenlaceBloque({ ...r, reintentar: true, guardado: false }, false)).toBe('pendiente');
    expect(desenlaceBloque({ ...r, guardado: false }, true)).toBe('no_guardado');
    expect(desenlaceBloque({ ...r, marcadas: ['x'] }, true)).toBe('marcado');
    expect(desenlaceBloque(r, true)).toBe('sin_xp');
    expect(desenlaceBloque({ ...r, cuenta: false }, true)).toBe('mision_abierta');
    expect(desenlaceBloque({ ...r, cuenta: false }, false)).toBe('solo_horas');
  });
});
