// NIVL · WORK: Proyectos, Horas, Revisión y Carga se pintan en todos sus estados,
// sin claves sueltas, sin guiones largos y sin lenguaje clínico.
import { createElement, type ReactElement } from 'react';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }, useFocusEffect: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ ...jest.requireActual('react-native-safe-area-context'), useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/ui/useAlVolver', () => ({ useAlVolver: () => {}, debeRecargar: () => false }));

import { ESTADOS_GESTION } from '../demo';

// El paquete no trae tipos: esto es lo poco que se usa de él.
type Nodo = { children?: (Nodo | string)[] | null } | (Nodo | string)[] | string | null;
interface Pintado {
  toJSON: () => Nodo;
  unmount: () => void;
}
const { act, create } = require('react-test-renderer') as { act: (fn: () => void) => void; create: (e: ReactElement) => Pintado };

function textos(n: Nodo): string {
  if (n === null) return '';
  if (typeof n === 'string') return n;
  if (Array.isArray(n)) return n.map(textos).join(' ');
  return (n.children ?? []).map(textos).join(' ');
}

function pintar(id: string): string {
  const estado = ESTADOS_GESTION.find((e) => e.id === id)!;
  let r: Pintado;
  act(() => {
    r = create(createElement(() => estado.render()));
  });
  const out = textos(r!.toJSON());
  act(() => r!.unmount());
  return out;
}

describe('Gestión de WORK', () => {
  it.each(ESTADOS_GESTION.map((e) => e.id))('%s se pinta limpio', (id) => {
    const out = pintar(id);
    expect(out).not.toMatch(/trabajogestion:|trabajo:|\{\{/);
    expect(out).not.toMatch(/[—–]/);
    expect(out).not.toMatch(/agotamiento|burnout|estr[eé]s/i);
  });

  it('proyectos: la siguiente entrega y su riesgo a la vista', () => {
    const out = pintar('proyectos');
    expect(out).toContain('Web de la tienda');
    expect(out).toContain('Propuesta de portada');
    expect(out).toContain('Vence hoy');
  });

  it('el vacío trae su acción', () => {
    expect(pintar('proyectos-vacio')).toMatch(/nuevo proyecto/i);
    expect(pintar('horas-vacio')).toMatch(/apuntar horas/i);
  });

  it('sin la migración no ofrece lo que no podría guardar', () => {
    const out = pintar('proyectos-sin-migracion');
    expect(out).toContain('WORK se está preparando');
    expect(out).not.toMatch(/nuevo proyecto/i);
  });

  it('por facturar es informativo y lleva su importe', () => {
    const out = pintar('horas');
    expect(out).toContain('sin impuestos');
    expect(out).toContain('€');
  });

  it('la carga alta dice qué soltar; la normal no', () => {
    expect(pintar('carga-alta')).toContain('Carga alta');
    expect(pintar('carga-normal')).toContain('no hace falta soltar');
  });
});
