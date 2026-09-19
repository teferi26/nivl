import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SystemButton } from '@/components/SystemButton';
import {
  Card,
  Chip,
  ChipWrap,
  EmptyState,
  FadeIn,
  Row,
  RowValue,
  Screen,
  ScreenHeader,
  Section,
  Stagger,
  Stat,
  StatRow,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  breakRule,
  createRule,
  deleteRule,
  fetchLetter,
  fetchRedemptionsThisWeek,
  fetchRules,
  openLetter,
  redeemBonus,
  sealLetter,
} from '@/lib/contract';
import { esCompromiso } from '@/lib/compromiso';
import { ensureProfile } from '@/lib/data';
import { addDays, dateKey } from '@/lib/dates';
import {
  BONUS_BY_DIFFICULTY,
  BOSS_MULTIPLIER,
  DAILY_PENALTY_CAP,
  DIFFICULTIES,
  DUNGEON_CLEAR_XP,
  EVIDENCE_BONUS,
  GOAL_ACHIEVED_XP,
  GYM_SESSION_XP,
  JOURNAL_XP,
  PENALTY_FACTOR,
  PR_XP,
  REDEEM_COST,
  REDEEM_WEEKLY_CAP,
  RULE_BREAK_XP,
  streakMultiplier,
  WEIGH_IN_XP,
  XP_BY_DIFFICULTY,
} from '@/lib/game';
import { colors, fonts } from '@/lib/theme';
import type { Letter, Profile, Rule } from '@/lib/types';

// Plantilla basada en el cuaderno "CAMINO AL ÉXITO" del usuario, adaptada
// a su vida actual (carrera terminada).
const TEMPLATE_RULES: { text: string; consequence: string }[] = [
  { text: 'Escribir el diario todos los días: lo vivido y el plan del día', consequence: 'Correr 8 km' },
  { text: 'Nada de alcohol', consequence: '1 día comiendo solo limpio' },
  { text: 'Nada de cafeína', consequence: '1 día sin pantallas de ocio' },
  { text: 'Comer limpio a diario', consequence: 'Correr 4,5 km' },
  { text: 'Si salgo de fiesta sin haberlo ganado', consequence: '1 semana de dieta estricta' },
  { text: 'Ningún plan se interpone a mis objetivos', consequence: 'Reorganizar la semana y compensar el tiempo' },
];

const OPEN_OPTIONS = [
  { label: '1 año', days: 365 },
  { label: '3 años', days: 365 * 3 },
  { label: '5 años', days: 365 * 5 },
];

/** Una fila de la tabla de puntuación: concepto a la izquierda, valor a la derecha. */
function Puntuacion({ filas, tone = 'dim' }: { filas: { label: string; value: string }[]; tone?: 'dim' | 'red' }) {
  return (
    <Card padded={false} style={styles.lista}>
      {filas.map((f, i) => (
        <Row
          key={f.label}
          first={i === 0}
          title={f.label}
          trailing={
            <Text style={[styles.scoreValue, tone === 'red' && styles.scoreValueRed]} numberOfLines={3}>
              {f.value}
            </Text>
          }
        />
      ))}
    </Card>
  );
}

