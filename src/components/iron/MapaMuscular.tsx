// NIVL · IRON · Mapa muscular de cuerpo entero (por delante y por detrás).
//
// Es el mismo maniquí del motor, de pie y en vista frontal: cada músculo es
// una capa sobre la silueta (principal en el acento de IRON, secundarios más
// suaves). La vista de detrás se pinta en espejo para que el lado derecho de
// la persona quede a la derecha, como al mirarla de espaldas.

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { t } from '@/i18n';
import { capasMapa, ENCUADRE_MAPA, ranuras, type Musculos } from '@/iron/dibujo';
import { ink, type } from '@/design/tokens';
import { ESTILO_CAPA } from './estilo';

const RANURAS = ranuras('frontal');
const { x, y, ancho: anchoMundo, alto: altoMundo } = ENCUADRE_MAPA;
const VIEWBOX = `${x} ${-(y + altoMundo)} ${anchoMundo} ${altoMundo}`;

function Figura({ musculos, cara, ancho }: { musculos: Musculos; cara: 'ant' | 'post'; ancho: number }) {
  const capas = useMemo(() => capasMapa(musculos, cara), [musculos, cara]);
  const alto = (ancho * altoMundo) / anchoMundo;
  return (
    <Svg width={ancho} height={alto} viewBox={VIEWBOX}>
      <G transform={cara === 'post' ? 'scale(-1, 1)' : undefined}>
        {RANURAS.map((r, i) => (capas[i] ? <Path key={r.clave} d={capas[i]} {...ESTILO_CAPA[r.estilo]} /> : null))}
      </G>
    </Svg>
  );
}

export function MapaMuscular({ musculos, ancho, etiqueta }: { musculos: Musculos; ancho: number; etiqueta: string }) {
  const cada = Math.floor((ancho - 12) / 2);
  return (
    <View style={styles.fila} accessible accessibilityRole="image" accessibilityLabel={etiqueta}>
      {(['ant', 'post'] as const).map((cara) => (
        <View key={cara} style={styles.celda}>
          <Figura musculos={musculos} cara={cara} ancho={cada} />
          <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
            {cara === 'ant' ? t('iron:demo.mapaDelante') : t('iron:demo.mapaDetras')}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  celda: { alignItems: 'center', gap: 4 },
  rotulo: {
    fontFamily: type.label.family,
    fontSize: type.label.size,
    lineHeight: type.label.lineHeight,
    letterSpacing: type.label.tracking,
    color: ink.ink6,
    textTransform: 'uppercase',
  },
});
