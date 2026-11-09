import fs from 'fs';
import path from 'path';
import { __fijarIdiomaParaTest } from '@/i18n';
import { lineaCrisis } from '../consentmath';
import { LINEAS_CRISIS, lineasDe } from '../crisis';

const raiz = path.resolve(__dirname, '..', '..', '..');
const leer = (r: string) => fs.readFileSync(path.join(raiz, r), 'utf8');

describe('líneas de crisis', () => {
  afterEach(() => __fijarIdiomaParaTest('es'));

  test('cada país con número cita una fuente https', () => {
    for (const [pais, fila] of Object.entries(LINEAS_CRISIS)) {
      expect(pais).toMatch(/^[A-Z]{2}$/);
      expect(fila.crisis ?? fila.emergencias).toBeTruthy();
      expect(fila.fuente).toMatch(/^https:\/\//);
    }
  });

  test('España conserva 024 y 112', () => {
    expect(lineaCrisis('ES')).toContain('024');
    expect(lineaCrisis('ES')).toContain('112');
  });

  test('cada país recibe solo sus números', () => {
    expect(lineasDe('fr')).toEqual({ crisis: '3114', emergencias: '112' });
    expect(lineaCrisis('US')).toContain('988');
    expect(lineaCrisis('US')).not.toContain('024');
    expect(lineaCrisis('IT')).not.toMatch(/024|988/);
  });

  test.each([null, 'ZZ'])('sin país conocido (%s) no se escribe ningún número', (region) => {
    expect(lineaCrisis(region)).not.toMatch(/\d/);
  });

  test.each(['en', 'fr', 'de', 'it', 'pt'] as const)('%s: la plantilla usa los números del país', (idioma) => {
    __fijarIdiomaParaTest(idioma);
    expect(lineaCrisis('DE')).toContain('0800 1110111');
    expect(lineaCrisis('CA')).toContain('9-8-8');
    expect(lineaCrisis('IT')).toContain('112');
    expect(lineaCrisis('ZZ')).not.toMatch(/\d/);
  });

  test('la copia del coach es la misma tabla', () => {
    const tabla = (s: string) => s.slice(s.indexOf('const FUENTE_112_UE'), s.indexOf('/** Las líneas del país'));
    expect(tabla(leer('supabase/functions/_shared/crisis.ts'))).toBe(tabla(leer('src/lib/crisis.ts')));
  });

  test('la doctrina del coach ya no fija teléfonos de España', () => {
    const k = leer('supabase/functions/_shared/knowledge.ts');
    expect(k).toContain('${TABLA_CRISIS}');
    expect(k).not.toContain('se le dieron el 024');
  });
});
