// NIVL · El retrato del gladiador.
//
// @deprecated (FASE3, Lote Z): el retrato hexagonal ya no se pinta en ninguna
// pantalla. Usa `Avatar` de '@/components/ui' (círculo con el marco de rango).
// `useRetrato` vive ahora en src/components/ui/useRetrato.ts; aquí solo se
// reexporta para no romper imports viejos.

import { Image } from 'expo-image';
import { StyleSheet, Text } from 'react-native';
// eslint-disable-next-line no-restricted-imports -- este Avatar viejo está en desuso y es el único que aún pinta el hexágono.
import { Hexagon } from '@/components/Hexagon';
import { useRetrato } from '@/components/ui/useRetrato';
import { colors, fonts } from '@/lib/theme';

export { useRetrato };

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

/** @deprecated Usa `Avatar` de '@/components/ui' (FASE3, Lote Z). */
export function Avatar({ size, avatarPath, name, onReady }: Props) {
  const { uri, fallida, alCargar, alFallar } = useRetrato(avatarPath, onReady);

  return (
    <Hexagon size={size}>
      {uri && !fallida ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          onLoad={alCargar}
          onError={alFallar}
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
