// NIVL · nivl://auth/confirmar — el enlace del correo de alta.
//
// Ruta PÚBLICA (fuera de la puerta de sesión de _layout): llega sin sesión y
// es justo esto lo que la abre. Si el enlace resulta ser de recuperación, se
// pasa a restablecer; si todo va bien, a '/', que decide onboarding o Hoy.

import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SystemButton } from '@/components/SystemButton';
import { useEnlaceCorreo } from '@/components/useEnlaceCorreo';
import { colors, fonts } from '@/lib/theme';

export default function Confirmar() {
  const estado = useEnlaceCorreo();

  useEffect(() => {
    if (estado.fase !== 'listo') return;
    router.replace(estado.destino === 'recuperacion' ? '/auth/restablecer' : '/');
  }, [estado]);

  const error = estado.fase === 'error' ? estado.mensaje : estado.fase === 'sin_enlace' ? 'Este enlace no trae nada que confirmar. Abre el último correo que te enviamos o entra con tu contraseña.' : null;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>CONFIRMAR CUENTA</Text>
        {error ? (
          <>
            <Text style={styles.title}>No se ha podido confirmar</Text>
            <Text style={styles.text} accessibilityRole="alert">
              {error}
            </Text>
            <SystemButton title="Ir a entrar" onPress={() => router.replace('/login')} style={styles.cta} />
          </>
        ) : (
          <>
            <Text style={styles.title}>Confirmando tu correo</Text>
            <ActivityIndicator color={colors.accent} style={styles.spinner} accessibilityLabel="Confirmando" />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, justifyContent: 'center', padding: 28 },
  eyebrow: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, color: colors.textFaint },
  title: { fontFamily: fonts.heading, fontSize: 26, letterSpacing: -0.4, color: colors.text, marginTop: 8 },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textDim, marginTop: 12 },
  spinner: { marginTop: 24, alignSelf: 'flex-start' },
  cta: { marginTop: 24 },
});
