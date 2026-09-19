// NIVL · Diario — ponerle nombre a lo que sentiste.
//
// Un 3 de 5 no dice nada; "frustrado" sí, y además se puede contar: el Archivo
// y el coach ven qué palabras se repiten. Dos filas, lo que empuja y lo que
// pesa, con el vocabulario de `journalmath.ts` (el coach tiene su espejo).

import * as Haptics from 'expo-haptics';
import { StyleSheet, Text, View } from 'react-native';
import { Chip, ChipWrap } from '@/components/ui';
import { EMOCIONES, MAX_EMOCIONES, type Valencia } from '@/lib/journalmath';
import { colors, fonts } from '@/lib/theme';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

const FILAS: { valence: Valencia; rotulo: string }[] = [
  { valence: 'up', rotulo: 'Lo que empuja' },
  { valence: 'down', rotulo: 'Lo que pesa' },
];

export function EmotionPicker({ value, onChange }: Props) {
  const lleno = value.length >= MAX_EMOCIONES;

  const alternar = (id: string) => {
    const marcada = value.includes(id);
    if (!marcada && lleno) return;
    Haptics.selectionAsync().catch(() => {});
    onChange(marcada ? value.filter((x) => x !== id) : [...value, id]);
  };

  return (
    <View>
      {FILAS.map((fila) => (
        <View key={fila.valence} style={styles.fila}>
          <Text style={styles.rotulo}>{fila.rotulo}</Text>
          <ChipWrap>
            {EMOCIONES.filter((e) => e.valence === fila.valence).map((e) => {
              const marcada = value.includes(e.id);
              return (
                <Chip
                  key={e.id}
                  small
                  label={e.label}
                  selected={marcada}
                  disabled={!marcada && lleno}
                  onPress={() => alternar(e.id)}
                  accessibilityLabel={`${e.label}, ${marcada ? 'marcada' : 'sin marcar'}`}
                />
              );
            })}
          </ChipWrap>
        </View>
      ))}
      <Text style={styles.nota}>
        {lleno
          ? `Tope de ${MAX_EMOCIONES}. Quita una para marcar otra.`
          : 'Ponle nombre: un 3 no dice nada, «frustrado» sí.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { marginTop: 14 },
  rotulo: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginBottom: 8 },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 10 },
});
