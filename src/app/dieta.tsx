import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
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

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => router.back()}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={24} color={colors.cyan} />
          </Pressable>
          <Text style={styles.title}>DIETA SEMANAL</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ir a la lista de la compra"
            onPress={() => router.push('/compra')}
            hitSlop={10}
          >
            <Ionicons name="cart-outline" size={22} color={colors.cyan} />
          </Pressable>
        </View>

        <View style={styles.dayChips}>
          {DAY_CHIPS.map((label, i) => (
            <Pressable
              key={label}
              onPress={() => setDay(i + 1)}
              style={[styles.dayChip, day === i + 1 && styles.dayChipOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: day === i + 1 }}
              accessibilityLabel={`Día ${label}`}
            >
              <Text style={[styles.dayChipText, day === i + 1 && styles.dayChipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <SystemWindow color={colors.cyanDim}>
          {kcalDia > 0 ? (
            <Text style={styles.dayTotal}>
              TOTAL DEL DÍA · {kcalDia} kcal · {proteDia} g de proteína
            </Text>
          ) : null}
          {MEAL_SLOTS.map((slotName) => {
            const existing = daySlots.find((s) => s.slot === slotName);
            return (
              <Pressable
                key={slotName}
                onPress={() => openEditor(slotName)}
                style={styles.mealRow}
                accessibilityRole="button"
                accessibilityLabel={`Editar ${slotName}`}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.mealSlot}>{slotName.toUpperCase()}</Text>
                  {existing ? (
                    <>
                      <Text style={styles.mealDesc}>{existing.description}</Text>
                      {existing.kcal || existing.protein_g ? (
                        <Text style={styles.mealMacros}>
                          {existing.kcal ? `${existing.kcal} kcal` : ''}
                          {existing.kcal && existing.protein_g ? ' · ' : ''}
                          {existing.protein_g ? `${existing.protein_g} g de proteína` : ''}
                        </Text>
                      ) : null}
                      {existing.ingredients ? (
                        <Text style={styles.mealIngredients} numberOfLines={1}>
                          {existing.ingredients}
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <Text style={styles.mealEmpty}>Sin planificar — toca para añadir</Text>
                  )}
                </View>
                <Ionicons name={existing ? 'create-outline' : 'add'} size={18} color={colors.textFaint} />
              </Pressable>
            );
          })}
        </SystemWindow>

        <SystemButton title="Generar lista de la compra" onPress={generateList} loading={busy} />
        <Text style={styles.hint}>
          El sistema junta los ingredientes de las 7 jornadas, elimina duplicados y los envía a la lista.
        </Text>
      </ScrollView>

      <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {editing?.slot.toUpperCase()} · {['L', 'M', 'X', 'J', 'V', 'S', 'D'][day - 1]}
            </Text>
            <Text style={styles.label}>Comida</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Ej. Pollo con arroz y brócoli"
              placeholderTextColor={colors.textFaint}
            />
            <Text style={styles.label}>Ingredientes (separados por comas)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={ingredients}
              onChangeText={setIngredients}
              placeholder="pollo, arroz, brócoli, aceite de oliva"
              placeholderTextColor={colors.textFaint}
              multiline
            />
            <SystemButton title="Guardar" onPress={save} disabled={!description.trim()} style={{ marginTop: 18 }} />
            {editing?.existing ? (
              <SystemButton title="Eliminar" variant="danger" onPress={removeSlot} style={{ marginTop: 10 }} />
            ) : null}
            <SystemButton title="Cancelar" variant="outline" onPress={() => setEditing(null)} style={{ marginTop: 10 }} />
          </View>
        </View>
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
  dayChips: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  dayChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cyanDim,
    paddingVertical: 9,
    alignItems: 'center',
  },
  dayChipOn: { backgroundColor: colors.cyanFaint, borderColor: colors.cyan },
  dayChipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textDim },
  dayChipTextOn: { color: colors.cyan },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  mealSlot: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2, color: colors.cyanText },
  mealDesc: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, marginTop: 2 },
  mealMacros: { fontFamily: fonts.semibold, fontSize: 12, color: colors.cyanText, marginTop: 2 },
  mealIngredients: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 1 },
  dayTotal: {
    fontFamily: fonts.heading,
    fontSize: 11.5,
    letterSpacing: 2,
    color: colors.cyanText,
    marginBottom: 12,
  },
  mealEmpty: { fontFamily: fonts.body, fontSize: 13, color: colors.textFaint, marginTop: 2 },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 10, lineHeight: 17 },
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 14, 0.85)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.panel,
    borderTopWidth: 1.5,
    borderTopColor: colors.cyanDim,
    padding: 20,
    paddingBottom: 34,
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
  multiline: { minHeight: 70, textAlignVertical: 'top' },
});
