import { deMisiones, desgloseXp } from '../voice';

describe('desgloseXp', () => {
  it('sin nada pagado no dice nada', () => {
    expect(desgloseXp([])).toBe('');
    expect(desgloseXp([{ xp: 0, de: 'del diario' }])).toBe('');
  });

  it('una sola parte va sin suma', () => {
    expect(desgloseXp([{ xp: 50, de: 'a FUE por la sesión' }])).toBe('+50 XP a FUE por la sesión.');
  });

  it('el diario con misión enlazada cuadra con lo que enseña la misión', () => {
    // Misión de 10 + resto del módulo hasta 15: el caso del vídeo del 01/10.
    expect(
      desgloseXp([
        { xp: 10, de: deMisiones(['Escribir el diario']) },
        { xp: 5, de: 'a PER por el diario' },
      ]),
    ).toBe('+15 XP: 10 de la misión «Escribir el diario», marcada sola + 5 a PER por el diario.');
  });

  it('omite las partes a cero aunque haya varias', () => {
    expect(
      desgloseXp([
        { xp: 50, de: deMisiones(['Entrenar']) },
        { xp: 0, de: 'a FUE por la sesión' },
        { xp: 25, de: 'a FUE por 1 récord' },
      ]),
    ).toBe('+75 XP: 50 de la misión «Entrenar», marcada sola + 25 a FUE por 1 récord.');
  });
});

describe('deMisiones', () => {
  it('concuerda en número', () => {
    expect(deMisiones(['A'])).toBe('de la misión «A», marcada sola');
    expect(deMisiones(['A', 'B'])).toBe('de las misiones «A», «B», marcadas solas');
  });
});
