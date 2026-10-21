// NIVL · Mundo IRON: el mapa muscular pequeño de la tarjeta de técnica (la
// lámina pinta dos siluetas, delante y detrás, sin rótulos). Es la misma
// figura de MapaMuscular (src/components/iron), con el mismo dibujo del motor
// (capasMapa) y los mismos colores; aquí solo cambia el tamaño y que no lleva
// rótulos: el lector oye la etiqueta del conjunto.

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { ESTILO_CAPA } from '@/components/iron/estilo';
import { capasMapa, ENCUADRE_MAPA, ranuras, type Musculos } from '@/iron/dibujo';

const RANURAS = ranuras('frontal');
const { x, y, ancho: anchoMundo, alto: altoMundo } = ENCUADRE_MAPA;
const VIEWBOX = `${x} ${-(y + altoMundo)} ${anchoMundo} ${altoMundo}`;

function Figura({ musculos, cara, alto }: { musculos: Musculos; cara: 'ant' | 'post'; alto: number }) {
  const capas = useMemo(() => capasMapa(musculos, cara), [musculos, cara]);
  return (
    <Svg width={(alto * anchoMundo) / altoMundo} height={alto} viewBox={VIEWBOX}>
      <G transform={cara === 'post' ? 'scale(-1, 1)' : undefined}>
        {RANURAS.map((r, i) => (capas[i] ? <Path key={r.clave} d={capas[i]} {...ESTILO_CAPA[r.estilo]} /> : null))}
      </G>
    </Svg>
  );
}

export function MapaMini({ musculos, alto, etiqueta }: { musculos: Musculos; alto: number; etiqueta: string }) {
  return (
    <View style={styles.fila} accessible accessibilityRole="image" accessibilityLabel={etiqueta}>
      <Figura musculos={musculos} cara="ant" alto={alto} />
      <Figura musculos={musculos} cara="post" alto={alto} />
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', gap: 2 },
});
