import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SystemButton } from '@/components/SystemButton';
import { entrar, pedirRecuperacion, registrar } from '@/lib/authFlow';
import { LEGAL_URLS } from '@/lib/proplans';
import { colors, fonts } from '@/lib/theme';
import {
  checkPassword,
  isValidEmail,
  isValidName,
  mensajeSistema,
  NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@/lib/validation';

// La cuenta es de NIVL (Supabase Auth propio). Los mensajes de error y la
// lógica viven en authFlow.ts (Chat 3): esta pantalla solo pinta.
type Mode = 'signin' | 'signup' | 'recover';

// Texto acordado con el Chat 3 (seguridad y datos).
const CASILLA_LEGAL = 'He leído y acepto los Términos de NIVL y he leído su Política de privacidad.';

// Anti-enumeración: valen igual exista o no la cuenta (contrato de authFlow).
const AVISO_REGISTRO =
  'Si el correo es nuevo, te hemos enviado un enlace para confirmarlo. Ábrelo en este móvil y después entra con tu contraseña.';
const AVISO_RECUPERACION =
  'Si ese correo tiene cuenta, te hemos enviado un enlace. Ábrelo en este móvil para elegir una contraseña nueva.';

const STRENGTH_META = {
  debil: { label: 'Débil', color: colors.red, bars: 1 },
  media: { label: 'Media', color: colors.accentText, bars: 3 },
  fuerte: { label: 'Fuerte', color: colors.accent, bars: 4 },
} as const;

const INTRO: Record<Mode, string> = {
  signin: 'Entra con tu correo y tu contraseña de NIVL.',
  signup: 'Crea tu cuenta de NIVL. Te enviaremos un enlace para confirmar el correo.',
  recover: 'Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.',
};

export default function Login() {
  const [mode, setMode] = useState<Mode>('signin');
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
  const pw = checkPassword(password, email);
  const confirmMatch = password === confirm;

  const canSubmit =
    mode === 'signin'
      ? emailValid && password.length > 0
      : mode === 'recover'
        ? emailValid
        : nameValid && emailValid && pw.ok && confirmMatch && accepted;

  const reset = () => {
    setError(null);
    setNotice(null);
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
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
        await entrar(email, password);
        // La puerta de sesión de _layout redirige al detectar la sesión.
      } else if (mode === 'recover') {
        await pedirRecuperacion(email);
        setNotice(AVISO_RECUPERACION);
      } else {
        const r = await registrar(email, password, name);
        if (r === 'confirmar_email') {
          // Se vuelve a Entrar con el correo puesto: lo siguiente es confirmar y entrar.
          setMode('signin');
          setPassword('');
          setConfirm('');
          setNotice(AVISO_REGISTRO);
        }
      }
    } catch (e) {
      setError(mensajeSistema(e));
    } finally {
      setBusy(false);
    }
  };

  const showNameError = mode === 'signup' && touched.name && name.length > 0 && !nameValid;
  const showEmailError = touched.email && email.length > 0 && !emailValid;
  const showConfirmError = mode === 'signup' && touched.confirm && confirm.length > 0 && !confirmMatch;
  const strength = STRENGTH_META[pw.strength];

  return (
    <SafeAreaView style={styles.screen}>
      {/* Un solo mecanismo para el teclado: el inset automático del ScrollView,
          que además lleva el campo enfocado a la vista. Junto a un
          KeyboardAvoidingView con padding, iOS sumaba el teclado dos veces. */}
      <View style={{ flex: 1 }}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <Text style={styles.brand}>NIVL</Text>
            <Text style={styles.tagline}>UN 1 % MEJOR CADA DÍA</Text>
          </View>

          {mode !== 'recover' ? (
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
          ) : (
            <Text style={styles.recoverTitle} accessibilityRole="header">
              RECUPERAR CONTRASEÑA
            </Text>
          )}

          <Text style={styles.intro}>{INTRO[mode]}</Text>

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
              onSubmitEditing={mode === 'recover' ? submit : undefined}
            />
            {showEmailError ? <Text style={styles.fieldError}>Formato de correo no válido.</Text> : null}

            {mode !== 'recover' ? (
              <>
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
                    placeholder={mode === 'signup' ? 'Una frase que recuerdes' : '••••••••••'}
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
              </>
            ) : null}

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
              <Text style={styles.hint}>
                Sin reglas raras: {PASSWORD_MIN_LENGTH} caracteres o más. Una frase que recuerdes es perfecta.
              </Text>
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
                  placeholder="••••••••••"
                  placeholderTextColor={colors.textFaint}
                  accessibilityLabel="Repite la contraseña"
                />
                {showConfirmError ? <Text style={styles.fieldError}>Las contraseñas no coinciden.</Text> : null}

                <Pressable
                  onPress={() => setAccepted((a) => !a)}
                  style={styles.checkRow}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: accepted }}
                  accessibilityLabel={CASILLA_LEGAL}
                >
                  <View style={[styles.checkbox, accepted && styles.checkboxOn]}>
                    {accepted ? <Ionicons name="checkmark" size={14} color={colors.bg} /> : null}
                  </View>
                  <Text style={styles.checkText}>{CASILLA_LEGAL}</Text>
                </Pressable>
                {/* Los enlaces van fuera de la casilla: dentro, VoiceOver y
                    TalkBack leían la casilla entera y no llegaban a ellos. */}
                <View style={styles.legalesRegistro}>
                  {(
                    [
                      ['Términos de NIVL', LEGAL_URLS.terminos],
                      ['Privacidad de NIVL', LEGAL_URLS.privacidad],
                    ] as const
                  ).map(([texto, url]) => (
                    <Pressable
                      key={url}
                      onPress={() => Linking.openURL(url).catch(() => {})}
                      hitSlop={12}
                      accessibilityRole="link"
                      accessibilityLabel={texto}
                    >
                      <Text style={styles.legalLink}>{texto}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {error ? (
              <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                {error}
              </Text>
            ) : null}
            {notice ? (
              <Text style={styles.notice} accessibilityRole="alert" accessibilityLiveRegion="polite">
                {notice}
              </Text>
            ) : null}

            <SystemButton
              title={mode === 'signin' ? 'Entrar' : mode === 'recover' ? 'Enviar enlace' : 'Crear cuenta'}
              onPress={submit}
              loading={busy}
              disabled={!canSubmit}
              style={{ marginTop: 22 }}
            />

            {mode === 'signin' ? (
              <Pressable
                onPress={() => switchMode('recover')}
                disabled={busy}
                style={styles.forgot}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Recuperar contraseña olvidada"
              >
                <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
              </Pressable>
            ) : mode === 'recover' ? (
              <Pressable
                onPress={() => switchMode('signin')}
                disabled={busy}
                style={styles.forgot}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Volver a entrar"
              >
                <Text style={styles.forgotText}>Volver a entrar</Text>
              </Pressable>
            ) : (
              <Text style={styles.legal}>Tus hábitos, misiones y progreso se guardan en tu cuenta de NIVL.</Text>
            )}

            {/* Los textos legales, a la vista antes de entrar. Al crear cuenta
                ya van junto a la casilla. */}
            {mode !== 'signup' ? (
              <View style={styles.legales}>
                <Pressable
                  onPress={() => Linking.openURL(LEGAL_URLS.terminos).catch(() => {})}
                  hitSlop={12}
                  accessibilityRole="link"
                  accessibilityLabel="Términos de uso de NIVL"
                >
                  <Text style={styles.legalLink}>Términos de NIVL</Text>
                </Pressable>
                <Text style={styles.legalSep}>·</Text>
                <Pressable
                  onPress={() => Linking.openURL(LEGAL_URLS.privacidad).catch(() => {})}
                  hitSlop={12}
                  accessibilityRole="link"
                  accessibilityLabel="Política de privacidad de NIVL"
                >
                  <Text style={styles.legalLink}>Privacidad de NIVL</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
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
  recoverTitle: {
    fontFamily: fonts.heading,
    fontSize: 13,
    letterSpacing: 2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 14,
  },
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
  error: { fontFamily: fonts.semibold, fontSize: 13, color: colors.red, marginTop: 16, lineHeight: 18 },
  notice: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accentText, marginTop: 16, lineHeight: 18 },
  forgot: { marginTop: 18, alignItems: 'center' },
  forgotText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accentText },
  legalesRegistro: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 8, marginTop: 10, paddingLeft: 32 },
  legales: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 22 },
  legalLink: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, textDecorationLine: 'underline' },
  legalSep: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  legal: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 18,
    textAlign: 'center',
    lineHeight: 15,
  },
});
