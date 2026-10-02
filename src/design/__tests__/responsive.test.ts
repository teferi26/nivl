import { ANCHO_ASIDE, ANCHO_RAIL, ANCHO_SIDEBAR, marcoDe } from '../responsive';

describe('marcoDe: clases de tamaño (SISTEMA.md §3)', () => {
  it('375 (iPhone) es compact con margen 20 y contenido 560', () => {
    expect(marcoDe(375)).toEqual({ sizeClass: 'compact', gutter: 20, maxContent: 560, nav: 'tabs' });
  });

  it('744 (iPad mini) es medium con margen 32 y contenido 640', () => {
    expect(marcoDe(744)).toEqual({ sizeClass: 'medium', gutter: 32, maxContent: 640, nav: 'rail' });
  });

  it.each([1024, 1440])('%i es expanded con margen 48 y contenido 720', (w) => {
    expect(marcoDe(w)).toEqual({ sizeClass: 'expanded', gutter: 48, maxContent: 720, nav: 'sidebar' });
  });

  it('el corte compact/medium está en 600', () => {
    expect(marcoDe(599).sizeClass).toBe('compact');
    expect(marcoDe(600).sizeClass).toBe('medium');
  });

  it('el corte medium/expanded está en 1024', () => {
    expect(marcoDe(1023).sizeClass).toBe('medium');
    expect(marcoDe(1024).sizeClass).toBe('expanded');
  });

  it('un ancho 0 o no finito se trata como compact', () => {
    expect(marcoDe(0).sizeClass).toBe('compact');
    expect(marcoDe(Number.NaN).sizeClass).toBe('compact');
  });

  it('los anchos de navegación y columna son los del sistema', () => {
    expect([ANCHO_RAIL, ANCHO_SIDEBAR, ANCHO_ASIDE]).toEqual([72, 240, 320]);
  });
});
