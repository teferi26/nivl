// NIVL · Arena: la barra que se llena (Reanimated).
//
// Pista ink4 y relleno blanco (o ink8 para el rival). El relleno mide siempre
// el ancho completo y se escala en X desde la izquierda: no hace falta medir
// con onLayout y el muelle corre entero en el hilo de UI. Los segmentos son
// cortes de 2 pt en negro por encima del relleno (como XPBar). No la
// sustituye: XPBar sigue en su sitio.

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { ink } from '@/design/tokens';
import { ratioSeguro } from './cifras';
import { MUELLE_BARRA } from './muelle';
import { useMovimientoArena } from './quieto';

export interface BarraProps {
  /** 0..1 (se acota). */
  ratio: number;
  /** Desde dónde se llena. null o ausente: aparece ya en `ratio`. */
  desde?: number | null;
  alto?: 4 | 6 | 8;
  /** Cortes de 2 pt (solo si son 30 o menos; más no se leen). */
  segmentos?: number;
  tono?: 'blanco' | 'ink8';
  /** Qué mide, para el lector: «Experiencia del nivel 23». */
  etiqueta: string;
  /**
   * Dentro de un bloque que ya se lee entero (el Hero): la barra no se anuncia
   * por su cuenta. Por defecto, false.
   */
  enGrupo?: boolean;
}

const CORTE = 2;
const MAX_SEGMENTOS = 30;

export function Barra({ ratio, desde, alto = 6, segmentos, tono = 'blanco', etiqueta, enGrupo = false }: BarraProps) {
  const reducido = useMovimientoArena();
  const r = ratioSeguro(ratio, 1);
  const inicio = desde == null ? r : ratioSeguro(desde, 1);
  const progreso = useSharedValue(reducido ? r : inicio);

  useEffect(() => {
    if (reducido) {
      cancelAnimation(progreso);
      progreso.value = r;
      return;
    }
    // Configuración entera (muelle.ts): con los valores por defecto de
    // Reanimated 4, `damping: 18` suelto rebotaba por encima del 100 %.
    progreso.value = withSpring(r, { ...MUELLE_BARRA, reduceMotion: ReduceMotion.System });
  }, [r, reducido, progreso]);

  const relleno = useAnimatedStyle(() => ({ transform: [{ scaleX: progreso.value }] }));

  const n = segmentos != null && segmentos > 1 && segmentos <= MAX_SEGMENTOS ? Math.floor(segmentos) : 0;
  const cortes = Array.from({ length: Math.max(0, n - 1) }, (_, i) => ((i + 1) / n) * 100);

  return (
    <View
      {...(enGrupo
        ? { importantForAccessibility: 'no-hide-descendants' as const, accessibilityElementsHidden: true }
        : {
            accessible: true,
            accessibilityRole: 'progressbar' as const,
            accessibilityLabel: etiqueta,
            accessibilityValue: { min: 0, max: 100, now: Math.round(r * 100) },
          })}
      style={[styles.pista, { height: alto }]}
    >
      <Animated.View
        style={[styles.relleno, { backgroundColor: tono === 'ink8' ? ink.ink8 : ink.ink10 }, relleno]}
      />
      {cortes.map((pct) => (
        <View key={pct} style={[styles.corte, { left: `${pct}%` }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pista: { width: '100%', backgroundColor: ink.ink4, overflow: 'hidden' },
  relleno: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    transformOrigin: 'left',
  },
  corte: { position: 'absolute', top: 0, bottom: 0, width: CORTE, marginLeft: -CORTE / 2, backgroundColor: ink.ink0 },
});
