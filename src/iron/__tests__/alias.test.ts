import { __fijarIdiomaParaTest, IDIOMAS } from '@/i18n';
import { textoIron } from '@/components/iron/texto';
import { ALIAS_IRON } from '../alias';
import { normalizarNombre } from '../casar';
import { ejercicioIronDe } from '../catalogo';
import { EJERCICIOS } from '../ejercicios';

afterEach(() => __fijarIdiomaParaTest('es'));

describe('alias del catálogo de IRON', () => {
  it('cada alias es de un ejercicio que existe', () => {
    const ids = new Set(EJERCICIOS.map((e) => e.id));
    for (const id of Object.keys(ALIAS_IRON)) expect(ids).toContain(id);
  });

  it('ningún alias se repite entre dos ejercicios', () => {
    const visto = new Map<string, string>();
    for (const [id, lista] of Object.entries(ALIAS_IRON)) {
      for (const a of lista) {
        const k = normalizarNombre(a);
        expect(k).not.toBe('');
        const otro = visto.get(k);
        if (otro !== undefined && otro !== id) throw new Error(`«${a}» está en ${otro} y en ${id}`);
        visto.set(k, id);
      }
    }
  });

  it('ningún alias es el nombre oficial de otro ejercicio en ningún idioma', () => {
    for (const lng of IDIOMAS) {
      const oficiales = new Map<string, string>();
      for (const e of EJERCICIOS) oficiales.set(normalizarNombre(textoIron(e.nombre, { lng })), e.id);
      for (const [id, lista] of Object.entries(ALIAS_IRON)) {
        for (const a of lista) {
          const duenio = oficiales.get(normalizarNombre(a));
          if (duenio !== undefined && duenio !== id) throw new Error(`«${a}» (${id}) es el nombre de ${duenio} en ${lng}`);
        }
      }
    }
  });

  it('casa los nombres habituales en España y en inglés', () => {
    __fijarIdiomaParaTest('es');
    const casos: [string, string][] = [
      ['press banca', 'press-banca'],
      ['Press de banca', 'press-banca'],
      ['PRESS BANCA PLANO', 'press-banca'],
      ['Bench press', 'press-banca'],
      ['sentadilla', 'sentadilla-barra'],
      ['Sentadillas', 'sentadilla-barra'],
      ['back squat', 'sentadilla-barra'],
      ['Peso muerto', 'peso-muerto'],
      ['deadlift', 'peso-muerto'],
      ['Dominadas', 'dominada'],
      ['pull-ups', 'dominada'],
      ['Chin-ups', 'dominada-supina'],
      ['Jalón al pecho', 'jalon-pecho'],
      ['jalon al pecho', 'jalon-pecho'],
      ['Lat pulldown', 'jalon-pecho'],
      ['Curl con barra', 'curl-barra'],
      ['Curl de bíceps con mancuerna', 'curl-biceps-mancuerna'],
      ['Remo con barra', 'remo-barra'],
      ['Press militar', 'press-militar-barra'],
      ['OHP', 'press-militar-barra'],
      ['Hip thrust', 'hip-thrust'],
      ['Zancadas atrás', 'zancada-atras-mancuerna'],
      ['Fondos en paralelas', 'fondos-paralelas'],
      ['dips', 'fondos-paralelas'],
      ['Elevaciones laterales', 'elevaciones-laterales'],
      ['Push-ups', 'flexiones'],
    ];
    for (const [nombre, id] of casos) expect([nombre, ejercicioIronDe(nombre)?.id]).toEqual([nombre, id]);
  });

  it('el nombre oficial en inglés casa aunque la interfaz esté en español', () => {
    const en = EJERCICIOS.map((e) => [e.id, textoIron(e.nombre, { lng: 'en' })] as const);
    __fijarIdiomaParaTest('es');
    for (const [id, nombre] of en) expect([nombre, ejercicioIronDe(nombre)?.id]).toEqual([nombre, id]);
  });

  it('los alias también casan con la interfaz en otro idioma', () => {
    __fijarIdiomaParaTest('de');
    expect(ejercicioIronDe('press banca')?.id).toBe('press-banca');
    expect(ejercicioIronDe('Dominadas')?.id).toBe('dominada');
  });

  it('lo ambiguo no casa: vale más no enseñar nada que la técnica de otro movimiento', () => {
    __fijarIdiomaParaTest('es');
    for (const nombre of ['Fondos', 'Zancadas', 'Curl de bíceps', 'Press inclinado', 'Jalón', 'Gemelos', 'Aperturas', 'Encogimientos', 'Curl femoral']) {
      expect([nombre, ejercicioIronDe(nombre)]).toEqual([nombre, undefined]);
    }
  });
});
