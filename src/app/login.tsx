import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SystemButton } from '@/components/SystemButton';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.replace('/');
  };

  const signUp = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.session) {
      router.replace('/');
    } else {
      setNotice('Cuenta creada. Confirma tu correo (o desactiva "Confirm email" en Supabase) y entra.');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>NIVL</Text>
          <Text style={styles.tagline}>EL SISTEMA TE ESTÁ ESPERANDO</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Correo</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="cazador@nivl.app"
              placeholderTextColor={colors.textFaint}
            />
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.textFaint}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <SystemButton
              title="Entrar"
              onPress={signIn}
              loading={busy}
              disabled={!email.trim() || !password}
              style={{ marginTop: 22 }}
            />
            <SystemButton
              title="Crear cuenta"
              variant="outline"
              onPress={signUp}
              disabled={busy || !email.trim() || password.length < 6}
              style={{ marginTop: 10 }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 28,
  },
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
    marginBottom: 40,
  },
  form: {
    width: '100%',
  },
  label: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.textDim,
    textTransform: 'uppercase',
    marginBottom: 7,
    marginTop: 14,
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
  error: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.red,
    marginTop: 14,
  },
  notice: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.cyanText,
    marginTop: 14,
  },
});
