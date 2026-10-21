// NIVL · Modos: el marco de visor del emblema de la cabecera, según la marca
// de maestría (MK I a V). Las «esquinas de visor» de la propuesta P07 (el HUD
// de cada modo: escuadras del acento en las esquinas) alrededor de la placa
// del emblema; la marca se lee en cuántas esquinas hay y en su peso:
//   MK I   dos escuadras finas (arriba a la izquierda y abajo a la derecha).
//   MK II  las cuatro, finas.
//   MK III las cuatro, de regla (el visor de la lámina, 2 pt).
//   MK IV  las cuatro de regla y una muesca en el centro de cada lado.
//   MK V   las de MK IV en oro laurel, el remate de la marca máxima.
// Decorativo: el nombre de la marca lo dice la cabecera («MK III»).

import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import type { Marca } from '@/modos/maestria';
import { ORO_LAUREL } from './MarcoEmblema';

export interface MarcoVisorProps {
  marca: Marca;
  color: string;
  /** Lado del marco en pt (el emblema va centrado dentro, con aire). */
  tamano: number;
  style?: StyleProp<ViewStyle>;
}

const RECETA: Record<Marca, { esquinas: 2 | 4; grosor: number; muescas: boolean; oro: boolean }> = {
  1: { esquinas: 2, grosor: 1.5, muescas: false, oro: false },
  2: { esquinas: 4, grosor: 1.5, muescas: false, oro: false },
  3: { esquinas: 4, grosor: 2, muescas: false, oro: false },
  4: { esquinas: 4, grosor: 2, muescas: true, oro: false },
  5: { esquinas: 4, grosor: 2.5, muescas: true, oro: true },
};

export function MarcoVisor({ marca, color, tamano, style }: MarcoVisorProps) {
  const r = RECETA[marca];
  const c = r.oro ? ORO_LAUREL : color;
  const g = r.grosor;
  const o = g / 2;
  const l = Math.round(tamano * 0.26);
  const f = tamano - o;
  const esquinas = [
    `M ${o} ${o + l} V ${o} H ${o + l}`, // arriba izquierda
    `M ${f} ${f - l} V ${f} H ${f - l}`, // abajo derecha
    `M ${f - l} ${o} H ${f} V ${o + l}`, // arriba derecha
    `M ${o + l} ${f} H ${o} V ${f - l}`, // abajo izquierda
  ].slice(0, r.esquinas);
  const m = tamano / 2;
  const largo = tamano * 0.08;
  return (
    <View style={[{ width: tamano, height: tamano }, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={tamano} height={tamano}>
        {esquinas.map((d, i) => (
          <Path key={i} d={d} stroke={c} strokeWidth={g} fill="none" strokeOpacity={0.9} />
        ))}
        {r.muescas ? (
          <>
            <Line x1={m} y1={o} x2={m} y2={o + largo} stroke={c} strokeWidth={g} />
            <Line x1={m} y1={f} x2={m} y2={f - largo} stroke={c} strokeWidth={g} />
            <Line x1={o} y1={m} x2={o + largo} y2={m} stroke={c} strokeWidth={g} />
            <Line x1={f} y1={m} x2={f - largo} y2={m} stroke={c} strokeWidth={g} />
          </>
        ) : null}
      </Svg>
    </View>
  );
}
