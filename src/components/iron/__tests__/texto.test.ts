// NIVL · IRON · La ficha y la demo encuentran el nombre de cualquier músculo,
// grupo o material, lo haya añadido el motor (`iron`) o un grupo de la fase 2
// (`iron-<grupo>`), en español y en los idiomas traducidos.
import { __fijarIdiomaParaTest } from '@/i18n';
import { IDIOMAS_TRADUCIDOS } from '@/i18n/traducidos';
import { EJERCICIOS } from '@/iron/ejercicios';
import { GRUPOS, MUSCULOS } from '@/iron/musculos';
import { nombreIron } from '../texto';

const MATERIALES = [...new Set(EJERCICIOS.flatMap((e) => e.material))];

describe.each(['es', ...IDIOMAS_TRADUCIDOS] as const)('nombreIron (%s)', (idioma) => {
  beforeAll(() => __fijarIdiomaParaTest(idioma));
  afterAll(() => __fijarIdiomaParaTest('es'));

  it('cada músculo del mapa tiene nombre (no el id)', () => {
    for (const m of MUSCULOS) expect(nombreIron('musculo', m)).not.toBe(m);
  });
  it('cada grupo, de entrega o muscular, tiene nombre', () => {
    for (const g of GRUPOS) expect(nombreIron('grupo', g)).not.toBe(g);
  });
  it('cada material que usa el catálogo tiene nombre', () => {
    for (const m of MATERIALES) expect(nombreIron('material', m)).not.toBe(m);
  });
});
