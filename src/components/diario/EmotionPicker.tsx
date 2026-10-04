// NIVL · Diario: ponerle nombre a lo que sentiste.
//
// Un 3 de 5 no dice nada; "frustrado" sí, y además se puede contar: el Archivo
// y el coach ven qué palabras se repiten. Dos filas, lo que empuja y lo que
// pesa, con el vocabulario de `journalmath.ts` (el coach tiene su espejo).
// Chips con estado (marco de 2 la marcada, sin invertir); el Chip ya vibra al
// marcar (Lote 0), aquí no se vuelve a vibrar.

import { StyleSheet, Text, View } from 'react-native';
import { Chip, ChipWrap } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { EMOCIONES, MAX_EMOCIONES, type Valencia } from '@/lib/journalmath';

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
    onChange(marcada ? value.filter((x) => x !== id) : [...value, id]);
  };

  return (
    <View>
      {FILAS.map((fila) => (
        <View key={fila.valence} style={styles.fila} accessibilityLabel={fila.rotulo}>
          <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
            {fila.rotulo}
          </Text>
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
      <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
        {lleno
          ? `Tope de ${MAX_EMOCIONES}. Quita una para marcar otra.`
          : 'Ponle nombre: un 3 no dice nada, «frustrado» sí.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { marginTop: space.s4 },
  rotulo: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
    marginBottom: space.s2,
  },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: space.s3,
  },
});
