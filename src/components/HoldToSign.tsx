// NIVL · Firmar manteniendo pulsado.
//
// Un toque se da sin pensar; un compromiso no. Mantener el dedo un segundo y
// medio mientras el anillo se cierra y el móvil late es lo más parecido a
// firmar que cabe en una pantalla. Soltar antes lo deshace sin castigo.
//
// El gesto no existe para un lector de pantalla, así que la acción accesible
// "activar" firma directamente: la deliberación ahí ya la pone el doble toque.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '@/lib/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 132;
const STROKE = 4;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

interface Props {
  label: string;
  /** Rótulo mientras el dedo está puesto. */
  holdingLabel?: string;
  onComplete: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Milisegundos que hay que aguantar. */
  duration?: number;
  /**
   * Avisa al padre de que el dedo está puesto (true) o se ha levantado
   * (false). Dentro de un ScrollView sirve para apagar el scroll mientras se
   * firma: si no, una deriva mínima del dedo le entrega el gesto al scroll,
   * llega un onPressOut y el anillo vuelve a cero.
   */
  onHoldChange?: (holding: boolean) => void;
}

// Cuánto puede alejarse el dedo del anillo sin que cuente como soltar.
const MARGEN_DEL_DEDO = { top: 60, bottom: 60, left: 60, right: 60 } as const;

export function HoldToSign({ label, holdingLabel = 'No sueltes', onComplete, disabled, loading, duration = 1600, onHoldChange }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const latido = useRef<ReturnType<typeof setInterval> | null>(null);
  const hecho = useRef(false);
  const [holding, setHoldingState] = useState(false);
  const avisar = useRef(onHoldChange);
  avisar.current = onHoldChange;
  const setHolding = (h: boolean) => {
    setHoldingState(h);
    avisar.current?.(h);
  };

  const parar = () => {
    if (latido.current) clearInterval(latido.current);
    latido.current = null;
  };

  // Al desmontar (la firma ha ido bien y se cambia de paso) el padre no puede
  // quedarse con el scroll apagado.
  useEffect(
    () => () => {
      parar();
      avisar.current?.(false);
    },
    [],
  );

  // Si la firma falla (sin red), el padre vuelve a habilitar el botón: el
  // anillo tiene que volver a cero para poder repetir el gesto.
  useEffect(() => {
    if (!loading && hecho.current) {
      hecho.current = false;
      progress.setValue(0);
    }
  }, [loading, progress]);

  const empezar = () => {
    if (disabled || loading || hecho.current) return;
    setHolding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    latido.current = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, 220);
    Animated.timing(progress, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
      if (!finished) return;
      parar();
      hecho.current = true;
      setHolding(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onComplete();
    });
  };

  const soltar = () => {
    parar();
    setHolding(false);
    if (hecho.current) return;
    // Corta la animación en curso (su callback llega con finished = false) y
    // deshace el anillo deprisa: soltar no es un error, es no haber firmado.
    Animated.timing(progress, { toValue: 0, duration: 220, useNativeDriver: false }).start();
  };

  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [C, 0] });
  const fill = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <View style={styles.wrap}>
      <Pressable
        onPressIn={empezar}
        onPressOut={soltar}
        pressRetentionOffset={MARGEN_DEL_DEDO}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Mantén pulsado hasta que el anillo se cierre para firmar"
        accessibilityState={{ disabled: !!disabled, busy: !!loading }}
        accessibilityActions={[{ name: 'activate', label }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName !== 'activate' || disabled || loading || hecho.current) return;
          hecho.current = true;
          progress.setValue(1);
          onComplete();
        }}
        style={[styles.button, disabled && styles.disabled]}
      >
        <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.track} strokeWidth={STROKE} fill="none" />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={colors.accent}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="butt"
            strokeDasharray={`${C} ${C}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <Animated.View style={[styles.core, { opacity: fill }]} />
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Ionicons name="finger-print-outline" size={40} color={colors.text} />
        )}
      </Pressable>
      <Text style={styles.label}>{loading ? 'Sellando' : holding ? holdingLabel : label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: 8 },
  button: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  // El centro se enciende a medida que el anillo se cierra: luz con color, no con blur.
  core: {
    position: 'absolute',
    width: SIZE - 28,
    height: SIZE - 28,
    borderRadius: (SIZE - 28) / 2,
    backgroundColor: colors.accentFaint,
  },
  label: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.textDim,
    marginTop: 12,
    textAlign: 'center',
  },
});
