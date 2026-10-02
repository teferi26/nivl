import {
  ANCHO_ASIDE,
  ANCHO_RAIL,
  ANCHO_SIDEBAR,
  anchoNavegacion,
  cabeAside,
  huecoContenido,
  marcoDe,
  MIN_CONTENIDO_CON_ASIDE,
  navDeVentana,
} from '../responsive';

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

describe('huecoContenido: el ancho real tras la navegación', () => {
  it('la navegación ocupa 0 · 72 · 240', () => {
    expect([anchoNavegacion('tabs'), anchoNavegacion('rail'), anchoNavegacion('sidebar')]).toEqual([0, 72, 240]);
  });

  it('el mínimo con panel es 560 + 2·32', () => {
    expect(MIN_CONTENIDO_CON_ASIDE).toBe(624);
  });

  it('375 y 430 (barra inferior) no restan nada', () => {
    expect(huecoContenido(375)).toEqual({ ancho: 375, sizeClass: 'compact', cabeAside: false });
    expect(huecoContenido(430)).toEqual({ ancho: 430, sizeClass: 'compact', cabeAside: false });
  });

  it('744 resta el raíl: 672, medium, sin panel', () => {
    expect(huecoContenido(744)).toEqual({ ancho: 672, sizeClass: 'medium', cabeAside: false });
  });

  it('1024 resta la barra lateral: 784, medium, sin panel (antes 368 de contenido)', () => {
    expect(huecoContenido(1024)).toEqual({ ancho: 784, sizeClass: 'medium', cabeAside: false });
  });

  it('1440 resta la barra lateral: 1200, expanded, con panel', () => {
    expect(huecoContenido(1440)).toEqual({ ancho: 1200, sizeClass: 'expanded', cabeAside: true });
  });

  it('el inset izquierdo se resta junto a la navegación, no con la barra inferior', () => {
    expect(huecoContenido(744, 20).ancho).toBe(652);
    expect(huecoContenido(375, 20).ancho).toBe(375);
  });

  it('un ancho no finito da un hueco 0 compact', () => {
    expect(huecoContenido(Number.NaN)).toEqual({ ancho: 0, sizeClass: 'compact', cabeAside: false });
  });
});

describe('cabeAside', () => {
  it('solo en expanded y si quedan 624 tras el panel', () => {
    expect(cabeAside(1023)).toBe(false);
    expect(cabeAside(1024)).toBe(true); // 1024 − 320 = 704
    expect(cabeAside(943)).toBe(false);
    expect(cabeAside(Number.NaN)).toBe(false);
  });
});

describe('navDeVentana: la navegación sale de la ventana, no del hueco', () => {
  it.each([
    [375, 'tabs'],
    [599, 'tabs'],
    [600, 'rail'],
    [640, 'rail'],
    [671, 'rail'],
    [1023, 'rail'],
    [1024, 'sidebar'],
  ] as const)('%i → %s', (w, nav) => {
    expect(navDeVentana(w)).toBe(nav);
  });

  it('entre 600 y 671 hay raíl aunque el hueco sea compact', () => {
    for (const w of [600, 640, 671]) {
      expect(huecoContenido(w).sizeClass).toBe('compact');
      expect(navDeVentana(w)).toBe('rail');
    }
  });

  it('un ancho no válido es la barra inferior', () => {
    expect(navDeVentana(0)).toBe('tabs');
    expect(navDeVentana(Number.NaN)).toBe('tabs');
  });
});
