// NIVL · Arena: la tarjeta de piedra (SISTEMA.md §5 bis).
//
// Por dentro es una Card (conserva SuperficieContext y PressScale); por fuera
// añade lo que la hace losa y no caja de formulario:
//   · remaches → 4 cuadrados de 3 × 3 en las esquinas (ink6; ink0 sobre la
//     invertida), como los clavos de un escudo.
//   · zócalo   → una segunda losa con hairline ink4 desplazada 4 pt abajo a la
//     derecha, detrás de la tarjeta. Da profundidad sin sombra ni color.
//   · marco    → borde ink10 de 1, 2 o 3 (jerarquía por trazo).
//   · rótulo   → línea de cabecera en Cinzel grabado, con un dato a la derecha.
//
// Variantes (y su Card): piedra = surface · contorno = outline · trama = alerta
// · grano = logro · invertida = inverse (UNA por pantalla).

import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Card } from '@/components/ui/Card';
import { splitStyle } from '@/components/ui/motion';
import { ink, space, stroke, type as tipo } from '@/design/tokens';

export type VarianteArena = 'piedra' | 'contorno' | 'trama' | 'grano' | 'invertida';

const CARD: Record<VarianteArena, 'surface' | 'outline' | 'alerta' | 'logro' | 'inverse'> = {
  piedra: 'surface',
  contorno: 'outline',
  trama: 'alerta',
  grano: 'logro',
  invertida: 'inverse',
};

export interface TarjetaArenaProps {
  variante?: VarianteArena;
  remaches?: boolean;
  zocalo?: boolean;
  marco?: 1 | 2 | 3;
  /** Cabecera grabada: «DÍA PERFECTO», «CONTRATO». */
  rotulo?: string;
  /** Dato a la derecha del rótulo: «3/5», «Hoy». */
  meta?: string;
  padded?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  /** Lo de colocación (margen, ancho, flex) va al envoltorio; lo visual, a la tarjeta. */
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** Lado del remache y su distancia al borde. */
const REMACHE = 3;
const REMACHE_BORDE = 5;
/** Desplazamiento de la losa de debajo. */
const ZOCALO = 4;

export function TarjetaArena({
  variante = 'piedra',
  remaches,
  zocalo,
  marco,
  rotulo,
  meta,
  padded = true,
  onPress,
  onLongPress,
  accessibilityLabel,
  style,
  children,
}: TarjetaArenaProps) {
  const invertida = variante === 'invertida';
  const { outer, inner } = splitStyle(style);
  const colorRotulo = invertida ? ink.ink0 : ink.ink9;
  const colorMeta = invertida ? ink.ink3 : ink.ink6;
  const colorRemache = invertida ? ink.ink0 : ink.ink6;

  const cabecera = rotulo ? (
    <View style={styles.cabecera}>
      <Text
        style={[styles.rotulo, { color: colorRotulo }]}
        maxFontSizeMultiplier={1.35}
        numberOfLines={2}
        accessibilityRole="header"
      >
        {rotulo}
      </Text>
      {meta ? (
        <Text style={[styles.meta, { color: colorMeta }]} maxFontSizeMultiplier={1.35}>
          {meta}
        </Text>
      ) : null}
    </View>
  ) : null;

  const tarjeta = (
    <Card
      variant={CARD[variante]}
      padded={padded}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={accessibilityLabel}
      style={[styles.card, marco ? { borderWidth: marco, borderColor: ink.ink10 } : null, inner]}
    >
      {cabecera}
      {children}
    </Card>
  );

  const clavos = remaches ? (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, zocalo && styles.dentroZocalo]}>
      {(['tl', 'tr', 'bl', 'br'] as const).map((p) => (
        <View
          key={p}
          style={[
            styles.remache,
            { backgroundColor: colorRemache },
            p[0] === 't' ? { top: REMACHE_BORDE } : { bottom: REMACHE_BORDE },
            p[1] === 'l' ? { left: REMACHE_BORDE } : { right: REMACHE_BORDE },
          ]}
        />
      ))}
    </View>
  ) : null;

  return (
    <View style={[zocalo && styles.conZocalo, outer]}>
      {zocalo ? <View pointerEvents="none" style={styles.losa} /> : null}
      {tarjeta}
      {clavos}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 0 },
  conZocalo: { paddingRight: ZOCALO, paddingBottom: ZOCALO },
  losa: {
    position: 'absolute',
    top: ZOCALO,
    left: ZOCALO,
    right: 0,
    bottom: 0,
    borderWidth: stroke.hairline,
    // ink4 y no ink3: con ink3 (1,3:1 sobre el negro) la losa no se veía.
    borderColor: ink.ink4,
    backgroundColor: ink.ink0,
  },
  dentroZocalo: { right: ZOCALO, bottom: ZOCALO },
  remache: { position: 'absolute', width: REMACHE, height: REMACHE },
  cabecera: { flexDirection: 'row', alignItems: 'baseline', gap: space.s3, marginBottom: space.s3 },
  rotulo: {
    flex: 1,
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    textTransform: 'uppercase',
  },
  meta: { fontFamily: tipo.number.family, fontSize: 13, lineHeight: 18 },
});
