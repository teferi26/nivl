// NIVL · FOCUS: temario largo, horario rápido y tarjetas pegadas o generadas.
import { copiarDia, huecoDelDia, leerHora, siguienteHueco } from '@/focus/horarioRapido';
import { MAX_ANVERSO, tarjetasDeIa, tarjetasDesdeTexto, temasDesdeTexto } from '@/focus/importar';
import { agruparPorSeccion, conteoPorEstado, filtrarTemas, numeroDeTema, pierdeCalendario, puedeEmpezarVuelta, seccionQueToca, yaNumerado } from '@/focus/temarioLista';
import type { Clase, EstadoTema } from '@/focus/tipos';

const tema = (estado: EstadoTema, seccion: string | null = null, nombre = 'x') => ({ estado, seccion, nombre });

describe('numeración del temario', () => {
  it.each(['Tema 1', 'tema 12. La Constitución', 'T. 3 Las Cortes', 'Unidad 4', '3. Las Cortes', '12) Derivadas', '7 Integrales', 'IV. La Corona', 'Lección 2', 'Art. 14', 'Bloque 3: Física'])('%s ya lleva número', (n) => {
    expect(yaNumerado(n)).toBe(true);
    expect(numeroDeTema(n, 5)).toBeNull();
  });
  it.each(['Integrales dobles', 'La Generación del 27', 'Árboles binarios', 'Vida y obra'])('%s se numera por su sitio', (n) => {
    expect(yaNumerado(n)).toBe(false);
    expect(numeroDeTema(n, 5)).toBe(5);
  });
});

describe('filtro y secciones', () => {
  const temas = [tema('dominado', 'Bloque I'), tema('repasando', 'Bloque I'), tema('dominado', 'Bloque II'), tema('pendiente', 'Bloque II'), tema('pendiente', null), tema('pendiente', 'Bloque I')];

  it('cuenta por estado', () => {
    expect(conteoPorEstado(temas)).toEqual({ todos: 6, pendiente: 3, repasando: 1, dominado: 2 });
  });
  it('filtra sin perder el orden', () => {
    expect(filtrarTemas(temas, 'pendiente')).toEqual([temas[3], temas[4], temas[5]]);
    expect(filtrarTemas(temas, 'todos')).toHaveLength(6);
  });
  it('agrupa por orden de aparición y junta lo de la misma sección', () => {
    const g = agruparPorSeccion(temas);
    expect(g.map((x) => x.seccion)).toEqual(['Bloque I', 'Bloque II', null]);
    expect(g[0]).toMatchObject({ vistos: 2 });
    expect(g[0]?.temas).toHaveLength(3);
  });
  it('trata la sección en blanco como sin sección', () => {
    expect(agruparPorSeccion([tema('pendiente', '  ')])[0]?.seccion).toBeNull();
  });
  it('abre la primera sección con algo por estudiar', () => {
    expect(seccionQueToca(agruparPorSeccion(temas))).toBe('Bloque I');
    expect(seccionQueToca(agruparPorSeccion([tema('dominado', 'A'), tema('pendiente', 'B')]))).toBe('B');
    expect(seccionQueToca(agruparPorSeccion([tema('dominado', 'A')]))).toBe('A');
    expect(seccionQueToca([])).toBeNull();
  });
});

describe('vueltas y calendario', () => {
  it('solo hay otra vuelta con todo visto', () => {
    expect(puedeEmpezarVuelta([])).toBe(false);
    expect(puedeEmpezarVuelta([tema('dominado'), tema('pendiente')])).toBe(false);
    expect(puedeEmpezarVuelta([tema('dominado'), tema('repasando')])).toBe(true);
  });
  it('solo avisa si volver a pendiente se lleva repasos', () => {
    expect(pierdeCalendario({ repasoEl: '2026-12-01' }, 'pendiente')).toBe(true);
    expect(pierdeCalendario({ repasoEl: null }, 'pendiente')).toBe(false);
    expect(pierdeCalendario({ repasoEl: '2026-12-01' }, 'dominado')).toBe(false);
  });
});

describe('temas en lote', () => {
  it('admite 70 epígrafes largos con secciones y recorta a 160', () => {
    const largo = 'x'.repeat(117);
    const texto = ['# Bloque I', ...Array.from({ length: 70 }, (_, i) => `Tema ${i + 1}. ${largo}`), '# Bloque II', 'y'.repeat(200)].join('\n');
    const r = temasDesdeTexto(texto);
    expect(r.temas).toHaveLength(71);
    expect(r.recortados).toBe(1);
    expect(r.temas[70]).toMatchObject({ seccion: 'Bloque II' });
    expect(r.temas[70]?.nombre).toHaveLength(160);
  });
});

