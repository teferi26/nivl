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
import { HoldToSign } from '@/components/HoldToSign';
import { ProOffer } from '@/components/ProOffer';
import { SystemButton } from '@/components/SystemButton';
import { Card, Chip, FadeIn } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  GOAL_DETAIL_MAX_LENGTH,
  GOAL_MAX_LENGTH,
  HORIZONTES,
  HORIZONTE_POR_DEFECTO,
  firmaValida,
  limpiarFrase,
  textoCompromiso,
  type Horizonte,
} from '@/lib/compromiso';
import { sealLetter } from '@/lib/contract';
import { createStarterQuests, ensureProfile, insertEvent, updateProfile } from '@/lib/data';
import { addDays, dateKey, fechaConAnio } from '@/lib/dates';
import { KINDS, PROFILE_KINDS, type ProfileKind } from '@/lib/kinds';
import { fetchAiStatus, isPro } from '@/lib/pro';
import { colors, fonts } from '@/lib/theme';
import { NAME_MAX_LENGTH } from '@/lib/validation';

// Bienvenida · Nombre · Para qué · El objetivo · Primeros hábitos · La firma · NIVL Pro
//
// El orden no es casual. Primero se dice para qué se está aquí, luego se
// eligen los hábitos que llevan hasta ahí, y solo entonces se firma: el
// compromiso ya tiene contenido. Pro va DESPUÉS de la firma, en el momento de
// más convicción, y con la salida gratuita a la misma altura que la compra.
const STEPS = 7;

// Nombres por defecto de la fila de perfil: si es uno de estos, no se
// prerrellena (que escriba el suyo).
const DEFAULT_NAMES = new Set(['Gladiador', 'Cazador']);

