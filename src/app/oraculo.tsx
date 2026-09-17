import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SystemButton } from '@/components/SystemButton';
import { TextoSistema } from '@/components/TextoSistema';
import {
  Card,
  Check,
  EmptyState,
  FadeIn,
  Row,
  RowValue,
  Screen,
  ScreenHeader,
  Section,
  Stagger,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { createQuest } from '@/lib/data';
import { DIFFICULTY_LABEL, XP_BY_DIFFICULTY } from '@/lib/game';
import { askOracle, getApiKey, PaywallError, setApiKey, type ProposedQuest } from '@/lib/oracle';
import { openCheckout, paymentsConfigured } from '@/lib/subscription';
import { colors, fonts } from '@/lib/theme';

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function Oraculo() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [apiKey, setKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
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
    setKeyOpen(false);
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
          'La IA consume API de verdad. Suscríbete y va incluida, o pega tu propia API key y paga solo tu consumo.',
          paymentsConfigured()
            ? [
                { text: 'Suscribirme', onPress: () => openCheckout(userId).catch(() => {}) },
                { text: 'Usaré mi key', onPress: () => setKeyOpen(true) },
                { text: 'Ahora no', style: 'cancel' },
              ]
            : [
                { text: 'Pegar mi key', onPress: () => setKeyOpen(true) },
                { text: 'Entendido', style: 'cancel' },
              ],
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
        { text: 'Ver misiones', onPress: () => router.replace('/(tabs)/habitos') },
      ]);
      setProposals([]);
      setGoal('');
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      setAccepting(false);
    }
  };

  const hayPropuestas = proposals.length > 0;
  const dias = (d: number[]) => (d.length === 7 ? 'todos los días' : d.map((x) => DAY_LABELS[x - 1]).join(' '));

  return (
    <Screen>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            onBack={() => router.back()}
            eyebrow="El sistema forja"
            title="Oráculo"
            subtitle={
              keySaved
                ? 'Dile tu objetivo y lo convierte en misiones. Tu clave está en este dispositivo.'
                : 'Dile tu objetivo y lo convierte en misiones diarias con fecha y medida.'
            }
            action={{ icon: 'key-outline', label: keySaved ? 'Cambiar la clave de API' : 'Usar mi propia clave de API', onPress: () => setKeyOpen(true) }}
          />
        </FadeIn>

        <FadeIn index={1}>
          <Section title="Tu objetivo">
            <TextInput
              style={styles.goalInput}
              value={goal}
              onChangeText={setGoal}
              placeholder="Correr 10 km en mayo. Aprobar Cálculo con nota. Dormir 8 horas."
              placeholderTextColor={colors.textFaint}
              multiline
              editable={!busy}
              accessibilityLabel="Tu objetivo"
            />
            <SystemButton
              title="Consultar al oráculo"
              icon="sparkles-outline"
              variant={hayPropuestas ? 'outline' : 'solid'}
              onPress={consult}
              loading={busy}
              disabled={!goal.trim()}
              style={{ marginTop: 12 }}
            />
          </Section>
        </FadeIn>

        {busy ? (
          <FadeIn index={2}>
            <Card variant="outline">
              <EmptyState compact icon="hourglass-outline" title="El oráculo delibera" body="Unos segundos. Está midiendo tu objetivo contra tus días." />
            </Card>
          </FadeIn>
        ) : null}

        {!busy && !hayPropuestas ? (
          <FadeIn index={2}>
            <Card variant="outline">
              <EmptyState
                compact
                icon="sparkles-outline"
                title="El oráculo espera"
                body="Un objetivo concreto, con fecha y medida, da mejores misiones. Tú eliges cuáles aceptar."
              />
            </Card>
          </FadeIn>
        ) : null}

        {hayPropuestas ? (
          <>
            <FadeIn index={2}>
              <Section title="Veredicto del sistema" tone="accent">
                <Card>
                  <TextoSistema texto={summary} />
                </Card>
              </Section>
            </FadeIn>

            <FadeIn index={3}>
              <Section title="Misiones propuestas" meta={`${selected.size}/${proposals.length}`}>
                <Card padded={false} style={styles.lista}>
                  {proposals.map((p, i) => {
                    const on = selected.has(i);
                    return (
                      <Row
                        key={i}
                        first={i === 0}
                        leading={<Check checked={on} />}
                        title={p.title}
                        muted={!on}
                        detail={
                          <View>
                            <Text style={styles.meta}>
                              {p.stat} · {DIFFICULTY_LABEL[p.difficulty]} · {dias(p.days_of_week)}
                            </Text>
                            {p.reasoning ? (
                              <Text style={styles.reason} numberOfLines={3}>
                                {p.reasoning}
                              </Text>
                            ) : null}
                          </View>
                        }
                        trailing={<RowValue tone={on ? 'accent' : 'dim'}>+{XP_BY_DIFFICULTY[p.difficulty]} XP</RowValue>}
                        onPress={() => toggle(i)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={`Misión propuesta: ${p.title}, ${on ? 'aceptada' : 'descartada'}`}
                      />
                    );
                  })}
                </Card>
                <Text style={styles.nota}>Desmarca las que no quieras. Las aceptadas pasan a Hábitos como misiones diarias.</Text>
                <SystemButton
                  title={selected.size === 1 ? 'Aceptar 1 misión' : `Aceptar ${selected.size} misiones`}
                  icon="checkmark"
                  onPress={accept}
                  loading={accepting}
                  disabled={selected.size === 0}
                  style={{ marginTop: 14 }}
                />
              </Section>
            </FadeIn>
          </>
        ) : null}
      </Stagger>

      <Modal visible={keyOpen} transparent animationType="slide" onRequestClose={() => setKeyOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdropTap} onPress={() => setKeyOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar" />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>CLAVE DE API</Text>
            <Text style={styles.sheetTitle}>Tu propia clave</Text>
            <Text style={styles.sheetBody}>
              OpenAI o Anthropic. Se guarda solo en este dispositivo y pagas solo tu consumo. Con suscripción no hace falta.
            </Text>
            <Text style={styles.label}>Clave</Text>
            <TextInput
              style={styles.input}
              value={apiKey}
              onChangeText={setKey}
              placeholder="sk-proj-… (OpenAI) o sk-ant-… (Anthropic)"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={keySaved}
              accessibilityLabel="Clave de API"
            />
            <Text style={styles.hint}>{keySaved ? 'Hay una clave guardada. Pega otra para sustituirla, o bórrala y guarda para quitarla.' : 'Nunca sale del dispositivo.'}</Text>
            <SystemButton title="Guardar la clave" onPress={saveKey} style={{ marginTop: 22 }} />
            <SystemButton title="Cancelar" variant="ghost" onPress={() => setKeyOpen(false)} style={{ marginTop: 6 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  goalInput: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 20,
    lineHeight: 27,
    letterSpacing: -0.3,
    minHeight: 110,
    textAlignVertical: 'top',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.accentText },
  reason: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textFaint, marginTop: 3 },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  backdropTap: { flex: 1 },
  sheet: {
    backgroundColor: colors.panel,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },
  sheetHandle: { alignSelf: 'center', width: 36, height: 3, backgroundColor: colors.accentDim, marginBottom: 16 },
  sheetEyebrow: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, color: colors.accentText },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 24, letterSpacing: -0.5, color: colors.text, marginTop: 6, marginBottom: 4 },
  sheetBody: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textDim, marginTop: 4 },
  label: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 8, lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
