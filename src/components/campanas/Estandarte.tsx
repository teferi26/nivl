// NIVL · Campañas: el estandarte (L-RADICAL §B.7).
//
// El vexilo de la legión: un travesaño arriba y la tela colgando con la muesca
// en V abajo, de un solo trazo ink10 y sin relleno. Dentro, la letra del rango
// en Cinzel 700. El grosor dice la envergadura de la campaña (E y D 1, C 2,
// de B arriba 3): la jerarquía va en el trazo, nunca en el color.
//
// Es decoración salvo que lleve `accessibilityLabel`; en una tarjeta pulsable
// el rango ya va en la etiqueta de la tarjeta.

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ink, type as tipo } from '@/design/tokens';
import type { DungeonRank } from '@/lib/types';

export interface EstandarteProps {
  letra: string;
  ancho: 40 | 72;
  grosor: 1 | 2 | 3;
  accessibilityLabel?: string;
}

/** Grosor del trazo según la envergadura de la campaña. */
export function grosorDeRango(rango: DungeonRank): 1 | 2 | 3 {
  if (rango === 'E' || rango === 'D') return 1;
  if (rango === 'C') return 2;
  return 3;
}

/** Alto del estandarte: un tercio más que su ancho. */
export const altoEstandarte = (ancho: number) => Math.round(ancho * 1.3);

/** Cadena `d` del vexilo para un ancho y un grosor dados (en pt, sin escalar). */
export function pathEstandarte(ancho: number, grosor: number): string {
  const alto = altoEstandarte(ancho);
  const m = grosor / 2 + 0.5;
  const arriba = m + 1;
  const izq = Math.round(ancho * 0.16);
  const der = ancho - izq;
  const abajo = alto - m;
  const muesca = alto - Math.round(ancho * 0.24);
  const medio = ancho / 2;
  return (
    `M${m} ${arriba}H${ancho - m}` + // travesaño
    ` M${medio} ${arriba}V${m}` + // remate del asta
    ` M${izq} ${arriba}V${abajo}L${medio} ${muesca}L${der} ${abajo}V${arriba}` // tela con la muesca
  );
}

export function Estandarte({ letra, ancho, grosor, accessibilityLabel }: EstandarteProps) {
  const alto = altoEstandarte(ancho);
  const grande = ancho === 72;
  const oculto = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
    : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };
  return (
    <View {...oculto} pointerEvents="none" style={{ width: ancho, height: alto }}>
      <Svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`}>
        <Path
          d={pathEstandarte(ancho, grosor)}
          stroke={ink.ink10}
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
      {/* La letra va en el paño, por encima de la muesca. */}
      <View style={[styles.letraHueco, { top: alto * 0.1, bottom: alto * 0.3 }]}>
        <Text
          style={[styles.letra, grande ? styles.letraGrande : styles.letraPeque]}
          maxFontSizeMultiplier={1}
          allowFontScaling={false}
        >
          {letra}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  letraHueco: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  letra: { fontFamily: tipo.display.family, color: ink.ink10, textAlign: 'center' },
  letraPeque: { fontSize: 18, lineHeight: 22 },
  letraGrande: { fontSize: 32, lineHeight: 38 },
});
