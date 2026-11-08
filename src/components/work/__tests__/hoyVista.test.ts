// NIVL · WORK: Hoy y el bloque se pintan en todos sus estados, en los seis
// idiomas de textos que existen, sin claves sueltas ni vocabulario de juego.
import { createElement, type ReactElement } from 'react';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/components/ConsentimientoSalud', () => ({ useHealthConsent: () => ({ accepted: true, medicionActiva: true }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }, useFocusEffect: jest.fn() }));
jest.mock('../LineaEconomia', () => ({ LineaEconomia: () => null }));
jest.mock('@/components/OrdenDelDia', () => ({ OrdenDelDia: () => null }));
jest.mock('@/components/modos/mundo/CabeceraMundo', () => ({ CabeceraMundo: () => null }));
jest.mock('@/components/ui/useAlVolver', () => ({ useAlVolver: () => {}, debeRecargar: () => false }));

import { ESTADOS_WORK_HOY } from '../demo';

interface Json {
  children: (Json | string)[] | null;
}
interface Renderer {
  toJSON: () => Json | Json[] | string | null;
  unmount: () => void;
}
const { create, act } = jest.requireActual<{ create: (el: ReactElement) => Renderer; act: (fn: () => void) => void }>('react-test-renderer');

function textos(n: Json | Json[] | string | null): string {
  if (n === null) return '';
  if (typeof n === 'string') return n;
  if (Array.isArray(n)) return n.map(textos).join(' ');
  return (n.children ?? []).map(textos).join(' ');
}

function pintar(id: string): string {
  const estado = ESTADOS_WORK_HOY.find((e) => e.id === id)!;
  let r: Renderer;
  act(() => {
    r = create(createElement(() => estado.render()));
  });
  const out = textos(r!.toJSON());
  act(() => r!.unmount());
  return out;
}

describe('Hoy de WORK', () => {
  it.each(ESTADOS_WORK_HOY.map((e) => e.id))('%s se pinta sin claves sueltas ni guiones largos', (id) => {
    const out = pintar(id);
    expect(out).not.toMatch(/trabajo:|trabajogestion:|\{\{/);
    expect(out).not.toMatch(new RegExp('[\\u2014\\u2013]'));
    expect(out).not.toMatch(/\b(arena|gladiador|Agilidad|AGI|INT)\b/i);
  });

  it('la primera vez pregunta qué sacar hoy y no ofrece empezar', () => {
    const out = pintar('primera-vez');
    expect(out).toContain('¿Qué tienes que sacar hoy?');
    expect(out).not.toMatch(/empezar bloque/i);
  });

  it('con el día planificado hay una tarjeta Ahora y un solo Empezar bloque', () => {
    const out = pintar('lleno');
    expect(out).toContain('Ahora');
    expect(out.match(/empezar bloque/gi)).toHaveLength(1);
  });

  it('sin la migración no pide lo que no podría guardar', () => {
    const out = pintar('sin-migracion');
    expect(out).toContain('WORK se está preparando');
    expect(out).not.toContain('¿Qué tienes que sacar hoy?');
  });

  it('al terminar enseña lo pagado de verdad', () => {
    const out = pintar('bloque-terminado');
    expect(out).toContain('+50 XP');
    expect(out).toContain('50 min');
  });

  it('parar antes no culpa: la prioridad sigue abierta y no hay XP', () => {
    const out = pintar('bloque-corto');
    expect(out).toContain('12 min');
    expect(out).toContain('La prioridad sigue abierta');
    expect(out).not.toMatch(/XP/);
  });
});
