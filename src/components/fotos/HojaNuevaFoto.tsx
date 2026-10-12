// NIVL · Fotos de progreso: la hoja de nueva foto (L5 · A).
//
// Cámara o galería (recorte 3:4, calidad 0,5, base64), pose obligatoria con
// chips (por defecto, la primera que falta esta semana) y fecha de hoy con «-1 / +1» (nunca futuro). Guardar sube la foto con
// la capa de datos. Sin XP: una foto de progreso es un registro, no una misión.
//
// Privacidad: el base64 vive solo en el estado de la hoja (memoria) y la
// vista previa usa `cachePolicy="memory"`. Al cerrar o al guardar se vacía el
// estado y se borra el archivo temporal que deja el selector; al cerrar,
// también su carpeta de caché (`ImagePicker`). Fuera de la app (`tapada`) la
// vista previa no se pinta.

import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { vibrar } from '@/design/haptics';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { addDays, isValidKey } from '@/lib/dates';
import { POSES, type FotoProgreso, type Pose } from '@/lib/progressPhotos';
import { borrarCacheSelector, borrarTemporales, subirFoto } from './datos';
import { DIAS_ATRAS_MAX, fechaCorta, fechaFotoValida, mensajeErrorFotos, nombrePose } from './modelo';

interface Props {
  visible: boolean;
  onCerrar: () => void;
  uid: string | null;
  hoy: string;
  onGuardada: (f: FotoProgreso) => void;
  /** El servidor ha dicho que falta salud o 18+: hay que releer el permiso. */
  onGate: () => void;
  /** La pose con la que abre: la primera que falta esta semana (null: ninguna). */
  poseInicial?: Pose | null;
  /** La app no está activa: no se pinta la vista previa. */
  tapada?: boolean;
}

interface Elegida {
  base64: string;
  uri: string;
}

const OPCIONES: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.5,
  base64: true,
  allowsEditing: true,
  aspect: [3, 4],
  exif: false,
};

/** Solo JPG: el bucket admite jpeg y webp, y esta app sube siempre .jpg. */
function esJpeg(a: ImagePicker.ImagePickerAsset): boolean {
  const mime = a.mimeType?.toLowerCase();
  if (mime) return mime === 'image/jpeg' || mime === 'image/jpg';
  // Sin tipo declarado: en la web la URI es data:…; en nativo el recorte sale en JPG.
  if (a.uri.startsWith('data:')) return /^data:image\/jpe?g/i.test(a.uri);
  return !/\.(png|webp|heic|heif|gif)$/i.test(a.uri);
}

function sinCabecera(b64: string): string {
  const i = b64.indexOf('base64,');
  return i >= 0 ? b64.slice(i + 7) : b64;
}

