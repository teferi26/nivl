import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Platform,
  KeyboardAvoidingView,
  Alert,
  Modal,
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
  CARDIO_KINDS,
  CARDIO_ZONES,
  cardioDayState,
  deleteCardio,
  fetchCardio,
  paceOf,
  saveCardio,
  type CardioKind,
  type CardioSession,
  type CardioZone,
} from '@/lib/bodywork';
import { ensureProfile } from '@/lib/data';
import { addDays, dateKey } from '@/lib/dates';
import { awardXp } from '@/lib/engine';
import { CARDIO_DAILY_CAP, cardioXp } from '@/lib/game';
import { colors, fonts } from '@/lib/theme';
import { voice } from '@/lib/voice';

const ICONO: Record<CardioKind, keyof typeof Ionicons.glyphMap> = {
  correr: 'walk-outline',
  nadar: 'water-outline',
  bici: 'bicycle-outline',
  caminar: 'footsteps-outline',
  remo: 'boat-outline',
  otro: 'pulse-outline',
};

const ETIQUETA: Record<CardioKind, string> = {
  correr: 'Correr',
  nadar: 'Nadar',
  bici: 'Bici',
  caminar: 'Caminar',
  remo: 'Remo',
  otro: 'Otro',
};

// La natación se mide en metros y por tiempo; el resto en kilómetros.
const PIDE_DISTANCIA: Record<CardioKind, boolean> = {
  correr: true,
  nadar: true,
  bici: true,
  caminar: true,
  remo: true,
  otro: false,
};

