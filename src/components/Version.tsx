import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { SIN_DATO } from '@/components/ui/sinDato';
import { colors, fonts } from '@/lib/theme';
import { mensajeSistema } from '@/lib/validation';

/**
 * Qué código estás corriendo exactamente.
 *
 * Existe por una tarde entera perdida: la app estaba instalada, la
 * actualización publicada, la configuración correcta en los dos lados… y no
 * había forma de saber si el móvil tenía el código nuevo o el viejo. Sin este
 * dato, "no se ha actualizado" y "sí se actualizó pero no se nota" son
 * indistinguibles, y se depura a ciegas.
 *
 * - Versión es la del binario: solo cambia con un build nuevo de TestFlight.
 * - Paquete es la actualización OTA que está corriendo encima. `embedded`
 *   significa que va con el que venía dentro del binario, o sea que NO ha
 *   llegado ninguna actualización.
 *
 * Solo vive en Perfil (ajustes): en el acceso era ruido de diagnóstico a la
 * vista de quien aún no tiene cuenta (revisión de Apple). A la vista, solo
 * «Versión 1.0.8 (23)»; canal, paquete y «Buscar actualización» salen al
 * mantener pulsado. El botón no se deja suelto: la app ya busca la
 * actualización sola al arrancar y la aplica en el siguiente; para el
 * usuario es una herramienta de depuración, no una función.
 */
export function Version() {
  const [buscando, setBuscando] = useState(false);
  const [detalle, setDetalle] = useState(false);
  const version = Constants.expoConfig?.version ?? SIN_DATO;
  const build = numeroDeBuild();

  // En Expo Go y en desarrollo estas propiedades no existen: se degrada a un
  // texto honesto en vez de reventar la pantalla de Perfil.
  const canal = Updates.channel || 'sin canal';
  const paquete = Updates.isEmbeddedLaunch
    ? 'embedded (sin OTA)'
    : (Updates.updateId ?? SIN_DATO).slice(0, 8);
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
      avisar(
        'Actualizaciones desactivadas',
        'Esta copia no tiene el sistema de actualizaciones activo (pasa en Expo Go y en desarrollo). Solo cambia con un build nuevo.',
      );
      return;
    }
    setBuscando(true);
    try {
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) {
        avisar(
          'Ya estás al día',
          `No hay ninguna actualización nueva para la versión ${version} en el canal ${canal}.`,
        );
        return;
      }
      await Updates.fetchUpdateAsync();
      setBuscando(false);
      const ahora = await confirmar({
        titulo: 'Actualización lista',
        mensaje: 'El sistema va a reiniciarse para aplicarla. Si lo dejas para más tarde, se aplica en el próximo arranque.',
        confirmar: 'Reiniciar',
        cancelar: 'Más tarde',
      });
      if (ahora) await Updates.reloadAsync();
    } catch (e) {
      avisar('No se pudo actualizar', mensajeSistema(e));
    } finally {
      setBuscando(false);
    }
  };

  const titulo = `Versión ${version}${build ? ` (${build})` : ''}`;
  const alternar = () => setDetalle((d) => !d);

  return (
    <View style={styles.caja}>
      <Pressable
        onLongPress={alternar}
        delayLongPress={600}
        style={styles.version}
        accessibilityRole="text"
        accessibilityLabel={titulo}
        accessibilityHint={detalle ? 'Mantén pulsado para ocultar los detalles' : 'Mantén pulsado para ver los detalles'}
        accessibilityActions={[{ name: 'longpress', label: detalle ? 'Ocultar detalles' : 'Ver detalles' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'longpress') alternar();
        }}
      >
        <Text style={styles.linea} maxFontSizeMultiplier={1.35}>
          {titulo}
        </Text>
      </Pressable>
      {detalle ? (
        <>
          <Text style={styles.linea} maxFontSizeMultiplier={1.35}>
            Canal {canal}
          </Text>
          <Text style={styles.linea} maxFontSizeMultiplier={1.35}>
            Paquete {paquete}
            {creado ? ` · ${creado}` : ''}
          </Text>
          <Pressable
            onPress={buscar}
            style={styles.boton}
            accessibilityRole="button"
            accessibilityLabel="Buscar actualización del sistema"
            accessibilityState={{ busy: buscando }}
          >
            {buscando ? (
              <ActivityIndicator size="small" color={colors.accentText} />
            ) : (
              <Text style={styles.botonTexto} maxFontSizeMultiplier={1.35}>
                BUSCAR ACTUALIZACIÓN
              </Text>
            )}
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

/**
 * El número de build del binario (CFBundleVersion en iOS), o null si no se
 * sabe. `expo-application` no es dependencia directa del proyecto: se lee de
 * `Constants.platform`, que viene del binario (no del manifiesto, que una OTA
 * puede cambiar), y si no, de app.json. Sin número, la línea va sin
 * paréntesis en vez de «(-)».
 */
function numeroDeBuild(): string | null {
  const nativo = Constants.platform?.ios?.buildNumber;
  if (nativo) return nativo;
  const config = Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode;
  return config != null && String(config) !== '' ? String(config) : null;
}

const styles = StyleSheet.create({
  caja: { marginTop: 18, alignItems: 'center', gap: 2 },
  version: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
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
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.textFaint,
  },
});
