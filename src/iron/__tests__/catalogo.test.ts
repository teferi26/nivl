import { __fijarIdiomaParaTest } from '@/i18n';
import { textoIron } from '@/components/iron/texto';
import { buscarIron, ejercicioIronDe, entradasIron } from '../catalogo';
import { EJERCICIOS } from '../ejercicios';

afterEach(() => __fijarIdiomaParaTest('es'));

describe('catálogo de IRON para Gimnasio', () => {
  it('cada ejercicio casa con su propio nombre en español (sin nombres repetidos)', () => {
    __fijarIdiomaParaTest('es');
    for (const e of EJERCICIOS) {
      const nombre = textoIron(e.nombre);
      expect(ejercicioIronDe(nombre)?.id).toBe(e.id);
      expect(ejercicioIronDe(nombre.toUpperCase())?.id).toBe(e.id);
    }
  });

  it('en otro idioma casa con el nombre traducido y también con el español', () => {
    const es = Object.fromEntries(EJERCICIOS.map((e) => [e.id, textoIron(e.nombre)]));
    __fijarIdiomaParaTest('en');
    const press = EJERCICIOS.find((e) => e.id === 'press-banca')!;
    expect(ejercicioIronDe(textoIron(press.nombre))?.id).toBe('press-banca');
    expect(ejercicioIronDe(es['press-banca'])?.id).toBe('press-banca');
    expect(entradasIron().find((e) => e.id === 'press-banca')?.nombre).toBe(textoIron(press.nombre));
  });

  it('un nombre libre que no es del catálogo no casa', () => {
    __fijarIdiomaParaTest('es');
    expect(ejercicioIronDe('Mi circuito del jueves')).toBeUndefined();
    expect(buscarIron('sentadilla').length).toBeGreaterThan(0);
  });
});
