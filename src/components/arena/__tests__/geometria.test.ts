import {
  ARCADAS,
  gradasUtiles,
  MEANDRO_UNIDAD,
  PATH_MEANDRO,
  pathArena,
  pathColumna,
  pathLaurel,
  xDelTallo,
} from '../geometria';

/** Números de una cadena `d`. */
const numeros = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
const comandos = (d: string, c: string) => (d.match(new RegExp(c, 'g')) ?? []).length;

describe('laurel', () => {
  it('a 64 de alto reproduce el tallo de la retícula', () => {
    expect(pathLaurel(64).startsWith('M18 62C6 48 6 20 16 2')).toBe(true);
  });

  it('cuatro pares de hojas: un tallo y ocho trazos', () => {
    const d = pathLaurel(88);
    expect(comandos(d, 'M')).toBe(1 + 8);
    expect(comandos(d, 'l')).toBe(8);
  });

  it('escala con el alto y no se sale de la retícula', () => {
    const alto = 88;
    const ancho = (alto * 24) / 64;
    const d = pathLaurel(alto);
    // Solo las coordenadas absolutas (tras M y C) tienen que caber.
    const abs = d.split(/l[^M]*/).join(' ');
    const ns = numeros(abs);
    for (let i = 0; i < ns.length; i += 2) {
      expect(ns[i]).toBeGreaterThanOrEqual(0);
      expect(ns[i]).toBeLessThanOrEqual(ancho);
      expect(ns[i + 1]).toBeGreaterThanOrEqual(0);
      expect(ns[i + 1]).toBeLessThanOrEqual(alto);
    }
  });

  it('el tallo se curva hacia la izquierda y las hojas de fuera caben', () => {
    for (const y of [50, 38, 26, 14]) {
      const x = xDelTallo(y);
      expect(x).toBeLessThan(18);
      expect(x - 7).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('columna', () => {
  it('capitel, fuste, estrías y basa a 96', () => {
    expect(pathColumna(96)).toBe('M2 4H22M4 8H20M6 8V86M18 8V86M10 12V82M14 12V82M4 88H20M2 92H22');
  });

  it('escala el ancho y nunca invierte el fuste', () => {
    expect(pathColumna(72, 48).startsWith('M4 4H44')).toBe(true);
    const d = pathColumna(4);
    expect(d).toContain('V10');
  });
});

describe('arena', () => {
  it('arco: una semielipse por grada y 15 arcadas', () => {
    const d = pathArena(390, 120, 3, 'arco');
    expect(comandos(d, 'A')).toBe(3);
    expect(comandos(d, 'L')).toBe(ARCADAS);
  });

  it('arco: la grada exterior se apoya abajo y no se sale', () => {
    const d = pathArena(390, 120, 3, 'arco');
    expect(d.startsWith('M11.7 119A183.3 110.4 0 0 1 378.3 119')).toBe(true);
    // Arcadas: cada «M x y L x y» dentro del lienzo.
    const arcadas = d.match(/M[\d.]+ [\d.]+L[\d.]+ [\d.]+/g) ?? [];
    expect(arcadas).toHaveLength(ARCADAS);
    for (const a of arcadas) {
      const [x1, y1, x2, y2] = numeros(a);
      for (const x of [x1, x2]) expect(x >= 0 && x <= 390).toBe(true);
      for (const y of [y1, y2]) expect(y >= 0 && y <= 120).toBe(true);
    }
  });

  it('las gradas se acotan a 1..5', () => {
    expect(gradasUtiles(0)).toBe(1);
    expect(gradasUtiles(3)).toBe(3);
    expect(gradasUtiles(9)).toBe(5);
    expect(comandos(pathArena(200, 100, 9, 'arco'), 'A')).toBe(5);
  });

  it('óvalo: dos elipses (cuatro arcos) y el eje', () => {
    const d = pathArena(220, 140, 3, 'ovalo');
    expect(comandos(d, 'A')).toBe(4);
    expect(comandos(d, 'H')).toBe(1);
  });

  it('sin tamaño no pinta nada', () => {
    expect(pathArena(0, 120, 3, 'arco')).toBe('');
  });
});

describe('meandro', () => {
  it('la unidad cabe en 10 × 10', () => {
    expect(MEANDRO_UNIDAD).toBe(10);
    for (const n of numeros(PATH_MEANDRO)) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(MEANDRO_UNIDAD);
    }
  });
});
