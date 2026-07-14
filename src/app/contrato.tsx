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
import { SafeAreaView } from 'react-native-safe-area-context';
import { SystemButton } from '@/components/SystemButton';
import { SystemWindow } from '@/components/SystemWindow';
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
  setRuleActive,
} from '@/lib/contract';
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

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={24} color={colors.cyan} />
          </Pressable>
          <Text style={styles.title}>EL CONTRATO</Text>
          <Pressable
            onPress={() => setRuleFormOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Añadir norma"
          >
            <Ionicons name="add" size={24} color={colors.cyan} />
          </Pressable>
        </View>

        <SystemWindow color={colors.cyanDim}>
          <Text style={styles.windowTitle}>PUNTOS BONUS</Text>
          <View style={styles.pbRow}>
            <Text style={styles.pbValue}>{profile?.bonus_points ?? 0} PB</Text>
            <Text style={styles.pbMeta}>
              canjeados esta semana: {spentWeek}/{REDEEM_WEEKLY_CAP}
            </Text>
          </View>
          <Text style={styles.pbHint}>
            Las misiones extra pagan en PB. {REDEEM_COST} PB = 1 h de descanso sin culpa.
          </Text>
          <SystemButton
            title={`Canjear ${REDEEM_COST} PB por 1 h de descanso`}
            variant="outline"
            onPress={onRedeem}
            style={{ marginTop: 12 }}
          />
        </SystemWindow>

        <SystemWindow color={colors.cyanDim}>
          <Text style={styles.windowTitle}>REGLAS DEL JUEGO</Text>
          {activeRules.length === 0 ? (
            <>
              <Text style={styles.empty}>
                Aquí van las normas que TÚ te impones y sus consecuencias. El sistema solo las hace
                cumplir.
              </Text>
              <SystemButton
                title="Cargar mis normas del cuaderno"
                onPress={seedTemplate}
                loading={busy}
                style={{ marginTop: 12 }}
              />
            </>
          ) : (
            activeRules.map((r, i) => (
              <View key={r.id} style={styles.ruleRow}>
                <Text style={styles.ruleNumber}>{i + 1})</Text>
                <View style={styles.ruleBody}>
                  <Text style={styles.ruleText}>{r.text}</Text>
                  <Text style={styles.ruleConsequence}>Si la rompo: {r.consequence}</Text>
                  <View style={styles.ruleActions}>
                    <Pressable
                      onPress={() => onBreakRule(r)}
                      style={styles.breakBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Confesar que he roto la norma ${r.text}`}
                    >
                      <Text style={styles.breakBtnText}>LA HE ROTO</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onDeleteRule(r)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Eliminar norma ${r.text}`}
                    >
                      <Ionicons name="trash-outline" size={17} color={colors.textFaint} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
          )}
        </SystemWindow>

        <SystemWindow color={colors.purpleDim} fill={colors.panelDeep}>
          <Text style={[styles.windowTitle, { color: '#A697F0' }]}>CARTA A TU YO DEL FUTURO</Text>
          {!letter ? (
            <>
              <Text style={styles.empty}>
                Escríbele a quien serás. El sistema sellará la carta y la custodiará hasta el día
                señalado.
              </Text>
              <SystemButton
                title="Escribir la carta"
                variant="outline"
                onPress={() => setLetterFormOpen(true)}
                style={{ marginTop: 12 }}
              />
            </>
          ) : letter.opened_at ? (
            <>
              <Text style={styles.letterMeta}>
                Sellada el {letter.sealed_at.slice(0, 10)} · abierta el {letter.opened_at.slice(0, 10)}
              </Text>
              <Text style={styles.letterBody}>{letter.body}</Text>
            </>
          ) : letterOpenable ? (
            <>
              <Text style={styles.letterMeta}>Ha llegado el día. La carta espera.</Text>
              <SystemButton title="Abrir la carta" onPress={onOpenLetter} style={{ marginTop: 12 }} />
            </>
          ) : (
            <Text style={styles.letterMeta}>
              Sellada el {letter.sealed_at.slice(0, 10)}. Se abrirá el {letter.open_at}. Hasta
              entonces, a trabajar.
            </Text>
          )}
        </SystemWindow>

        {/* Tabla de transparencia: los valores salen de game.ts, no pueden desincronizarse del motor. */}
        <SystemWindow color={colors.cyanDim}>
          <Text style={styles.windowTitle}>PUNTUACIÓN DEL SISTEMA</Text>
          <Text style={styles.scoreSection}>ASÍ SE GANA</Text>
          {[
            {
              label: 'Misión (trivial → épica)',
              value: `${DIFFICULTIES.map((d) => XP_BY_DIFFICULTY[d]).join(' · ')} XP`,
            },
            { label: 'Evidencia (foto)', value: `+${Math.round(EVIDENCE_BONUS * 100)} %` },
            { label: 'Racha', value: '+10 % por semana · techo ×1,5' },
            { label: 'Sesión de gimnasio', value: `${GYM_SESSION_XP} XP` },
            { label: 'Récord personal', value: `${PR_XP} XP` },
            { label: 'Página del diario', value: `${JOURNAL_XP} XP` },
            { label: 'Pesarte', value: `${WEIGH_IN_XP} XP` },
            { label: 'Objetivo cumplido', value: `${GOAL_ACHIEVED_XP} XP` },
            {
              label: 'Mazmorra despejada',
              value: `${DUNGEON_CLEAR_XP.E}–${DUNGEON_CLEAR_XP.S} XP · jefe ×${BOSS_MULTIPLIER}`,
            },
            {
              label: 'Misión extra',
              value: `${DIFFICULTIES.map((d) => BONUS_BY_DIFFICULTY[d]).join(' · ')} PB`,
            },
          ].map((row) => (
            <View key={row.label} style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>{row.label}</Text>
              <Text style={styles.scoreValue}>{row.value}</Text>
            </View>
          ))}
          <Text style={[styles.scoreSection, { marginTop: 14 }]}>ASÍ SE PIERDE</Text>
          {[
            {
              label: 'Misión del día sin hacer',
              value: `−${Math.round(PENALTY_FACTOR * 100)} % de su XP · tope −${DAILY_PENALTY_CAP}/día`,
            },
            { label: 'Romper una norma firmada', value: `−${RULE_BREAK_XP} XP + consecuencia` },
            { label: 'Piedra de Protección', value: 'absorbe todo el daño de un día' },
          ].map((row) => (
            <View key={row.label} style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>{row.label}</Text>
              <Text style={[styles.scoreValue, { color: colors.red }]}>{row.value}</Text>
            </View>
          ))}
          <Text style={styles.pbHint}>
            Toda la app puntúa con esta tabla: mismo esfuerzo, misma recompensa. Los PB no dan XP —
            se canjean por descanso ({REDEEM_COST} PB = 1 h, máx. {REDEEM_WEEKLY_CAP}/semana).
          </Text>
        </SystemWindow>
      </ScrollView>

      <Modal visible={ruleFormOpen} transparent animationType="slide" onRequestClose={() => setRuleFormOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>NUEVA NORMA</Text>
            <Text style={styles.label}>La norma</Text>
            <TextInput
              style={styles.input}
              value={ruleText}
              onChangeText={setRuleText}
              placeholder="Ej. Nada de redes sociales antes de las 12"
              placeholderTextColor={colors.textFaint}
            />
            <Text style={styles.label}>Consecuencia si la rompo</Text>
            <TextInput
              style={styles.input}
              value={ruleConsequence}
              onChangeText={setRuleConsequence}
              placeholder="Ej. Correr 5 km"
              placeholderTextColor={colors.textFaint}
            />
            <SystemButton
              title="Firmar la norma"
              onPress={addRule}
              disabled={!ruleText.trim() || !ruleConsequence.trim()}
              style={{ marginTop: 18 }}
            />
            <SystemButton title="Cancelar" variant="outline" onPress={() => setRuleFormOpen(false)} style={{ marginTop: 10 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={letterFormOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setLetterFormOpen(false)}
      >
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>PARA MI YO DEL FUTURO</Text>
              <TextInput
                style={[styles.input, styles.letterInput]}
                value={letterBody}
                onChangeText={setLetterBody}
                placeholder="No sé cómo estarás, ni en qué situación…"
                placeholderTextColor={colors.textFaint}
                multiline
              />
              <Text style={styles.label}>Se abrirá dentro de</Text>
              <View style={styles.chips}>
                {OPEN_OPTIONS.map((o) => (
                  <Pressable
                    key={o.label}
                    onPress={() => setLetterYears(o)}
                    style={[styles.chip, letterYears.label === o.label && styles.chipOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: letterYears.label === o.label }}
                    accessibilityLabel={`Abrir dentro de ${o.label}`}
                  >
                    <Text style={[styles.chipText, letterYears.label === o.label && styles.chipTextOn]}>
                      {o.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <SystemButton
                title="Sellar la carta"
                onPress={onSealLetter}
                loading={busy}
                disabled={!letterBody.trim()}
                style={{ marginTop: 18 }}
              />
              <SystemButton
                title="Cancelar"
                variant="outline"
                onPress={() => setLetterFormOpen(false)}
                style={{ marginTop: 10 }}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  windowTitle: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2.5,
    color: colors.cyan,
    marginBottom: 8,
  },
  pbRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  pbValue: { fontFamily: fonts.brand, fontSize: 28, color: colors.amber },
  pbMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  pbHint: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, marginTop: 6, lineHeight: 17 },
  scoreSection: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textDim,
    marginTop: 4,
    marginBottom: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  scoreLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.text, flexShrink: 1 },
  scoreValue: { fontFamily: fonts.semibold, fontSize: 12, color: colors.cyanText, textAlign: 'right' },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, lineHeight: 19 },
  ruleRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  ruleNumber: { fontFamily: fonts.heading, fontSize: 14, color: colors.cyanText, width: 24 },
  ruleBody: { flex: 1, minWidth: 0 },
  ruleText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, lineHeight: 20 },
  ruleConsequence: { fontFamily: fonts.body, fontSize: 12, color: colors.red, marginTop: 3 },
  ruleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  breakBtn: {
    borderWidth: 1,
    borderColor: colors.redDim,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  breakBtnText: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1.5, color: colors.red },
  letterMeta: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textDim, lineHeight: 19 },
  letterBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    marginTop: 10,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 14, 0.85)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.panel,
    borderTopWidth: 1.5,
    borderTopColor: colors.cyanDim,
    padding: 20,
    paddingBottom: 34,
    maxHeight: '88%',
  },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 15, letterSpacing: 3, color: colors.cyan, marginBottom: 6 },
  label: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.textDim,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cyanDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  letterInput: { minHeight: 140, textAlignVertical: 'top', lineHeight: 21, marginTop: 8 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cyanDim,
    paddingVertical: 9,
    alignItems: 'center',
  },
  chipOn: { backgroundColor: colors.cyanFaint, borderColor: colors.cyan },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textDim },
  chipTextOn: { color: colors.cyan },
});
