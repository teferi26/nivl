import { buscarEjercicios, casarEjercicio, indiceCasado, normalizarNombre } from '../casar';

const ENTRADAS = [
  { id: 'press-banca', nombres: ['Bench press', 'Press de banca con barra'] },
  {
    id: 'sentadilla-barra',
    nombres: ['Barbell back squat', 'Sentadilla con barra'],
  },
  {
    id: 'curl-biceps-mancuerna',
    nombres: ['Dumbbell biceps curl', 'Curl de bíceps con mancuerna'],
  },
  // Un nombre repetido: gana el primero del catálogo.
  { id: 'otro', nombres: ['Press de banca con barra'] },
];

describe('normalizarNombre', () => {
  it('quita tildes, mayúsculas, signos y espacios de más', () => {
    expect(normalizarNombre('  Curl de BÍCEPS  (mancuerna) ')).toBe('curl de biceps mancuerna');
    expect(normalizarNombre('Élévation latérale')).toBe('elevation laterale');
    expect(normalizarNombre('Kniebeuge mit Langhantel, groß')).toBe('kniebeuge mit langhantel gross');
    expect(normalizarNombre('')).toBe('');
  });
});

describe('casarEjercicio', () => {
  const indice = indiceCasado(ENTRADAS);

  it('casa en el idioma activo y en español', () => {
    expect(casarEjercicio('bench press', indice)).toBe('press-banca');
    expect(casarEjercicio('Press de banca con barra', indice)).toBe('press-banca');
    expect(casarEjercicio('curl de biceps con mancuerna', indice)).toBe('curl-biceps-mancuerna');
    expect(casarEjercicio('SENTADILLA   con barra', indice)).toBe('sentadilla-barra');
  });

  it('no casa por parecido ni con texto vacío', () => {
    expect(casarEjercicio('Press banca', indice)).toBeNull();
    expect(casarEjercicio('Sentadilla', indice)).toBeNull();
    expect(casarEjercicio('   ', indice)).toBeNull();
  });
});

describe('casarEjercicio con alias', () => {
  const CON_ALIAS = [
    // Este alias choca con el nombre oficial de otro ejercicio (y va antes): no se lo quita.
    { id: 'press-inclinado', nombres: ['Press inclinado con barra'], alias: ['Press de banca', 'Press banca inclinado'] },
    { id: 'press-banca', nombres: ['Press de banca'], alias: ['Press banca', 'Bench'] },
    { id: 'dominada', nombres: ['Dominada'], alias: ['Dominadas', 'Pull ups'] },
  ];
  const indice = indiceCasado(CON_ALIAS);

  it('casa por alias, normalizado igual que el nombre', () => {
    expect(casarEjercicio('press banca', indice)).toBe('press-banca');
    expect(casarEjercicio('PULL-UPS', indice)).toBe('dominada');
    expect(casarEjercicio('Press banca inclinado', indice)).toBe('press-inclinado');
  });

  it('un alias nunca pisa el nombre oficial de otro ejercicio', () => {
    expect(casarEjercicio('Press de banca', indice)).toBe('press-banca');
  });

  it('la búsqueda del selector también mira los alias', () => {
    expect(buscarEjercicios('pull', CON_ALIAS).map((e) => e.id)).toEqual(['dominada']);
  });
});

describe('buscarEjercicios', () => {
  it('todas las palabras, en cualquier nombre y sin tildes', () => {
    expect(buscarEjercicios('banca', ENTRADAS).map((e) => e.id)).toEqual(['press-banca', 'otro']);
    expect(buscarEjercicios('BICEPS mancu', ENTRADAS).map((e) => e.id)).toEqual(['curl-biceps-mancuerna']);
    expect(buscarEjercicios('squat', ENTRADAS).map((e) => e.id)).toEqual(['sentadilla-barra']);
    expect(buscarEjercicios('remo', ENTRADAS)).toEqual([]);
  });

  it('consulta vacía: el catálogo entero', () => {
    expect(buscarEjercicios(' ', ENTRADAS)).toHaveLength(ENTRADAS.length);
  });
});
