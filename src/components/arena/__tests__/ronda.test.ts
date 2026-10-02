import { GALEA_PATH, GALEA_PATH_PEQUENA } from '@/components/ui/Crown';
import { levelFromXp } from '@/lib/game';
import { ratioSeguro, rotuloSiguiente } from '../cifras';
import { ajustarInscripcion, anchoInscripcion } from '../medida';
import { MUELLE_BARRA, razonAmortiguamiento, sobreimpulso } from '../muelle';

describe('barra del Hero: lo que le llega', () => {
  it('la demo de Hoy (nivel 23) da 9.300 de 11.030: 84 %, xp dentro del nivel', () => {
    const n = levelFromXp(105321);
    expect(n).toEqual({ level: 23, into: 9300, next: 11030 });
    expect(ratioSeguro(n.into, n.next)).toBeCloseTo(0.843, 3);
  });

  it('nivel máximo: barra llena', () => {
    const n = levelFromXp(1e12);
    expect(n.next).toBe(0);
    expect(ratioSeguro(n.into, n.next)).toBe(1);
  });
});

describe('muelle de la Barra', () => {
  it('con los valores por defecto de Reanimated 4, damping 18 suelto rebotaba un 62 %', () => {
    const suelto = { mass: 4, stiffness: 900, damping: 18, overshootClamping: false };
    expect(razonAmortiguamiento(suelto)).toBeCloseTo(0.15, 2);
    expect(sobreimpulso(suelto)).toBeGreaterThan(0.6);
    // 84 % desde 0: el primer pico pasaba del 100 % (la barra se veía llena).
    expect(0.84 * (1 + sobreimpulso(suelto))).toBeGreaterThan(1);
  });

  it('la configuración de la Barra va entera, casi crítica y sin pasarse', () => {
    expect(MUELLE_BARRA.mass).toBe(1);
    expect(MUELLE_BARRA.stiffness).toBe(100);
    expect(razonAmortiguamiento(MUELLE_BARRA)).toBeGreaterThanOrEqual(0.9);
    expect(MUELLE_BARRA.overshootClamping).toBe(true);
    expect(sobreimpulso(MUELLE_BARRA)).toBe(0);
  });
});

describe('rotuloSiguiente', () => {
  it('nombra el nivel que viene sin parecer el actual', () => {
    expect(rotuloSiguiente(23, false)).toBe('SIGUIENTE · 24');
    expect(rotuloSiguiente(999, true)).toBe('NIVEL MÁXIMO');
  });
});

describe('ajustarInscripcion', () => {
  const base = { size: 14, tracking: 4 };

  it('el título de A cabe con su tracking a 375 (hueco de 335)', () => {
    expect(ajustarInscripcion('HÉROE DE LA ARENA', 335, base)).toEqual({ size: 14, tracking: 4, cabe: true });
  });

  it('un título largo aprieta el tracking antes que el cuerpo', () => {
    const t = 'CAMPEÓN DE LA ARENA DE POMPEYA';
    const a = ajustarInscripcion(t, 335, base);
    expect(a.cabe).toBe(true);
    expect(a.tracking).toBeLessThan(4);
    expect(anchoInscripcion(t, a.size, a.tracking)).toBeLessThanOrEqual(335);
  });

  it('si ni apretando cabe, lo dice (y se deja bajar a dos líneas)', () => {
    expect(ajustarInscripcion('X'.repeat(80), 335, base).cabe).toBe(false);
  });

  it('sin ancho medido no toca nada', () => {
    expect(ajustarInscripcion('HÉROE DE LA ARENA', 0, base)).toEqual({ size: 14, tracking: 4, cabe: true });
  });
});

describe('galea pequeña', () => {
  it('sin los ojos redondos: ni arcos ni rejilla, una sola ranura', () => {
    expect(GALEA_PATH_PEQUENA).not.toMatch(/A/);
    expect(GALEA_PATH_PEQUENA).not.toMatch(/NaN|Infinity/);
    expect(GALEA_PATH_PEQUENA.match(/M/g)).toHaveLength(5);
    expect(GALEA_PATH_PEQUENA).toContain(' 20H');
  });

  it('se apoya en la misma base que la grande', () => {
    // La grande va de perfil y la pequeña de frente, pero las dos tienen la
    // barbilla en la línea base: cambiar de tamaño no las hace saltar.
    expect(GALEA_PATH).toContain(' 20H');
    expect(GALEA_PATH_PEQUENA).toContain(' 20H');
  });
});
