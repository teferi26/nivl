// NIVL · nivl://auth/restablecer — el enlace del correo de «olvidé mi
// contraseña».
//
// Ruta PÚBLICA: el enlace abre una sesión de recuperación (authFlow) y aquí se
// elige la contraseña nueva. Si ya había sesión abierta por el enlace (se llegó
// desde /auth/confirmar con un enlace de recuperación), el formulario sale sin
// volver a canjear nada.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SystemButton } from '@/components/SystemButton';
import { useEnlaceCorreo } from '@/components/useEnlaceCorreo';
import { useAuth } from '@/lib/auth';
import { cambiarContrasena } from '@/lib/authFlow';
import { colors, fonts } from '@/lib/theme';
import { checkPassword, mensajeSistema, PASSWORD_MIN_LENGTH } from '@/lib/validation';

export default function Restablecer() {
  const estado = useEnlaceCorreo();
  const { session } = useAuth();
  const [nueva, setNueva] = useState('');
  const [repite, setRepite] = useState('');
  const [ver, setVer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);

  const pw = checkPassword(nueva, session?.user.email ?? undefined);
  const coinciden = nueva === repite;
  const puede = pw.ok && coinciden && !busy;

  // Con el enlace canjeado, o con la sesión de recuperación ya abierta.
  const listo = estado.fase === 'listo' || (estado.fase === 'sin_enlace' && !!session);
  const fallo =
    estado.fase === 'error'
      ? estado.mensaje
      : estado.fase === 'sin_enlace' && !session
        ? 'Este enlace no es válido o ha caducado. Pide uno nuevo desde «¿Olvidaste tu contraseña?».'
        : null;

  const guardar = async () => {
    if (!puede) return;
    setBusy(true);
    setError(null);
    try {
      await cambiarContrasena(nueva);
      setHecho(true);
    } catch (e) {
      setError(mensajeSistema(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>RESTABLECER CONTRASEÑA</Text>

        {hecho ? (
          <>
            <Text style={styles.title}>Contraseña cambiada</Text>
            <Text style={styles.text}>Ya puedes usarla para entrar en NIVL.</Text>
            <SystemButton title="Continuar" onPress={() => router.replace('/')} style={styles.cta} />
          </>
        ) : fallo ? (
          <>
            <Text style={styles.title}>Enlace no válido</Text>
            <Text style={styles.text} accessibilityRole="alert">
              {fallo}
            </Text>
            <SystemButton title="Ir a entrar" onPress={() => router.replace('/login')} style={styles.cta} />
          </>
        ) : !listo ? (
          <>
            <Text style={styles.title}>Comprobando el enlace</Text>
            <ActivityIndicator color={colors.accent} style={styles.spinner} accessibilityLabel="Comprobando" />
          </>
        ) : (
          <>
            <Text style={styles.title}>Elige una contraseña nueva</Text>
            <Text style={styles.text}>
              Sin reglas raras: {PASSWORD_MIN_LENGTH} caracteres o más. Una frase que recuerdes es perfecta.
            </Text>

            <Text style={styles.label}>Contraseña nueva</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={nueva}
                onChangeText={setNueva}
                secureTextEntry={!ver}
                autoCapitalize="none"
                autoComplete="new-password"
                placeholder="Una frase que recuerdes"
                placeholderTextColor={colors.textFaint}
                accessibilityLabel="Contraseña nueva"
              />
              <Pressable
                onPress={() => setVer((v) => !v)}
                style={styles.eye}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <Ionicons name={ver ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textDim} />
              </Pressable>
            </View>
            {nueva.length > 0 && pw.missing.length > 0 ? (
              <Text style={styles.hint}>Le falta: {pw.missing.join(', ')}.</Text>
            ) : null}

            <Text style={styles.label}>Repite la contraseña</Text>
            <TextInput
              style={styles.input}
              value={repite}
              onChangeText={setRepite}
              secureTextEntry={!ver}
              autoCapitalize="none"
              autoComplete="new-password"
              placeholder="••••••••••"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Repite la contraseña"
              onSubmitEditing={guardar}
            />
            {repite.length > 0 && !coinciden ? <Text style={styles.fieldError}>Las contraseñas no coinciden.</Text> : null}

            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <SystemButton title="Guardar contraseña" onPress={guardar} loading={busy} disabled={!puede} style={styles.cta} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  eyebrow: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, color: colors.textFaint },
  title: { fontFamily: fonts.heading, fontSize: 26, letterSpacing: -0.4, color: colors.text, marginTop: 8 },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textDim, marginTop: 12 },
  spinner: { marginTop: 24, alignSelf: 'flex-start' },
  cta: { marginTop: 24 },
  label: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.textDim,
    textTransform: 'uppercase',
    marginBottom: 7,
    marginTop: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.panel,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 48 },
  eye: { position: 'absolute', right: 12, padding: 4 },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 6, lineHeight: 17 },
  fieldError: { fontFamily: fonts.body, fontSize: 12, color: colors.red, marginTop: 5 },
  error: { fontFamily: fonts.semibold, fontSize: 13, color: colors.red, marginTop: 16, lineHeight: 18 },
});
