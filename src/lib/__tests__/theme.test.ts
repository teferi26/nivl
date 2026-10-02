import { contraste, ink, luminancia } from '@/design/tokens';
import { colors } from '../theme';

const ESCALA = new Set<string>(Object.values(ink));

describe('theme v2: solo la escala ink', () => {
  it('cada color del tema es un valor de ink', () => {
    for (const [nombre, valor] of Object.entries(colors)) {
      expect({ nombre, enEscala: ESCALA.has(valor) }).toEqual({ nombre, enEscala: true });
    }
  });

  it('text, textDim y textFaint dan ≥ 4,5:1 sobre bg y panel', () => {
    for (const texto of [colors.text, colors.textDim, colors.textFaint]) {
      for (const fondo of [colors.bg, colors.panel]) {
        expect(contraste(texto, fondo)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('la escala del Heatmap crece en luminancia', () => {
    const escala = [colors.track, colors.accentFaint, colors.accentDim, colors.accent].map(luminancia);
    for (let i = 1; i < escala.length; i++) expect(escala[i]).toBeGreaterThan(escala[i - 1]);
  });
});