describe('leer una hora a mano', () => {
  it.each([
    ['8', 480],
    ['08', 480],
    ['8h', 480],
    ['8:30', 510],
    ['8.30', 510],
    ['8,30', 510],
    ['8h30', 510],
    ['830', 510],
    ['1430', 870],
    [' 14 ', 840],
    ['0', 0],
  ])('%s', (s, min) => {
    expect(leerHora(s)).toBe(min);
  });
  it.each(['', 'a', '24', '25', '8:3', '8:60', '2500', '12345'])('rechaza «%s»', (s) => {
    expect(leerHora(s)).toBeNull();
  });
});

describe('horario rápido', () => {
  const clase = (id: string, dia: number, inicio: number, fin: number, asignaturaId = 'a'): Clase => ({ id, asignaturaId, dia, inicio, fin, aula: null });

  it('la siguiente empieza donde acabó y dura lo mismo', () => {
    expect(siguienteHueco(480, 540)).toEqual({ inicio: 540, fin: 600 });
    expect(siguienteHueco(1380, 1439)).toBeNull();
    expect(siguienteHueco(1320, 1400)).toEqual({ inicio: 1400, fin: 1439 });
  });
  it('sigue el día por la última clase', () => {
    expect(huecoDelDia([clase('b', 1, 540, 600), clase('a', 1, 480, 540)], 1)).toEqual({ inicio: 600, fin: 660 });
    expect(huecoDelDia([], 1)).toBeNull();
  });
  it('copia un día entero a los demás', () => {
    const r = copiarDia([clase('a', 1, 480, 540, 'x'), clase('b', 1, 540, 600, 'y')], 1, [2, 3]);
    expect(r.saltadas).toBe(0);
    expect(r.nuevas).toEqual([
      { asignaturaId: 'x', dia: 2, inicio: 480, fin: 540, aula: null },
      { asignaturaId: 'y', dia: 2, inicio: 540, fin: 600, aula: null },
      { asignaturaId: 'x', dia: 3, inicio: 480, fin: 540, aula: null },
      { asignaturaId: 'y', dia: 3, inicio: 540, fin: 600, aula: null },
    ]);
  });
  it('no pisa lo que ya hay ni se copia sobre sí mismo', () => {
    const r = copiarDia([clase('a', 1, 480, 540), clase('b', 2, 500, 520)], 1, [1, 2, 2]);
    expect(r).toEqual({ nuevas: [], saltadas: 1 });
  });
});

describe('tarjetas pegadas', () => {
  it('lee CSV con comillas y comas dentro', () => {
    const r = tarjetasDesdeTexto('"¿Qué es, exactamente?","Una cosa, sí"\n"Con ""comillas""";"Vale"\nsuelta,"con, coma"');
    expect(r.tarjetas).toEqual([
      { anverso: '¿Qué es, exactamente?', reverso: 'Una cosa, sí' },
      { anverso: 'Con "comillas"', reverso: 'Vale' },
      { anverso: 'suelta', reverso: 'con, coma' },
    ]);
    expect(r.descartadas).toBe(0);
  });
  it('una sola coma separa; con varias no se adivina', () => {
    const r = tarjetasDesdeTexto('Capital de Francia,París\nuno, dos, tres');
    expect(r.tarjetas).toEqual([{ anverso: 'Capital de Francia', reverso: 'París' }]);
    expect(r.descartadas).toBe(1);
  });
  it('salta la cabecera de una hoja de cálculo', () => {
    const r = tarjetasDesdeTexto('Pregunta;Respuesta\na;b');
    expect(r.tarjetas).toEqual([{ anverso: 'a', reverso: 'b' }]);
    expect(r.descartadas).toBe(0);
  });
  it('la barra manda sobre la coma', () => {
    expect(tarjetasDesdeTexto('uno, dos | tres, cuatro').tarjetas).toEqual([{ anverso: 'uno, dos', reverso: 'tres, cuatro' }]);
  });
});

describe('tarjetas generadas', () => {
  it('sanea la respuesta y quita repetidas', () => {
    const r = tarjetasDeIa([{ frente: ' ¿Mitosis? ', dorso: 'División \u2014 celular' }, { frente: '¿MITOSIS?', dorso: 'otra' }, { frente: '', dorso: 'x' }, { frente: 'a' }, null, 3]);
    expect(r).toHaveLength(1);
    expect(r[0]?.anverso).toBe('¿Mitosis?');
    expect(r[0]?.reverso).not.toMatch(/[–—]/);
  });
  it('recorta a los topes de la tabla', () => {
    expect(tarjetasDeIa([{ frente: 'x'.repeat(900), dorso: 'y' }])[0]?.anverso).toHaveLength(MAX_ANVERSO);
  });
  it.each([null, undefined, 'texto', { frente: 'a', dorso: 'b' }])('sin array, nada: %p', (v) => {
    expect(tarjetasDeIa(v)).toEqual([]);
  });
});
