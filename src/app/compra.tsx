import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SystemButton } from '@/components/SystemButton';
import { SystemWindow } from '@/components/SystemWindow';
import { useAuth } from '@/lib/auth';
import { addShoppingItems, clearDoneShopping, fetchShoppingItems, setShoppingDone } from '@/lib/body';
import { colors, fonts } from '@/lib/theme';
import type { ShoppingItem } from '@/lib/types';

export default function Compra() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState('');

  const load = useCallback(async () => {
    try {
      setItems(await fetchShoppingItems());
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

  const add = async () => {
    if (!userId || !newItem.trim()) return;
    await addShoppingItems(userId, [{ name: newItem.trim() }]);
    setNewItem('');
    await load();
  };

  const toggle = async (item: ShoppingItem) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    await setShoppingDone(item.id, !item.done);
  };

  const clearDone = async () => {
    await clearDoneShopping();
    await load();
  };

  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
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
          <Text style={styles.title}>LISTA DE LA COMPRA</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={newItem}
            onChangeText={setNewItem}
            placeholder="Añadir artículo…"
            placeholderTextColor={colors.textFaint}
            onSubmitEditing={add}
            returnKeyType="done"
          />
          <Pressable
            onPress={add}
            style={styles.addButton}
            accessibilityRole="button"
            accessibilityLabel="Añadir a la lista"
          >
            <Ionicons name="add" size={22} color={colors.bg} />
          </Pressable>
        </View>

        <SystemWindow color={colors.cyanDim}>
          <Text style={styles.windowTitle}>PENDIENTE · {pending.length}</Text>
          {pending.length === 0 ? (
            <Text style={styles.empty}>Nada pendiente. Generala desde la dieta o añade artículos arriba.</Text>
          ) : (
            pending.map((i) => (
              <Pressable
                key={i.id}
                onPress={() => toggle(i)}
                style={styles.row}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: false }}
                accessibilityLabel={`${i.name}, pendiente`}
              >
                <View style={styles.box} />
                <Text style={styles.rowText}>{i.name}</Text>
                {i.qty ? <Text style={styles.qty}>{i.qty}</Text> : null}
              </Pressable>
            ))
          )}
        </SystemWindow>

        {done.length > 0 ? (
          <>
            <SystemWindow color={colors.line}>
              <Text style={[styles.windowTitle, { color: colors.textFaint }]}>EN EL CARRO · {done.length}</Text>
              {done.map((i) => (
                <Pressable
                  key={i.id}
                  onPress={() => toggle(i)}
                  style={styles.row}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: true }}
                  accessibilityLabel={`${i.name}, en el carro`}
                >
                  <View style={[styles.box, styles.boxDone]}>
                    <Ionicons name="checkmark" size={13} color={colors.cyan} />
                  </View>
                  <Text style={[styles.rowText, styles.rowDone]}>{i.name}</Text>
                </Pressable>
              ))}
            </SystemWindow>
            <SystemButton title="Vaciar comprados" variant="outline" onPress={clearDone} />
          </>
        ) : null}
      </ScrollView>
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
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cyanDim,
    backgroundColor: colors.panel,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addButton: {
    width: 44,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  windowTitle: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2.5,
    color: colors.cyan,
    marginBottom: 6,
  },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  box: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: colors.cyanDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: { backgroundColor: colors.cyanFaint, borderColor: colors.cyan },
  rowText: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  rowDone: { color: colors.textDim, textDecorationLine: 'line-through' },
  qty: { fontFamily: fonts.body, fontSize: 13, color: colors.textFaint },
});
