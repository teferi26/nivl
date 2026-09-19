// NIVL · El retrato del gladiador.

import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Hexagon } from '@/components/Hexagon';
import { signedUrlCached } from '@/lib/data';
import { colors, fonts } from '@/lib/theme';

interface Props {
  size: number;
  /** `profiles.avatar_url`: la ruta en el bucket, no una URL firmada. */
  avatarPath: string | null;
  name: string;
  /**
   * Se llama UNA vez cuando el retrato ya es definitivo: la foto pintada, o la
   * inicial si no hay foto o no se ha podido traer. Lo usa la tarjeta de
   * compartir para no capturar un hexágono vacío.
   */
  onReady?: () => void;
}

/** Lo que se espera a una foto antes de darla por perdida (solo con `onReady`). */
const ESPERA_FOTO_MS = 5000;

/**
 * La inicial del nombre NO es un indicador de carga: es la respuesta a "este
 * gladiador no tiene foto".
 *
 * Usarla mientras la foto viajaba hacía que en cada entrada saliera primero
 * una letra y después la cara. Y como el perfil arranca llamándose "Gladiador",
 * esa letra era una C que no significaba nada para su dueño.
 *
 * Con `avatarPath` ya sabemos que hay foto antes de tenerla: se deja el hueco
 * en silencio y la cara entra cuando llega. La letra solo aparece cuando de
 * verdad no hay ninguna.
 */
export function Avatar({ size, avatarPath, name, onReady }: Props) {
  const [uri, setUri] = useState<string | null>(null);
  // La foto existe pero no ha llegado (sin red, firma caducada): se cae a la
  // inicial en vez de dejar el hueco para siempre.
  const [fallida, setFallida] = useState(false);
  const avisado = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const listo = () => {
    if (avisado.current) return;
    avisado.current = true;
    onReadyRef.current?.();
  };
  const esperaFoto = onReady !== undefined;

  useEffect(() => {
    let vivo = true;
    avisado.current = false;
    setFallida(false);
    if (!avatarPath) {
      setUri(null);
      listo();
      return;
    }
    const perder = () => {
      if (!vivo) return;
      setFallida(true);
      listo();
    };
    signedUrlCached('avatars', avatarPath)
      .then((u) => {
        if (!vivo) return;
        setUri(u);
        if (!u) perder();
      })
      .catch(perder);
    const tope = esperaFoto ? setTimeout(perder, ESPERA_FOTO_MS) : null;
    return () => {
      vivo = false;
      if (tope) clearTimeout(tope);
    };
  }, [avatarPath, esperaFoto]);

  return (
    <Hexagon size={size}>
      {uri && !fallida ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          onLoad={listo}
          onError={() => {
            setFallida(true);
            listo();
          }}
        />
      ) : avatarPath && !fallida ? null : (
        <Text allowFontScaling={false} style={[styles.letra, { fontSize: size * 0.4 }]}>
          {name.charAt(0).toUpperCase()}
        </Text>
      )}
    </Hexagon>
  );
}

const styles = StyleSheet.create({
  letra: { color: colors.accent, fontFamily: fonts.brand },
});