export default function Onboarding() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ProfileKind | null>(null);
  const [goal, setGoal] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [horizonte, setHorizonte] = useState<Horizonte>(HORIZONTE_POR_DEFECTO);
  const [firma, setFirma] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  // Quien ya tiene coach (una cuenta de cortesía que rehace el onboarding) no
  // ve la oferta: tras firmar, entra.
  const yaEsPro = useRef(false);

  // El nombre puede venir ya de Franky (trigger de alta, migración 0018).
  useEffect(() => {
    if (!userId) return;
    ensureProfile(userId)
      .then((p) => {
        if (p.name && !DEFAULT_NAMES.has(p.name)) setName((n) => n || p.name);
      })
      .catch(() => {});
    fetchAiStatus()
      .then((s) => {
        yaEsPro.current = isPro(s);
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

  // El objetivo es una frase libre, no una meta medible: no cabe en `goals`
  // (que exige valor inicial y valor objetivo numéricos y paga XP al
  // cumplirse). Va a la crónica de eventos, donde el coach puede leerlo.
  const saveGoal = () =>
    withLock(async () => {
      if (!limpiarFrase(goal)) return;
      await insertEvent(userId!, 'onboarding_goal', {
        goal: limpiarFrase(goal),
        target: limpiarFrase(target) || null,
        deadline: limpiarFrase(deadline) || null,
        kind,
      });
      setStep(4);
    });

  const saveStarters = () =>
    withLock(async () => {
      if (!kind) return;
      const quests = KINDS[kind].starterQuests.filter((_, i) => chosen.has(i));
      await createStarterQuests(userId!, quests);
      setFirma('');
      setStep(5);
    });

  const hoy = dateKey();
  const abreEl = addDays(hoy, horizonte.days);
  const contrato = textoCompromiso({
    name,
    goal,
    target,
    deadline,
    horizonte,
    firmadoEl: fechaConAnio(hoy),
    seAbreEl: fechaConAnio(abreEl),
  });

  const finish = () =>
    withLock(async () => {
      await updateProfile(userId!, { onboarding_done: true });
      router.replace('/(tabs)');
    });

  // La firma se sella como una carta al yo del futuro: aparece en Contrato y
  // se abre el día que vence el horizonte. El evento deja constancia en la
  // crónica sin revelar el texto.
  const sign = () =>
    withLock(async () => {
      await sealLetter(userId!, contrato, abreEl);
      await insertEvent(userId!, 'commitment_signed', { years: horizonte.years, open_at: abreEl }).catch(() => {});
      if (yaEsPro.current) {
        await updateProfile(userId!, { onboarding_done: true });
        router.replace('/(tabs)');
        return;
      }
      setStep(6);
    });

  const toggleStarter = (i: number) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const meta = kind ? KINDS[kind] : null;
  const firmaOk = firmaValida(firma, name);

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
            <FadeIn key="paso-0">
              <Text style={styles.brand}>NIVL</Text>
              <Text style={styles.tagline}>UN 1 % MEJOR CADA DÍA</Text>
              <Card variant="outline">
                <Text style={styles.lore}>
                  Esto no es una lista de tareas. Es una arena.{'\n\n'}
                  Cada día tienes misiones. Cumplirlas da XP y sube tu nivel; fallarlas lo
                  resta. La racha multiplica. Los proyectos grandes son campañas con un jefe
                  final. Y hay un coach que dicta tu día, te juzga por la noche y recuerda
                  todo lo que aprende de ti.{'\n\n'}
                  Nada de trampas: las evidencias se hacen con la cámara, en el momento. El
                  sistema no opina. Registra.
                </Text>
              </Card>
              <SystemButton title="Entrar en la arena" size="lg" onPress={() => setStep(1)} />
            </FadeIn>
          ) : null}

          {step === 1 ? (
            <FadeIn key="paso-1">
              <Text style={styles.stepTitle}>¿Cómo te llamas?</Text>
              <Card variant="outline">
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
              </Card>
              <SystemButton title="Continuar" onPress={saveName} loading={busy} disabled={!name.trim()} />
            </FadeIn>
          ) : null}

          {step === 2 ? (
            <FadeIn key="paso-2">
              <Text style={styles.stepTitle}>¿Para qué vas a usar NIVL?</Text>
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
                <Card variant="outline" style={{ marginTop: 6 }}>
                  <Text style={styles.detailTitle}>QUÉ SE ACTIVA</Text>
                  <Text style={styles.detail}>{meta.description}</Text>
                </Card>
              ) : null}
              <SystemButton title="Continuar" onPress={saveKind} loading={busy} disabled={!kind} />
            </FadeIn>
          ) : null}

          {step === 3 && meta ? (
            <FadeIn key="paso-3">
              <Text style={styles.stepTitle}>¿A qué has venido?</Text>
              <Text style={styles.stepHint}>
                Una sola cosa, en una frase. No «mejorar»: lo que quieres haber conseguido. Es lo que vas a firmar.
              </Text>
              <Card variant="outline">
                <Text style={styles.label}>Tu objetivo</Text>
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  value={goal}
                  onChangeText={setGoal}
                  placeholder={meta.goalExample}
                  placeholderTextColor={colors.textFaint}
                  maxLength={GOAL_MAX_LENGTH}
                  multiline
                  accessibilityLabel="Tu objetivo, en una frase"
                />
                <View style={styles.pair}>
                  <View style={styles.pairItem}>
                    <Text style={[styles.label, styles.labelGap]}>Cifra · opcional</Text>
                    <TextInput
                      style={styles.input}
                      value={target}
                      onChangeText={setTarget}
                      placeholder="78 kg, 5.000 €…"
                      placeholderTextColor={colors.textFaint}
                      maxLength={GOAL_DETAIL_MAX_LENGTH}
                      accessibilityLabel="Cifra del objetivo, opcional"
                    />
                  </View>
                  <View style={styles.pairItem}>
                    <Text style={[styles.label, styles.labelGap]}>Fecha · opcional</Text>
                    <TextInput
                      style={styles.input}
                      value={deadline}
                      onChangeText={setDeadline}
                      placeholder="junio de 2027"
                      placeholderTextColor={colors.textFaint}
                      maxLength={GOAL_DETAIL_MAX_LENGTH}
                      accessibilityLabel="Fecha del objetivo, opcional"
                    />
                  </View>
                </View>
              </Card>
              <SystemButton title="Continuar" onPress={saveGoal} loading={busy} disabled={!limpiarFrase(goal)} />
            </FadeIn>
          ) : null}

          {step === 4 && meta ? (
            <FadeIn key="paso-4">
              <Text style={styles.stepTitle}>Tus primeras misiones</Text>
              <Text style={styles.stepHint}>
                Propuestas para un {meta.label.toLowerCase() === 'en general' ? 'gladiador' : meta.label.toLowerCase()}.
                Quita las que no vayan contigo; podrás crear las tuyas en Hábitos.
              </Text>
              <Card variant="outline">
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
              </Card>
              <SystemButton
                title={chosen.size > 0 ? `Crear ${chosen.size} misión${chosen.size === 1 ? '' : 'es'}` : 'Empezar sin misiones'}
                onPress={saveStarters}
                loading={busy}
              />
            </FadeIn>
          ) : null}

          {step === 5 ? (
            <FadeIn key="paso-5">
              <Text style={styles.stepTitle}>Fírmalo contigo</Text>
              <Text style={styles.stepHint}>
                Nadie más lo va a leer. Se sella hoy y se abre cuando venza el plazo. Elige cuánto te das.
              </Text>
              <View style={styles.horizontes} accessibilityRole="radiogroup">
                {HORIZONTES.map((h) => (
                  <View key={h.years} style={styles.horizonte}>
                    <Chip
                      label={h.label}
                      selected={horizonte.years === h.years}
                      onPress={() => setHorizonte(h)}
                      accessibilityLabel={`Horizonte de ${h.label}${h.recomendado ? ', recomendado' : ''}`}
                      style={styles.horizonteChip}
                    />
                    <Text style={styles.recomendado}>{h.recomendado ? 'recomendado' : ' '}</Text>
                  </View>
                ))}
              </View>
              <Card variant="outline" accent={colors.accentDim}>
                <Text style={styles.contrato}>{contrato}</Text>
              </Card>
              <Text style={styles.smallPrint}>
                Se abrirá el {fechaConAnio(abreEl)}. Hasta entonces lo guarda Contrato, sellado. Tus normas y sus
                consecuencias las escribes allí cuando entres.
              </Text>
              <Card variant="outline" style={styles.firmaCard}>
                <Text style={styles.label}>Escribe tu nombre para firmar</Text>
                <TextInput
                  style={styles.input}
                  value={firma}
                  onChangeText={setFirma}
                  placeholder={name.trim()}
                  placeholderTextColor={colors.textFaint}
                  maxLength={NAME_MAX_LENGTH}
                  autoCapitalize="words"
                  autoCorrect={false}
                  accessibilityLabel="Escribe tu nombre para firmar"
                />
              </Card>
              <HoldToSign
                label={firmaOk ? 'Mantén pulsado para firmar' : 'Escribe tu nombre'}
                onComplete={sign}
                disabled={!firmaOk}
                loading={busy}
              />
            </FadeIn>
          ) : null}

          {step === 6 ? (
            <FadeIn key="paso-6">
              <Text style={styles.stepTitle}>Firmado. Ahora, quién lo dirige.</Text>
              <Text style={styles.stepHint}>
                NIVL es tuya entera y gratis. El coach de IA es lo único de pago. Decide ahora o más adelante, desde la
                pestaña Coach: el compromiso vale igual.
              </Text>
              <ProOffer
                compact
                userId={userId}
                kind={kind}
                exitLabel="Seguir gratis por ahora"
                onExit={finish}
                exitLoading={busy}
                onPurchased={finish}
              />
            </FadeIn>
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
    fontSize: 26,
    letterSpacing: -0.5,
    lineHeight: 31,
    color: colors.text,
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
  labelGap: { marginTop: 14 },
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
  inputMulti: { minHeight: 76, textAlignVertical: 'top', lineHeight: 22 },
  pair: { flexDirection: 'row', gap: 10 },
  pairItem: { flex: 1, minWidth: 0 },
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
  horizontes: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  horizonte: { flex: 1, alignItems: 'stretch' },
  horizonteChip: { justifyContent: 'center' },
  recomendado: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.accentText,
    textAlign: 'center',
    marginTop: 6,
  },
  contrato: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: colors.text },
  firmaCard: { marginTop: 14 },
  smallPrint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textFaint,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 4,
  },
});
