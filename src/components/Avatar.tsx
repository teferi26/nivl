// NIVL · El retrato del cazador.

import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Hexagon } from '@/components/Hexagon';
import { signedUrlCached } from '@/lib/data';
import { colors, fonts } from '@/lib/theme';

interface Props {
  size: number;
  /** `profiles.avatar_url`: la ruta en el bucket, no una URL firmada. */
  avatarPath: string | null;
  name: string;
}

/**
 * La inicial del nombre NO es un indicador de carga: es la respuesta a "este
 * cazador no tiene foto".
 *
 * Usarla mientras la foto viajaba hacía que en cada entrada saliera primero
 * una letra y después la cara. Y como el perfil arranca llamándose "Cazador",
 * esa letra era una C que no significaba nada para su dueño.
 *
 * Con `avatarPath` ya sabemos que hay foto antes de tenerla: se deja el hueco
 * en silencio y la cara entra cuando llega. La letra solo aparece cuando de
 * verdad no hay ninguna.
 */
export function Avatar({ size, avatarPath, name }: Props) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    if (!avatarPath) {
      setUri(null);
      return;
    }
    signedUrlCached('avatars', avatarPath)
      .then((u) => vivo && setUri(u))
      .catch(() => vivo && setUri(null));
    return () => {
      vivo = false;
    };
  }, [avatarPath]);

  return (
    <Hexagon size={size}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />
      ) : avatarPath ? null : (
        <Text style={[styles.letra, { fontSize: size * 0.4 }]}>
          {name.charAt(0).toUpperCase()}
        </Text>
      )}
    </Hexagon>
  );
}

const styles = StyleSheet.create({
  letra: { color: colors.cyan, fontFamily: fonts.brand },
});
