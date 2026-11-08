import {
  ANCHO_ASIDE,
  ANCHO_MIN_RAIL,
  cabenDosPaneles,
  columnasRejilla,
  ladoCelda,
  repartoPaneles,
  UMBRAL_DOS_PANELES,
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
    [466, 'tabs'],
    [599, 'tabs'],
    [600, 'tabs'],
    [669, 'tabs'],
    [719, 'tabs'],
    [720, 'rail'],
    [744, 'rail'],
    [1023, 'rail'],
    [1024, 'sidebar'],
    [1366, 'sidebar'],
  ] as const)('%i → %s', (w, nav) => {
    expect(navDeVentana(w)).toBe(nav);
  });

  it('«medium estrecho» (600–719) lleva barra inferior y el hueco es la ventana entera', () => {
    expect(ANCHO_MIN_RAIL).toBe(720);
    for (const w of [600, 640, 669, 694]) {
      expect(navDeVentana(w)).toBe('tabs');
      expect(huecoContenido(w)).toEqual({ ancho: w, sizeClass: 'medium', cabeAside: false });
    }
  });

  it('un ancho no válido es la barra inferior', () => {
    expect(navDeVentana(0)).toBe('tabs');
    expect(navDeVentana(Number.NaN)).toBe('tabs');
  });
});

describe('marco por dispositivo: iPhone Duo, iPad y Mac', () => {
  // [ventana, nav, hueco, clase del hueco, ¿dos paneles?]
  it.each([
    [466, 'tabs', 466, 'compact', false], // Duo plegado: como un iPhone
    [669, 'tabs', 669, 'medium', true], // Duo abierto: barra inferior y dos paneles
    [744, 'rail', 672, 'medium', true], // iPad mini vertical
    [1024, 'sidebar', 784, 'medium', true], // iPad 13" vertical
    [1366, 'sidebar', 1126, 'expanded', true], // iPad Pro 13" apaisado / Mac
  ] as const)('%i → %s, hueco %i (%s), dos paneles: %s', (w, nav, hueco, clase, dos) => {
    expect(navDeVentana(w)).toBe(nav);
    const h = huecoContenido(w);
    expect(h.ancho).toBe(hueco);
    expect(h.sizeClass).toBe(clase);
    expect(cabenDosPaneles(h.ancho)).toBe(dos);
  });

  it('plegar y desplegar el Duo no cambia de clase a medias: 466 compact, 669 medium', () => {
    expect(marcoDe(466)).toEqual({ sizeClass: 'compact', gutter: 20, maxContent: 560, nav: 'tabs' });
    expect(marcoDe(669)).toEqual({ sizeClass: 'medium', gutter: 32, maxContent: 640, nav: 'tabs' });
  });
});

describe('repartoPaneles', () => {
  it('el umbral es 640 de hueco', () => {
    expect(UMBRAL_DOS_PANELES).toBe(640);
    expect(repartoPaneles(639)).toBeNull();
    expect(repartoPaneles(640)).not.toBeNull();
    expect(repartoPaneles(466)).toBeNull();
  });

  it('Duo abierto (669): mitades, el filete fuera', () => {
    expect(repartoPaneles(669)).toEqual({ izquierda: 334, derecha: 334 });
    expect(repartoPaneles(669, 'mitad')).toEqual({ izquierda: 334, derecha: 334 });
  });

  it('iPad mini (672) y 13" vertical (784): mitades', () => {
    expect(repartoPaneles(672)).toEqual({ izquierda: 335, derecha: 336 });
    expect(repartoPaneles(784)).toEqual({ izquierda: 391, derecha: 392 });
  });

  it('desde 900 la lista se acota a 320–400 y el detalle se lleva el resto', () => {
    expect(repartoPaneles(900)).toEqual({ izquierda: 324, derecha: 575 });
    expect(repartoPaneles(1126)).toEqual({ izquierda: 400, derecha: 725 });
    expect(repartoPaneles(1126, 'mitad')).toEqual({ izquierda: 562, derecha: 563 });
  });

  it('con texto muy grande, un solo panel', () => {
    expect(repartoPaneles(1126, 'lista', 1.5)).toBeNull();
    expect(cabenDosPaneles(1126, 1.35)).toBe(true);
  });

  it('un hueco no finito no parte', () => {
    expect(repartoPaneles(Number.NaN)).toBeNull();
  });
});

describe('columnasRejilla y ladoCelda', () => {
  it('cuenta las celdas que caben con su separación', () => {
    expect(columnasRejilla(335, 96, 12, 3, 6)).toBe(3);
    expect(columnasRejilla(560, 96, 12, 3, 6)).toBe(5);
    expect(columnasRejilla(725, 96, 12, 3, 6)).toBe(6);
    expect(columnasRejilla(2000, 96, 12, 3, 6)).toBe(6);
  });

  it('nunca baja del mínimo, ni con ancho 0', () => {
    expect(columnasRejilla(0, 96, 12, 3)).toBe(3);
    expect(columnasRejilla(100, 96, 12, 3)).toBe(3);
  });

  it('el lado reparte el ancho menos las separaciones', () => {
    expect(ladoCelda(560, 5, 12)).toBe(102);
    expect(ladoCelda(0, 5, 12)).toBe(0);
  });
});
