import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Platform,
  KeyboardAvoidingView,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SystemButton } from '@/components/SystemButton';
import {
  Card,
  Chip,
  ChipRow,
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
  addShoppingItems,
  deleteMealSlot,
  fetchMealSlots,
  ingredientsFromPlan,
  MEAL_SLOTS,
  upsertMealSlot,
} from '@/lib/body';
import { isoWeekday } from '@/lib/dates';
import { colors, fonts } from '@/lib/theme';
import type { MealSlot, MealSlotName } from '@/lib/types';

const DAY_CHIPS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const SLOT_LABEL: Record<MealSlotName, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
  snack: 'Snack',
};

export default function Dieta() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [slots, setSlots] = useState<MealSlot[]>([]);
  const [day, setDay] = useState(isoWeekday(new Date()));
  const [editing, setEditing] = useState<{ slot: MealSlotName; existing: MealSlot | null } | null>(null);
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSlots(await fetchMealSlots());
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  }, []);

  // Al volver a la pantalla, no solo al montarla: estas dos se alimentan de
  // datos que cambian desde otras pantallas.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const daySlots = slots.filter((s) => s.day_of_week === day);
  // Solo suman las comidas que el coach ha planificado con macros; las escritas
  // a mano no llevan cifras y no deben falsear el total del día.
  const kcalDia = daySlots.reduce((a, s) => a + (s.kcal ?? 0), 0);
  const proteDia = daySlots.reduce((a, s) => a + (s.protein_g ?? 0), 0);

  const openEditor = (slotName: MealSlotName) => {
    const existing = daySlots.find((s) => s.slot === slotName) ?? null;
    setDescription(existing?.description ?? '');
    setIngredients(existing?.ingredients ?? '');
    setEditing({ slot: slotName, existing });
  };

  const save = async () => {
    if (!userId || !editing || !description.trim()) return;
    await upsertMealSlot(userId, {
      id: editing.existing?.id,
      day_of_week: day,
      slot: editing.slot,
      description: description.trim(),
      ingredients: ingredients.trim() || null,
    });
    setEditing(null);
    await load();
  };

  const removeSlot = async () => {
    if (!editing?.existing) return;
    await deleteMealSlot(editing.existing.id);
    setEditing(null);
    await load();
  };

  const generateList = async () => {
    if (!userId || busy) return;
    const items = ingredientsFromPlan(slots);
    if (items.length === 0) {
      Alert.alert(
        'Sin ingredientes',
        'Añade ingredientes a tus comidas (separados por comas) y el sistema generará la lista.',
      );
      return;
    }
    setBusy(true);
    try {
      await addShoppingItems(userId, items.map((name) => ({ name })));
      Alert.alert('Lista generada', `${items.length} ingredientes enviados a la lista de la compra.`, [
        { text: 'Ver lista', onPress: () => router.push('/compra') },
        { text: 'OK' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  // Solo presentación.
  const nombreDia = DAY_NAMES[day - 1] ?? '';
  const esHoy = day === isoWeekday(new Date());
  const subtitulo =
    kcalDia > 0
      ? `${nombreDia}: ${kcalDia} kcal y ${proteDia} g de proteína planificados.`
      : daySlots.length > 0
        ? `${nombreDia}: ${daySlots.length} ${daySlots.length === 1 ? 'comida' : 'comidas'} planificadas.`
        : `${nombreDia} sin planificar todavía.`;

  return (
    <Screen>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            onBack={() => router.back()}
            eyebrow="Cuerpo"
            title="Dieta"
            subtitle={subtitulo}
            action={{ icon: 'cart-outline', label: 'Ir a la lista de la compra', onPress: () => router.push('/compra') }}
          />
        </FadeIn>

        <FadeIn index={1}>
          <ChipRow style={styles.dias}>
            {DAY_CHIPS.map((label, i) => (
              <Chip
                key={label}
                label={label}
                selected={day === i + 1}
                onPress={() => setDay(i + 1)}
                accessibilityLabel={DAY_NAMES[i]}
              />
            ))}
          </ChipRow>
        </FadeIn>

        <FadeIn index={2}>
          <Card>
            <StatRow>
              <Stat value={kcalDia > 0 ? kcalDia : '—'} label="kcal" />
              <Stat value={proteDia > 0 ? proteDia : '—'} unit={proteDia > 0 ? 'g' : undefined} label="Proteína" />
              <Stat
                value={`${daySlots.length}/${MEAL_SLOTS.length}`}
                label="Comidas"
                tone={daySlots.length === MEAL_SLOTS.length ? 'accent' : 'text'}
              />
            </StatRow>
            {kcalDia === 0 && daySlots.length > 0 ? (
              <Text style={styles.nota}>Las comidas escritas a mano no llevan macros; solo suman las que planifica el coach.</Text>
            ) : null}
          </Card>
        </FadeIn>

        <FadeIn index={3}>
          <Section title={esHoy ? `Hoy · ${nombreDia}` : nombreDia} meta={`${daySlots.length}/${MEAL_SLOTS.length}`}>
            <Card padded={false} style={styles.lista}>
              {MEAL_SLOTS.map((slotName, i) => {
                const existing = daySlots.find((s) => s.slot === slotName);
                const macros = existing
                  ? [existing.kcal ? `${existing.kcal} kcal` : null, existing.protein_g ? `${existing.protein_g} g prot.` : null]
                      .filter(Boolean)
                      .join(' · ')
                  : '';
                return (
                  <Row
                    key={slotName}
                    first={i === 0}
                    leading={<Text style={styles.slotLetra}>{SLOT_LABEL[slotName].slice(0, 1)}</Text>}
                    title={existing ? existing.description : SLOT_LABEL[slotName]}
                    muted={!existing}
                    detail={
                      existing
                        ? [SLOT_LABEL[slotName], existing.ingredients].filter(Boolean).join(' · ')
                        : 'Sin planificar. Toca para añadir.'
                    }
                    trailing={macros ? <RowValue tone="accent">{macros}</RowValue> : undefined}
                    chevron
                    onPress={() => openEditor(slotName)}
                    accessibilityLabel={`${existing ? 'Editar' : 'Planificar'} ${SLOT_LABEL[slotName].toLowerCase()} del ${nombreDia.toLowerCase()}`}
                  />
                );
              })}
            </Card>
          </Section>
        </FadeIn>

        <FadeIn index={4}>
          <Section title="Lista de la compra">
            <SystemButton title="Generar lista de la compra" onPress={generateList} loading={busy} icon="cart-outline" />
            <Text style={styles.nota}>
              El sistema junta los ingredientes de las 7 jornadas, elimina duplicados y los envía a la lista.
            </Text>
          </Section>
        </FadeIn>
      </Stagger>

      <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            style={styles.backdropTap}
            onPress={() => setEditing(null)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>
              {editing ? SLOT_LABEL[editing.slot].toUpperCase() : ''} · {nombreDia.toUpperCase()}
            </Text>
            <Text style={styles.sheetTitle}>{editing?.existing ? 'Ajusta la comida' : '¿Qué vas a comer?'}</Text>
            <Text style={styles.label}>Comida</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Ej. Pollo con arroz y brócoli"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Descripción de la comida"
            />
            <Text style={styles.label}>Ingredientes (separados por comas)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={ingredients}
              onChangeText={setIngredients}
              placeholder="pollo, arroz, brócoli, aceite de oliva"
              placeholderTextColor={colors.textFaint}
              multiline
              accessibilityLabel="Ingredientes separados por comas"
            />
            <SystemButton title="Guardar" onPress={save} disabled={!description.trim()} style={{ marginTop: 22 }} />
            {editing?.existing ? (
              <SystemButton title="Eliminar" variant="danger" onPress={removeSlot} style={{ marginTop: 10 }} />
            ) : null}
            <SystemButton title="Cancelar" variant="ghost" onPress={() => setEditing(null)} style={{ marginTop: 6 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dias: { marginBottom: 16 },
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  slotLetra: {
    width: 28,
    height: 28,
    lineHeight: 28,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.accentDim,
    fontFamily: fonts.brand,
    fontSize: 13,
    color: colors.text,
  },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 10 },
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
  label: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
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
  multiline: { minHeight: 72, textAlignVertical: 'top' },
});
