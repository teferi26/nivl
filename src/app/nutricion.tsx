import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SystemButton } from '@/components/SystemButton';
import { SystemWindow } from '@/components/SystemWindow';
import { useAuth } from '@/lib/auth';
import {
  fetchNutritionLog,
  fetchNutritionLogs,
  fetchNutritionTarget,
  saveNutritionLog,
  type NutritionLog,
  type NutritionTarget,
} from '@/lib/bodywork';
import { ensureProfile } from '@/lib/data';
import { addDays, dateKey } from '@/lib/dates';
import { awardXp } from '@/lib/engine';
import { NUTRITION_DAY_XP } from '@/lib/game';
import { colors, fonts } from '@/lib/theme';

export default function Nutricion() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const hoy = dateKey();

  const [objetivo, setObjetivo] = useState<NutritionTarget | null>(null);
  const [hoyLog, setHoyLog] = useState<NutritionLog | null>(null);
  const [historial, setHistorial] = useState<NutritionLog[]>([]);
  const [kcal, setKcal] = useState(false);
  const [prote, setProte] = useState(false);
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [obj, log, hist] = await Promise.all([
        fetchNutritionTarget(),
        fetchNutritionLog(hoy),
        fetchNutritionLogs(addDays(hoy, -28)),
      ]);
      setObjetivo(obj);
      setHoyLog(log);
      setHistorial(hist);
      if (log) {
        setKcal(log.hit_kcal);
        setProte(log.hit_protein);
        setNotas(log.notes ?? '');
      }
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  }, [hoy]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const guardar = async () => {
    if (!userId || guardando) return;
    setGuardando(true);
    try {
      // El XP solo se paga la primera vez que se cierra el día cumpliendo
      // ambas cosas: corregir el parte después no vuelve a premiar.
      const yaPagado = hoyLog?.hit_kcal && hoyLog?.hit_protein;
      const merece = kcal && prote && !yaPagado;

      await saveNutritionLog(userId, {
        date: hoy,
        hit_kcal: kcal,
        hit_protein: prote,
        kcal_est: null,
        protein_est: null,
        notes: notas.trim() || null,
      });

      if (merece) {
        const perfil = await ensureProfile(userId);
        await awardXp(perfil, NUTRITION_DAY_XP, 'VIT', 'nutrition_day', { kcal, prote });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      await cargar();
      Alert.alert(
        'Parte registrado',
        merece
          ? `El sistema toma nota. +${NUTRITION_DAY_XP} XP a VIT.`
          : 'El sistema toma nota.',
      );
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      setGuardando(false);
    }
  };

  const dias = historial.length;
  const pctKcal = dias ? Math.round((historial.filter((l) => l.hit_kcal).length / dias) * 100) : 0;
  const pctProte = dias ? Math.round((historial.filter((l) => l.hit_protein).length / dias) * 100) : 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="chevron-back" size={24} color={colors.cyan} />
        </Pressable>
        <Text style={styles.title}>NUTRICIÓN</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.contenido}>
        <SystemWindow>
          <Text style={styles.windowTitle}>OBJETIVO VIGENTE</Text>
          {objetivo ? (
            <>
              <View style={styles.macros}>
                <View>
                  <Text style={styles.macroNum}>{objetivo.kcal}</Text>
                  <Text style={styles.macroLabel}>kcal</Text>
                </View>
                <View>
                  <Text style={styles.macroNum}>{objetivo.protein_g}</Text>
                  <Text style={styles.macroLabel}>proteína g</Text>
                </View>
                {objetivo.carbs_g ? (
                  <View>
                    <Text style={styles.macroNum}>{objetivo.carbs_g}</Text>
                    <Text style={styles.macroLabel}>carbo g</Text>
                  </View>
                ) : null}
                {objetivo.fat_g ? (
                  <View>
                    <Text style={styles.macroNum}>{objetivo.fat_g}</Text>
                    <Text style={styles.macroLabel}>grasa g</Text>
                  </View>
                ) : null}
              </View>
              {objetivo.rationale ? <Text style={styles.motivo}>{objetivo.rationale}</Text> : null}
            </>
          ) : (
            <Text style={styles.vacio}>
              El sistema aún no te ha fijado objetivos. Pídeselos al coach y los calculará con tu
              peso, tu entrenamiento y el ritmo al que quieres bajar.
            </Text>
          )}
        </SystemWindow>

        <SystemWindow>
          <Text style={styles.windowTitle}>PARTE DE HOY</Text>
          <Pressable
            onPress={() => setKcal((v) => !v)}
            style={styles.check}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: kcal }}
            accessibilityLabel="He cumplido las calorías"
          >
            <View style={[styles.caja, kcal && styles.cajaOn]}>
              {kcal ? <Ionicons name="checkmark" size={14} color={colors.bg} /> : null}
            </View>
            <Text style={styles.checkText}>
              He cumplido las calorías{objetivo ? ` (${objetivo.kcal})` : ''}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setProte((v) => !v)}
            style={styles.check}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: prote }}
            accessibilityLabel="He cumplido la proteína"
          >
            <View style={[styles.caja, prote && styles.cajaOn]}>
              {prote ? <Ionicons name="checkmark" size={14} color={colors.bg} /> : null}
            </View>
            <Text style={styles.checkText}>
              He cumplido la proteína{objetivo ? ` (${objetivo.protein_g} g)` : ''}
            </Text>
          </Pressable>

          <TextInput
            style={styles.input}
            value={notas}
            onChangeText={setNotas}
            placeholder="Qué se torció, o qué comiste de más"
            placeholderTextColor={colors.textFaint}
            multiline
            accessibilityLabel="Notas del día"
          />
          <SystemButton title="Registrar el día" onPress={guardar} loading={guardando} style={{ marginTop: 12 }} />
        </SystemWindow>

        <SystemWindow>
          <Text style={styles.windowTitle}>ADHERENCIA · 28 DÍAS</Text>
          {dias ? (
            <>
              <Text style={styles.adherencia}>
                Calorías {pctKcal} % · Proteína {pctProte} % · {dias} partes
              </Text>
              <Text style={styles.hint}>
                Si la adherencia es alta y el peso no se mueve dos semanas, el fallo es del
                objetivo, no tuyo: el sistema lo recalculará.
              </Text>
            </>
          ) : (
            <Text style={styles.vacio}>
              Sin partes todavía. Son dos toques al día y son lo que permite al sistema saber si
              hay que tocar las calorías o apretar.
            </Text>
          )}
        </SystemWindow>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: { fontFamily: fonts.heading, fontSize: 15, letterSpacing: 3, color: colors.text },
  contenido: { padding: 16, paddingBottom: 32 },
  windowTitle: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2.5,
    color: colors.cyanText,
    marginBottom: 10,
  },
  macros: { flexDirection: 'row', gap: 22, flexWrap: 'wrap' },
  macroNum: { fontFamily: fonts.number, fontSize: 20, color: colors.text },
  macroLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.textDim },
  motivo: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textDim,
    marginTop: 10,
  },
  vacio: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.textDim },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  caja: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: colors.cyanDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cajaOn: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  checkText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text, flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 60,
    marginTop: 8,
  },
  adherencia: { fontFamily: fonts.semibold, fontSize: 14, color: colors.cyanText },
  hint: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textFaint,
    marginTop: 8,
  },
});
