import {
  ARCADAS,
  gradasUtiles,
  MEANDRO_UNIDAD,
  paresLaurel,
  PATH_MEANDRO,
  pathArena,
  pathColumna,
  pathLaurel,
  xDelTallo,
} from '../geometria';
import { BASE_CORONA, GALEA_PATH } from '@/components/ui/Crown';

/** Números de una cadena `d`. */
const numeros = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
const comandos = (d: string, c: string) => (d.match(new RegExp(c, 'g')) ?? []).length;

describe('laurel', () => {
  const hojasDe = (d: string) => comandos(d, 'Z');

  it('a 64 de alto reproduce el tallo de la retícula', () => {
    expect(pathLaurel(64).startsWith('M16 63C8.5 49 8 26 14 12')).toBe(true);
  });

  it('es determinista y sin NaN ni Infinity', () => {
    for (const alto of [20, 44, 60, 88, 120]) {
      const d = pathLaurel(alto);
      expect(pathLaurel(alto)).toBe(d);
      expect(d).not.toMatch(/NaN|Infinity/);
    }
  });

  it('sin alto no pinta nada', () => {
    expect(pathLaurel(0)).toBe('');
    expect(pathLaurel(Number.NaN)).toBe('');
  });

  it('cada hoja es una almendra cerrada: dos cuadráticas y Z', () => {
    const d = pathLaurel(44);
    const hojas = d.match(/M[^MC]*Q[^MQ]*Q[^MQ]*Z/g) ?? [];
    expect(hojas).toHaveLength(hojasDe(d));
    expect(comandos(d, 'Q')).toBe(hojasDe(d) * 2);
    // La almendra vuelve a su base: el último punto es el primero.
    for (const h of hojas) {
      const ns = numeros(h);
      expect(ns.slice(-2)).toEqual(ns.slice(0, 2));
    }
  });

  it('el número de hojas crece con el alto: pocas a 20, la rama llena a 88', () => {
    expect(paresLaurel(20)).toBe(2);
    expect(paresLaurel(44)).toBe(4);
    expect(paresLaurel(88)).toBe(7);
    let antes = 0;
    for (const alto of [20, 32, 44, 60, 76, 88]) {
      const n = hojasDe(pathLaurel(alto));
      // Pares alternos (fuera y dentro) y la hoja de la punta.
      expect(n).toBe(paresLaurel(alto) * 2 + 1);
      expect(n).toBeGreaterThanOrEqual(antes);
      antes = n;
    }
    expect(hojasDe(pathLaurel(88))).toBeGreaterThan(hojasDe(pathLaurel(20)));
  });

  it('alternas: las hojas de fuera van a la izquierda del tallo y las de dentro a la derecha', () => {
    const d = pathLaurel(64);
    const hojas = (d.match(/M[^MC]*Q[^MQ]*Q[^MQ]*Z/g) ?? []).slice(0, -1);
    hojas.forEach((h, i) => {
      const [x0, , , , px] = numeros(h);
      if (i % 2 === 0) expect(px).toBeLessThan(x0);
      else expect(px).toBeGreaterThan(x0);
    });
  });

  it('decrecientes hacia la punta (por lado)', () => {
    const d = pathLaurel(88);
    const hojas = (d.match(/M[^MC]*Q[^MQ]*Q[^MQ]*Z/g) ?? []).slice(0, -1);
    const largo = (h: string) => {
      const [x0, y0, , , px, py] = numeros(h);
      return Math.hypot(px - x0, py - y0);
    };
    for (const lado of [0, 1]) {
      const ls = hojas.filter((_, i) => i % 2 === lado).map(largo);
      for (let i = 1; i < ls.length; i++) expect(ls[i]).toBeLessThanOrEqual(ls[i - 1] + 0.01);
      expect(ls[ls.length - 1]).toBeLessThan(ls[0]);
    }
  });

  it('escala con el alto y no se sale del lienzo (controles incluidos)', () => {
    for (const alto of [20, 44, 88]) {
      const ancho = (alto * 24) / 64;
      const ns = numeros(pathLaurel(alto));
      for (let i = 0; i < ns.length; i += 2) {
        expect(ns[i]).toBeGreaterThanOrEqual(0);
        expect(ns[i]).toBeLessThanOrEqual(ancho);
        expect(ns[i + 1]).toBeGreaterThanOrEqual(0);
        expect(ns[i + 1]).toBeLessThanOrEqual(alto);
      }
    }
  });

  it('el tallo se curva hacia la izquierda', () => {
    for (const y of [50, 38, 26]) expect(xDelTallo(y)).toBeLessThan(14);
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

describe('galea', () => {
  it('cabe en la retícula de 24 y se apoya en la base', () => {
    expect(GALEA_PATH).not.toMatch(/NaN|Infinity/);
    // Fuera los radios y las banderas de los arcos: solo quedan coordenadas.
    const ns = numeros(GALEA_PATH.replace(/A[\d.]+ [\d.]+ 0 1 0/g, ' '));
    for (const n of ns) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(23);
    }
    // La barbilla de la visera es un tramo horizontal sobre la línea base.
    expect(GALEA_PATH).toContain(` ${BASE_CORONA}H`);
  });

  it('cresta, cúpula, ala, visera, dos ojos y una rejilla de pocas barras', () => {
    // Seis piezas (cresta, cúpula, ala, visera y los dos ojos) y cuatro barras
    // cortas de rejilla, una cruz por ojo: nada de cuadrícula.
    expect(comandos(GALEA_PATH, 'M')).toBe(6 + 4);
    expect(comandos(GALEA_PATH, 'A')).toBe(4);
  });
});
