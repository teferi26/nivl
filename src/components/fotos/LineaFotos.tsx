// NIVL · Fotos de progreso: la línea del tiempo (L5 · A).
//
// Una fila por semana ISO, de la más reciente a la más antigua: frente, lado y
// espalda (la última de cada pose esa semana) y «-» donde falta. Las imágenes
// llegan por URL firmada de 60 s y se pintan con `cachePolicy="memory"`: nada
// de la foto toca el disco. Si una firma ha caducado, `onFallo` la renueva
// (una vez por foto, lo controla quien firma).

import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { POSES, type FotoConPeso, type Pose, type SemanaFotos } from '@/lib/progressPhotos';
import { fechaCorta, NOMBRE_POSE } from './modelo';

interface MiniaturaProps {
  url?: string;
  pose: Pose;
  fecha?: string;
  hoy?: string;
  /** Sin foto: el hueco con «-». */
  vacia?: boolean;
  onPress?: () => void;
  onFallo?: () => void;
  /** Proporción alto/ancho (3:4 por defecto). */
  grande?: boolean;
}

/** Una foto (o su hueco) en proporción 3:4. */
export function Miniatura({ url, pose, fecha, hoy, vacia, onPress, onFallo, grande }: MiniaturaProps) {
  const etiqueta = vacia
    ? `${NOMBRE_POSE[pose]}: sin foto esta semana`
    : `Foto de ${NOMBRE_POSE[pose].toLowerCase()} del ${fecha ? fechaCorta(fecha, hoy) : ''}`;
  const caja = (
    <View style={[styles.marco, vacia && styles.marcoVacio, grande && styles.marcoGrande]}>
      {vacia ? (
        <Text style={styles.guion}>-</Text>
      ) : url ? (
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory"
          transition={120}
          onError={onFallo}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Ionicons name="image-outline" size={grande ? 28 : 20} color={ink.ink4} />
      )}
    </View>
  );
  if (!onPress || vacia) {
    return (
      <View accessible accessibilityLabel={etiqueta} style={styles.flex}>
        {caja}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.flex, pressed && styles.pulsado]}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityHint="Abre la foto"
    >
      {caja}
    </Pressable>
  );
}

interface LineaFotosProps {
  semanas: SemanaFotos[];
  urls: Record<string, string>;
  hoy: string;
  hayMas: boolean;
  onVerMas: () => void;
  onAbrir: (f: FotoConPeso) => void;
  onFallo: (id: string) => void;
}

export function LineaFotos({ semanas, urls, hoy, hayMas, onVerMas, onAbrir, onFallo }: LineaFotosProps) {
  return (
    <View style={styles.lista}>
      {semanas.map((s, i) => (
        <View key={s.semana} style={[styles.semana, i > 0 && styles.conRegla]}>
          <View style={styles.cabecera}>
            <Text style={styles.numero} maxFontSizeMultiplier={1.35}>
              SEMANA {s.numeroIso}
            </Text>
            <Text style={styles.fecha} maxFontSizeMultiplier={1.35}>
              {fechaCorta(s.semana, hoy)}
            </Text>
            <View style={styles.hueco} />
            <Text style={styles.cuenta} maxFontSizeMultiplier={1.35}>
              {s.completa ? 'COMPLETA' : `${s.fotos.length}/3`}
            </Text>
          </View>
          <View style={styles.fila}>
            {POSES.map((p) => {
              const f = s.fotos.find((x) => x.pose === p);
              return (
                <View key={p} style={styles.celda}>
                  {f ? (
                    <Miniatura
                      url={urls[f.id]}
                      pose={p}
                      fecha={f.fecha}
                      hoy={hoy}
                      onPress={() => onAbrir(f)}
                      onFallo={() => onFallo(f.id)}
                    />
                  ) : (
                    <Miniatura pose={p} vacia />
                  )}
                  <Text style={styles.pose} maxFontSizeMultiplier={1.35}>
                    {NOMBRE_POSE[p]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}
      {hayMas ? <Button title="Ver más" variant="ghost" size="sm" onPress={onVerMas} style={styles.verMas} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { width: '100%' },
  pulsado: { opacity: 0.7 },
  marco: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: ink.ink2,
    borderWidth: stroke.hairline,
    borderColor: ink.ink3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  marcoGrande: { borderColor: ink.ink4 },
  marcoVacio: { backgroundColor: ink.ink0 },
  guion: { fontFamily: tipo.cifra.family, fontSize: 24, lineHeight: 28, color: ink.ink4 },
  lista: { gap: 0 },
  semana: { paddingVertical: space.s4, gap: space.s3 },
  conRegla: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  cabecera: { flexDirection: 'row', alignItems: 'baseline', gap: space.s2 },
  numero: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: 2,
    color: ink.ink9,
  },
  fecha: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, letterSpacing: tipo.micro.tracking, color: ink.ink6 },
  hueco: { flex: 1 },
  cuenta: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, letterSpacing: tipo.micro.tracking, color: ink.ink8 },
  fila: { flexDirection: 'row', gap: space.s2 },
  celda: { flex: 1, minWidth: 0, gap: space.s1 },
  pose: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
    textAlign: 'center',
  },
  verMas: { alignSelf: 'center', marginTop: space.s2 },
});
