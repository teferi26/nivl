// NIVL · Recuerdos: la vista del pase (FASE3 Lote F). Pura: todo llega por
// props desde usePase (Pase.tsx) o desde la galería con datos de mentira.
//
// Una columna de min(ancho, alto·9/16) centrada sobre negro: la foto a
// sangre dentro de ella con un velo plano, las barras arriba (pista ink4,
// relleno ink10; sin avance solo, quietas), la marca del periodo, compartir y
// cerrar de 44, las dos mitades que pasan atrás y adelante (mantener pulsado
// pausa) y el texto de la diapositiva abajo (portada y cierre, centrados en
// Cinzel).

import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import type { Recap, Slide } from '@/lib/photos';
import { EYEBROW_SLIDE, nombrePeriodo } from './tipos';

const BOTON = 44;
const MARGEN = 22;

export interface PaseVistaProps {
  recap: Recap;
  i: number;
  /** URL firmada de la foto de la diapositiva actual, si la hay. */
  foto: string | undefined;
  /** 0..1 de la diapositiva actual (solo si avanza sola). */
  progreso: Animated.Value;
  /** Avanza sola: ni «reducir movimiento» ni lector de pantalla. */
  auto: boolean;
  pausado: boolean;
  compartiendo: boolean;
  onAnterior: () => void;
  onSiguiente: () => void;
  onPausar: () => void;
  onSeguir: () => void;
  onCompartir: () => void;
  onSalir: () => void;
}

