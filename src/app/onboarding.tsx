import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert,
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
import { SystemWindow } from '@/components/SystemWindow';
import { useAuth } from '@/lib/auth';
import { updateProfile } from '@/lib/data';
import { colors, fonts } from '@/lib/theme';
import { openCheckout, paymentsConfigured } from '@/lib/subscription';

const STEPS = 4;

export default function Onboarding() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const finish = async (after?: () => Promise<void>) => {
    if (!userId || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      if (after) await after();
      await updateProfile(userId, { onboarding_done: true });
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const saveName = async () => {
    if (!userId || !name.trim() || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await updateProfile(userId, { name: name.trim() });
      setStep(2);
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const subscribe = async () => {
    if (!userId) return;
    try {
      await openCheckout(userId);
      // El webhook activará la cuenta; el usuario sigue dentro mientras tanto.
      await finish();
    } catch (e) {
      Alert.alert('Pagos no disponibles', e instanceof Error ? e.message : 'Inténtalo más tarde');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.dots}>
            {Array.from({ length: STEPS }, (_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
            ))}
          </View>

          {step === 0 ? (
            <View>
              <Text style={styles.brand}>NIVL</Text>
              <Text style={styles.tagline}>HAS SIDO ELEGIDO COMO JUGADOR</Text>
              <SystemWindow color={colors.cyanDim}>
                <Text style={styles.lore}>
                  Este sistema convierte tu vida real en el juego: misiones diarias con XP,
                  niveles y rangos de cazador (E→S), mazmorras para tus proyectos, y un contrato
                  con tus propias normas.{'\n\n'}
                  Nada de trampas: las evidencias se hacen con la cámara, en el momento. El
                  sistema no juzga. Registra.
                </Text>
              </SystemWindow>
              <SystemButton title="Aceptar el despertar" onPress={() => setStep(1)} />
            </View>
          ) : null}

          {step === 1 ? (
            <View>
              <Text style={styles.stepTitle}>IDENTIFÍCATE, CAZADOR</Text>
              <SystemWindow color={colors.cyanDim}>
                <Text style={styles.label}>Tu nombre en el sistema</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Teferi"
                  placeholderTextColor={colors.textFaint}
                  maxLength={24}
                  accessibilityLabel="Nombre del cazador"
                />
              </SystemWindow>
              <SystemButton title="Continuar" onPress={saveName} loading={busy} disabled={!name.trim()} />
            </View>
          ) : null}

          {step === 2 ? (
            <View>
              <Text style={styles.stepTitle}>EL CONTRATO</Text>
              <SystemWindow color={colors.cyanDim}>
                <Text style={styles.lore}>
                  En NIVL las normas las pones tú — y también sus consecuencias.{'\n\n'}
                  · Cada norma rota se confiesa al sistema: −25 XP y el castigo que TÚ firmaste
                  (correr 5 km, un día comiendo limpio…). Cúmplelo el mismo día y recuperas el XP.
                  {'\n'}· Las misiones extra pagan Puntos Bonus: 10 PB = 1 hora de descanso sin
                  culpa, máximo 30 a la semana.{'\n'}· Podrás sellar una carta a tu yo del futuro.
                </Text>
              </SystemWindow>
              <SystemButton title="Firmo el contrato" onPress={() => setStep(3)} />
              <Text style={styles.smallPrint}>
                Podrás escribir tus normas en Sistema → Contrato cuando entres.
              </Text>
            </View>
          ) : null}

          {step === 3 ? (
            <View>
              <Text style={styles.stepTitle}>EL ORÁCULO · PREMIUM</Text>
              <SystemWindow color={colors.purpleDim} fill={colors.panelDeep}>
                <Text style={styles.lore}>
                  La IA del sistema genera tus misiones desde un objetivo ("correr una 10K en
                  mayo") y cada semana analiza tus datos y se ajusta sola a ti.{'\n\n'}
                  Estas funciones consumen API de verdad, así que van aparte:{'\n'}· Suscripción
                  mensual: Oráculo incluido, sin configurar nada.{'\n'}· O usa tu propia API key
                  (OpenAI o Anthropic) y paga solo tu consumo.{'\n\n'}
                  Todo lo demás — misiones, XP, mazmorras, gym, dieta, diario, contrato — es
                  tuyo gratis para siempre.
                </Text>
              </SystemWindow>
              {paymentsConfigured() ? (
                <SystemButton title="Suscribirme y desbloquear el Oráculo" onPress={subscribe} loading={busy} />
              ) : null}
              <SystemButton
                title="Usaré mi propia API key"
                variant="outline"
                onPress={() => finish()}
                loading={busy}
                style={{ marginTop: 10 }}
              />
              <Pressable onPress={() => finish()} disabled={busy} style={styles.skip} accessibilityRole="button">
                <Text style={styles.skipText}>Empezar sin IA por ahora</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 24 },
  dot: { width: 22, height: 4, backgroundColor: colors.track },
  dotOn: { backgroundColor: colors.cyan },
  brand: {
    fontFamily: fonts.brand,
    fontSize: 42,
    letterSpacing: 12,
    color: colors.cyan,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.heading,
    fontSize: 13,
    letterSpacing: 3,
    color: colors.cyanText,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  stepTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    letterSpacing: 3,
    color: colors.cyan,
    textAlign: 'center',
    marginBottom: 18,
  },
  lore: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text, lineHeight: 22 },
  label: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.textDim,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cyanDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  smallPrint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 12,
  },
  skip: { marginTop: 16, alignItems: 'center' },
  skipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textFaint },
});
