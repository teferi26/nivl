import { contraste, ink, RANK_THEME, sizeClass, VERIFY_WIDTHS } from '../tokens';

const SUPERFICIES = [ink.ink0, ink.ink1, ink.ink2] as const;

describe('tokens v2: contraste AA', () => {
  it('todo texto supera 4,5:1 sobre cualquier superficie', () => {
    for (const texto of [ink.ink6, ink.ink8, ink.ink9, ink.ink10]) {
      for (const fondo of SUPERFICIES) {
        expect(contraste(texto, fondo)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('la inversión (negro sobre blanco) es máxima', () => {
    expect(contraste(ink.ink0, ink.ink10)).toBeCloseTo(21, 0);
  });

  it('los bordes de control superan 1,5:1 contra el fondo (visibles, no texto)', () => {
    expect(contraste(ink.ink4, ink.ink0)).toBeGreaterThanOrEqual(1.5);
  });

  it('la escala es estrictamente creciente en luminancia', () => {
    const orden = Object.values(ink).map((h) => contraste(h, '#000000'));
    for (let i = 1; i < orden.length; i++) expect(orden[i]).toBeGreaterThan(orden[i - 1]);
  });
});

describe('clases de tamaño', () => {
  it('reparte los anchos de verificación', () => {
    expect(VERIFY_WIDTHS.map(sizeClass)).toEqual(['compact', 'compact', 'medium', 'expanded', 'expanded']);
    expect(sizeClass(599)).toBe('compact');
    expect(sizeClass(600)).toBe('medium');
  });
});

describe('tema por rango', () => {
  it('el marco nunca adelgaza al subir de rango', () => {
    const orden = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
    for (let i = 1; i < orden.length; i++) {
      expect(RANK_THEME[orden[i]].ring).toBeGreaterThanOrEqual(RANK_THEME[orden[i - 1]].ring);
      expect(RANK_THEME[orden[i]].grain).toBeGreaterThanOrEqual(RANK_THEME[orden[i - 1]].grain);
    }
  });

  it('solo S brilla', () => {
    expect(Object.entries(RANK_THEME).filter(([, t]) => t.shimmer).map(([r]) => r)).toEqual(['S']);
  });
});
