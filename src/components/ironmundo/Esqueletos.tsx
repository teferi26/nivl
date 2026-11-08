// NIVL · Mundo IRON: la carga con la forma exacta del contenido (lámina 2).
// Cada esqueleto usa las mismas tarjetas, rellenos y alturas de línea que la
// pieza real, con líneas fantasma donde irá el texto y un brillo de 1,2 s que
// las recorre (quieto con «reducir movimiento» y en la galería con quieto=1):
// al llegar los datos la pantalla no salta.

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { estaQuieto } from '@/components/arena/quieto';
import { useMovimientoReducido } from '@/components/ui/motion';
import { t } from '@/i18n';
import { RotuloIron, TarjetaIron } from './piezas';
import { C, fs, M, O, px, R } from './tema';

/** Alto de línea de cada texto de IRON (los de estilosIron y piezas). */
export const LINEA = {
  rotulo: 14,
  titulo: 29,
  meta: 18,
  fila: 20,
  kg: 25,
  peso: 15,
} as const;

function useBrillo(): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  const reducido = useMovimientoReducido();
  useEffect(() => {
    if (reducido || estaQuieto()) {
      v.setValue(0.35);
      return;
    }
    const bucle = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    );
    bucle.start();
    return () => bucle.stop();
  }, [v, reducido]);
  return v;
}

/** Una línea fantasma (donde irá un texto). */
export function LineaHueco({ ancho, alto, style, acento }: { ancho: DimensionValue; alto: number; style?: StyleProp<ViewStyle>; acento?: boolean }) {
  const brillo = useBrillo();
  // El texto ocupa ~70 % de su alto de línea: la línea fantasma, centrada.
  const grueso = acento ? alto : Math.max(6, Math.round(alto * 0.62));
  return (
    <View style={[{ height: alto, justifyContent: 'center' }, style]}>
      <View style={[styles.linea, { width: ancho, height: grueso }, acento && styles.lineaAcento]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.brillo, acento && styles.brilloAcento, { opacity: brillo }]} />
      </View>
    </View>
  );
}

/** El entreno de hoy cargando: rótulo, título, meta y el botón. */
export function HeroeHueco() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={t('ironmundo:entreno.cargandoA11y')}>
      <TarjetaIron>
        <LineaHueco ancho="46%" alto={LINEA.rotulo} />
        <LineaHueco ancho="62%" alto={LINEA.titulo} style={styles.titulo} />
        <LineaHueco ancho="52%" alto={LINEA.meta} style={styles.meta} />
        <LineaHueco ancho="100%" alto={M.boton} acento style={styles.boton} />
      </TarjetaIron>
    </View>
  );
}

/** Las tres tarjetas de pesos cargando: nombre, cifra, subida y la línea de la gráfica. */
export function PesosHueco() {
  return (
    <View style={styles.pesos} accessibilityRole="progressbar" accessibilityLabel={t('ironmundo:pesos.cargandoA11y')}>
      {[0, 1, 2].map((i) => (
        <TarjetaIron key={i} style={styles.peso}>
          <LineaHueco ancho="55%" alto={LINEA.kg} />
          <LineaHueco ancho="70%" alto={LINEA.peso} style={styles.kg} />
          <LineaHueco ancho="60%" alto={px(13)} style={styles.kg} />
          <LineaHueco ancho="100%" alto={px(18)} style={styles.grafica} />
        </TarjetaIron>
      ))}
    </View>
  );
}

/** Las rutinas cargando: cuatro píldoras. */
export function RutinasHueco() {
  return (
    <View>
      <RotuloIron seccion texto={t('ironmundo:rutinas.rotulo')} />
      <View style={styles.chips}>
        {[px(78), px(66), px(52), px(70)].map((w, i) => (
          <View key={i} style={[styles.chip, { width: w }]}>
            <LineaHueco ancho="70%" alto={Math.round(fs(10.5) * 1.3)} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Las barras de la dieta cargando (en lugar de una píldora suelta). */
export function BarrasHueco({ n = 3 }: { n?: number }) {
  return (
    <View>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={styles.barra}>
          <LineaHueco ancho={`${50 - i * 8}%`} alto={Math.round(fs(8.5) * 1.3)} />
          <LineaHueco ancho="100%" alto={3} acento style={styles.barraPista} />
        </View>
      ))}
    </View>
  );
}

/** Una tarjeta genérica cargando: rótulo y unas líneas. */
export function TarjetaHueco({ lineas = 3, heroe, alto }: { lineas?: number; heroe?: boolean; alto?: number }) {
  return (
    <TarjetaIron heroe={heroe} style={alto ? { minHeight: alto } : undefined}>
      <LineaHueco ancho="40%" alto={LINEA.rotulo} />
      {Array.from({ length: lineas }, (_, i) => (
        <LineaHueco key={i} ancho={`${86 - i * 14}%`} alto={LINEA.fila} style={styles.meta} />
      ))}
    </TarjetaIron>
  );
}

const styles = StyleSheet.create({
  linea: { backgroundColor: C.hueco, borderRadius: R.chip, overflow: 'hidden' },
  lineaAcento: { backgroundColor: O.tenue, borderRadius: M.radioBoton },
  brillo: { backgroundColor: C.borde },
  brilloAcento: { backgroundColor: O.borde },
  titulo: { marginTop: px(4) },
  meta: { marginTop: px(2) },
  boton: { marginTop: 3 },
  pesos: { flexDirection: 'row', gap: 8 },
  peso: { flex: 1, minWidth: 0, borderRadius: R.control, paddingVertical: 10, paddingHorizontal: 11 },
  kg: { marginTop: px(2) },
  grafica: { marginTop: px(4) },
  chips: { flexDirection: 'row', gap: px(6) },
  chip: {
    paddingVertical: px(7),
    paddingHorizontal: px(11),
    borderRadius: M.radioChip,
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.tarjeta,
  },
  barra: { marginBottom: px(5) },
  barraPista: { marginTop: px(2) },
});
