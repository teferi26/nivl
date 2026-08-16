import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SystemButton } from '@/components/SystemButton';
import { SystemWindow } from '@/components/SystemWindow';
import { generarResumen } from '@/lib/coach';
import { fetchRecaps, marcarVisto, urlFirmada, type Recap, type Slide } from '@/lib/photos';
import { colors, fonts } from '@/lib/theme';

const { width } = Dimensions.get('window');
const DURACION_MS = 6000;

/** El pase: una diapositiva a la vez, con barras de progreso arriba. */
function Pase({ recap, onSalir }: { recap: Recap; onSalir: () => void }) {
  const [i, setI] = useState(0);
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

  if (!slide) return null;
  const foto = slide.foto ? urls[slide.foto] : undefined;

  return (
    <View style={styles.pase}>
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

        <Pressable
          onPress={onSalir}
          hitSlop={12}
          style={styles.cerrar}
          accessibilityRole="button"
          accessibilityLabel="Cerrar el resumen"
        >
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>

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

        <View style={styles.contenidoSlide} pointerEvents="none">
          {slide.dato ? <Text style={styles.dato}>{slide.dato}</Text> : null}
          <Text style={[styles.tituloSlide, slide.tipo === 'duro' && styles.tituloDuro]}>
            {slide.titulo}
          </Text>
          <Text style={styles.textoSlide}>{slide.texto}</Text>
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

  const cargar = useCallback(async () => {
    try {
      setRecaps(await fetchRecaps());
    } catch {
      /* la pantalla ya avisa si no hay nada */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const generar = async () => {
    if (generando) return;
    setGenerando(true);
    setAviso(null);
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
      setAviso(e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      setGenerando(false);
    }
  };

  if (abierto) return <Pase recap={abierto} onSalir={() => setAbierto(null)} />;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={24} color={colors.cyan} />
        </Pressable>
        <Text style={styles.title}>RECUERDOS</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.contenido}>
        <SystemWindow color={colors.cyanDim}>
          <Text style={styles.windowTitle}>LA SEMANA EN IMÁGENES</Text>
          <Text style={styles.hint}>
            El sistema junta las fotos que has ido subiendo con cada misión y te cuenta la semana.
            Si no has subido ninguna, no hay resumen: un pase vacío no recuerda nada.
          </Text>
          <SystemButton
            title="Generar el de esta semana"
            onPress={generar}
            loading={generando}
            style={{ marginTop: 12 }}
          />
          {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
          <Text style={styles.hint}>El del mes lo genera el sistema solo, el día 1.</Text>
        </SystemWindow>

        {recaps.length === 0 ? (
          <SystemWindow>
            <Text style={styles.vacio}>
              Todavía no hay recuerdos. Sube una foto al completar una misión y el domingo tendrás
              algo que mirar.
            </Text>
          </SystemWindow>
        ) : (
          recaps.map((r) => (
            <Pressable key={r.id} onPress={() => setAbierto(r)} accessibilityRole="button">
              <SystemWindow color={r.kind === 'mensual' ? colors.purpleDim : colors.cyanDim}>
                <View style={styles.filaRecap}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.windowTitle}>
                      {r.kind === 'mensual' ? 'MES' : 'SEMANA'} · {r.period_start}
                    </Text>
                    <Text style={styles.hint}>
                      {r.slides.length} diapositivas · {r.photo_count} fotos
                      {r.seen_at ? '' : ' · sin ver'}
                    </Text>
                  </View>
                  <Ionicons
                    name="play-circle-outline"
                    size={30}
                    color={r.seen_at ? colors.textDim : colors.cyan}
                  />
                </View>
              </SystemWindow>
            </Pressable>
          ))
        )}
      </ScrollView>

      {generando ? (
        <View style={styles.cargando} pointerEvents="none">
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.hint}>El sistema está montando tu semana…</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: { fontFamily: fonts.heading, fontSize: 15, letterSpacing: 3, color: colors.text },
  contenido: { padding: 16, paddingBottom: 32 },
  windowTitle: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2.5,
    color: colors.cyanText,
    marginBottom: 8,
  },
  hint: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.textDim, marginTop: 4 },
  aviso: { fontFamily: fonts.semibold, fontSize: 13, color: colors.amber, marginTop: 10, lineHeight: 19 },
  vacio: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.textDim },
  filaRecap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cargando: { position: 'absolute', bottom: 30, alignSelf: 'center', alignItems: 'center', gap: 6 },

  pase: { flex: 1, backgroundColor: colors.bg },
  velo: { backgroundColor: colors.bg },
  // Con foto detrás el velo se levanta para que la imagen respire, pero sin
  // llegar a tapar el texto: es un degradado plano, no un blur.
  veloFoto: { backgroundColor: 'rgba(6, 11, 22, 0.62)' },
  paseSeguro: { flex: 1, paddingHorizontal: 22 },
  barras: { flexDirection: 'row', gap: 4, paddingTop: 6 },
  barraPista: { flex: 1, height: 2.5, backgroundColor: colors.track },
  barraRelleno: { height: 2.5, backgroundColor: colors.cyan },
  cerrar: { position: 'absolute', top: 44, right: 18, zIndex: 10 },
  zonas: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  zona: { flex: 1 },
  contenidoSlide: { flex: 1, justifyContent: 'flex-end', paddingBottom: 60, maxWidth: width - 44 },
  dato: { fontFamily: fonts.brand, fontSize: 46, color: colors.cyan, marginBottom: 6 },
  tituloSlide: {
    fontFamily: fonts.heading,
    fontSize: 26,
    letterSpacing: 1.5,
    color: colors.text,
    marginBottom: 10,
  },
  tituloDuro: { color: colors.amber },
  textoSlide: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24, color: colors.text },
});
