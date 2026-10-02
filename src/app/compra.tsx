import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  avisar,
  Card,
  Check,
  EmptyState,
  FadeIn,
  ProgressRing,
  Row,
  RowValue,
  Screen,
  ScreenHeader,
  Section,
  Skeleton,
  SkeletonRows,
  Stagger,
  volver,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { addShoppingItems, clearDoneShopping, fetchShoppingItems, setShoppingDone } from '@/lib/body';
import { colors, fonts } from '@/lib/theme';
import type { ShoppingItem } from '@/lib/types';
import { mensajeSistema } from '@/lib/validation';

export default function Compra() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchShoppingItems());
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      setLoaded(true);
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
    try {
      await addShoppingItems(userId, [{ name: newItem.trim() }]);
      setNewItem('');
      await load();
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    }
  };

  const toggle = async (item: ShoppingItem) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    try {
      await setShoppingDone(item.id, !item.done);
    } catch (e) {
      // Optimista: si no se guarda, vuelve a como estaba.
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: item.done } : i)));
      avisar('Error del sistema', mensajeSistema(e));
    }
  };

  const clearDone = async () => {
    try {
      await clearDoneShopping();
      await load();
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    }
  };

  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  // Solo presentación.
  const subtitulo =
    items.length === 0
      ? 'Nada en la lista.'
      : pending.length === 0
        ? 'Todo en el carro. Compra hecha.'
        : `${pending.length} ${pending.length === 1 ? 'artículo pendiente' : 'artículos pendientes'} · ${done.length} en el carro.`;

  return (
    <Screen>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            onBack={() => volver(router)}
            eyebrow="Compra"
            title="Lista de la compra"
            subtitle={loaded ? subtitulo : undefined}
            right={
              loaded && items.length > 0 ? (
                <ProgressRing
                  ratio={done.length / items.length}
                  size={66}
                  stroke={4}
                  label={`${done.length}/${items.length}`}
                  sublabel="carro"
                />
              ) : undefined
            }
          />
        </FadeIn>

        <FadeIn index={1}>
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={newItem}
              onChangeText={setNewItem}
              placeholder="Añadir artículo"
              placeholderTextColor={colors.textFaint}
              onSubmitEditing={add}
              returnKeyType="done"
              accessibilityLabel="Nuevo artículo"
            />
            <Pressable
              onPress={add}
              disabled={!newItem.trim()}
              style={({ pressed }) => [styles.addButton, !newItem.trim() && styles.addButtonOff, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Añadir a la lista"
              accessibilityState={{ disabled: !newItem.trim() }}
            >
              <Ionicons name="add" size={22} color={colors.bg} />
            </Pressable>
          </View>
        </FadeIn>

        {!loaded ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Cargando la lista">
            <Skeleton height={11} width={90} style={styles.skEyebrow} />
            <SkeletonRows rows={4} />
          </View>
        ) : (
          <>
            <FadeIn index={2}>
              <Section title="Pendiente" meta={pending.length > 0 ? `${pending.length}` : undefined}>
                {pending.length === 0 ? (
                  <Card variant="outline">
                    <EmptyState
                      compact
                      icon="cart-outline"
                      title="Nada pendiente"
                      body="Genera la lista desde la dieta o añade artículos arriba."
                      action={{ label: 'Ir a la dieta', onPress: () => router.push('/dieta') }}
                    />
                  </Card>
                ) : (
                  <Card padded={false} style={styles.lista}>
                    {pending.map((i, idx) => (
                      <Row
                        key={i.id}
                        first={idx === 0}
                        leading={<Check checked={false} size={24} />}
                        title={i.name}
                        trailing={i.qty ? <RowValue>{i.qty}</RowValue> : undefined}
                        onPress={() => toggle(i)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: false }}
                        accessibilityLabel={`${i.name}, pendiente`}
                      />
                    ))}
                  </Card>
                )}
              </Section>
            </FadeIn>

            {done.length > 0 ? (
              <FadeIn index={3}>
                <Section
                  title="En el carro"
                  meta={`${done.length}`}
                  tone="accent"
                  action={{ label: 'Vaciar comprados', icon: 'trash-outline', onPress: clearDone }}
                >
                  <Card padded={false} style={styles.lista}>
                    {done.map((i, idx) => (
                      <Row
                        key={i.id}
                        first={idx === 0}
                        leading={<Check checked size={24} />}
                        title={i.name}
                        done
                        trailing={i.qty ? <RowValue>{i.qty}</RowValue> : undefined}
                        onPress={() => toggle(i)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: true }}
                        accessibilityLabel={`${i.name}, en el carro`}
                      />
                    ))}
                  </Card>
                </Section>
              </FadeIn>
            ) : null}
          </>
        )}
      </Stagger>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skEyebrow: { marginBottom: 12, marginTop: 8 },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 22 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addButton: {
    width: 50,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonOff: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
});
