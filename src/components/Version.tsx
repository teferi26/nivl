import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';

/**
 * Qué código estás corriendo exactamente.
 *
 * Existe por una tarde entera perdida: la app estaba instalada, la
 * actualización publicada, la configuración correcta en los dos lados… y no
 * había forma de saber si el móvil tenía el código nuevo o el viejo. Sin este
 * dato, "no se ha actualizado" y "sí se actualizó pero no se nota" son
 * indistinguibles, y se depura a ciegas.
 *
 * - VERSIÓN es la del binario: solo cambia con un build nuevo de TestFlight.
 * - PAQUETE es la actualización OTA que está corriendo encima. `embedded`
 *   significa que va con el que venía dentro del binario, o sea que NO ha
 *   llegado ninguna actualización.
 */
export function Version() {
  const version = Constants.expoConfig?.version ?? '—';
  const build =
    Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? '—';

  // En Expo Go y en desarrollo estas propiedades no existen: se degrada a un
  // texto honesto en vez de reventar la pantalla de Perfil.
  const canal = Updates.channel || 'sin canal';
  const paquete = Updates.isEmbeddedLaunch
    ? 'embedded (sin OTA)'
    : (Updates.updateId ?? '—').slice(0, 8);
  const creado = Updates.createdAt ? Updates.createdAt.toISOString().slice(0, 16).replace('T', ' ') : null;

  return (
    <View style={styles.caja}>
      <Text style={styles.linea}>
        VERSIÓN {version} ({String(build)}) · CANAL {canal}
      </Text>
      <Text style={styles.linea}>
        PAQUETE {paquete}
        {creado ? ` · ${creado}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { marginTop: 18, alignItems: 'center', gap: 2 },
  linea: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: colors.textFaint,
  },
});
