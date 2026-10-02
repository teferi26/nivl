import { vibrar } from '@/design/haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { DescargoSalud } from '@/components/DescargoSalud';
import { SystemButton } from '@/components/SystemButton';
import { XPBar } from '@/components/XPBar';
import {
  avisar,
  Card,
  Check,
  EmptyState,
  FadeIn,
  Row,
  RowValue,
  Screen,
  ScreenHeader,
  Section,
  Skeleton,
  SkeletonRows,
  Stagger,
  Stat,
  StatRow,
  volver,
} from '@/components/ui';
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
import { propagarActo } from '@/lib/links';
import { mensajeSistema } from '@/lib/validation';
import { deMisiones, desgloseXp } from '@/lib/voice';
import { NUTRITION_DAY_XP } from '@/lib/game';
import { supabase } from '@/lib/supabase';
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
  const [loaded, setLoaded] = useState(false);

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
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      setLoaded(true);
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
      //
      // El recibo es el evento del día, no el parte guardado: mirando el parte,
      // desmarcar-guardar-marcar-guardar pagaba 10 XP en cada vuelta, sin fin.
      const { count: recibos } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'nutrition_day')
        .gte('created_at', new Date(`${hoy}T00:00:00`).toISOString());
      const merece = kcal && prote && !recibos;

      await saveNutritionLog(userId, {
        date: hoy,
        hit_kcal: kcal,
        hit_protein: prote,
        // Si el coach estimó el día desde el chat, guardar aquí no lo borra.
        kcal_est: hoyLog?.kcal_est ?? null,
        protein_est: hoyLog?.protein_est ?? null,
        notes: notas.trim() || null,
      });

      if (merece) {
        const perfil = await ensureProfile(userId);
        await awardXp(perfil, NUTRITION_DAY_XP, 'VIT', 'nutrition_day', { kcal, prote, date: hoy });
        vibrar('mision');
      }

      // Un solo gesto: el parte marca solo la misión de registrar comidas. Los
      // 10 XP de arriba son por CUMPLIR los dos objetivos, no por registrar,
      // así que aquí no hay doble pago que evitar.
      const eco = await propagarActo(await ensureProfile(userId), 'nutricion', hoy);

      await cargar();
      // Las dos partes pueden pagar a la vez: callar la misión infravaloraba el aviso.
      const desglose = desgloseXp([
        { xp: eco.xp, de: deMisiones(eco.marcadas) },
        { xp: merece ? NUTRITION_DAY_XP : 0, de: 'a VIT por cumplir kcal y proteína' },
      ]);
      avisar('Parte registrado', desglose ? `El sistema toma nota. ${desglose}` : 'El sistema toma nota.');
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      setGuardando(false);
    }
  };

  const dias = historial.length;
  const pctKcal = dias ? Math.round((historial.filter((l) => l.hit_kcal).length / dias) * 100) : 0;
  const pctProte = dias ? Math.round((historial.filter((l) => l.hit_protein).length / dias) * 100) : 0;

  // Solo presentación.
  const cumplidosHoy = (kcal ? 1 : 0) + (prote ? 1 : 0);
  const diaPagado = !!(hoyLog?.hit_kcal && hoyLog?.hit_protein);
  const subtitulo = objetivo
    ? `${objetivo.kcal} kcal y ${objetivo.protein_g} g de proteína al día.`
    : 'Sin objetivo fijado todavía.';

  return (
    <Screen>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader onBack={() => volver(router)} eyebrow="Cuerpo" title="Nutrición" subtitle={loaded ? subtitulo : undefined} />
        </FadeIn>

        {!loaded ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Cargando tu nutrición">
            <Skeleton height={76} style={styles.skCard} />
            <Skeleton height={11} width={110} style={styles.skEyebrow} />
            <SkeletonRows rows={3} />
          </View>
        ) : (
          <>
            <FadeIn index={1}>
              {objetivo ? (
                <Card>
                  <StatRow>
                    <Stat value={objetivo.kcal} label="kcal" />
                    <Stat value={objetivo.protein_g} unit="g" label="Proteína" />
                    {objetivo.carbs_g ? <Stat value={objetivo.carbs_g} unit="g" label="Carbos" /> : null}
                    {objetivo.fat_g ? <Stat value={objetivo.fat_g} unit="g" label="Grasa" /> : null}
                  </StatRow>
                  {objetivo.rationale ? <Text style={styles.motivo}>{objetivo.rationale}</Text> : null}
                </Card>
              ) : (
                <Card variant="outline">
                  <EmptyState
                    compact
                    icon="nutrition-outline"
                    title="Sin objetivo fijado"
                    body="Pídeselo al coach: lo calculará con tu peso, tu entrenamiento y el ritmo al que quieres bajar."
                    action={{ label: 'Hablar con el coach', onPress: () => router.push('/(tabs)/coach') }}
                  />
                </Card>
              )}
            </FadeIn>

            <FadeIn index={2}>
              <Section title="Parte de hoy" meta={`${cumplidosHoy}/2`} tone={cumplidosHoy === 2 ? 'accent' : 'dim'}>
                <Card padded={false} style={styles.lista}>
                  <Row
                    first
                    leading={<Check checked={kcal} />}
                    title="Calorías"
                    detail={objetivo ? `Objetivo: ${objetivo.kcal} kcal` : 'Sin objetivo fijado'}
                    trailing={kcal ? <RowValue tone="accent">Cumplido</RowValue> : undefined}
                    onPress={() => setKcal((v) => !v)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: kcal }}
                    accessibilityLabel="He cumplido las calorías"
                  />
                  <Row
                    leading={<Check checked={prote} />}
                    title="Proteína"
                    detail={objetivo ? `Objetivo: ${objetivo.protein_g} g` : 'Sin objetivo fijado'}
                    trailing={prote ? <RowValue tone="accent">Cumplido</RowValue> : undefined}
                    onPress={() => setProte((v) => !v)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: prote }}
                    accessibilityLabel="He cumplido la proteína"
                  />
                </Card>
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
                <Text style={styles.nota}>
                  {diaPagado
                    ? 'El día ya está registrado y pagado. Puedes corregir el parte sin que vuelva a premiar.'
                    : `Cumplir las dos cosas paga +${NUTRITION_DAY_XP} XP a VIT.`}
                </Text>
              </Section>
            </FadeIn>

            <FadeIn index={3}>
              <Section title="Adherencia · 28 días" meta={dias ? `${dias} ${dias === 1 ? 'parte' : 'partes'}` : undefined}>
                {dias ? (
                  <Card>
                    <StatRow>
                      <Stat value={pctKcal} unit="%" label="Calorías" tone={pctKcal >= 80 ? 'accent' : 'text'} />
                      <Stat value={pctProte} unit="%" label="Proteína" tone={pctProte >= 80 ? 'accent' : 'text'} />
                      <Stat value={dias} label="Partes" />
                    </StatRow>
                    <View style={styles.barras}>
                      <View style={styles.barra}>
                        <Text style={styles.barraRotulo}>CALORÍAS</Text>
                        <XPBar ratio={pctKcal / 100} height={5} />
                      </View>
                      <View style={styles.barra}>
                        <Text style={styles.barraRotulo}>PROTEÍNA</Text>
                        <XPBar ratio={pctProte / 100} height={5} />
                      </View>
                    </View>
                    <Text style={styles.nota}>
                      Si la adherencia es alta y el peso no se mueve dos semanas, el fallo es del
                      objetivo, no tuyo: el sistema lo recalculará.
                    </Text>
                  </Card>
                ) : (
                  <Card variant="outline">
                    <EmptyState
                      compact
                      icon="analytics-outline"
                      title="Sin partes todavía"
                      body="Son dos toques al día y son lo que permite al sistema saber si hay que tocar las calorías o apretar."
                    />
                  </Card>
                )}
              </Section>
            </FadeIn>
          <DescargoSalud />
          </>
        )}
      </Stagger>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skCard: { marginBottom: 10 },
  skEyebrow: { marginBottom: 12, marginTop: 16 },
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  motivo: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textDim, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 10 },
  barras: { marginTop: 16, gap: 10 },
  barra: { gap: 6 },
  barraRotulo: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1.8, color: colors.textFaint },
});
