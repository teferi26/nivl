import { contraste, ink, luminancia, oro } from '@/design/tokens';
import { colors } from '../theme';

const ESCALA = new Set<string>([...Object.values(ink), oro.hilo, oro.borde]);

describe('theme Ónix: la escala ink y el hilo de oro', () => {
  it('cada color del tema sale de los tokens', () => {
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
