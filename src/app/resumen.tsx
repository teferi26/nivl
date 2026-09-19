import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { SystemButton } from '@/components/SystemButton';
import { Card, EmptyState, FadeIn, Row, RowValue, Screen, ScreenHeader, Section, Stagger, Tag } from '@/components/ui';
import { accessNotice, CoachAccessError, generarResumen } from '@/lib/coach';
import { fetchRecaps, marcarVisto, urlFirmada, type Recap, type Slide } from '@/lib/photos';
import { colors, fonts } from '@/lib/theme';

const { width } = Dimensions.get('window');
const DURACION_MS = 6000;

/** Rótulo pequeño de cada diapositiva: dice qué es antes de leerla. */
const EYEBROW_SLIDE: Record<Slide['tipo'], string> = {
  portada: 'NIVL · Recuerdos',
  dato: 'El dato',
  foto: 'Evidencia',
  duro: 'Lo duro',
  cierre: 'Cierre',
};

function nombrePeriodo(r: Recap): string {
  return `${r.kind === 'mensual' ? 'Mes' : 'Semana'} del ${r.period_start}`;
}

/** El pase: una diapositiva a la vez, con barras de progreso arriba. */
function Pase({ recap, onSalir }: { recap: Recap; onSalir: () => void }) {
  const [i, setI] = useState(0);
  const [compartiendo, setCompartiendo] = useState(false);
  const lienzo = useRef<View>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const progreso = useRef(new Animated.Value(0)).current;
  const slides = recap.slides;
  const slide: Slide | undefined = slides[i];

  // Las fotos son privadas: cada una necesita su URL firmada. Se piden todas
  // de golpe al abrir para que el pase no se pare a mitad esperando una.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const rutas = slides.map((s) => s.foto).filter(Boolean) as string[];
      const pares = await Promise.all(
        rutas.map(async (r) => [r, (await urlFirmada(r)) ?? ''] as const),
      );
      if (vivo) setUrls(Object.fromEntries(pares));
    })();
    return () => {
      vivo = false;
    };
  }, [slides]);

  useEffect(() => {
    progreso.setValue(0);
    const anim = Animated.timing(progreso, {
      toValue: 1,
      duration: DURACION_MS,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (!finished) return;
      if (i < slides.length - 1) setI((v) => v + 1);
    });
    return () => anim.stop();
  }, [i, slides.length, progreso]);

  useEffect(() => {
    if (i === slides.length - 1) {
      marcarVisto(recap.id).catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [i, slides.length, recap.id]);

  /**
   * Sacar la diapositiva como imagen.
   *
   * Era lo que faltaba: el pase se podía ver pero no extraer, así que el
   * recuerdo se quedaba dentro de la app. Se captura lo que hay en pantalla —
   * foto de fondo incluida— y se abre el compartir del sistema.
   */
  const compartir = async () => {
    if (compartiendo || !lienzo.current) return;
    setCompartiendo(true);
    try {
      const uri = await captureRef(lienzo, { format: 'jpg', quality: 0.92 });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('No disponible', 'Este dispositivo no permite compartir archivos.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Tu semana' });
    } catch (e) {
      Alert.alert('No se pudo extraer', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      setCompartiendo(false);
    }
  };

  if (!slide) return null;
  const foto = slide.foto ? urls[slide.foto] : undefined;
  const esPortada = slide.tipo === 'portada';
  const esCierre = slide.tipo === 'cierre';
  const centrado = esPortada || esCierre;

  return (
    <View style={styles.pase} ref={lienzo} collapsable={false}>
      {foto ? (
        <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} />
      ) : null}
      <View style={[StyleSheet.absoluteFill, styles.velo, foto ? styles.veloFoto : null]} />

      <SafeAreaView style={styles.paseSeguro} edges={['top', 'bottom']}>
        <View style={styles.barras}>
          {slides.map((_, n) => (
            <View key={n} style={styles.barraPista}>
              <Animated.View
                style={[
                  styles.barraRelleno,
                  n < i && { width: '100%' },
                  n === i && {
                    width: progreso.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.paseCabecera} pointerEvents="box-none">
          <Text style={styles.paseMarca}>{nombrePeriodo(recap).toUpperCase()}</Text>
          <View style={styles.paseBotones}>
            <Pressable
              onPress={compartir}
              hitSlop={10}
              style={({ pressed }) => [styles.paseBoton, pressed && styles.pulsado]}
              accessibilityRole="button"
              accessibilityLabel="Extraer esta diapositiva como imagen"
            >
              {compartiendo ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Ionicons name="share-outline" size={20} color={colors.text} />
              )}
            </Pressable>
            <Pressable
              onPress={onSalir}
              hitSlop={10}
              style={({ pressed }) => [styles.paseBoton, pressed && styles.pulsado]}
              accessibilityRole="button"
              accessibilityLabel="Cerrar el resumen"
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {/* Mitad izquierda atrás, mitad derecha adelante: el gesto que ya
            conoce cualquiera que haya visto una historia. */}
        <View style={styles.zonas}>
          <Pressable
            style={styles.zona}
            onPress={() => setI((v) => Math.max(0, v - 1))}
            accessibilityRole="button"
            accessibilityLabel="Anterior"
          />
          <Pressable
            style={styles.zona}
            onPress={() => (i < slides.length - 1 ? setI((v) => v + 1) : onSalir())}
            accessibilityRole="button"
            accessibilityLabel="Siguiente"
          />
        </View>

        <View style={[styles.contenidoSlide, centrado && styles.contenidoCentrado]} pointerEvents="none">
          {centrado ? <View style={styles.regla} /> : null}
          <Text style={[styles.slideEyebrow, centrado && styles.centrado]}>{EYEBROW_SLIDE[slide.tipo]}</Text>
          {slide.dato ? <Text style={[styles.dato, centrado && styles.centrado]}>{slide.dato}</Text> : null}
          <Text
            style={[styles.tituloSlide, centrado && styles.tituloPortada, slide.tipo === 'duro' && styles.tituloDuro]}
            numberOfLines={4}
          >
            {centrado ? slide.titulo.toUpperCase() : slide.titulo}
          </Text>
          <Text style={[styles.textoSlide, centrado && styles.centrado]}>{slide.texto}</Text>
          {centrado ? <View style={styles.regla} /> : null}
          {esCierre ? <Text style={styles.cierreMotto}>UN 1 % MEJOR CADA DÍA</Text> : null}
          <Text style={[styles.pasePie, centrado && styles.centrado]}>
            {i + 1} / {slides.length}
            {esCierre ? ' · Toca para salir' : ''}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

export default function Resumen() {
  const [recaps, setRecaps] = useState<Recap[]>([]);
  const [abierto, setAbierto] = useState<Recap | null>(null);
  const [generando, setGenerando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // El pase lo monta la IA: sin NIVL Pro el aviso lleva el camino, no un error.
  const [pidePro, setPidePro] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setRecaps(await fetchRecaps());
    } catch {
      /* la pantalla ya avisa si no hay nada */
    } finally {
      setCargado(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const generar = async () => {
    if (generando) return;
    setGenerando(true);
    setAviso(null);
    setPidePro(false);
    try {
      const r = await generarResumen('semanal');
      if (!r.slides.length) {
        setAviso(r.motivo ?? 'Sin fotos esta semana.');
        return;
      }
      await cargar();
      const nuevos = await fetchRecaps();
      setAbierto(nuevos[0] ?? null);
    } catch (e) {
      if (e instanceof CoachAccessError) {
        setPidePro(e.reason === 'sin_suscripcion');
        setAviso(
          e.reason === 'sin_suscripcion'
            ? 'El pase de la semana lo monta el coach, y el coach es parte de NIVL Pro. Tus fotos y tus recuerdos guardados siguen aquí.'
            : accessNotice(e),
        );
      } else {
        setAviso(e instanceof Error ? e.message : 'Fallo desconocido');
      }
    } finally {
      setGenerando(false);
    }
  };

  if (abierto) return <Pase recap={abierto} onSalir={() => setAbierto(null)} />;

  const sinVer = recaps.filter((r) => !r.seen_at).length;
  const subtitulo = !cargado
    ? undefined
    : recaps.length === 0
      ? 'Todavía no hay pases guardados.'
      : sinVer > 0
        ? `${sinVer} ${sinVer === 1 ? 'pase sin ver' : 'pases sin ver'} de ${recaps.length}.`
        : `${recaps.length} ${recaps.length === 1 ? 'pase guardado' : 'pases guardados'}.`;

  return (
    <Screen refreshing={refrescando} onRefresh={refrescar}>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader onBack={() => router.back()} eyebrow="Recuerdos" title="Tu semana en imágenes" subtitle={subtitulo} />
        </FadeIn>

        <FadeIn index={1}>
          <Section title="Esta semana">
            <Card>
              <Text style={styles.texto}>
                El sistema junta las fotos que has ido subiendo con cada misión y te cuenta la semana. Si no has
                subido ninguna, no hay resumen: un pase vacío no recuerda nada.
              </Text>
              <SystemButton
                title="Generar el de esta semana"
                icon="sparkles-outline"
                onPress={generar}
                loading={generando}
                style={{ marginTop: 16 }}
              />
              {generando ? <Text style={styles.montando}>El sistema está montando tu semana…</Text> : null}
              {aviso ? (
                <View style={styles.aviso}>
                  <Ionicons name="alert-circle-outline" size={15} color={colors.accentText} />
                  <Text style={styles.avisoTexto}>{aviso}</Text>
                </View>
              ) : null}
              {pidePro ? (
                <SystemButton
                  title="Ver NIVL Pro"
                  variant="outline"
                  size="sm"
                  onPress={() => router.push('/pro')}
                  style={{ marginTop: 12, alignSelf: 'flex-start' }}
                />
              ) : null}
              <Text style={styles.nota}>El del mes lo genera el sistema solo, el día 1.</Text>
            </Card>
          </Section>
        </FadeIn>

        <FadeIn index={2}>
          <Section title="Pases" meta={recaps.length > 0 ? `${recaps.length}` : undefined}>
            {!cargado ? (
              <EmptyState compact icon="hourglass-outline" title="Buscando tus recuerdos" />
            ) : recaps.length === 0 ? (
              <Card variant="outline">
                <EmptyState
                  icon="images-outline"
                  title="Todavía no hay recuerdos"
                  body="Sube una foto al completar una misión y el domingo tendrás algo que mirar."
                />
              </Card>
            ) : (
              <Card padded={false} style={styles.lista}>
                {recaps.map((r, i) => (
                  <Row
                    key={r.id}
                    first={i === 0}
                    leading={
                      <Ionicons
                        name={r.seen_at ? 'play-circle-outline' : 'play-circle'}
                        size={26}
                        color={r.seen_at ? colors.textDim : colors.accent}
                      />
                    }
                    title={nombrePeriodo(r)}
                    detail={`${r.slides.length} diapositivas · ${r.photo_count} fotos`}
                    trailing={r.seen_at ? <RowValue>Visto</RowValue> : <Tag tone="accent">Sin ver</Tag>}
                    chevron
                    onPress={() => setAbierto(r)}
                    accessibilityLabel={`Abrir el pase: ${nombrePeriodo(r)}`}
                  />
                ))}
              </Card>
            )}
          </Section>
        </FadeIn>
      </Stagger>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  texto: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.textDim },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 12 },
  montando: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textDim, marginTop: 10, textAlign: 'center' },
  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12 },
  avisoTexto: { flex: 1, minWidth: 0, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19, color: colors.accentText },
  pulsado: { opacity: 0.6 },

  pase: { flex: 1, backgroundColor: colors.bg },
  velo: { backgroundColor: colors.bg },
  // Con foto detrás el velo se levanta para que la imagen respire, pero sin
  // llegar a tapar el texto: es un velo plano de negro, no un blur ni un tinte.
  veloFoto: { backgroundColor: 'rgba(5, 5, 5, 0.62)' },
  paseSeguro: { flex: 1, paddingHorizontal: 22 },
  barras: { flexDirection: 'row', gap: 4, paddingTop: 6 },
  barraPista: { flex: 1, height: 2, backgroundColor: colors.accentDim },
  barraRelleno: { height: 2, backgroundColor: colors.accent },
  paseCabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, zIndex: 10 },
  paseMarca: { flex: 1, fontFamily: fonts.heading, fontSize: 10.5, letterSpacing: 2.5, color: colors.textDim },
  paseBotones: { flexDirection: 'row', gap: 8 },
  paseBoton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  zonas: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  zona: { flex: 1 },
  contenidoSlide: { flex: 1, justifyContent: 'flex-end', paddingBottom: 56, maxWidth: width - 44 },
  contenidoCentrado: { justifyContent: 'center', alignItems: 'center', paddingBottom: 0 },
  centrado: { textAlign: 'center' },
  regla: { width: 40, height: 1, backgroundColor: colors.accentDim, marginVertical: 22 },
  slideEyebrow: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginBottom: 10,
  },
  dato: { fontFamily: fonts.brand, fontSize: 54, lineHeight: 60, color: colors.accent, marginBottom: 6 },
  tituloSlide: {
    fontFamily: fonts.heading,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.6,
    color: colors.text,
    marginBottom: 12,
  },
  // Portada y cierre: Cinzel en mayúsculas, la piedra tallada, centrada.
  tituloPortada: {
    fontFamily: fonts.brand,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 2,
    textAlign: 'center',
  },
  // Lo duro se dice con el mismo blanco, más pequeño y sin adorno.
  tituloDuro: { fontSize: 24, lineHeight: 29, color: colors.textDim },
  textoSlide: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24, color: colors.text },
  cierreMotto: { fontFamily: fonts.heading, fontSize: 10.5, letterSpacing: 3, color: colors.textFaint, textAlign: 'center' },
  pasePie: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textFaint, marginTop: 18 },
});
