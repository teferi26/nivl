// NIVL · Arena: la entrada de un bloque (Reanimated).
//
// Fundido de 260 ms y subida de 14 pt en 320 ms, en cascada de 55 ms
// (`motion.escalon`) con tope en el octavo bloque. Solo para bloques de
// pantalla y los 8 primeros de una lista: nunca en filas de un ranking ni en
// el hilo del coach, y nunca con `layout` (prohibido: recoloca todo al vuelo).
//
// En nativo es una animación de entrada escrita a mano (worklet). En la web
// Reanimated 4.1 no ejecuta las entradas propias, y sus Keyframe y preajustes
// con duración o retraso revientan al limpiar (setElementPosition lee una
// instantánea que aún no existe): allí entra con el FadeIn de ui/motion
// (Animated de RN), mismo fundido, misma subida y misma cascada.
// Con «reducir movimiento» no hay entrada: el bloque aparece en su sitio.

import { useMemo, type ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  withDelay,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';
import { FadeIn } from '@/components/ui/motion';
import { motion } from '@/design/tokens';
import { estaQuieto, useMovimientoArena } from './quieto';

/** Bloques con retraso propio; del noveno en adelante entran con el octavo. */
export const TOPE_ESCALON = 8;
const DESPLAZAMIENTO = 14;
const DURA_OPACIDAD = motion.base; // 260
const DURA_SUBIDA = 320;

interface EntradaProps {
  /** Posición en la cascada (0 = sin retraso). */
  indice?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

function entradaNativa(retraso: number): EntryExitAnimationFunction {
  return () => {
    'worklet';
    const curva = Easing.out(Easing.cubic);
    return {
      initialValues: { opacity: 0, transform: [{ translateY: DESPLAZAMIENTO }] },
      animations: {
        opacity: withDelay(
          retraso,
          withTiming(1, { duration: DURA_OPACIDAD, easing: curva, reduceMotion: ReduceMotion.System }),
        ),
        transform: [
          {
            translateY: withDelay(
              retraso,
              withTiming(0, { duration: DURA_SUBIDA, easing: curva, reduceMotion: ReduceMotion.System }),
            ),
          },
        ],
      },
    };
  };
}

export function Entrada({ indice = 0, style, children }: EntradaProps) {
  const reducido = useMovimientoArena();
  const retraso = Math.min(Math.max(0, indice), TOPE_ESCALON) * motion.escalon;
  const entering = useMemo(() => entradaNativa(retraso), [retraso]);
  // Galería con ?quieto=1 (solo desarrollo): el bloque, ya en su sitio.
  if (estaQuieto()) return <View style={style}>{children}</View>;
  if (Platform.OS === 'web') {
    // FadeIn ya respeta «reducir movimiento» por su cuenta.
    return (
      <FadeIn delay={retraso} from={DESPLAZAMIENTO} duration={DURA_OPACIDAD} style={style}>
        {children}
      </FadeIn>
    );
  }
  return (
    <Animated.View entering={reducido ? undefined : entering} style={style}>
      {children}
    </Animated.View>
  );
}
