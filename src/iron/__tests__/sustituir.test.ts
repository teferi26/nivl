// NIVL · IRON · El botón «Sustituir»: mismo grupo o nada, y respeta el material.
import { EJERCICIOS } from '../ejercicios';
import { cabeConMaterial, sustituto } from '../sustituir';
import type { Ejercicio } from '../tipos';

const base = EJERCICIOS.find((e) => e.id === 'press-banca') as Ejercicio;
const copia = (id: string, cambios: Partial<Ejercicio>): Ejercicio => ({ ...base, id, ...cambios });

describe('sustituto', () => {
  it('con los 5 del prototipo no hay dos del mismo grupo: no inventa', () => {
    const catalogo = EJERCICIOS.slice(0, 5);
    for (const e of catalogo) expect(sustituto(e.id, { catalogo })).toBeNull();
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
