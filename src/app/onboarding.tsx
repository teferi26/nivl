import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { createStarterQuests, ensureProfile, updateProfile } from '@/lib/data';
import { KINDS, PROFILE_KINDS, type ProfileKind } from '@/lib/kinds';
import { colors, fonts } from '@/lib/theme';
import { NAME_MAX_LENGTH } from '@/lib/validation';

// Bienvenida · Nombre · Para qué · Primeros hábitos · El contrato
const STEPS = 5;

// Nombres por defecto de la fila de perfil: si es uno de estos, no se
// prerrellena (que escriba el suyo).
const DEFAULT_NAMES = new Set(['Gladiador', 'Cazador']);

export default function Onboarding() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ProfileKind | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  // El nombre puede venir ya de Franky (trigger de alta, migración 0018).
  useEffect(() => {
    if (!userId) return;
    ensureProfile(userId)
      .then((p) => {
        if (p.name && !DEFAULT_NAMES.has(p.name)) setName((n) => n || p.name);
      })
      .catch(() => {});
  }, [userId]);

  const withLock = async (fn: () => Promise<void>) => {
    if (!userId || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const saveName = () =>
    withLock(async () => {
      if (!name.trim()) return;
      await updateProfile(userId!, { name: name.trim() });
      setStep(2);
    });

  const saveKind = () =>
    withLock(async () => {
      if (!kind) return;
      await updateProfile(userId!, { profile_kind: kind });
      // Por defecto todos los hábitos propuestos marcados: quitar es un toque.
      setChosen(new Set(KINDS[kind].starterQuests.map((_, i) => i)));
      setStep(3);
    });

  const saveStarters = () =>
    withLock(async () => {
      if (!kind) return;
      const quests = KINDS[kind].starterQuests.filter((_, i) => chosen.has(i));
      await createStarterQuests(userId!, quests);
      setStep(4);
    });

  const finish = () =>
    withLock(async () => {
      await updateProfile(userId!, { onboarding_done: true });
      router.replace('/(tabs)');
    });

  const toggleStarter = (i: number) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const meta = kind ? KINDS[kind] : null;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.dots}>
            {Array.from({ length: STEPS }, (_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
            ))}
          </View>

          {step === 0 ? (
            <View>
              <Text style={styles.brand}>NIVL</Text>
              <Text style={styles.tagline}>UN 1 % MEJOR CADA DÍA</Text>
              <SystemWindow>
                <Text style={styles.lore}>
                  Esto no es una lista de tareas. Es una arena.{'\n\n'}
                  Cada día tienes misiones. Cumplirlas da XP y sube tu nivel; fallarlas lo
                  resta. La racha multiplica. Los proyectos grandes son campañas con un jefe
                  final. Y hay un coach que dicta tu día, te juzga por la noche y recuerda
                  todo lo que aprende de ti.{'\n\n'}
                  Nada de trampas: las evidencias se hacen con la cámara, en el momento. El
                  sistema no opina. Registra.
                </Text>
              </SystemWindow>
              <SystemButton title="Entrar en la arena" onPress={() => setStep(1)} />
            </View>
          ) : null}

          {step === 1 ? (
            <View>
              <Text style={styles.stepTitle}>IDENTIFÍCATE</Text>
              <SystemWindow>
                <Text style={styles.label}>Tu nombre en el sistema</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Cómo quieres que te llame"
                  placeholderTextColor={colors.textFaint}
                  maxLength={NAME_MAX_LENGTH}
                  autoCapitalize="words"
                  accessibilityLabel="Tu nombre"
                />
              </SystemWindow>
              <SystemButton title="Continuar" onPress={saveName} loading={busy} disabled={!name.trim()} />
            </View>
          ) : null}

          {step === 2 ? (
            <View>
              <Text style={styles.stepTitle}>¿PARA QUÉ VAS A USAR NIVL?</Text>
              <Text style={styles.stepHint}>
                Cambia lo que ves primero y lo que el coach te pide. Todo sigue disponible y lo
                puedes cambiar en Perfil.
              </Text>
              {PROFILE_KINDS.map((k) => {
                const m = KINDS[k];
                const on = kind === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setKind(k)}
                    style={[styles.kindCard, on && styles.kindCardOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={m.label}
                  >
                    <Ionicons name={m.icon as never} size={22} color={on ? colors.bg : colors.accent} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.kindLabel, on && styles.kindLabelOn]}>{m.label.toUpperCase()}</Text>
                      <Text style={[styles.kindTagline, on && styles.kindTaglineOn]}>{m.tagline}</Text>
                    </View>
                  </Pressable>
                );
              })}
              {meta ? (
                <SystemWindow color={colors.line} style={{ marginTop: 6 }}>
                  <Text style={styles.detailTitle}>QUÉ SE ACTIVA</Text>
                  <Text style={styles.detail}>{meta.description}</Text>
                </SystemWindow>
              ) : null}
              <SystemButton title="Continuar" onPress={saveKind} loading={busy} disabled={!kind} />
            </View>
          ) : null}

          {step === 3 && meta ? (
            <View>
              <Text style={styles.stepTitle}>TUS PRIMERAS MISIONES</Text>
              <Text style={styles.stepHint}>
                Propuestas para un {meta.label.toLowerCase() === 'en general' ? 'gladiador' : meta.label.toLowerCase()}.
                Quita las que no vayan contigo; podrás crear las tuyas en Hábitos.
              </Text>
              <SystemWindow>
                {meta.starterQuests.map((q, i) => {
                  const on = chosen.has(i);
                  return (
                    <Pressable
                      key={q.title}
                      onPress={() => toggleStarter(i)}
                      style={[styles.starterRow, i > 0 && styles.starterRowSep]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={q.title}
                    >
                      <View style={[styles.checkbox, on && styles.checkboxOn]}>
                        {on ? <Ionicons name="checkmark" size={14} color={colors.bg} /> : null}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.starterTitle, !on && styles.starterOff]}>{q.title}</Text>
                        <Text style={styles.starterMeta}>
                          {q.stat} · {q.difficulty} · {q.days_of_week.length === 7 ? 'cada día' : `${q.days_of_week.length} días/semana`}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </SystemWindow>
              <SystemButton
                title={chosen.size > 0 ? `Crear ${chosen.size} misión${chosen.size === 1 ? '' : 'es'}` : 'Empezar sin misiones'}
                onPress={saveStarters}
                loading={busy}
              />
            </View>
          ) : null}

          {step === 4 ? (
            <View>
              <Text style={styles.stepTitle}>EL CONTRATO</Text>
              <SystemWindow>
                <Text style={styles.lore}>
                  Las normas las pones tú, y también sus consecuencias.{'\n\n'}
                  · Cada norma se marca cada día. La que quede sin marcar al cierre cuenta como
                  rota: −25 XP y el castigo que TÚ firmaste. Cúmplelo y recuperas el XP.
                  {'\n'}· Las misiones extra pagan Puntos Bonus: 10 PB = 1 hora de descanso sin
                  culpa, máximo 30 a la semana.{'\n'}· Podrás sellar una carta a tu yo del futuro.
                </Text>
              </SystemWindow>
              <SystemButton title="Firmo el contrato" onPress={finish} loading={busy} />
              <Text style={styles.smallPrint}>Escribe tus normas en Hoy → Contrato cuando entres.</Text>
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
  dot: { width: 22, height: 3, backgroundColor: colors.track },
  dotOn: { backgroundColor: colors.accent },
  brand: {
    fontFamily: fonts.brand,
    fontSize: 44,
    letterSpacing: 12,
    color: colors.accent,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 4,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  stepTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    letterSpacing: 3,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: 10,
  },
  stepHint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textDim,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
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
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  kindCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.panel,
    padding: 14,
    marginBottom: 10,
  },
  kindCardOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  kindLabel: { fontFamily: fonts.heading, fontSize: 14, letterSpacing: 2, color: colors.text },
  kindLabelOn: { color: colors.bg },
  kindTagline: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, marginTop: 3, lineHeight: 17 },
  kindTaglineOn: { color: colors.panelDeep },
  detailTitle: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, color: colors.textFaint, marginBottom: 6 },
  detail: { fontFamily: fonts.body, fontSize: 13, color: colors.text, lineHeight: 19 },
  starterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  starterRowSep: { borderTopWidth: 1, borderTopColor: colors.line },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  starterTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  starterOff: { color: colors.textFaint },
  starterMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 2, letterSpacing: 0.5 },
  smallPrint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 12,
  },
});