/** "2026-09-17" → "17/09". Solo para la lista. */
const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export default function Cardio() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [sesiones, setSesiones] = useState<CardioSession[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [kind, setKind] = useState<CardioKind>('correr');
  const [zone, setZone] = useState<CardioZone>('Z2');
  const [distancia, setDistancia] = useState('');
  const [duracion, setDuracion] = useState('');
  const [pulso, setPulso] = useState('');
  const [rpe, setRpe] = useState('');
  const [notas, setNotas] = useState('');

  const cargar = useCallback(async () => {
    try {
      setSesiones(await fetchCardio(addDays(dateKey(), -56)));
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const limpiar = () => {
    setDistancia('');
    setDuracion('');
    setPulso('');
    setRpe('');
    setNotas('');
  };

  const guardar = async () => {
    if (!userId || guardando) return;
    const min = Number(duracion.replace(',', '.'));
    if (!min || min <= 0) {
      Alert.alert('Falta la duración', 'Sin minutos no hay sesión que registrar.');
      return;
    }
    const km = distancia.trim() ? Number(distancia.replace(',', '.')) : null;
    if (km !== null && (!Number.isFinite(km) || km <= 0)) {
      Alert.alert('Distancia inválida', 'Escribe los kilómetros con números, por ejemplo 5,2.');
      return;
    }
    const esfuerzo = rpe.trim() ? Number(rpe.replace(',', '.')) : null;
    if (esfuerzo !== null && (esfuerzo < 1 || esfuerzo > 10)) {
      Alert.alert('RPE fuera de rango', 'El esfuerzo va de 1 a 10.');
      return;
    }

    setGuardando(true);
    try {
      const hoy = dateKey();
      // Dos reglas a la vez: corregir una sesión ya registrada no vuelve a
      // premiar (y conserva lo que pagó en su día, o el tope se recalcularía
      // mal), y el total del día no puede pasar de CARDIO_DAILY_CAP.
      const { pagadoHoy, pagadoEsteTipo } = await cardioDayState(hoy, kind);
      const esCorreccion = pagadoEsteTipo !== null;
      const nuevo = esCorreccion ? 0 : cardioXp(kind, pagadoHoy);
      const xp = esCorreccion ? pagadoEsteTipo : nuevo;

      await saveCardio(userId, {
        date: hoy,
        kind,
        distance_km: km,
        duration_min: min,
        avg_hr: pulso.trim() ? Number(pulso) : null,
        rpe: esfuerzo,
        zone,
        notes: notas.trim() || null,
        xp,
      });

      // Se paga `nuevo`, nunca `xp`: `xp` solo conserva en la fila lo que ya se
      // cobró en su momento.
      if (nuevo > 0) {
        const perfil = await ensureProfile(userId);
        await awardXp(perfil, nuevo, 'FUE', 'cardio_session', { kind, km, min, zone });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setAbierto(false);
      limpiar();
      await cargar();
      Alert.alert(
        'Sesión registrada',
        nuevo > 0
          ? `${voice.allDone()}\n+${nuevo} XP a FUE.`
          : esCorreccion
            ? 'El sistema corrige el registro. El XP de esta sesión ya estaba pagado.'
            : `Anotada. Hoy ya has cobrado el máximo de cardio (${CARDIO_DAILY_CAP} XP), pero la sesión cuenta igual para tu estudio.`,
      );
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = (s: CardioSession) =>
    Alert.alert('Eliminar sesión', `${s.kind} del ${s.date}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteCardio(s.id).catch(() => {});
          await cargar();
        },
      },
    ]);

  const km28 = sesiones
    .filter((s) => s.date >= addDays(dateKey(), -28))
    .reduce((a, s) => a + Number(s.distance_km ?? 0), 0);

  // Solo presentación: las otras dos cifras del resumen de 28 días.
  const ultimas28 = sesiones.filter((s) => s.date >= addDays(dateKey(), -28));
  const min28 = ultimas28.reduce((a, s) => a + Number(s.duration_min ?? 0), 0);

  const subtitulo =
    sesiones.length === 0
      ? 'Nada registrado aún. Cada sesión ajusta la siguiente.'
      : `${km28.toFixed(1)} km y ${ultimas28.length} ${ultimas28.length === 1 ? 'sesión' : 'sesiones'} en 28 días.`;

  return (
    <Screen>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            onBack={() => router.back()}
            eyebrow="Cuerpo"
            title="Cardio"
            subtitle={subtitulo}
            action={{ icon: 'add', label: 'Registrar sesión de cardio', onPress: () => setAbierto(true), solid: true }}
          />
        </FadeIn>

        <FadeIn index={1}>
          <Card>
            <StatRow>
              <Stat value={km28.toFixed(1)} unit="km" label="28 días" />
              <Stat value={ultimas28.length} label="Sesiones" />
              <Stat value={Math.round(min28)} unit="min" label="En movimiento" />
            </StatRow>
            <Text style={styles.nota}>
              El volumen semanal no debe subir más de un 10 %. El sistema lo vigila y ajusta tus
              órdenes con estos datos.
            </Text>
          </Card>
        </FadeIn>

        <FadeIn index={2}>
          <Section title="Sesiones" meta={sesiones.length > 0 ? `${sesiones.length}` : undefined}>
            {sesiones.length === 0 ? (
              <Card variant="outline">
                <EmptyState
                  icon="pulse-outline"
                  title="Nada registrado"
                  body="Cada carrera y cada largo que anotes aquí es lo que el sistema usa para calcular tu ritmo y ajustar lo siguiente."
                  action={{ label: 'Registrar la primera', onPress: () => setAbierto(true) }}
                />
              </Card>
            ) : (
              <Card padded={false} style={styles.lista}>
                {sesiones.map((s, i) => {
                  const ritmo = paceOf(s.distance_km, s.duration_min);
                  const datos = [
                    s.distance_km ? `${s.distance_km} km` : null,
                    `${s.duration_min} min`,
                    ritmo ? `${ritmo} min/km` : null,
                    s.zone,
                    s.rpe ? `RPE ${s.rpe}` : null,
                    s.avg_hr ? `${s.avg_hr} ppm` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <Row
                      key={s.id}
                      first={i === 0}
                      leading={<Ionicons name={ICONO[s.kind]} size={18} color={colors.text} />}
                      title={ETIQUETA[s.kind]}
                      detail={s.notes ? `${datos}\n${s.notes}` : datos}
                      trailing={
                        <View style={styles.trailing}>
                          <RowValue strong>{fechaCorta(s.date)}</RowValue>
                          {s.xp_awarded > 0 ? <RowValue tone="accent">+{s.xp_awarded} XP</RowValue> : null}
                        </View>
                      }
                      onLongPress={() => borrar(s)}
                      accessibilityLabel={`${ETIQUETA[s.kind]} del ${s.date}. Mantén pulsado para eliminar.`}
                    />
                  );
                })}
              </Card>
            )}
          </Section>
        </FadeIn>
      </Stagger>

      <Modal visible={abierto} transparent animationType="slide" onRequestClose={() => setAbierto(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            style={styles.backdropTap}
            onPress={() => setAbierto(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetEyebrow}>NUEVA SESIÓN</Text>
              <Text style={styles.sheetTitle}>¿Qué has movido hoy?</Text>

              <Text style={styles.label}>Tipo</Text>
              <ChipWrap>
                {CARDIO_KINDS.map((k) => (
                  <Chip
                    key={k}
                    label={ETIQUETA[k]}
                    icon={ICONO[k]}
                    selected={kind === k}
                    onPress={() => setKind(k)}
                    accessibilityLabel={ETIQUETA[k]}
                  />
                ))}
              </ChipWrap>

              <Text style={styles.label}>Zona</Text>
              <ChipWrap>
                {CARDIO_ZONES.map((z) => (
                  <Chip key={z} label={z} selected={zone === z} onPress={() => setZone(z)} accessibilityLabel={`Zona ${z}`} />
                ))}
              </ChipWrap>
              <Text style={styles.hint}>
                Z2 es el motor: ritmo al que puedes hablar en frases completas. Es el 80 % del
                volumen y el que construye la base.
              </Text>

              <View style={styles.dosColumnas}>
                <View style={styles.columna}>
                  <Text style={styles.label}>Duración (min)</Text>
                  <TextInput
                    style={styles.input}
                    value={duracion}
                    onChangeText={setDuracion}
                    keyboardType="decimal-pad"
                    placeholder="30"
                    placeholderTextColor={colors.textFaint}
                    accessibilityLabel="Duración en minutos"
                  />
                </View>
                {PIDE_DISTANCIA[kind] ? (
                  <View style={styles.columna}>
                    <Text style={styles.label}>Distancia (km)</Text>
                    <TextInput
                      style={styles.input}
                      value={distancia}
                      onChangeText={setDistancia}
                      keyboardType="decimal-pad"
                      placeholder="5,2"
                      placeholderTextColor={colors.textFaint}
                      accessibilityLabel="Distancia en kilómetros"
                    />
                  </View>
                ) : null}
              </View>

              <View style={styles.dosColumnas}>
                <View style={styles.columna}>
                  <Text style={styles.label}>Esfuerzo (RPE 1-10)</Text>
                  <TextInput
                    style={styles.input}
                    value={rpe}
                    onChangeText={setRpe}
                    keyboardType="decimal-pad"
                    placeholder="6"
                    placeholderTextColor={colors.textFaint}
                    accessibilityLabel="Esfuerzo percibido de 1 a 10"
                  />
                </View>
                <View style={styles.columna}>
                  <Text style={styles.label}>Pulso medio</Text>
                  <TextInput
                    style={styles.input}
                    value={pulso}
                    onChangeText={setPulso}
                    keyboardType="number-pad"
                    placeholder="142"
                    placeholderTextColor={colors.textFaint}
                    accessibilityLabel="Pulsaciones medias"
                  />
                </View>
              </View>

              <Text style={styles.label}>Notas</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={notas}
                onChangeText={setNotas}
                multiline
                placeholder="Cómo fue, molestias, terreno"
                placeholderTextColor={colors.textFaint}
                accessibilityLabel="Notas de la sesión"
              />

              <SystemButton title="Registrar sesión" onPress={guardar} loading={guardando} style={{ marginTop: 22 }} />
              <SystemButton title="Cancelar" variant="ghost" onPress={() => setAbierto(false)} style={{ marginTop: 6 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 14 },
  trailing: { alignItems: 'flex-end', gap: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  backdropTap: { flex: 1 },
  sheet: {
    maxHeight: '92%',
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
  dosColumnas: { flexDirection: 'row', gap: 12 },
  columna: { flex: 1 },
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
  multiline: { minHeight: 72, textAlignVertical: 'top' },
});
