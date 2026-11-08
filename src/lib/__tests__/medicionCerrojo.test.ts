import { conCerrojoCardio } from '../cerrojoCardio';

const espera = () => new Promise((r) => setTimeout(r, 1));

describe('conCerrojoCardio', () => {
  it('dos pagos de la misma persona no se solapan', async () => {
    const orden: string[] = [];
    const paga = (id: string) => async () => {
      orden.push(`lee ${id}`);
      await espera();
      orden.push(`paga ${id}`);
      return id;
    };
    await expect(Promise.all([conCerrojoCardio('u', paga('a')), conCerrojoCardio('u', paga('b'))])).resolves.toEqual(['a', 'b']);
    expect(orden).toEqual(['lee a', 'paga a', 'lee b', 'paga b']);
  });

  it('un fallo no bloquea al siguiente', async () => {
    const falla = conCerrojoCardio('u', async () => {
      throw new Error('red');
    });
    await expect(falla).rejects.toThrow('red');
    await expect(conCerrojoCardio('u', async () => 1)).resolves.toBe(1);
  });

  it('dos personas no se esperan', async () => {
    let soltar: () => void = () => {};
    const primera = conCerrojoCardio('a', () => new Promise<void>((r) => (soltar = r)));
    await expect(conCerrojoCardio('b', async () => 'b')).resolves.toBe('b');
    await espera();
    soltar();
    await primera;
  });
});
