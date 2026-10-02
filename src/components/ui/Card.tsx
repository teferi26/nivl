// NIVL · La tarjeta: una unidad con superficie propia (SISTEMA.md §5).
//
// Cinco variantes y un solo significado cada una:
//   · surface → superficie ink1 (lo normal para listas de cosas).
//   · outline → hairline ink3 sobre el negro (bloques secundarios, error).
//   · inverse → blanco con texto negro: lo activo o lo hecho. UNA por pantalla.
//               Publica SuperficieContext = 'inverse' para que el contenido
//               sepa que tiene que pintarse en negro.
//   · alerta  → borde rayado (trama) de 3 pt alrededor de una superficie ink1.
//               Sustituye al rojo.
//   · logro   → grano sobre ink1. Sustituye al oro.
// Con `onPress` responde al dedo encogiéndose (PressScale).

import { createContext, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ink } from '@/design/tokens';
import { PressScale } from './motion';
import { Grano, Trama } from './Texture';

export type Superficie = 'normal' | 'inverse';

/** Superficie sobre la que se pinta el contenido. 'inverse' = fondo blanco. */
export const SuperficieContext = createContext<Superficie>('normal');

type Variante =
  | 'surface'
  | 'outline'
  | 'inverse'
  | 'alerta'
  | 'logro'
  /** @deprecated Usa 'surface'. */
  | 'raised'
  /** @deprecated Usa 'surface', 'inverse' o 'logro' según lo que quieras decir. */
  | 'tinted';

interface Props {
  variant?: Variante;
  /** Color del borde (outline) o de una barra lateral izquierda de 2 px. */
  accent?: string;
  padded?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export function Card({
  variant = 'surface',
  accent,
  padded = true,
  onPress,
  onLongPress,
  disabled,
  accessibilityLabel,
  style,
  children,
}: Props) {
  const v = variant === 'raised' ? 'surface' : variant;
  const alerta = v === 'alerta';
  const base = [
    styles.card,
    v === 'surface' && styles.surface,
    v === 'outline' && [styles.outline, accent ? { borderColor: accent } : null],
    v === 'inverse' && styles.inverse,
    v === 'tinted' && styles.tinted,
    alerta && styles.alerta,
    v === 'logro' && styles.logro,
    accent && v !== 'outline' ? { borderLeftWidth: 2, borderLeftColor: accent } : null,
    // En alerta el relleno va dentro, para que la trama quede como un borde.
    padded && !alerta && styles.padded,
    style,
  ];

  const contenido = alerta ? (
    <>
      <Trama />
      <View style={[styles.alertaDentro, padded && styles.padded]}>{children}</View>
    </>
  ) : v === 'logro' ? (
    <>
      <Grano />
      {children}
    </>
  ) : (
    children
  );

  const envuelto = (
    <SuperficieContext.Provider value={v === 'inverse' ? 'inverse' : 'normal'}>{contenido}</SuperficieContext.Provider>
  );

  if (onPress || onLongPress) {
    return (
      <PressScale
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={base}
      >
        {envuelto}
      </PressScale>
    );
  }
  return <View style={base}>{envuelto}</View>;
}

const styles = StyleSheet.create({
  card: { marginBottom: 10 },
  surface: { backgroundColor: ink.ink1 },
  outline: { borderWidth: 1, borderColor: ink.ink3, backgroundColor: ink.ink0 },
  inverse: { backgroundColor: ink.ink10 },
  tinted: { backgroundColor: ink.ink3 },
  alerta: { backgroundColor: ink.ink0, overflow: 'hidden' },
  alertaDentro: { margin: 3, backgroundColor: ink.ink1 },
  logro: { backgroundColor: ink.ink1, overflow: 'hidden' },
  padded: { padding: 16 },
});
