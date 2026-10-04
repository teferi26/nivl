import { act, createElement, type ReactElement } from 'react';
import { LEIDO_SIN_DATO, SIN_DATO } from '@/components/ui/sinDato';
import { Stat } from '@/components/ui/Stat';
import { RowValue } from '@/components/ui/Row';

jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Animated: { View: 'Animated.View', Value: class { setValue() {} }, timing: () => ({ start: () => {} }) },
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

interface Nodo { props: { accessibilityLabel?: string; children?: unknown } }
const { create } = jest.requireActual<{
  create: (element: ReactElement) => { unmount: () => void; root: { findAllByType: (t: string) => Nodo[] } };
}>('react-test-renderer');

function textos(element: ReactElement): Nodo[] {
  let r: ReturnType<typeof create> | null = null;
  act(() => {
    r = create(element);
  });
  const nodos = r!.root.findAllByType('Text').map((n) => ({ props: { ...n.props } }));
  act(() => r!.unmount());
  return nodos;
}

describe('sin dato', () => {
  it('se pinta con guion corto y se lee «sin dato»', () => {
    expect(SIN_DATO).toBe('-');
    expect(LEIDO_SIN_DATO).toBe('sin dato');
  });

  it('Stat sin dato lleva la etiqueta para el lector de pantalla', () => {
    const [valor] = textos(createElement(Stat, { value: SIN_DATO, label: 'Peso' }));
    expect(valor.props.children).toBe(SIN_DATO);
    expect(valor.props.accessibilityLabel).toBe(LEIDO_SIN_DATO);
  });

  it('Stat con cifra no fuerza ninguna etiqueta', () => {
    const [valor] = textos(createElement(Stat, { value: 72, label: 'Peso' }));
    expect(valor.props.accessibilityLabel).toBeUndefined();
  });

  it('RowValue sin dato también se lee «sin dato»', () => {
    const [valor] = textos(createElement(RowValue, null, SIN_DATO));
    expect(valor.props.accessibilityLabel).toBe(LEIDO_SIN_DATO);
    const [otro] = textos(createElement(RowValue, null, '18 d'));
    expect(otro.props.accessibilityLabel).toBeUndefined();
  });
});
