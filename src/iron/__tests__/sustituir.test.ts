// NIVL · IRON · El botón «Sustituir»: mismo grupo o nada, y respeta el material.
// Una sola versión para todo el catálogo (fase 2 integrada): los 5 del
// prototipo aparte y, en el catálogo completo, cada grupo.
import { EJERCICIOS } from '../ejercicios';
import { cabeConMaterial, sustituto } from '../sustituir';
import type { Ejercicio } from '../tipos';

const base = EJERCICIOS.find((e) => e.id === 'press-banca') as Ejercicio;
const copia = (id: string, cambios: Partial<Ejercicio>): Ejercicio => ({ ...base, id, ...cambios });

describe('sustituto', () => {
  it('con los 5 del prototipo no hay dos del mismo grupo: no inventa', () => {
    const prototipo = EJERCICIOS.slice(0, 5);
    for (const e of prototipo) expect(sustituto(e.id, { catalogo: prototipo })).toBeNull();
  });

  // core, cardio y movilidad son una familia (se cruzan a mano: burpees ↔ mountain climbers).
  const familia = (g: string) => (g === 'cardio' || g === 'movilidad' ? 'core' : g);

  it('en el catálogo completo, cada ejercicio tiene sustituto y es de su grupo', () => {
    for (const e of EJERCICIOS) {
      const s = sustituto(e.id);
      expect(s).not.toBeNull();
      expect(`${e.id} → ${familia(s?.ejercicio.grupo ?? '')}`).toBe(`${e.id} → ${familia(e.grupo)}`);
    }
  });

  it('los sustitutos escritos a mano son del mismo grupo (o de su familia)', () => {
    for (const e of EJERCICIOS)
      for (const id of e.sustitutos) {
        const otro = EJERCICIOS.find((x) => x.id === id);
        expect(`${e.id} → ${id} (${familia(otro?.grupo ?? '?')})`).toBe(`${e.id} → ${id} (${familia(e.grupo)})`);
      }
  });

  it('cada carpeta de grupo tiene en casa algo que proponer: sin material, el sustituto sigue en su grupo', () => {
    for (const e of EJERCICIOS) {
      const s = sustituto(e.id, { material: [] });
      if (s) expect(familia(s.ejercicio.grupo)).toBe(familia(e.grupo));
    }
  });

  it('propone el del mismo grupo que más principales comparte', () => {
    const fondos = copia('fondos', { material: ['peso_corporal'], musculos: { principales: ['triceps'], secundarios: [] } });
    const aperturas = copia('aperturas', { material: ['mancuerna', 'banco'] });
    const catalogo = [...EJERCICIOS, fondos, aperturas];
    expect(sustituto('press-banca', { catalogo })).toEqual({ ejercicio: aperturas, motivo: 'grupo' });
  });

  it('la lista escrita a mano va primero', () => {
    const fondos = copia('fondos', { material: ['peso_corporal'], musculos: { principales: ['triceps'], secundarios: [] } });
    const aperturas = copia('aperturas', { material: ['mancuerna', 'banco'] });
    const press = { ...base, sustitutos: ['fondos'] };
    const catalogo = [press, fondos, aperturas];
    expect(sustituto('press-banca', { catalogo })?.ejercicio.id).toBe('fondos');
    expect(sustituto('press-banca', { catalogo })?.motivo).toBe('elegido');
  });

  it('filtra por el material que hay y por lo ya descartado', () => {
    const aperturas = copia('aperturas', { material: ['mancuerna', 'banco'] });
    const flexiones = copia('flexiones', { material: ['peso_corporal'] });
    const catalogo = [base, aperturas, flexiones];
    expect(sustituto('press-banca', { catalogo, material: ['barra'] })?.ejercicio.id).toBe('flexiones');
    expect(sustituto('press-banca', { catalogo, excluir: ['aperturas', 'flexiones'] })).toBeNull();
  });

  it('id desconocido: null', () => {
    expect(sustituto('no-existe')).toBeNull();
  });

  it('el peso corporal siempre cabe', () => {
    expect(cabeConMaterial(EJERCICIOS.find((e) => e.id === 'plancha') as Ejercicio, [])).toBe(true);
  });
});
