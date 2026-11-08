// NIVL · La tarjeta: una unidad con superficie propia (SISTEMA.md §5).
//
// Cinco variantes y un solo significado cada una:
//   · surface → vidrio redondeado con hairline (lo normal para listas de cosas).
//   · outline → solo hairline (bloques secundarios, error).
//   · inverse → hueso con texto oscuro: lo activo o lo hecho. UNA por pantalla.
//               Publica SuperficieContext = 'inverse' para que el contenido
//               sepa que tiene que pintarse en oscuro.
//   · alerta  → borde rayado (trama ink6) de 3 pt alrededor de una superficie
//               opaca: la alerta no depende del color.
//   · logro   → marco de oro sobre un velo de oro: el hilo de Ónix.
// Con `onPress` responde al dedo encogiéndose (PressScale).

import { createContext, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ink, oro, radio, vidrio } from '@/design/tokens';
import { PressScale } from './motion';
import { menuContextualWeb } from './pulsacionLarga';
import { Trama } from './Texture';

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
  /** Las variantes viejas `raised` y `tinted` están en desuso; la losa con remaches, zócalo y rótulo es `TarjetaArena`. */
  variant?: Variante;
  /**
   * Color del borde (outline) o de una barra lateral izquierda de 2 px.
   * @deprecated Sin color en NIVL v2: el significado va en la variante (`alerta`, `logro`)
   * o en `TarjetaArena` con `marco` (FASE3).
   */
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
  const logro = v === 'logro';
  // La trama es marco: el relleno va en la placa de dentro.
  const enMarco = alerta;
  const base = [
    styles.card,
    v === 'surface' && styles.surface,
    v === 'outline' && [styles.outline, accent ? { borderColor: accent } : null],
    v === 'inverse' && styles.inverse,
    v === 'tinted' && styles.tinted,
    alerta && styles.alerta,
    logro && styles.logro,
    accent && v !== 'outline' ? { borderLeftWidth: 2, borderLeftColor: accent } : null,
    // En alerta el relleno va dentro, para que la textura quede como un borde.
    padded && !enMarco && styles.padded,
    style,
  ];

  const contenido = alerta ? (
    <>
      <Trama color={ink.ink6} />
      <View style={[styles.alertaDentro, padded && styles.padded]}>{children}</View>
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
        {...menuContextualWeb(disabled ? undefined : onLongPress)}
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
  card: { marginBottom: 10, borderRadius: radio.tarjeta },
  surface: { backgroundColor: vidrio.tarjeta, borderWidth: 1, borderColor: vidrio.borde },
  outline: { borderWidth: 1, borderColor: vidrio.borde },
  inverse: { backgroundColor: ink.ink10 },
  tinted: { backgroundColor: vidrio.campo },
  alerta: { backgroundColor: ink.ink0, overflow: 'hidden' },
  alertaDentro: { margin: 3, backgroundColor: ink.ink1, borderRadius: radio.tarjeta - 3 },
  logro: { backgroundColor: oro.fondo, borderWidth: 1, borderColor: oro.borde },
  padded: { padding: 16 },
});
