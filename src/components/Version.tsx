import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const [buscando, setBuscando] = useState(false);
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

  /**
   * Buscar la actualización a mano.
   *
   * expo-updates comprueba solo al arrancar en frío y aplica en el arranque
   * SIGUIENTE, y eso falló en la práctica sin dar ninguna señal. Este botón
   * hace las tres cosas seguidas —comprobar, descargar y recargar— y dice en
   * voz alta lo que pasó en cada paso. Si no hay nada que traer, lo dice; si
   * el sistema de actualizaciones ni siquiera está activo, también.
   */
  const buscar = async () => {
    if (buscando) return;
    if (!Updates.isEnabled) {
      Alert.alert(
        'Actualizaciones desactivadas',
        'Esta copia no tiene el sistema de actualizaciones activo (pasa en Expo Go y en desarrollo). Solo cambia con un build nuevo.',
      );
      return;
    }
    setBuscando(true);
    try {
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) {
        Alert.alert(
          'Ya estás al día',
          `No hay ninguna actualización nueva para la versión ${version} en el canal ${canal}.`,
        );
        return;
      }
      await Updates.fetchUpdateAsync();
      Alert.alert('Actualización lista', 'El sistema va a reiniciarse para aplicarla.', [
        { text: 'Reiniciar', onPress: () => Updates.reloadAsync() },
      ]);
    } catch (e) {
      Alert.alert('No se pudo actualizar', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      setBuscando(false);
    }
  };

  return (
    <View style={styles.caja}>
      <Text style={styles.linea}>
        VERSIÓN {version} ({String(build)}) · CANAL {canal}
      </Text>
      <Text style={styles.linea}>
        PAQUETE {paquete}
        {creado ? ` · ${creado}` : ''}
      </Text>
      <Pressable
        onPress={buscar}
        style={styles.boton}
        accessibilityRole="button"
        accessibilityLabel="Buscar actualización del sistema"
      >
        {buscando ? (
          <ActivityIndicator size="small" color={colors.accentText} />
        ) : (
          <Text style={styles.botonTexto}>BUSCAR ACTUALIZACIÓN</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { marginTop: 18, alignItems: 'center', gap: 2 },
  boton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.accentFaint,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 190,
    alignItems: 'center',
  },
  botonTexto: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.accentText,
  },
  linea: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: colors.textFaint,
  },
});
