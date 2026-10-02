// NIVL · Arena: el contador que sube (Reanimated).
//
// Un número que cuenta desde `desde` hasta `valor` en 700 ms con salida suave.
// El valor vive en un SharedValue del hilo de UI; solo cuando cambia el entero
// se avisa al hilo de JS (scheduleOnRN) para volver a pintar el texto. El
// lector de pantalla oye siempre el valor FINAL, nunca la cuenta.
//
// Límite de uso: como mucho 4 por pantalla y ninguno en filas de una lista.
// Con «reducir movimiento» el número aparece ya en su valor.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { type as tipo } from '@/design/tokens';
import { formatoMiles } from './cifras';
import { useMovimientoArena } from './quieto';

export interface ContadorProps {
  valor: number;
  /** Desde dónde cuenta. null o ausente: aparece ya en `valor` (sin cuenta). */
  desde?: number | null;
  duracion?: number;
  formato?: (n: number) => string;
  /** Unidad pequeña pegada a la cifra («d», «%», « XP»). */
  sufijo?: string;
  style?: StyleProp<TextStyle>;
  /** Por defecto, el valor final formateado más el sufijo. */
  accessibilityLabel?: string;
  maxFontSizeMultiplier?: number;
  adjustsFontSizeToFit?: boolean;
  numberOfLines?: number;
}

export function Contador({
  valor,
  desde,
  duracion = 700,
  formato = formatoMiles,
  sufijo,
  style,
  accessibilityLabel,
  maxFontSizeMultiplier,
  adjustsFontSizeToFit,
  numberOfLines,
}: ContadorProps) {
  const reducido = useMovimientoArena();
  const inicio = desde ?? valor;
  const sv = useSharedValue(inicio);
  const [shown, setShown] = useState(() => Math.round(reducido ? valor : inicio));

  useAnimatedReaction(
    () => Math.round(sv.value),
    (v, previo) => {
      if (v !== previo) scheduleOnRN(setShown, v);
    },
  );

  useEffect(() => {
    if (reducido) {
      cancelAnimation(sv);
      sv.value = valor;
      setShown(Math.round(valor));
      return;
    }
    sv.value = withTiming(valor, {
      duration: duracion,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [valor, duracion, reducido, sv]);

  // Al llegar se pinta el valor exacto (por si no es entero).
  const llegado = shown === Math.round(valor);
  const texto = formato(llegado ? valor : shown);
  const final = `${formato(valor)}${sufijo ?? ''}`;
  const plano = StyleSheet.flatten(style) ?? {};
  const tamSufijo = Math.max(tipo.micro.size, Math.round((plano.fontSize ?? tipo.cifra.size) * 0.42));

  return (
    <Text
      style={[styles.base, style]}
      accessibilityLabel={accessibilityLabel ?? final}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      numberOfLines={numberOfLines ?? (adjustsFontSizeToFit ? 1 : undefined)}
    >
      {texto}
      {sufijo ? (
        <Text style={[styles.sufijo, { fontSize: tamSufijo }]}>{sufijo}</Text>
      ) : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  // Cifras tabulares: la anchura no baila mientras cuenta.
  base: { fontVariant: ['tabular-nums'], includeFontPadding: false },
  sufijo: { fontFamily: tipo.micro.family, letterSpacing: tipo.micro.tracking },
});
