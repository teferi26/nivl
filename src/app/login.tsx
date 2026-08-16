import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SystemButton } from '@/components/SystemButton';
import { mapAuthError } from '@/lib/authErrors';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { checkPassword, isValidEmail } from '@/lib/validation';

type Mode = 'signin' | 'signup';

const STRENGTH_META = {
  debil: { label: 'Débil', color: colors.red, bars: 1 },
  media: { label: 'Media', color: colors.amber, bars: 3 },
  fuerte: { label: 'Fuerte', color: colors.cyan, bars: 4 },
} as const;

export default function Login() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false, confirm: false });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailValid = isValidEmail(email);
  const pw = checkPassword(password);
  const confirmMatch = password === confirm;

  const canSubmit =
    mode === 'signin'
      ? emailValid && password.length > 0
      : emailValid && pw.ok && confirmMatch;

  const reset = () => {
    setError(null);
    setNotice(null);
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    reset();
    setConfirm('');
    setTouched({ email: false, password: false, confirm: false });
  };

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    reset();
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        // La puerta de sesión de _layout redirige al detectar la sesión.
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        if (!data.session) {
          setNotice(
            'Cuenta creada. Confirma tu correo (o desactiva "Confirm email" en Supabase) y entra.',
          );
        }
      }
    } catch (e) {
      setError(mapAuthError(e instanceof Error ? e.message : 'Fallo desconocido'));
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    reset();
    if (!emailValid) {
      setTouched((t) => ({ ...t, email: true }));
      setError('Escribe tu correo arriba para enviarte el enlace de recuperación.');
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (err) throw err;
      setNotice('Te hemos enviado un enlace para restablecer la contraseña. Revisa tu correo.');
    } catch (e) {
      setError(mapAuthError(e instanceof Error ? e.message : 'Fallo desconocido'));
    } finally {
      setBusy(false);
    }
  };

  const showEmailError = touched.email && email.length > 0 && !emailValid;
  const showConfirmError = mode === 'signup' && touched.confirm && confirm.length > 0 && !confirmMatch;
  const strength = STRENGTH_META[pw.strength];

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>NIVL</Text>
          <Text style={styles.tagline}>
            {mode === 'signin' ? 'EL SISTEMA TE ESTÁ ESPERANDO' : 'HAS SIDO ELEGIDO COMO JUGADOR'}
          </Text>

          <View style={styles.toggle}>
            <Pressable
              onPress={() => switchMode('signin')}
              style={[styles.toggleBtn, mode === 'signin' && styles.toggleBtnOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'signin' }}
              accessibilityLabel="Entrar con cuenta existente"
            >
              <Text style={[styles.toggleText, mode === 'signin' && styles.toggleTextOn]}>ENTRAR</Text>
            </Pressable>
            <Pressable
              onPress={() => switchMode('signup')}
              style={[styles.toggleBtn, mode === 'signup' && styles.toggleBtnOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'signup' }}
              accessibilityLabel="Crear una cuenta nueva"
            >
              <Text style={[styles.toggleText, mode === 'signup' && styles.toggleTextOn]}>CREAR CUENTA</Text>
            </Pressable>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Correo</Text>
            <TextInput
              style={[styles.input, showEmailError && styles.inputError]}
              value={email}
              onChangeText={setEmail}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="cazador@nivl.app"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Correo electrónico"
            />
            {showEmailError ? <Text style={styles.fieldError}>Formato de correo no válido.</Text> : null}

            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                placeholderTextColor={colors.textFaint}
                accessibilityLabel="Contraseña"
              />
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                style={styles.eye}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textDim} />
              </Pressable>
            </View>

            {mode === 'signup' && password.length > 0 ? (
              <View style={styles.strengthWrap}>
                <View style={styles.strengthBars}>
                  {[0, 1, 2, 3].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.strengthBar,
                        { backgroundColor: i < strength.bars ? strength.color : colors.track },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
              </View>
            ) : null}
            {mode === 'signup' && password.length > 0 && pw.missing.length > 0 ? (
              <Text style={styles.hint}>Le falta: {pw.missing.join(', ')}.</Text>
            ) : null}

            {mode === 'signup' ? (
              <>
                <Text style={styles.label}>Repite la contraseña</Text>
                <TextInput
                  style={[styles.input, showConfirmError && styles.inputError]}
                  value={confirm}
                  onChangeText={setConfirm}
                  onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  placeholder="••••••••"
                  placeholderTextColor={colors.textFaint}
                  accessibilityLabel="Repite la contraseña"
                />
                {showConfirmError ? <Text style={styles.fieldError}>Las contraseñas no coinciden.</Text> : null}
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <SystemButton
              title={mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
              onPress={submit}
              loading={busy}
              disabled={!canSubmit}
              style={{ marginTop: 22 }}
            />

            {mode === 'signin' ? (
              <Pressable
                onPress={forgotPassword}
                disabled={busy}
                style={styles.forgot}
                accessibilityRole="button"
                accessibilityLabel="Recuperar contraseña olvidada"
              >
                <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
              </Pressable>
            ) : (
              <Text style={styles.legal}>
                Al crear una cuenta aceptas guardar tus datos en tu propio proyecto de Supabase.
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  brand: {
    fontFamily: fonts.brand,
    fontSize: 46,
    letterSpacing: 14,
    color: colors.cyan,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 4,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
  },
  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.cyanDim,
    marginBottom: 6,
  },
  toggleBtn: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  toggleBtnOn: { backgroundColor: colors.cyanFaint },
  toggleText: { fontFamily: fonts.heading, fontSize: 13, letterSpacing: 2, color: colors.textDim },
  toggleTextOn: { color: colors.cyan },
  form: { width: '100%' },
  label: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.textDim,
    textTransform: 'uppercase',
    marginBottom: 7,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cyanDim,
    backgroundColor: colors.panel,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputError: { borderColor: colors.redDim },
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 48 },
  eye: { position: 'absolute', right: 12, padding: 4 },
  fieldError: { fontFamily: fonts.body, fontSize: 12, color: colors.red, marginTop: 5 },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 6 },
  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
  strengthBar: { flex: 1, height: 4 },
  strengthLabel: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1 },
  error: { fontFamily: fonts.semibold, fontSize: 13, color: colors.red, marginTop: 16, lineHeight: 18 },
  notice: { fontFamily: fonts.semibold, fontSize: 13, color: colors.cyanText, marginTop: 16, lineHeight: 18 },
  forgot: { marginTop: 18, alignItems: 'center' },
  forgotText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.cyanText },
  legal: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 18,
    textAlign: 'center',
    lineHeight: 15,
  },
});