export function PaseVista({
  recap,
  i,
  foto,
  progreso,
  auto,
  pausado,
  compartiendo,
  onAnterior,
  onSiguiente,
  onPausar,
  onSeguir,
  onCompartir,
  onSalir,
}: PaseVistaProps) {
  const { width, height } = useWindowDimensions();
  // La columna del pase: 9:16 como mucho. En un móvil es la pantalla entera;
  // en una web ancha, una columna centrada con negro a los lados.
  const columna = Math.round(Math.min(width, (height * 9) / 16));
  const slides = recap.slides;
  const slide: Slide | undefined = slides[i];
  if (!slide) return null;
  const esPortada = slide.tipo === 'portada';
  const esCierre = slide.tipo === 'cierre';
  const centrado = esPortada || esCierre;
  const ultima = i === slides.length - 1;

  const pie = [`${i + 1} / ${slides.length}`, pausado ? 'En pausa' : null, ultima ? 'Toca para salir' : !auto ? 'Toca a la derecha para seguir' : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.pase}>
      <View style={[styles.columna, { width: columna }]}>
        {foto ? <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} /> : null}
        <View style={[StyleSheet.absoluteFill, foto ? styles.veloFoto : styles.velo]} />

        <SafeAreaView style={styles.seguro} edges={['top', 'bottom']}>
          <View style={styles.barras} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {slides.map((_, n) => (
              <View key={n} style={styles.barraPista}>
                <Animated.View
                  style={[
                    styles.barraRelleno,
                    (n < i || (!auto && n === i)) && styles.lleno,
                    auto &&
                      n === i && {
                        width: progreso.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                      },
                  ]}
                />
              </View>
            ))}
          </View>

          <View style={styles.cabecera} pointerEvents="box-none">
            <Text style={styles.marca} numberOfLines={1} maxFontSizeMultiplier={1.35}>
              {nombrePeriodo(recap)}
            </Text>
            <View style={styles.botones}>
              <Pressable
                onPress={onCompartir}
                style={({ pressed }) => [styles.boton, pressed && styles.pulsado]}
                accessibilityRole="button"
                accessibilityLabel="Compartir esta diapositiva"
                accessibilityState={{ busy: compartiendo }}
              >
                {compartiendo ? (
                  <ActivityIndicator size="small" color={ink.ink10} />
                ) : (
                  <Ionicons name="share-outline" size={20} color={ink.ink10} />
                )}
              </Pressable>
              <Pressable
                onPress={onSalir}
                style={({ pressed }) => [styles.boton, pressed && styles.pulsado]}
                accessibilityRole="button"
                accessibilityLabel="Cerrar el resumen"
              >
                <Ionicons name="close" size={22} color={ink.ink10} />
              </Pressable>
            </View>
          </View>

          {/* Mitad izquierda atrás, mitad derecha adelante: el gesto que ya
              conoce cualquiera que haya visto una historia. Mantener pulsado
              pausa; soltar sigue. */}
          <View style={styles.zonas}>
            <Pressable
              style={styles.zona}
              onPress={onAnterior}
              onLongPress={onPausar}
              onPressOut={pausado ? onSeguir : undefined}
              accessibilityRole="button"
              accessibilityLabel="Anterior"
            />
            <Pressable
              style={styles.zona}
              onPress={onSiguiente}
              onLongPress={onPausar}
              onPressOut={pausado ? onSeguir : undefined}
              accessibilityRole="button"
              accessibilityLabel={ultima ? 'Salir' : 'Siguiente'}
            />
          </View>

          <View
            style={[styles.contenido, centrado && styles.contenidoCentrado, { maxWidth: columna - MARGEN * 2 }]}
            pointerEvents="none"
            accessible
            accessibilityLiveRegion="polite"
          >
            {centrado ? <View style={styles.regla} /> : null}
            <Text style={[styles.eyebrow, centrado && styles.centrado]} maxFontSizeMultiplier={1.35}>
              {EYEBROW_SLIDE[slide.tipo]}
            </Text>
            {slide.dato ? (
              <Text style={[styles.dato, centrado && styles.centrado]} maxFontSizeMultiplier={1}>
                {slide.dato}
              </Text>
            ) : null}
            <Text
              style={[styles.titulo, centrado && styles.tituloPortada, slide.tipo === 'duro' && styles.tituloDuro]}
              numberOfLines={4}
              maxFontSizeMultiplier={1.35}
            >
              {centrado ? slide.titulo.toUpperCase() : slide.titulo}
            </Text>
            <Text style={[styles.texto, centrado && styles.centrado]} maxFontSizeMultiplier={1.6}>
              {slide.texto}
            </Text>
            {centrado ? <View style={styles.regla} /> : null}
            {esCierre ? (
              <Text style={styles.lema} maxFontSizeMultiplier={1.35}>
                UN 1 % MEJOR CADA DÍA
              </Text>
            ) : null}
            <Text style={[styles.pie, centrado && styles.centrado]} maxFontSizeMultiplier={1.35}>
              {pie}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pase: { flex: 1, backgroundColor: ink.ink0, alignItems: 'center' },
  columna: { flex: 1, maxWidth: '100%', overflow: 'hidden', backgroundColor: ink.ink0 },
  velo: { backgroundColor: ink.ink0 },
  // Con foto detrás el velo se levanta para que la imagen respire, pero sin
  // llegar a tapar el texto: es un velo plano de negro, no un blur ni un tinte.
  veloFoto: { backgroundColor: 'rgba(0, 0, 0, 0.62)' },
  seguro: { flex: 1, paddingHorizontal: MARGEN },
  barras: { flexDirection: 'row', gap: space.s1, paddingTop: space.s2 },
  barraPista: { flex: 1, height: stroke.rule, backgroundColor: ink.ink4 },
  barraRelleno: { height: stroke.rule, width: '0%', backgroundColor: ink.ink10 },
  lleno: { width: '100%' },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
    marginTop: space.s3,
    zIndex: 10,
  },
  marca: {
    flex: 1,
    minWidth: 0,
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: ink.ink8,
  },
  botones: { flexDirection: 'row', gap: space.s2 },
  boton: {
    width: BOTON,
    height: BOTON,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ink.ink0,
  },
  pulsado: { backgroundColor: ink.ink2 },
  zonas: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  zona: { flex: 1 },
  contenido: { flex: 1, justifyContent: 'flex-end', paddingBottom: space.s14 },
  contenidoCentrado: { justifyContent: 'center', alignItems: 'center', paddingBottom: 0 },
  centrado: { textAlign: 'center' },
  regla: { width: 40, height: stroke.hairline, backgroundColor: ink.ink4, marginVertical: space.s5 },
  eyebrow: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: ink.ink6,
    marginBottom: space.s3,
  },
  dato: {
    fontFamily: tipo.display.family,
    fontSize: tipo.display.size,
    lineHeight: tipo.display.lineHeight,
    color: ink.ink10,
    marginBottom: space.s2,
  },
  titulo: {
    fontFamily: tipo.title.family,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: tipo.title.tracking,
    color: ink.ink10,
    marginBottom: space.s3,
  },
  // Portada y cierre: Cinzel en mayúsculas, la piedra tallada, centrada.
  tituloPortada: {
    fontFamily: tipo.rank.family,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 2,
    textAlign: 'center',
  },
  // Lo duro se dice con el mismo blanco, más pequeño y sin adorno.
  tituloDuro: { fontSize: 24, lineHeight: 29, color: ink.ink8 },
  texto: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, lineHeight: 24, color: ink.ink9 },
  lema: {
    fontFamily: tipo.inscripcion.family,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 3,
    color: ink.ink6,
    textAlign: 'center',
  },
  pie: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink6,
    marginTop: space.s5,
  },
});
