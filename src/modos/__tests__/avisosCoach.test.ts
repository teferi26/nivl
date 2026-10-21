// Modos · chat del coach entre modos: qué avisos «Ir a {modo}» se pintan.
import {
  avisosDeModo,
  misionDe,
  misionDeAccion,
  misionesDeMensaje,
  resultadosBuenos,
  type EstadoAvisos,
} from '../avisosCoach';

const TODOS: EstadoAvisos['activados'] = ['iron', 'focus', 'work', 'founder'];
const enIron: EstadoAvisos = { activo: true, modo: 'iron', activados: TODOS };

describe('avisosDeModo', () => {
  it('desde IRON, una misión de FOCUS avisa «Ir a FOCUS»', () => {
    expect(avisosDeModo([{ titulo: 'Repasa el tema 4', modos: ['focus'] }], enIron)).toEqual([
      { modo: 'focus', titulos: ['Repasa el tema 4'] },
    ]);
  });

  it('sin modo no se avisa', () => {
    expect(avisosDeModo([{ titulo: 'Leer', modos: [] }], enIron)).toEqual([]);
  });

  it('una misión del mundo en el que estás no se avisa, aunque tenga otros modos', () => {
    expect(avisosDeModo([{ titulo: 'Pierna', modos: ['iron'] }], enIron)).toEqual([]);
    expect(avisosDeModo([{ titulo: 'Caminar estudiando', modos: ['iron', 'focus'] }], enIron)).toEqual([]);
  });

  it('varias de otros modos: un aviso por modo, en el orden de la rueda y sin repetir', () => {
    const avisos = avisosDeModo(
      [
        { titulo: 'Llamar a 10 clientes', modos: ['founder'] },
        { titulo: 'Repasa el tema 4', modos: ['focus'] },
        { titulo: 'Simulacro', modos: ['focus'] },
        { titulo: 'Simulacro', modos: ['focus'] },
        { titulo: 'Informe', modos: ['work', 'founder'] },
      ],
      enIron,
    );
    expect(avisos).toEqual([
      { modo: 'focus', titulos: ['Repasa el tema 4', 'Simulacro'] },
      { modo: 'work', titulos: ['Informe'] },
      { modo: 'founder', titulos: ['Llamar a 10 clientes', 'Informe'] },
    ]);
  });

  it('desde NIVL (General) también avisa: la misión es de un mundo propio', () => {
    expect(avisosDeModo([{ titulo: 'Repasa', modos: ['focus'] }], { ...enIron, modo: 'general' })).toEqual([
      { modo: 'focus', titulos: ['Repasa'] },
    ]);
  });

  it('solo a modos activados', () => {
    expect(avisosDeModo([{ titulo: 'Repasa', modos: ['focus'] }], { ...enIron, activados: ['iron'] })).toEqual([]);
  });

  it('con modos_activos apagado, nada', () => {
    expect(avisosDeModo([{ titulo: 'Repasa', modos: ['focus'] }], { ...enIron, activo: false })).toEqual([]);
  });
});

describe('de dónde sale la misión', () => {
  it('misionDe limpia los modos y exige título', () => {
    expect(misionDe({ titulo: ' Repasa ', modos: ['WORK', 'focus', 'general', 'x', 'focus'] })).toEqual({
      titulo: 'Repasa',
      modos: ['focus', 'work'],
    });
    expect(misionDe({ titulo: '', modos: ['focus'] })).toBeNull();
    expect(misionDe({ titulo: 'x', modos: [] })).toBeNull();
    expect(misionDe(null)).toBeNull();
  });

  it('del stream: solo crear_mision que salió bien', () => {
    const mision = { titulo: 'Repasa', modos: ['focus'] };
    expect(misionDeAccion({ name: 'crear_mision', ok: true, mision })).toEqual({ titulo: 'Repasa', modos: ['focus'] });
    expect(misionDeAccion({ name: 'crear_mision', ok: false, mision })).toBeNull();
    expect(misionDeAccion({ name: 'editar_mision', ok: true, mision })).toBeNull();
    expect(misionDeAccion({ name: 'crear_mision', ok: true })).toBeNull();
  });

  it('del hilo guardado: tool_use con su tool_result sin error', () => {
    const turno = {
      content: [
        { type: 'text', text: 'Hecho.' },
        { type: 'tool_use', id: 'a', name: 'crear_mision', input: { titulo: 'Repasa el tema 4', modos: ['focus'] } },
        { type: 'tool_use', id: 'b', name: 'crear_mision', input: { titulo: 'Falló', modos: ['work'] } },
        { type: 'tool_use', id: 'c', name: 'crear_mision', input: { titulo: 'Sin modo', modos: [] } },
        { type: 'tool_use', id: 'd', name: 'crear_mision', input: { titulo: 'Sin resultado', modos: ['founder'] } },
      ],
    };
    const resultados = {
      content: [
        { type: 'tool_result', tool_use_id: 'a', content: 'ok' },
        { type: 'tool_result', tool_use_id: 'b', content: 'Error', is_error: true },
        { type: 'tool_result', tool_use_id: 'c', content: 'ok' },
      ],
    };
    const buenos = resultadosBuenos([turno, resultados]);
    expect(misionesDeMensaje(turno, buenos)).toEqual([{ titulo: 'Repasa el tema 4', modos: ['focus'] }]);
  });
});
