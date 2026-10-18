// NIVL · IRON · El maniquí animado de un ejercicio.
//
// Monta una vez un <Path> por ranura (src/iron/dibujo.ts) y Reanimated solo
// cambia su `d` en cada cuadro, en el hilo de la interfaz: el reloj es un
// valor compartido que avanza en línea recta y `dibujar` (worklet) calcula el
// esqueleto del instante `reloj % ciclo`.
//
// · `ms`: pinta ese instante quieto (galería, capturas y exportación de vídeo).
// · Con «reducir movimiento», quieto en la pose central (la más exigente).
// · Todos los músculos se dibujan siempre; el principal brilla en la fase de
//   esfuerzo (concéntrica) y, en los isométricos (plancha), late todo el ciclo.

import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';
import { useMovimientoReducido } from '@/components/ui/motion';
import { dibujar, esfuerzoEn, ranuras, viewBox, type EstiloCapa } from '@/iron/dibujo';
import type { Ejercicio } from '@/iron/tipos';
import { brilloPrincipal, COLOR_SUELO, ESTILO_CAPA } from './estilo';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Vueltas que da el reloj de una tirada (luego vuelve a arrancar). */
const VUELTAS = 1000;
const VACIO = 'M0 0';

export interface ManiquiProps {
  ejercicio: Ejercicio;
  /** Ancho en puntos; el alto sale del encuadre. */
  ancho: number;
  /** Pinta este instante del ciclo, quieto. */
  ms?: number;
  pausado?: boolean;
  /** Con `ms`: fija el brillo del principal (0 a 1) en vez de sacarlo de la fase. */
  esfuerzo?: number;
  accessibilityLabel?: string;
}

/** El instante que se enseña quieto: la pose clave central (abajo en la sentadilla, arriba en el curl). */
export function msQuieto(ej: Ejercicio): number {
  return ej.msFicha ?? ej.poses[Math.floor(ej.poses.length / 2)].ms;
}

function Suelo({ ej }: { ej: Ejercicio }) {
  const { x, ancho } = ej.encuadre;
  return <Line x1={x} x2={x + ancho} y1={0} y2={0} stroke={COLOR_SUELO} strokeWidth={0.8} />;
}

const esPrincipal = (e: EstiloCapa) => e === 'principal';

const CapaAnimada = memo(function CapaAnimada({
  indice,
  capas,
  estilo,
  esfuerzo,
}: {
  indice: number;
  capas: SharedValue<string[]>;
  estilo: EstiloCapa;
  esfuerzo: SharedValue<number> | null;
}) {
  const base = ESTILO_CAPA[estilo];
  const animadas = useAnimatedProps(() => {
    const d = capas.value[indice];
    const out: { d: string; strokeWidth?: number; strokeOpacity?: number } = { d: d ? d : VACIO };
    if (esfuerzo) {
      const b = brilloPrincipal(esfuerzo.value);
      out.strokeWidth = b.strokeWidth;
      out.strokeOpacity = b.strokeOpacity;
    }
    return out;
  });
  return (
    <AnimatedPath
      animatedProps={animadas}
      fill={base.fill}
      fillOpacity={base.fillOpacity}
      stroke={base.stroke}
      strokeWidth={base.strokeWidth}
      strokeOpacity={base.strokeOpacity}
      fillRule={base.fillRule}
      strokeLinejoin="round"
    />
  );
});

function ManiquiAnimado({ ejercicio: ej, pausado }: { ejercicio: Ejercicio; pausado?: boolean }) {
  const reloj = useSharedValue(0);
  const ciclo = ej.cicloMs;

  useEffect(() => {
    if (pausado) {
      cancelAnimation(reloj);
      return;
    }
    const desde = reloj.value % ciclo;
    reloj.value = desde;
    reloj.value = withTiming(desde + ciclo * VUELTAS, { duration: ciclo * VUELTAS, easing: Easing.linear });
    return () => cancelAnimation(reloj);
  }, [pausado, ciclo, reloj]);

  const capas = useDerivedValue(() => dibujar(ej, reloj.value % ciclo));
  // El principal brilla en la fase de esfuerzo (en los isométricos, late).
  const esfuerzo = useDerivedValue(() => esfuerzoEn(ej, reloj.value % ciclo));
  const lista = useMemo(() => ranuras(ej.vista), [ej.vista]);

  return (
    <>
      {lista.map((r, i) => (
        <CapaAnimada key={r.clave} indice={i} capas={capas} estilo={r.estilo} esfuerzo={esPrincipal(r.estilo) ? esfuerzo : null} />
      ))}
    </>
  );
}

function ManiquiQuieto({ ejercicio: ej, ms, esfuerzo }: { ejercicio: Ejercicio; ms: number; esfuerzo?: number }) {
  const lista = useMemo(() => ranuras(ej.vista), [ej.vista]);
  const capas = useMemo(() => dibujar(ej, ms), [ej, ms]);
  const brillo = brilloPrincipal(esfuerzo ?? esfuerzoEn(ej, ms));
  return (
    <>
      {lista.map((r, i) => {
        if (!capas[i]) return null;
        const base = ESTILO_CAPA[r.estilo];
        return <Path key={r.clave} d={capas[i]} {...base} {...(esPrincipal(r.estilo) ? brillo : null)} strokeLinejoin="round" />;
      })}
    </>
  );
}

export function Maniqui({ ejercicio, ancho, ms, pausado, esfuerzo, accessibilityLabel }: ManiquiProps) {
  const reducido = useMovimientoReducido();
  const alto = (ancho * ejercicio.encuadre.alto) / ejercicio.encuadre.ancho;
  const quieto = ms !== undefined ? ms : reducido ? msQuieto(ejercicio) : undefined;
  return (
    <View
      style={[styles.marco, { width: ancho, height: alto }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={ancho} height={alto} viewBox={viewBox(ejercicio)}>
        <Suelo ej={ejercicio} />
        {quieto !== undefined ? (
          <ManiquiQuieto ejercicio={ejercicio} ms={quieto} esfuerzo={esfuerzo} />
        ) : (
          // La key reinicia el reloj y las capas al cambiar de ejercicio.
          <ManiquiAnimado key={ejercicio.id} ejercicio={ejercicio} pausado={pausado} />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  marco: { overflow: 'hidden' },
});
