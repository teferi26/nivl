import {
  completas,
  elegir,
  necesitaPermisoSalud,
  opcionesDe,
  payloadObjetivo,
  porcentajeGuion,
  RESPUESTAS_VACIAS,
  resumenCuestionario,
  validarRespuestas,
  veredicto,
  type Respuestas,
} from '../embudo';

const BASE: Respuestas = {
  ...RESPUESTAS_VACIAS,
  mejora: ['cuerpo', 'trabajo'],
  kind: 'deportista',
  meta: 'carrera',
  cuanto: 'anio',
  freno: ['tiempo'],
  coach: 'nunca',
  min: '30',
  mom: 'primera',
  tono: 'duro',
};

describe('embudo', () => {
  it('la barra empieza en el 5 % y no pasa del 100', () => {
    expect(porcentajeGuion(-1)).toBe(5);
    expect(porcentajeGuion(11)).toBe(100);
    expect(porcentajeGuion(20)).toBe(100);
  });

  it('cambiar de perfil invalida la meta', () => {
    const r = elegir('kind', 'estudiante', BASE);
    expect(r.meta).toBeNull();
    expect(opcionesDe('meta', r.kind)).toContain('oposicion');
  });

  it('una pregunta múltiple alterna', () => {
    expect(elegir('freno', 'movil', BASE).freno).toEqual(['tiempo', 'movil']);
    expect(elegir('freno', 'tiempo', BASE).freno).toEqual([]);
  });

  it('completas pide lo que el onboarding no volverá a preguntar', () => {
    expect(completas(BASE)).toBe(true);
    expect(completas({ ...BASE, tono: null })).toBe(false);
  });

  it('una meta de salud sin permiso no se guarda', () => {
    const p = payloadObjetivo(BASE, false);
    expect(p.goal).toBeNull();
    expect(p.health_data).toBe(false);
    expect(p.reason).not.toContain('cuerpo');
  });

  it('una meta de salud con permiso va marcada como dato de salud', () => {
    const p = payloadObjetivo(BASE, true);
    expect(p.goal).toBeTruthy();
    expect(p.health_data).toBe(true);
    expect(p.reason).toContain('cuerpo');
  });

  it('una meta que no es de salud se guarda sin permiso', () => {
    const r: Respuestas = { ...BASE, kind: 'trabajador', meta: 'ascenso', mejora: ['trabajo'] };
    expect(necesitaPermisoSalud(r)).toBe(false);
    expect(payloadObjetivo(r, false).goal).toBeTruthy();
  });

  it('el resumen cabe en el tope del trigger y no lleva texto libre', () => {
    const r = resumenCuestionario({ ...BASE, mejora: ['cuerpo', 'estudios', 'trabajo', 'negocio', 'disciplina', 'calma'] }, true);
    expect(r.length).toBeLessThan(500);
    expect(r).toMatch(/^tono:duro;/);
  });

  it('el veredicto depende del tono y usa las respuestas', () => {
    expect(veredicto(BASE)).not.toBe(veredicto({ ...BASE, tono: 'tacto' }));
  });

  it('lo guardado se valida: nada que no sea una opción conocida', () => {
    const r = validarRespuestas({ kind: 'deportista', meta: 'oposicion', freno: ['tiempo', 'x'], tono: 'gritar', min: 30 });
    expect(r).toMatchObject({ kind: 'deportista', meta: null, freno: ['tiempo'], tono: null, min: null });
    expect(validarRespuestas('nada')).toBeNull();
  });
});
