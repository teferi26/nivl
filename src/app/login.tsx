import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
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
import {
  FRANKY_PRIVACY_URL,
  FRANKY_RECOVER_URL,
  FRANKY_TERMS_URL,
  frankyLogin,
  frankyRegister,
} from '@/lib/frankyAuth';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { checkPassword, isValidEmail, isValidName, NAME_MAX_LENGTH } from '@/lib/validation';

type Mode = 'signin' | 'signup';

const STRENGTH_META = {
  debil: { label: 'Débil', color: colors.red, bars: 1 },
  media: { label: 'Media', color: colors.accentText, bars: 3 },
  fuerte: { label: 'Fuerte', color: colors.accent, bars: 4 },
} as const;

export default function Login() {
  const [mode, setMode] = useState<Mode>('signin');
  // Cuenta antigua de NIVL (anterior a la puerta de Franky): entra directo
  // contra Auth de NIVL. Es una vía de escape, no la puerta principal.
  const [legacy, setLegacy] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ name: false, email: false, password: false, confirm: false });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailValid = isValidEmail(email);
  const nameValid = isValidName(name);
  const pw = checkPassword(password);
  const confirmMatch = password === confirm;

  const canSubmit =
    mode === 'signin'
      ? emailValid && password.length > 0
      : nameValid && emailValid && pw.ok && confirmMatch && accepted;

  const reset = () => {
    setError(null);
    setNotice(null);
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setLegacy(false);
    reset();
    setConfirm('');
    setTouched({ name: false, email: false, password: false, confirm: false });
  };

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    reset();
    try {
      if (mode === 'signin') {
        if (legacy) {
          const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          if (err) throw err;
        } else {
          await frankyLogin(email, password);
        }
        // La puerta de sesión de _layout redirige al detectar la sesión.
      } else {
        await frankyRegister(name, email, password);
      }
    } catch (e) {
      setError(mapAuthError(e instanceof Error ? e.message : 'Fallo desconocido'));
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = () => {
    reset();
    if (legacy) {
      if (!emailValid) {
        setTouched((t) => ({ ...t, email: true }));
        setError('Escribe tu correo arriba para enviarte el enlace de recuperación.');
        return;
      }
      setBusy(true);
      supabase.auth
        .resetPasswordForEmail(email.trim())
        .then(({ error: err }) => {
          if (err) throw err;
          setNotice('Te hemos enviado un enlace para restablecer la contraseña. Revisa tu correo.');
        })
        .catch((e: unknown) => setError(mapAuthError(e instanceof Error ? e.message : 'Fallo desconocido')))
        .finally(() => setBusy(false));
      return;
    }
    // La contraseña es la de Franky: se cambia donde vive.
    Linking.openURL(FRANKY_RECOVER_URL).catch(() => {
      setError(`Abre ${FRANKY_RECOVER_URL} en tu navegador para cambiar la contraseña.`);
    });
  };

  const showNameError = mode === 'signup' && touched.name && name.length > 0 && !nameValid;
  const showEmailError = touched.email && email.length > 0 && !emailValid;
  const showConfirmError = mode === 'signup' && touched.confirm && confirm.length > 0 && !confirmMatch;
  const strength = STRENGTH_META[pw.strength];

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <Text style={styles.brand}>NIVL</Text>
            <View style={styles.byRow}>
              <View style={styles.byDot} />
              <Text style={styles.by}>by Franky</Text>
            </View>
            <Text style={styles.tagline}>UN 1 % MEJOR CADA DÍA</Text>
          </View>

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

          <Text style={styles.intro}>
            {mode === 'signin'
              ? legacy
                ? 'Cuenta antigua de NIVL: entra con la contraseña que tenías aquí.'
                : 'Tu cuenta de Franky vale aquí. Mismo correo, misma contraseña.'
              : 'Una sola cuenta para Franky y NIVL. La creas aquí y te sirve en las dos.'}
          </Text>

          <View style={styles.form}>
            {mode === 'signup' ? (
              <>
                <Text style={styles.label}>Nombre</Text>
                <TextInput
                  style={[styles.input, showNameError && styles.inputError]}
                  value={name}
                  onChangeText={setName}
                  onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                  autoCapitalize="words"
                  autoComplete="name"
                  maxLength={NAME_MAX_LENGTH}
                  placeholder="Cómo quieres que te llame el sistema"
                  placeholderTextColor={colors.textFaint}
                  accessibilityLabel="Nombre"
                />
                {showNameError ? (
                  <Text style={styles.fieldError}>Entre 1 y {NAME_MAX_LENGTH} caracteres.</Text>
                ) : null}
              </>
            ) : null}

            <Text style={styles.label}>Correo</Text>
            <TextInput
              style={[styles.input, showEmailError && styles.inputError]}
              value={email}
              onChangeText={setEmail}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="tu@correo.com"
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
                placeholder={mode === 'signup' ? 'Una frase que recuerdes' : '••••••••••••'}
                placeholderTextColor={colors.textFaint}
                accessibilityLabel="Contraseña"
                onSubmitEditing={mode === 'signin' ? submit : undefined}
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
            {mode === 'signup' && password.length === 0 ? (
              <Text style={styles.hint}>Sin reglas raras: 12 caracteres o más. Una frase que recuerdes es perfecta.</Text>
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
                  autoComplete="new-password"
                  placeholder="••••••••••••"
                  placeholderTextColor={colors.textFaint}
                  accessibilityLabel="Repite la contraseña"
                />
                {showConfirmError ? <Text style={styles.fieldError}>Las contraseñas no coinciden.</Text> : null}

                <Pressable
                  onPress={() => setAccepted((a) => !a)}
                  style={styles.checkRow}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: accepted }}
                  accessibilityLabel="Acepto los términos y la política de privacidad de Franky"
                >
                  <View style={[styles.checkbox, accepted && styles.checkboxOn]}>
                    {accepted ? <Ionicons name="checkmark" size={14} color={colors.bg} /> : null}
                  </View>
                  <Text style={styles.checkText}>
                    Acepto los{' '}
                    <Text style={styles.link} onPress={() => Linking.openURL(FRANKY_TERMS_URL)}>
                      términos
                    </Text>{' '}
                    y la{' '}
                    <Text style={styles.link} onPress={() => Linking.openURL(FRANKY_PRIVACY_URL)}>
                      política de privacidad
                    </Text>{' '}
                    de Franky.
                  </Text>
                </Pressable>
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <SystemButton
              title={mode === 'signin' ? (legacy ? 'Entrar con cuenta NIVL' : 'Entrar con Franky') : 'Crear cuenta Franky'}
              onPress={submit}
              loading={busy}
              disabled={!canSubmit}
              style={{ marginTop: 22 }}
            />

            {mode === 'signin' ? (
              <>
                <Pressable
                  onPress={forgotPassword}
                  disabled={busy}
                  style={styles.forgot}
                  accessibilityRole="button"
                  accessibilityLabel="Recuperar contraseña olvidada"
                >
                  <Text style={styles.forgotText}>
                    {legacy ? '¿Olvidaste tu contraseña?' : '¿Olvidaste tu contraseña? Recupérala en franky.es'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setLegacy((l) => !l);
                    reset();
                  }}
                  disabled={busy}
                  style={styles.legacy}
                  accessibilityRole="button"
                >
                  <Text style={styles.legacyText}>
                    {legacy ? 'Volver a entrar con Franky' : '¿Cuenta antigua de NIVL? Entrar con ella'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.legal}>
                Tus hábitos, misiones y progreso se guardan en NIVL. Tu identidad es la de Franky.
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
  hero: { alignItems: 'center', marginBottom: 28 },
  brand: {
    fontFamily: fonts.brand,
    fontSize: 48,
    letterSpacing: 14,
    color: colors.accent,
    textAlign: 'center',
  },
  byRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  byDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.franky },
  by: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textDim, letterSpacing: 1 },
  tagline: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 4,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 14,
  },
  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.accentDim,
    marginBottom: 14,
  },
  toggleBtn: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  toggleBtnOn: { backgroundColor: colors.accent },
  toggleText: { fontFamily: fonts.heading, fontSize: 13, letterSpacing: 2, color: colors.textDim },
  toggleTextOn: { color: colors.bg },
  intro: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, lineHeight: 19, textAlign: 'center' },
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
    borderColor: colors.accentDim,
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
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 6, lineHeight: 17 },
  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
  strengthBar: { flex: 1, height: 4 },
  strengthLabel: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 18 },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textDim, lineHeight: 19 },
  link: { color: colors.accentText, textDecorationLine: 'underline' },
  error: { fontFamily: fonts.semibold, fontSize: 13, color: colors.red, marginTop: 16, lineHeight: 18 },
  notice: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accentText, marginTop: 16, lineHeight: 18 },
  forgot: { marginTop: 18, alignItems: 'center' },
  forgotText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accentText },
  legacy: { marginTop: 14, alignItems: 'center' },
  legacyText: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  legal: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 18,
    textAlign: 'center',
    lineHeight: 15,
  },
});
