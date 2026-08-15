import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { createQuest } from '@/lib/data';
import { DIFFICULTY_LABEL, XP_BY_DIFFICULTY } from '@/lib/game';
import { askOracle, getApiKey, PaywallError, setApiKey, type ProposedQuest } from '@/lib/oracle';
import { openCheckout, paymentsConfigured } from '@/lib/subscription';
import { colors, fonts } from '@/lib/theme';

export default function Oraculo() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [apiKey, setKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [goal, setGoal] = useState('');
  const [proposals, setProposals] = useState<ProposedQuest[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    getApiKey().then((k) => {
      if (k) {
        setKey(k);
        setKeySaved(true);
      }
    });
  }, []);

  const saveKey = async () => {
    await setApiKey(apiKey);
    setKeySaved(!!apiKey.trim());
    Alert.alert('Guardada', 'La key se guarda solo en este dispositivo.');
  };

  const consult = async () => {
    if (!goal.trim() || busy || !userId) return;
    setBusy(true);
    setProposals([]);
    try {
      // Vía automática: suscripción premium (servidor) → key propia → paywall.
      const res = await askOracle(goal.trim(), userId);
      setProposals(res.quests);
      setSummary(res.plan_summary);
      setSelected(new Set(res.quests.map((_, i) => i)));
    } catch (e) {
      if (e instanceof PaywallError) {
        Alert.alert(
          'El Oráculo es premium',
          'La IA consume API de verdad. Suscríbete y va incluida, o pega tu propia API key arriba y paga solo tu consumo.',
          paymentsConfigured()
            ? [
                { text: 'Suscribirme', onPress: () => openCheckout(userId).catch(() => {}) },
                { text: 'Usaré mi key', style: 'cancel' },
              ]
            : [{ text: 'Entendido', style: 'cancel' }],
        );
      } else {
        Alert.alert('El oráculo guarda silencio', e instanceof Error ? e.message : 'Error desconocido');
      }
    } finally {
      setBusy(false);
    }
  };

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const accept = async () => {
    if (!userId || selected.size === 0 || accepting) return;
    setAccepting(true);
    try {
      for (const i of selected) {
        const p = proposals[i];
        if (!p) continue;
        await createQuest(userId, {
          title: p.title,
          stat: p.stat,
          difficulty: p.difficulty,
          days_of_week: p.days_of_week,
          requires_evidence: false,
        });
      }
      Alert.alert('MISIONES ASIGNADAS', `El sistema ha registrado ${selected.size} nueva(s) misión(es).`, [
        { text: 'Ver misiones', onPress: () => router.replace('/(tabs)/misiones') },
      ]);
      setProposals([]);
      setGoal('');
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      setAccepting(false);
    }
  };

  const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Volver"
            >
              <Ionicons name="chevron-back" size={24} color={colors.cyan} />
            </Pressable>
            <Text style={styles.title}>EL ORÁCULO</Text>
            <View style={{ width: 24 }} />
          </View>

          <SystemWindow color={colors.line}>
            <Text style={styles.label}>API KEY · OPENAI O ANTHROPIC (solo en tu dispositivo)</Text>
            <View style={styles.keyRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={apiKey}
                onChangeText={setKey}
                placeholder="sk-proj-… (OpenAI) o sk-ant-… (Anthropic)"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                secureTextEntry={keySaved}
              />
              <SystemButton title="Guardar" variant="outline" onPress={saveKey} style={{ paddingVertical: 10 }} />
            </View>
          </SystemWindow>

          <SystemWindow color={colors.cyanDim}>
            <Text style={styles.intro}>
              Dile al sistema tu objetivo y él forjará las misiones que te llevarán hasta él.
            </Text>
            <TextInput
              style={[styles.input, styles.goalInput]}
              value={goal}
              onChangeText={setGoal}
              placeholder="Ej. Correr una 10K en mayo · Aprobar INGP con nota · Dormir mejor"
              placeholderTextColor={colors.textFaint}
              multiline
            />
            <SystemButton
              title="Consultar al oráculo"
              onPress={consult}
              loading={busy}
              disabled={!goal.trim()}
              style={{ marginTop: 12 }}
            />
          </SystemWindow>

          {proposals.length > 0 ? (
            <>
              <SystemWindow color={colors.cyanDim}>
                <Text style={styles.label}>VEREDICTO DEL SISTEMA</Text>
                <Text style={styles.summary}>{summary}</Text>
              </SystemWindow>

              <SystemWindow color={colors.cyanDim}>
                <Text style={styles.label}>
                  MISIONES PROPUESTAS · {selected.size}/{proposals.length} SELECCIONADAS
                </Text>
                {proposals.map((p, i) => (
                  <Pressable
                    key={i}
                    onPress={() => toggle(i)}
                    style={styles.proposal}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected.has(i) }}
                    accessibilityLabel={`Misión propuesta: ${p.title}`}
                  >
                    <View style={[styles.box, selected.has(i) && styles.boxOn]}>
                      {selected.has(i) ? <Ionicons name="checkmark" size={14} color={colors.cyan} /> : null}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.proposalTitle}>{p.title}</Text>
                      <Text style={styles.proposalMeta}>
                        {p.stat} · {DIFFICULTY_LABEL[p.difficulty]} · {XP_BY_DIFFICULTY[p.difficulty]} XP ·{' '}
                        {p.days_of_week.length === 7
                          ? 'todos los días'
                          : p.days_of_week.map((d) => DAY_LABELS[d - 1]).join(' ')}
                      </Text>
                      <Text style={styles.proposalReason}>{p.reasoning}</Text>
                    </View>
                  </Pressable>
                ))}
                <SystemButton
                  title={`Aceptar ${selected.size} misión(es)`}
                  onPress={accept}
                  loading={accepting}
                  disabled={selected.size === 0}
                  style={{ marginTop: 14 }}
                />
              </SystemWindow>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontFamily: fonts.heading, fontSize: 15, letterSpacing: 3, color: colors.cyan },
  label: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textDim,
    marginBottom: 8,
  },
  keyRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  input: {
    borderWidth: 1,
    borderColor: colors.cyanDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  intro: { fontFamily: fonts.semibold, fontSize: 14, color: colors.cyanText, lineHeight: 20, marginBottom: 10 },
  goalInput: { minHeight: 70, textAlignVertical: 'top' },
  summary: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text, lineHeight: 20 },
  proposal: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  box: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.cyanDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxOn: { backgroundColor: colors.cyanFaint, borderColor: colors.cyan },
  proposalTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  proposalMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.cyanText, marginTop: 2 },
  proposalReason: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 3, lineHeight: 16 },
});
