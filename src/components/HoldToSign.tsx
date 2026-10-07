// NIVL · Firmar manteniendo pulsado.
//
// Un toque se da sin pensar; un compromiso no. Mantener el dedo un segundo y
// medio mientras el anillo se cierra y el móvil late es lo más parecido a
// firmar que cabe en una pantalla. Soltar antes lo deshace sin castigo.
//
// El gesto no existe para un lector de pantalla, así que la acción accesible
// "activar" firma directamente: la deliberación ahí ya la pone el doble toque.

import Ionicons from '@expo/vector-icons/Ionicons';
import { vibrar } from '@/design/haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
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
  onComplete: () => void | Promise<void>;
  disabled?: boolean;
  /** Pending input stays actionable without allowing a signature. */
  onRequestInput?: () => void;
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

export function HoldToSign({ label, holdingLabel = 'No sueltes', onComplete, onRequestInput, disabled, loading, duration = 1600, onHoldChange }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const latido = useRef<ReturnType<typeof setInterval> | null>(null);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const active = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const hecho = useRef(false);
  const pendingCompletion = useRef(false);
  const completionId = useRef(0);
  const inProgress = useRef(false);
  const [holding, setHoldingState] = useState(false);
  const latest = useRef({ disabled, loading, onComplete, onRequestInput, onHoldChange });
  latest.current = { disabled, loading, onComplete, onRequestInput, onHoldChange };

  const setHolding = useCallback((value: boolean) => {
    if (mounted.current) setHoldingState(value);
    latest.current.onHoldChange?.(value);
  }, []);

  const parar = useCallback(() => {
    if (latido.current) clearInterval(latido.current);
    latido.current = null;
  }, []);

  const cancelar = useCallback(() => {
    generation.current++;
    inProgress.current = false;
    animation.current?.stop();
    animation.current = null;
    progress.stopAnimation();
    progress.setValue(0);
    parar();
    setHolding(false);
  }, [parar, progress, setHolding]);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      active.current = state === 'active';
      if (!active.current) cancelar();
    });
    return () => {
      mounted.current = false;
      cancelar();
      subscription.remove();
    };
  }, [cancelar]);

  useEffect(() => {
    if (disabled || loading) cancelar();
    if (!loading && hecho.current && !pendingCompletion.current) {
      hecho.current = false;
      progress.setValue(0);
    }
  }, [disabled, loading, cancelar, progress]);

  const completar = (attempt: number) => {
    const current = latest.current;
    if (!mounted.current || !active.current || attempt !== generation.current || current.disabled || current.loading || hecho.current) return;
    parar();
    inProgress.current = false;
    animation.current = null;
    hecho.current = true;
    setHolding(false);
    vibrar('mision');
    pendingCompletion.current = true;
    const ownCompletion = ++completionId.current;
    const release = () => {
      if (ownCompletion !== completionId.current) return;
      pendingCompletion.current = false;
      hecho.current = false;
      // Invalidate late callbacks from this completed animation before rearming.
      if (generation.current === attempt) generation.current++;
      if (mounted.current && !latest.current.loading) progress.setValue(0);
    };
    try {
      Promise.resolve(current.onComplete()).then(release, release);
    } catch {
      release();
    }
  };

  const empezar = () => {
    if (!active.current || latest.current.disabled || latest.current.loading || hecho.current || inProgress.current) return;
    const attempt = ++generation.current;
    inProgress.current = true;
    setHolding(true);
    vibrar('seleccion');
    latido.current = setInterval(() => { vibrar('seleccion'); }, 220);
    animation.current = Animated.timing(progress, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: false });
    animation.current.start(({ finished }) => {
      if (finished) completar(attempt);
    });
  };

  const soltar = () => {
    if (hecho.current) {
      parar();
      setHolding(false);
      return;
    }
    cancelar();
  };

  const pedirEntrada = () => {
    if (!latest.current.loading && latest.current.disabled) latest.current.onRequestInput?.();
  };
  const bloqueado = !!loading || (!!disabled && !onRequestInput);

  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [C, 0] });
  const fill = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Pressable
        onPressIn={empezar}
        onPressOut={soltar}
        pressRetentionOffset={MARGEN_DEL_DEDO}
        onPress={pedirEntrada}
        disabled={bloqueado}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={disabled && onRequestInput ? 'Escribe tu nombre para firmar' : 'Mantén pulsado hasta que el anillo se cierre para firmar'}
        accessibilityState={{ disabled: bloqueado, busy: !!loading }}
        accessibilityActions={[{ name: 'activate', label }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName !== 'activate' || latest.current.loading || hecho.current) return;
          if (latest.current.disabled) { pedirEntrada(); return; }
          cancelar();
          progress.setValue(1);
          completar(generation.current);
        }}
        style={styles.wrap}
      >
        <View style={[styles.button, disabled && styles.disabled]}>
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
        </View>
      <Text style={styles.label}>{loading ? 'Sellando' : holding ? holdingLabel : label}</Text>
    </Pressable>
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