export default function Contrato() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [spentWeek, setSpentWeek] = useState(0);
  const [letter, setLetter] = useState<Letter | null>(null);
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [ruleText, setRuleText] = useState('');
  const [ruleConsequence, setRuleConsequence] = useState('');
  const [letterFormOpen, setLetterFormOpen] = useState(false);
  const [letterBody, setLetterBody] = useState('');
  const [letterYears, setLetterYears] = useState(OPEN_OPTIONS[2]!);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const today = dateKey();

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [prof, rs, reds, lt] = await Promise.all([
        ensureProfile(userId),
        fetchRules(),
        fetchRedemptionsThisWeek(),
        fetchLetter(),
      ]);
      setProfile(prof);
      setRules(rs);
      setSpentWeek(reds.reduce((s, r) => s + r.amount, 0));
      setLetter(lt);
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const seedTemplate = async () => {
    if (!userId || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      for (let i = 0; i < TEMPLATE_RULES.length; i++) {
        const t = TEMPLATE_RULES[i]!;
        await createRule(userId, { text: t.text, consequence: t.consequence, position: i });
      }
      await load();
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const addRule = async () => {
    if (!userId || !ruleText.trim() || !ruleConsequence.trim() || lock.current) return;
    lock.current = true;
    try {
      await createRule(userId, {
        text: ruleText.trim(),
        consequence: ruleConsequence.trim(),
        position: rules.reduce((m, r) => Math.max(m, r.position), -1) + 1,
      });
      setRuleText('');
      setRuleConsequence('');
      setRuleFormOpen(false);
      await load();
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      lock.current = false;
    }
  };

  const onBreakRule = (rule: Rule) => {
    Alert.alert(
      'Confesión al sistema',
      `¿Has roto la norma "${rule.text}"?\n\nPenalización: −${RULE_BREAK_XP} XP y la consecuencia que tú mismo firmaste: ${rule.consequence}. Cúmplela hoy y recuperas el XP.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'La he roto',
          style: 'destructive',
          onPress: async () => {
            if (!profile || lock.current) return;
            lock.current = true;
            try {
              const res = await breakRule(profile, rule);
              setProfile(res.profile);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              Alert.alert(
                'REGISTRADO',
                `El sistema no juzga: registra. La misión "Consecuencia: ${rule.consequence}" te espera hoy en Sistema.`,
              );
              await load();
            } catch (e) {
              Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
            } finally {
              lock.current = false;
            }
          },
        },
      ],
    );
  };

  const onDeleteRule = (rule: Rule) => {
    Alert.alert('Eliminar norma', `"${rule.text}" y su historial de incumplimientos.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRule(rule.id);
            await load();
          } catch (e) {
            Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
          }
        },
      },
    ]);
  };

  const onRedeem = () => {
    if (!profile) return;
    if (profile.bonus_points < REDEEM_COST) {
      Alert.alert('Puntos insuficientes', `Necesitas ${REDEEM_COST} PB para canjear 1 h de descanso.`);
      return;
    }
    if (spentWeek + REDEEM_COST > REDEEM_WEEKLY_CAP) {
      Alert.alert('Tope semanal', `Máximo ${REDEEM_WEEKLY_CAP} PB canjeados cada 7 días. Llevas ${spentWeek}.`);
      return;
    }
    Alert.alert('Canjear descanso', `${REDEEM_COST} PB → 1 hora de descanso ganado. ¿Confirmas?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Canjear',
        onPress: async () => {
          if (lock.current) return;
          lock.current = true;
          try {
            const newTotal = await redeemBonus(REDEEM_COST, '1 h de descanso');
            setProfile((p) => (p ? { ...p, bonus_points: newTotal } : p));
            setSpentWeek((s) => s + REDEEM_COST);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('DESCANSO GANADO', 'Disfrútalo sin culpa: lo has pagado con esfuerzo.');
          } catch (e) {
            Alert.alert('Error del sistema', e instanceof Error ? e.message : 'No se pudo canjear');
          } finally {
            lock.current = false;
          }
        },
      },
    ]);
  };

  const onSealLetter = async () => {
    if (!userId || !letterBody.trim() || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const openAt = addDays(today, letterYears.days);
      await sealLetter(userId, letterBody.trim(), openAt);
      setLetterFormOpen(false);
      setLetterBody('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('CARTA SELLADA', `El sistema la custodiará hasta el ${openAt}. Nadie podrá leerla antes, ni tú.`);
      await load();
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const onOpenLetter = async () => {
    if (!letter || lock.current) return;
    lock.current = true;
    try {
      const opened = await openLetter(letter);
      setLetter(opened);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      lock.current = false;
    }
  };

  const letterOpenable = letter && !letter.opened_at && letter.open_at <= today;
  const activeRules = rules.filter((r) => r.active);
  const bonus = profile?.bonus_points ?? 0;

  const subtitulo = !profile
    ? undefined
    : activeRules.length === 0
      ? 'Sin normas firmadas. El sistema solo hace cumplir lo que tú firmas.'
      : `${activeRules.length} ${activeRules.length === 1 ? 'norma firmada' : 'normas firmadas'} · ${bonus} PB en la bolsa`;

  // Tabla de transparencia: los valores salen de game.ts, no pueden desincronizarse del motor.
  const ganancias = [
    { label: 'Misión (trivial → épica)', value: `${DIFFICULTIES.map((d) => XP_BY_DIFFICULTY[d]).join(' · ')} XP` },
    { label: 'Evidencia (foto)', value: `+${Math.round(EVIDENCE_BONUS * 100)} %` },
    {
      label: 'Racha',
      value: `+${Math.round((streakMultiplier(7) - 1) * 100)} % por semana · techo ×${streakMultiplier(9999).toFixed(1).replace('.', ',')}`,
    },
    { label: 'Sesión de gimnasio', value: `${GYM_SESSION_XP} XP` },
    { label: 'Récord personal', value: `${PR_XP} XP` },
    { label: 'Página del diario', value: `${JOURNAL_XP} XP` },
    { label: 'Pesarte', value: `${WEIGH_IN_XP} XP` },
    { label: 'Objetivo cumplido', value: `${GOAL_ACHIEVED_XP} XP` },
    { label: 'Tarea de campaña', value: `XP de su dificultad · jefe ×${BOSS_MULTIPLIER}` },
    { label: 'Campaña despejada', value: `${DUNGEON_CLEAR_XP.E}–${DUNGEON_CLEAR_XP.S} XP según rango` },
    { label: 'Misión extra', value: `${DIFFICULTIES.map((d) => BONUS_BY_DIFFICULTY[d]).join(' · ')} PB` },
  ];
  const perdidas = [
    { label: 'Misión del día sin hacer', value: `−${Math.round(PENALTY_FACTOR * 100)} % de su XP · tope −${DAILY_PENALTY_CAP}/día` },
    { label: 'Romper una norma firmada', value: `−${RULE_BREAK_XP} XP + consecuencia` },
  ];

  return (
    <Screen>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            onBack={() => router.back()}
            eyebrow="Lo que tú firmas"
            title="El contrato"
            subtitle={subtitulo}
            action={{ icon: 'add', label: 'Firmar una norma nueva', onPress: () => setRuleFormOpen(true), solid: true }}
          />
        </FadeIn>

        <FadeIn index={1}>
          <Section title="Puntos bonus" tone="gold" meta={`${spentWeek}/${REDEEM_WEEKLY_CAP} canjeados`}>
            <Card>
              <StatRow>
                <Stat value={bonus} unit="PB" label="En la bolsa" tone={bonus >= REDEEM_COST ? 'gold' : 'text'} />
                <Stat value={REDEEM_WEEKLY_CAP - spentWeek} unit="PB" label="Canjeables esta semana" size="sm" style={styles.statRight} />
              </StatRow>
              <ChipWrap style={{ marginTop: 14 }}>
                <Chip
                  label={`Canjear ${REDEEM_COST} PB · 1 h de descanso`}
                  icon="cafe-outline"
                  tone="gold"
                  onPress={onRedeem}
                  disabled={!profile}
                  accessibilityLabel={`Canjear ${REDEEM_COST} puntos bonus por una hora de descanso`}
                />
              </ChipWrap>
              <Text style={styles.nota}>
                Las misiones extra pagan en PB, no en XP. {REDEEM_COST} PB son 1 h de descanso sin culpa, con tope de{' '}
                {REDEEM_WEEKLY_CAP} PB cada 7 días.
              </Text>
            </Card>
          </Section>
        </FadeIn>

        <FadeIn index={2}>
          <Section
            title="Reglas del juego"
            meta={activeRules.length > 0 ? `${activeRules.length}` : undefined}
            tone={activeRules.length > 0 ? 'accent' : 'dim'}
          >
            {activeRules.length === 0 ? (
              <Card variant="outline">
                <EmptyState
                  compact
                  icon="document-text-outline"
                  title="Ninguna norma firmada"
                  body="Aquí van las normas que tú te impones y su consecuencia. El sistema solo las hace cumplir."
                />
                <SystemButton
                  title="Cargar mis normas del cuaderno"
                  variant="outline"
                  size="sm"
                  onPress={seedTemplate}
                  loading={busy}
                  style={{ alignSelf: 'center', marginBottom: 8 }}
                />
              </Card>
            ) : (
              <>
                <Card padded={false} style={styles.lista}>
                  {activeRules.map((r, i) => (
                    <Row
                      key={r.id}
                      first={i === 0}
                      leading={<Text style={styles.ruleNumber}>{i + 1}</Text>}
                      title={r.text}
                      detail={`Si la rompes: ${r.consequence}`}
                      trailing={<RowValue tone="red">−{RULE_BREAK_XP} XP</RowValue>}
                      onPress={() => onBreakRule(r)}
                      onLongPress={() => onDeleteRule(r)}
                      accessibilityLabel={`Norma ${i + 1}: ${r.text}. Toca para confesar que la has roto. Mantén pulsado para eliminarla.`}
                    />
                  ))}
                </Card>
                <Text style={styles.nota}>
                  Toca una norma para confesar que la has roto. Mantén pulsada para eliminarla. Cada noche se marcan las
                  cumplidas en Hábitos.
                </Text>
              </>
            )}
          </Section>
        </FadeIn>

        <FadeIn index={3}>
          <Section title="Carta a tu yo del futuro" tone="gold">
            <Card variant="outline" accent={colors.gold}>
              {!letter ? (
                <EmptyState
                  compact
                  icon="mail-outline"
                  title="Aún no hay carta"
                  body="Escríbele a quien serás. El sistema la sella y la custodia hasta el día señalado."
                  action={{ label: 'Escribir la carta', onPress: () => setLetterFormOpen(true) }}
                />
              ) : letter.opened_at ? (
                <>
                  <Text style={styles.letterEyebrow}>ABIERTA</Text>
                  <Text style={styles.letterMeta}>
                    Sellada el {letter.sealed_at.slice(0, 10)} · abierta el {letter.opened_at.slice(0, 10)}
                  </Text>
                  <Text style={styles.letterBody}>{letter.body}</Text>
                </>
              ) : letterOpenable ? (
                <>
                  <Text style={styles.letterEyebrow}>HA LLEGADO EL DÍA</Text>
                  <Text style={styles.letterMeta}>La carta que sellaste el {letter.sealed_at.slice(0, 10)} espera.</Text>
                  <SystemButton title="Abrir la carta" variant="outline" icon="mail-open-outline" onPress={onOpenLetter} style={{ marginTop: 14 }} />
                </>
              ) : esCompromiso(letter.body) ? (
                <>
                  <Text style={styles.letterEyebrow}>FIRMADO POR TI</Text>
                  <Text style={styles.letterMeta}>
                    Firmado el {letter.sealed_at.slice(0, 10)} · vence el {letter.open_at}
                  </Text>
                  <Text style={styles.letterBody}>{letter.body}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.letterEyebrow}>SELLADA</Text>
                  <Text style={styles.letterMeta}>
                    Sellada el {letter.sealed_at.slice(0, 10)}. Se abrirá el {letter.open_at}. Hasta entonces, a trabajar.
                  </Text>
                </>
              )}
            </Card>
          </Section>
        </FadeIn>

        <FadeIn index={4}>
          <Section title="Así se gana">
            <Puntuacion filas={ganancias} />
          </Section>
        </FadeIn>

        <FadeIn index={5}>
          <Section title="Así se pierde" tone="red">
            <Puntuacion filas={perdidas} tone="red" />
            <Card padded={false} style={styles.lista}>
              <Row
                first
                leading={<Ionicons name="shield-half-outline" size={18} color={colors.accentText} />}
                title="Piedra de protección"
                detail="Absorbe todo el daño de un día."
              />
            </Card>
            <Text style={styles.nota}>
              Toda la app puntúa con esta tabla: mismo esfuerzo, misma recompensa. Los PB no dan XP: se canjean por descanso.
            </Text>
          </Section>
        </FadeIn>
      </Stagger>

      <Modal visible={ruleFormOpen} transparent animationType="slide" onRequestClose={() => setRuleFormOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdropTap} onPress={() => setRuleFormOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar" />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>NUEVA NORMA</Text>
            <Text style={styles.sheetTitle}>¿Qué te prohíbes?</Text>
            <Text style={styles.label}>La norma</Text>
            <TextInput
              style={styles.input}
              value={ruleText}
              onChangeText={setRuleText}
              placeholder="Ej. Nada de redes sociales antes de las 12"
              placeholderTextColor={colors.textFaint}
              autoFocus
              accessibilityLabel="Texto de la norma"
            />
            <Text style={styles.label}>Consecuencia si la rompes</Text>
            <TextInput
              style={styles.input}
              value={ruleConsequence}
              onChangeText={setRuleConsequence}
              placeholder="Ej. Correr 5 km"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Consecuencia de romper la norma"
            />
            <Text style={styles.hint}>Romperla cuesta −{RULE_BREAK_XP} XP. Cumplir la consecuencia el mismo día lo recupera.</Text>
            <SystemButton
              title="Firmar la norma"
              onPress={addRule}
              disabled={!ruleText.trim() || !ruleConsequence.trim()}
              style={{ marginTop: 22 }}
            />
            <SystemButton title="Cancelar" variant="ghost" onPress={() => setRuleFormOpen(false)} style={{ marginTop: 6 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={letterFormOpen} transparent animationType="slide" onRequestClose={() => setLetterFormOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdropTap} onPress={() => setLetterFormOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar" />
          <View style={[styles.sheet, styles.sheetTall]}>
            <View style={styles.sheetHandle} />
            <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[styles.sheetEyebrow, { color: colors.gold }]}>PARA TU YO DEL FUTURO</Text>
              <Text style={styles.sheetTitle}>Escríbele a quien serás</Text>
              <TextInput
                style={[styles.input, styles.letterInput]}
                value={letterBody}
                onChangeText={setLetterBody}
                placeholder="No sé cómo estarás, ni en qué situación…"
                placeholderTextColor={colors.textFaint}
                multiline
                accessibilityLabel="Cuerpo de la carta"
              />
              <Text style={styles.label}>Se abrirá dentro de</Text>
              <ChipWrap>
                {OPEN_OPTIONS.map((o) => (
                  <Chip
                    key={o.label}
                    label={o.label}
                    tone="gold"
                    selected={letterYears.label === o.label}
                    onPress={() => setLetterYears(o)}
                    accessibilityLabel={`Abrir dentro de ${o.label}`}
                  />
                ))}
              </ChipWrap>
              <Text style={styles.hint}>Se abrirá el {addDays(today, letterYears.days)}. Nadie podrá leerla antes, ni tú.</Text>
              <SystemButton
                title="Sellar la carta"
                onPress={onSealLetter}
                loading={busy}
                disabled={!letterBody.trim()}
                style={{ marginTop: 22 }}
              />
              <SystemButton title="Cancelar" variant="ghost" onPress={() => setLetterFormOpen(false)} style={{ marginTop: 6 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  statRight: { alignItems: 'flex-end' },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 10 },
  ruleNumber: { fontFamily: fonts.number, fontSize: 16, color: colors.accentText, minWidth: 22, textAlign: 'center' },
  scoreValue: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.accentText,
    textAlign: 'right',
    maxWidth: 170,
  },
  scoreValueRed: { color: colors.red },
  letterEyebrow: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, color: colors.gold },
  letterMeta: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textDim, marginTop: 6 },
  letterBody: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 22, color: colors.text, marginTop: 12 },
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
  sheetTall: { maxHeight: '88%' },
  sheetHandle: { alignSelf: 'center', width: 36, height: 3, backgroundColor: colors.accentDim, marginBottom: 16 },
  sheetEyebrow: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, color: colors.accentText },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 24, letterSpacing: -0.5, color: colors.text, marginTop: 6, marginBottom: 4 },
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
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  letterInput: { minHeight: 150, textAlignVertical: 'top', lineHeight: 22, marginTop: 14, fontFamily: fonts.body },
});
