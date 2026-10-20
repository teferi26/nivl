import { destinoMundo, irAlMundo, MUNDOS, mundoDeRuta, mundoDeSegmento, rutaCoachDe, rutaDeArranque, rutaInicioDe } from '@/modos/rutasModo';
import { MODOS } from '@/modos/tipos';
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a) } }));


describe('rutaInicioDe', () => {
  it('cada modo tiene su inicio y NIVL es (tabs)', () => {
    expect(rutaInicioDe('general')).toBe('/(tabs)');
    expect(rutaInicioDe('iron')).toBe('/iron-hoy');
    expect(rutaInicioDe('focus')).toBe('/focus-hoy');
    expect(rutaInicioDe('work')).toBe('/work-hoy');
    expect(rutaInicioDe('founder')).toBe('/founder-hoy');
  });
  it('lo que no es un modo va a NIVL', () => {
    expect(rutaInicioDe(null)).toBe('/(tabs)');
    expect(rutaInicioDe(undefined)).toBe('/(tabs)');
    expect(rutaInicioDe('basura' as never)).toBe('/(tabs)');
  });
  it('el inicio es la primera pestaña de cada mundo', () => {
    for (const m of MODOS) {
      if (m === 'general') continue;
      expect(rutaInicioDe(m)).toBe(`/${MUNDOS[m].pestanas[0]!.ruta}`);
    }
  });
});

describe('rutaCoachDe', () => {
  it('el coach de cada mundo es una pestaña de ese mundo', () => {
    expect(rutaCoachDe('general')).toBe('/(tabs)/coach');
    expect(rutaCoachDe(null)).toBe('/(tabs)/coach');
    for (const m of MODOS) {
      if (m === 'general') continue;
      const coach = MUNDOS[m].pestanas.find((p) => p.pestana === 'coach')!;
      expect(rutaCoachDe(m)).toBe(`/${coach.ruta}`);
    }
  });
});

describe('mundos', () => {
  it('las rutas de pestaña son únicas y llevan el prefijo de su modo', () => {
    const todas = MODOS.flatMap((m) => MUNDOS[m].pestanas.map((p) => p.ruta));
    expect(new Set(todas).size).toBe(todas.length);
    for (const m of MODOS) for (const p of MUNDOS[m].pestanas) expect(p.ruta.startsWith(`${m}-`)).toBe(true);
  });
  it('IRON: Hoy, Rutinas, Pesos y Coach (P01); ningún mundo tiene hábitos ni campañas', () => {
    expect(MUNDOS.iron.pestanas.map((p) => p.pestana)).toEqual(['hoy', 'rutinas', 'pesos', 'coach']);
    for (const m of MODOS) {
      if (m === 'general') continue;
      const nombres = MUNDOS[m].pestanas.map((p) => p.pestana as string);
      expect(nombres).not.toContain('habitos');
      expect(nombres).not.toContain('campanas');
      expect(nombres[0]).toBe('hoy');
      expect(nombres[nombres.length - 1]).toBe('coach');
    }
  });
  it('del segmento y de la ruta al modo', () => {
    expect(mundoDeSegmento('(iron)')).toBe('iron');
    expect(mundoDeSegmento('(tabs)')).toBe('general');
    expect(mundoDeSegmento('gym')).toBeNull();
    expect(mundoDeSegmento(undefined)).toBeNull();
    expect(mundoDeRuta('iron-pesos')).toBe('iron');
    expect(mundoDeRuta('founder-economia')).toBe('founder');
    expect(mundoDeRuta('coach')).toBeNull();
  });
});

describe('destinoMundo', () => {
  const on = (modo: 'general' | 'iron' | 'focus', cargado = true) => ({ activo: true, cargado, modo });
  it('con el interruptor apagado solo existe NIVL', () => {
    const off = { activo: false, cargado: true, modo: 'iron' as const };
    expect(destinoMundo(off, 'general')).toBeNull();
    expect(destinoMundo(off, 'iron')).toBe('/(tabs)');
    expect(destinoMundo({ ...off, cargado: false }, 'focus')).toBe('/(tabs)');
  });
  it('el mundo del modo activo se pinta', () => {
    expect(destinoMundo(on('iron'), 'iron')).toBeNull();
    expect(destinoMundo(on('general'), 'general')).toBeNull();
  });
  it('en otro mundo se va al del modo activo', () => {
    expect(destinoMundo(on('iron'), 'general')).toBe('/iron-hoy');
    expect(destinoMundo(on('general'), 'iron')).toBe('/(tabs)');
    expect(destinoMundo(on('focus'), 'iron')).toBe('/focus-hoy');
  });
  it('sin saber el modo: el mundo espera y NIVL pinta lo de siempre', () => {
    expect(destinoMundo(on('general', false), 'iron')).toBe('esperar');
    expect(destinoMundo(on('iron', false), 'general')).toBeNull();
  });
});

describe('rutaDeArranque', () => {
  it('al arrancar con un modo activo se entra en su mundo', () => {
    expect(rutaDeArranque({ activo: true, cargado: true, modo: 'iron' })).toBe('/iron-hoy');
    expect(rutaDeArranque({ activo: true, cargado: true, modo: 'general' })).toBe('/(tabs)');
  });
  it('apagado o sin leer, NIVL', () => {
    expect(rutaDeArranque({ activo: false, cargado: true, modo: 'iron' })).toBe('/(tabs)');
    expect(rutaDeArranque({ activo: true, cargado: false, modo: 'iron' })).toBe('/(tabs)');
  });
});

describe('irAlMundo', () => {
  it('cambia el modo y reemplaza la pantalla por su inicio', () => {
    const cambiar = jest.fn();
    irAlMundo('iron', cambiar);
    expect(cambiar).toHaveBeenCalledWith('iron');
    expect(mockReplace).toHaveBeenLastCalledWith('/iron-hoy');
    irAlMundo('general', cambiar);
    expect(mockReplace).toHaveBeenLastCalledWith('/(tabs)');
  });
});
