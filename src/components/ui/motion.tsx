// NIVL · Movimiento con intención.
//
// Tres primitivas y nada más: entrar (FadeIn), entrar en cascada (Stagger) y
// responder al dedo (PressScale). Todo con Animated y el driver nativo, 180 a
// 320 ms, y siempre saltable: ninguna animación bloquea un gesto. Si un día
// hace falta algo que no cabe aquí, es una señal de que la pantalla se está
// pasando de decoración.

import { createContext, useContext, useEffect, useRef, type PropsWithChildren, type ReactNode } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

const StaggerContext = createContext<{ step: number; base: number } | null>(null);

interface FadeInProps {
  /** Retraso propio (ms). Con `index` se suma al escalonado del Stagger. */
  delay?: number;
  index?: number;
  /** Desplazamiento inicial en píxeles (positivo: entra desde abajo). */
  from?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** Entrada al montar: fundido más una subida corta. */
export function FadeIn({ delay = 0, index = 0, from = 14, duration = 260, style, children }: FadeInProps) {
  const stagger = useContext(StaggerContext);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(from)).current;

  useEffect(() => {
    // Tope al escalonado: a partir del duodécimo elemento todos entran juntos,
    // que una lista larga no tarde dos segundos en aparecer.
    const escalon = stagger ? stagger.base + Math.min(index, 12) * stagger.step : 0;
    const anim = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, delay: delay + escalon, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: duration + 60, delay: delay + escalon, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [opacity, translateY, delay, index, duration, stagger]);

  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

interface StaggerProps {
  /** Milisegundos entre elementos consecutivos. */
  step?: number;
  /** Retraso antes del primero. */
  base?: number;
  children: ReactNode;
}

/** Envuelve una lista de FadeIn con `index` para que entren en cascada. */
export function Stagger({ step = 55, base = 40, children }: StaggerProps) {
  return <StaggerContext.Provider value={{ step, base }}>{children}</StaggerContext.Provider>;
}

interface PressScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Escala en reposo → pulsado. */
  to?: number;
}

/** Pressable que se encoge un poco al tocarlo. Sustituye a los `opacity: 0.7`. */
export function PressScale({ to = 0.97, style, children, onPressIn, onPressOut, ...rest }: PropsWithChildren<PressScaleProps>) {
  const scale = useRef(new Animated.Value(1)).current;
  const animar = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 4 }).start();

  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        animar(to);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animar(1);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
