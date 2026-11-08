import { siguienteEpoch } from '../healthmath';

const antes = (uid: string | null, accepted: boolean, revision: number, epoch: number) => ({ uid, value: { accepted, revision, epoch } });

describe('siguienteEpoch', () => {
  it('la primera lectura tras entrar no remonta, diga lo que diga', () => {
    expect(siguienteEpoch(antes(null, false, 0, 0), 'a', { accepted: true, revision: 3 })).toBe(0);
    expect(siguienteEpoch(antes(null, false, 0, 0), 'a', null)).toBe(0);
  });

  it('releer lo mismo no remonta', () => {
    expect(siguienteEpoch(antes('a', true, 3, 4), 'a', { accepted: true, revision: 3 })).toBe(4);
  });

  it('remonta si cambia el sí, la revisión o la cuenta', () => {
    expect(siguienteEpoch(antes('a', true, 3, 4), 'a', { accepted: false, revision: 3 })).toBe(5);
    expect(siguienteEpoch(antes('a', true, 3, 4), 'a', { accepted: true, revision: 4 })).toBe(5);
    expect(siguienteEpoch(antes('a', true, 3, 4), 'b', { accepted: true, revision: 3 })).toBe(5);
  });

  it('un fallo de lectura ya con cuenta remonta: no se deja nada de salud a la vista', () => {
    expect(siguienteEpoch(antes('a', true, 3, 4), 'a', null)).toBe(5);
  });
});