export function HojaNuevaFoto({ visible, onCerrar, uid, hoy, onGuardada, onGate, poseInicial = null, tapada = false }: Props) {
  const [pose, setPose] = useState<Pose | null>(null);
  const [fecha, setFecha] = useState(hoy);
  const [elegida, setElegida] = useState<Elegida | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cerrojo = useRef(false);
  const temporal = useRef<string | null>(null);

  const soltarTemporal = () => {
    if (temporal.current && !temporal.current.startsWith('data:')) borrarTemporales([], [temporal.current]);
    temporal.current = null;
  };

  // Cada apertura empieza de cero; al cerrar no queda nada en memoria ni en
  // la caché del selector. La pose inicial se toma al abrir, no después.
  const poseAlAbrir = useRef(poseInicial);
  poseAlAbrir.current = poseInicial;
  const estabaVisible = useRef(false);
  useEffect(() => {
    if (visible) {
      setPose(poseAlAbrir.current);
      setFecha(hoy);
      setError(null);
    } else {
      setElegida(null);
      soltarTemporal();
      if (estabaVisible.current) borrarCacheSelector();
    }
    estabaVisible.current = visible;
  }, [visible, hoy]);
  useEffect(() => () => soltarTemporal(), []);

  const tomar = (r: ImagePicker.ImagePickerResult) => {
    if (r.canceled) return;
    const a = r.assets[0];
    if (!a?.base64) return;
    if (!esJpeg(a)) {
      if (!a.uri.startsWith('data:')) borrarTemporales([], [a.uri]);
      avisar(t('fotos:hoja.soloJpg'), t('fotos:hoja.soloJpgCuerpo'));
      return;
    }
    soltarTemporal();
    temporal.current = a.uri;
    setError(null);
    setElegida({ base64: sinCabecera(a.base64), uri: a.uri });
  };

  const camara = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      const mensaje = t('fotos:hoja.sinCamara');
      if (Platform.OS === 'web') avisar(t('comun:sinCamara'), mensaje);
      else if (
        await confirmar({
          titulo: t('comun:sinCamara'),
          mensaje,
          confirmar: t('comun:abrirAjustes'),
          cancelar: t('comun:ahoraNo'),
        })
      ) {
        Linking.openSettings().catch(() => {});
      }
      return;
    }
    tomar(await ImagePicker.launchCameraAsync(OPCIONES));
  };

  // iOS 14+ y el selector de Android 13+ no piden permiso para elegir una foto.
  const galeria = async () => {
    tomar(await ImagePicker.launchImageLibraryAsync(OPCIONES));
  };

  const guardar = async () => {
    if (!uid || !elegida || !pose || cerrojo.current) return;
    if (!fechaFotoValida(fecha, hoy)) {
      setError(t('fotos:hoja.fechaFutura'));
      return;
    }
    cerrojo.current = true;
    setGuardando(true);
    setError(null);
    try {
      const f = await subirFoto(uid, { base64: elegida.base64, fecha, pose });
      vibrar('seleccion');
      setElegida(null);
      soltarTemporal();
      onGuardada(f);
      onCerrar();
    } catch (e) {
      const m = mensajeErrorFotos(e);
      setError(m.mensaje);
      if (m.refrescar) {
        onGate();
        onCerrar();
      }
    } finally {
      cerrojo.current = false;
      setGuardando(false);
    }
  };

  const minimo = addDays(hoy, -DIAS_ATRAS_MAX);
  const puedeAtras = isValidKey(fecha) && fecha > minimo;
  const puedeAdelante = isValidKey(fecha) && fecha < hoy;
  const nombreFecha =
    fecha === hoy ? t('fotos:hoja.hoy') : fecha === addDays(hoy, -1) ? t('fotos:hoja.ayer') : fechaCorta(fecha, hoy);

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        if (!cerrojo.current) onCerrar();
      }}
      eyebrow={t('fotos:fotosProgreso')}
      title={t('fotos:vista.nueva')}
      footer={
        <>
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : !pose ? (
            <Text style={styles.falta} maxFontSizeMultiplier={1.35}>
              {t('fotos:hoja.eligePose')}
            </Text>
          ) : null}
          <Button title={t('comun:guardar')} onPress={guardar} disabled={!elegida || !pose || !uid} loading={guardando} />
        </>
      }
    >
      <View style={styles.cuerpo}>
        <View style={styles.vista}>
          <View style={styles.previa}>
            {elegida && !tapada ? (
              <Image
                source={{ uri: elegida.uri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory"
                accessibilityLabel={t('fotos:hoja.previaA11y')}
              />
            ) : (
              <Ionicons name="camera-outline" size={28} color={ink.ink4} />
            )}
          </View>
          <View style={styles.fuentes}>
            <Button
              title={t('fotos:hoja.hacerFoto')}
              icon="camera-outline"
              variant="secondary"
              size="sm"
              onPress={camara}
              disabled={guardando}
            />
            <Button
              title={t('fotos:hoja.galeria')}
              icon="images-outline"
              variant="secondary"
              size="sm"
              onPress={galeria}
              disabled={guardando}
            />
            <Text style={styles.consejo} maxFontSizeMultiplier={1.35}>
              {t('fotos:hoja.consejo')}
            </Text>
          </View>
        </View>

        <Text style={styles.label}>{t('fotos:hoja.pose')}</Text>
        <ChipWrap>
          {POSES.map((p) => (
            <Chip key={p} label={nombrePose(p)} selected={pose === p} onPress={() => setPose(p)} />
          ))}
        </ChipWrap>

        <Text style={styles.label}>{t('fotos:hoja.fecha')}</Text>
        <View style={styles.fecha}>
          <Pressable
            onPress={() => puedeAtras && setFecha(addDays(fecha, -1))}
            disabled={!puedeAtras || guardando}
            style={({ pressed }) => [styles.paso, (!puedeAtras || pressed) && styles.pasoApagado]}
            accessibilityRole="button"
            accessibilityLabel={t('fotos:hoja.antesA11y')}
          >
            <Ionicons name="chevron-back" size={20} color={ink.ink9} />
          </Pressable>
          <Text style={styles.fechaTexto} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.35}>
            {nombreFecha}
          </Text>
          <Pressable
            onPress={() => puedeAdelante && setFecha(addDays(fecha, 1))}
            disabled={!puedeAdelante || guardando}
            style={({ pressed }) => [styles.paso, (!puedeAdelante || pressed) && styles.pasoApagado]}
            accessibilityRole="button"
            accessibilityLabel={t('fotos:hoja.despuesA11y')}
          >
            <Ionicons name="chevron-forward" size={20} color={ink.ink9} />
          </Pressable>
        </View>

        <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
          {t('fotos:hoja.nota')}
        </Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cuerpo: { gap: space.s2 },
  vista: { flexDirection: 'row', gap: space.s4, alignItems: 'flex-start' },
  previa: {
    width: 108,
    aspectRatio: 3 / 4,
    backgroundColor: ink.ink2,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fuentes: { flex: 1, minWidth: 0, gap: space.s2 },
  consejo: { fontFamily: tipo.bodySm.family, fontSize: 13, lineHeight: 18, color: ink.ink6, marginTop: space.s1 },
  label: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
    marginTop: space.s4,
  },
  fecha: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  paso: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
  },
  pasoApagado: { opacity: 0.4 },
  fechaTexto: {
    flex: 1,
    textAlign: 'center',
    fontFamily: tipo.number.family,
    fontSize: 18,
    lineHeight: 24,
    color: ink.ink9,
  },
  nota: { fontFamily: tipo.bodySm.family, fontSize: 13, lineHeight: 18, color: ink.ink6, marginTop: space.s4 },
  falta: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink6 },
  error: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink9 },
});
