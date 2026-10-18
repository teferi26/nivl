// NIVL · IRON · El maniquí animado de un ejercicio.
//
// Monta una vez un <Path> por ranura (src/iron/dibujo.ts) y Reanimated solo
// cambia su `d` en cada cuadro, en el hilo de la interfaz: el reloj es un
// valor compartido que avanza en línea recta y `dibujar` (worklet) calcula el
// esqueleto del instante `reloj % ciclo`.
//
// · `ms`: pinta ese instante quieto (galería, capturas y exportación de vídeo).
// · Con «reducir movimiento», quieto en la pose central (la más exigente).
// · En los isométricos (plancha) no se mueve el cuerpo: late el músculo.

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
import { dibujar, ranuras, viewBox, type EstiloCapa } from '@/iron/dibujo';
import type { Ejercicio } from '@/iron/tipos';
import { COLOR_SUELO, ESTILO_CAPA } from './estilo';

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
  accessibilityLabel?: string;
}

/** El instante que se enseña quieto: la pose clave central (abajo en la sentadilla, arriba en el curl). */
export function msQuieto(ej: Ejercicio): number {
  return ej.poses[Math.floor(ej.poses.length / 2)].ms;
}

/** Intensidad del músculo principal en un isométrico: de 0,55 a 1, una vez por ciclo. */
export function latidoEn(ms: number, ciclo: number): number {
  'worklet';
  return 0.775 + 0.225 * Math.cos(((ms % ciclo) / ciclo) * Math.PI * 2);
}

function Suelo({ ej }: { ej: Ejercicio }) {
  const { x, ancho } = ej.encuadre;
  return <Line x1={x} x2={x + ancho} y1={0} y2={0} stroke={COLOR_SUELO} strokeWidth={0.8} />;
}

const CapaAnimada = memo(function CapaAnimada({
  indice,
  capas,
  estilo,
  latido,
}: {
  indice: number;
  capas: SharedValue<string[]>;
  estilo: EstiloCapa;
  latido: SharedValue<number> | null;
}) {
  const base = ESTILO_CAPA[estilo];
  const animadas = useAnimatedProps(() => {
    const d = capas.value[indice];
    const out: { d: string; fillOpacity?: number } = { d: d ? d : VACIO };
    if (latido) out.fillOpacity = (base.fillOpacity ?? 1) * latido.value;
    return out;
  });
  return (
    <AnimatedPath
      animatedProps={animadas}
      fill={base.fill}
      fillOpacity={base.fillOpacity}
      stroke={base.stroke}
      strokeWidth={base.strokeWidth}
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
  const isometrico = ej.tipo === 'isometrico';
  // El músculo principal late una vez por ciclo (de 0,55 a 1).
  const latido = useDerivedValue(() => latidoEn(reloj.value, ciclo));
  const lista = useMemo(() => ranuras(ej.vista), [ej.vista]);

  return (
    <>
      {lista.map((r, i) => (
        <CapaAnimada
          key={r.clave}
          indice={i}
          capas={capas}
          estilo={r.estilo}
          latido={isometrico && (r.estilo === 'principal' || r.estilo === 'principalLejos') ? latido : null}
        />
      ))}
    </>
  );
}

function ManiquiQuieto({ ejercicio: ej, ms }: { ejercicio: Ejercicio; ms: number }) {
  const lista = useMemo(() => ranuras(ej.vista), [ej.vista]);
  const capas = useMemo(() => dibujar(ej, ms), [ej, ms]);
  const latido = ej.tipo === 'isometrico' ? latidoEn(ms, ej.cicloMs) : 1;
  return (
    <>
      {lista.map((r, i) => {
        if (!capas[i]) return null;
        const base = ESTILO_CAPA[r.estilo];
        const late = r.estilo === 'principal' || r.estilo === 'principalLejos';
        return (
          <Path
            key={r.clave}
            d={capas[i]}
            {...base}
            fillOpacity={late ? (base.fillOpacity ?? 1) * latido : base.fillOpacity}
            strokeLinejoin="round"
          />
        );
      })}
    </>
  );
}

export function Maniqui({ ejercicio, ancho, ms, pausado, accessibilityLabel }: ManiquiProps) {
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
          <ManiquiQuieto ejercicio={ejercicio} ms={quieto} />
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
