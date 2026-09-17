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
import { SafeAreaView } from 'react-native-safe-area-context';
import { SystemButton } from '@/components/SystemButton';
import { SystemWindow } from '@/components/SystemWindow';
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

const ICONO: Record<CardioKind, string> = {
  correr: 'walk-outline',
  nadar: 'water-outline',
  bici: 'bicycle-outline',
  caminar: 'footsteps-outline',
  remo: 'boat-outline',
  otro: 'pulse-outline',
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

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="chevron-back" size={24} color={colors.accent} />
        </Pressable>
        <Text style={styles.title}>MOTOR AERÓBICO</Text>
        <Pressable
          onPress={() => setAbierto(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Registrar sesión de cardio"
        >
          <Ionicons name="add" size={24} color={colors.accent} />
        </Pressable>
      </View>

      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={styles.contenido}>
        <SystemWindow>
          <Text style={styles.windowTitle}>ÚLTIMOS 28 DÍAS</Text>
          <View style={styles.kpis}>
            <View>
              <Text style={styles.kpiNum}>{km28.toFixed(1)}</Text>
              <Text style={styles.kpiLabel}>km</Text>
            </View>
            <View>
              <Text style={styles.kpiNum}>
                {sesiones.filter((s) => s.date >= addDays(dateKey(), -28)).length}
              </Text>
              <Text style={styles.kpiLabel}>sesiones</Text>
            </View>
          </View>
          <Text style={styles.hint}>
            El volumen semanal no debe subir más de un 10 %. El sistema lo vigila y ajusta tus
            órdenes con estos datos.
          </Text>
        </SystemWindow>

        {sesiones.length === 0 ? (
          <SystemWindow>
            <Text style={styles.vacio}>
              Nada registrado. Cada carrera y cada largo que anotes aquí es lo que el sistema usa
              para calcular tu ritmo y ajustar lo siguiente.
            </Text>
          </SystemWindow>
        ) : (
          sesiones.map((s) => {
            const ritmo = paceOf(s.distance_km, s.duration_min);
            return (
              <Pressable
                key={s.id}
                onLongPress={() => borrar(s)}
                accessibilityRole="button"
                accessibilityLabel={`${s.kind} del ${s.date}`}
                accessibilityHint="Mantén pulsado para eliminar"
              >
                <SystemWindow>
                  <View style={styles.fila}>
                    <Ionicons name={ICONO[s.kind] as never} size={18} color={colors.accent} />
                    <Text style={styles.tipo}>{s.kind.toUpperCase()}</Text>
                    <Text style={styles.fecha}>{s.date}</Text>
                  </View>
                  <Text style={styles.datos}>
                    {s.distance_km ? `${s.distance_km} km · ` : ''}
                    {s.duration_min} min
                    {ritmo ? ` · ${ritmo} min/km` : ''}
                    {` · ${s.zone}`}
                    {s.rpe ? ` · RPE ${s.rpe}` : ''}
                    {s.avg_hr ? ` · ${s.avg_hr} ppm` : ''}
                  </Text>
                  {s.notes ? <Text style={styles.notas}>{s.notes}</Text> : null}
                </SystemWindow>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Modal visible={abierto} transparent animationType="slide" onRequestClose={() => setAbierto(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" style={styles.sheet} contentContainerStyle={{ padding: 18 }}>
            <Text style={styles.sheetTitle}>REGISTRAR SESIÓN</Text>

            <Text style={styles.label}>Tipo</Text>
            <View style={styles.chips}>
              {CARDIO_KINDS.map((k) => (
                <Pressable
                  key={k}
                  onPress={() => setKind(k)}
                  style={[styles.chip, kind === k && styles.chipOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: kind === k }}
                  accessibilityLabel={k}
                >
                  <Text style={[styles.chipText, kind === k && styles.chipTextOn]}>{k}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Zona</Text>
            <View style={styles.chips}>
              {CARDIO_ZONES.map((z) => (
                <Pressable
                  key={z}
                  onPress={() => setZone(z)}
                  style={[styles.chip, zone === z && styles.chipOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: zone === z }}
                  accessibilityLabel={`Zona ${z}`}
                >
                  <Text style={[styles.chipText, zone === z && styles.chipTextOn]}>{z}</Text>
                </Pressable>
              ))}
            </View>
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
              style={[styles.input, { height: 64 }]}
              value={notas}
              onChangeText={setNotas}
              multiline
              placeholder="Cómo fue, molestias, terreno…"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Notas de la sesión"
            />

            <SystemButton title="Registrar" onPress={guardar} loading={guardando} style={{ marginTop: 16 }} />
            <SystemButton
              title="Cancelar"
              variant="outline"
              onPress={() => setAbierto(false)}
              style={{ marginTop: 8 }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
    color: colors.accentText,
    marginBottom: 10,
  },
  kpis: { flexDirection: 'row', gap: 28 },
  kpiNum: { fontFamily: fonts.number, fontSize: 22, color: colors.text },
  kpiLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.textDim },
  hint: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textFaint,
    marginTop: 10,
  },
  vacio: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.textDim },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  tipo: { fontFamily: fonts.heading, fontSize: 12, letterSpacing: 1.5, color: colors.text, flex: 1 },
  fecha: { fontFamily: fonts.number, fontSize: 11, color: colors.textFaint },
  datos: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accentText },
  notas: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', backgroundColor: colors.panel, borderTopWidth: 1.5, borderTopColor: colors.accentDim },
  sheetTitle: {
    fontFamily: fonts.heading,
    fontSize: 14,
    letterSpacing: 2.5,
    color: colors.accentText,
    marginBottom: 14,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textDim,
    marginTop: 12,
    marginBottom: 6,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.line, paddingVertical: 6, paddingHorizontal: 10 },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentFaint },
  chipText: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim },
  chipTextOn: { color: colors.accentText },
  dosColumnas: { flexDirection: 'row', gap: 12 },
  columna: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
