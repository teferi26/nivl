// NIVL · WORK: la agenda y la economía se pintan sin claves sueltas y dicen lo
// que tienen que decir.
import { createElement, type ComponentType, type ReactElement, type ReactNode } from 'react';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }, useFocusEffect: jest.fn() }));
jest.mock('@/components/modos/mundo/CabeceraMundo', () => ({ CabeceraMundo: () => null }));
jest.mock('@/components/ui/useAlVolver', () => ({ useAlVolver: () => {}, debeRecargar: () => false }));

import { ESTADOS_WORK } from '@/components/economia/work/demo';
import { AcentoEconomia } from '@/components/economia/work/PiezasWork';
import { ESTADOS_AGENDA_WORK } from '../agenda/demo';

interface NodoJson {
  children: (NodoJson | string)[] | null;
}
type Json = NodoJson | NodoJson[] | string | null;
interface Renderer {
  toJSON: () => Json;
  unmount: () => void;
}
const { create, act } = jest.requireActual<{ create: (el: ReactElement) => Renderer; act: (fn: () => void) => void }>('react-test-renderer');

function textos(n: Json): string {
  if (n === null) return '';
  if (typeof n === 'string') return n;
  if (Array.isArray(n)) return n.map(textos).join(' ');
  return (n.children ?? []).map(textos).join(' ');
}

function pintar(el: () => ReactElement): string {
  let r: Renderer;
  act(() => {
    r = create(createElement(el));
  });
  const out = textos(r!.toJSON());
  act(() => r!.unmount());
  return out;
}

const agenda = (id: string) => pintar(ESTADOS_AGENDA_WORK.find((e) => e.id === id)!.render);
const economia = (id: string) => ESTADOS_WORK.find((e) => e.id === id)!.render;

describe('Agenda de WORK', () => {
  it.each(ESTADOS_AGENDA_WORK.map((e) => e.id))('%s se pinta sin claves sueltas ni guiones largos', (id) => {
    const out = agenda(id);
    expect(out).not.toMatch(/trabajoagenda:|\{\{/);
    expect(out).not.toMatch(/[—–]/);
  });

  it('ofrece reunión y bloque siempre, y el calendario solo si el binario puede', () => {
    expect(agenda('agenda-ofrecer')).toContain('Conectar el calendario del móvil');
    const sinModulo = agenda('agenda-sin-modulo');
    expect(sinModulo).not.toMatch(/calendario del móvil|Calendario conectado/);
    expect(sinModulo).toMatch(/reunión/i);
    expect(sinModulo).toMatch(/bloque/i);
  });

  it('el permiso dice qué se copia y dónde', () => {
    const out = agenda('agenda-hoja-optin');
    expect(out).toContain('título y las horas');
    expect(out).toContain('cuenta NIVL');
  });
});

describe('Economía de WORK', () => {
  it('cifras uniformes, dinero personal y brief con autor y fecha', () => {
    const out = pintar(economia('general'));
    expect(out).toMatch(/\d\.\d{3},\d{2}/);
    expect(out).not.toMatch(/\b\d{4},\d{2}\b/);
    expect(out).toContain('tu dinero personal');
    expect(out).toContain('Escrito por IA el 1 oct');
  });

  it('sin IA lo dice', () => {
    expect(pintar(economia('brief-cifras'))).toContain('sin IA');
  });

  it('FOUNDER comparte la economía sin el rótulo de dinero personal', () => {
    const general = economia('general');
    const out = pintar(() => createElement(AcentoEconomia as ComponentType<{ modo: 'founder'; children?: ReactNode }>, { modo: 'founder' }, general()));
    expect(out).not.toContain('tu dinero personal');
    expect(out).toContain('Escrito por IA');
  });
});
