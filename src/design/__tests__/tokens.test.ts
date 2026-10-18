import { contraste, ink, modoAcento, motion, RANK_THEME, sizeClass, type, VERIFY_WIDTHS } from '../tokens';

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
    expect(VERIFY_WIDTHS.map(sizeClass)).toEqual([
      'compact',
      'compact',
      'medium',
      'medium',
      'expanded',
      'expanded',
      'expanded',
    ]);
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

describe('contrato de rangos del Chat 5', () => {
  it('umbrales crecientes y marcos en el orden del contrato', () => {
    const orden = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
    expect(orden.map((r) => RANK_THEME[r].desdeNivel)).toEqual([1, 5, 10, 15, 22, 30]);
    expect(orden.map((r) => RANK_THEME[r].marco)).toEqual([
      'liso', 'doble', 'remachado', 'laurel_simple', 'laurel_doble', 'laurel_corona',
    ]);
  });
});

describe('tipografía', () => {
  // Las familias que carga src/app/_layout.tsx con useFonts.
  const CARGADAS = new Set(['Cinzel_600SemiBold', 'Cinzel_700Bold', 'Outfit_500Medium', 'Outfit_600SemiBold', 'Outfit_700Bold']);

  it('ningún tamaño baja de 11 y toda familia está cargada', () => {
    for (const t of Object.values(type)) {
      expect(t.size).toBeGreaterThanOrEqual(11);
      expect(t.lineHeight).toBeGreaterThanOrEqual(t.size);
      expect(CARGADAS.has(t.family)).toBe(true);
    }
  });

  it('la arena: monumento > monumentoSm > cifra, y escalón de 55 ms', () => {
    expect(type.monumento.size).toBeGreaterThan(type.monumentoSm.size);
    expect(type.monumentoSm.size).toBeGreaterThan(type.cifra.size);
    expect(motion.escalon).toBe(55);
  });
});

describe('Modos F1: acentos', () => {
  it('cada acento llega a AA (4,5:1) sobre #000', () => {
    for (const [modo, hex] of Object.entries(modoAcento)) {
      expect({ modo, ratio: contraste(hex, '#000000') >= 4.5 }).toEqual({ modo, ratio: true });
    }
  });

  it('cada acento llega a AA sobre las superficies ink1 e ink2', () => {
    for (const hex of Object.values(modoAcento)) {
      expect(contraste(hex, ink.ink1)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(hex, ink.ink2)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('el texto negro sobre el acento también es AA (chip activo)', () => {
    for (const hex of Object.values(modoAcento)) expect(contraste(ink.ink0, hex)).toBeGreaterThanOrEqual(4.5);
  });

  it('General es el monocromo de siempre y los colores son los del contrato', () => {
    expect(modoAcento).toEqual({
      general: ink.ink10,
      iron: '#3D7BFF',
      focus: '#8B6CFF',
      work: '#19C37D',
      founder: '#FF9F1C',
    });
  });
});
