// NIVL · Diario — las victorias del día, una por línea.
//
// "Qué logré" era antes un párrafo perdido dentro de "lo vivido". Como lista se
// escribe en diez segundos y se relee de un vistazo, y el coach puede contarla.
// Las filas vacías no molestan: se tiran al guardar (`limpiarVictorias`).

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MAX_LARGO_VICTORIA, VICTORIAS_VISIBLES } from '@/lib/journalmath';
import { colors, fonts } from '@/lib/theme';

interface Props {
  /** Las filas tal cual están en pantalla, vacías incluidas. */
  value: string[];
  onChange: (next: string[]) => void;
}

export function WinsEditor({ value, onChange }: Props) {
  // Siempre hay al menos una fila donde escribir.
  const filas = value.length > 0 ? value : [''];
  // La fila recién añadida toma el foco al montarse: añadir y escribir es un gesto.
  const [nueva, setNueva] = useState<number | null>(null);
  const cabeOtra = filas.length < VICTORIAS_VISIBLES;

  const escribir = (i: number, texto: string) => onChange(filas.map((f, j) => (j === i ? texto : f)));

  const quitar = (i: number) => {
    setNueva(null);
    const resto = filas.filter((_, j) => j !== i);
    onChange(resto.length > 0 ? resto : ['']);
  };

  const anadir = () => {
    if (!cabeOtra) return;
    setNueva(filas.length);
    onChange([...filas, '']);
  };

  return (
    <View>
      {filas.map((fila, i) => {
        const escrita = fila.trim().length > 0;
        return (
          <View key={i} style={styles.fila}>
            <Ionicons
              name={escrita ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={escrita ? colors.accent : colors.accentDim}
            />
            <TextInput
              style={styles.input}
              value={fila}
              onChangeText={(t) => escribir(i, t)}
              placeholder={i === 0 ? 'Algo que hoy hiciste bien' : 'Otra victoria'}
              placeholderTextColor={colors.textFaint}
              maxLength={MAX_LARGO_VICTORIA}
              autoFocus={nueva === i}
              returnKeyType={i === filas.length - 1 && cabeOtra ? 'next' : 'done'}
              // Intro en la última fila abre la siguiente: se encadenan sin soltar el teclado.
              submitBehavior="submit"
              // Soltado el foco, esa fila deja de ser "la nueva": si no, una fila
              // que se montara más tarde en ese índice abriría el teclado sola.
              onBlur={() => setNueva((n) => (n === i ? null : n))}
              onSubmitEditing={() => {
                if (i === filas.length - 1 && cabeOtra && escrita) anadir();
                else Keyboard.dismiss();
              }}
              accessibilityLabel={`Victoria ${i + 1}`}
            />
            {filas.length > 1 || escrita ? (
              <Pressable
                onPress={() => quitar(i)}
                hitSlop={10}
                style={({ pressed }) => [styles.quitar, pressed && styles.pulsado]}
                accessibilityRole="button"
                accessibilityLabel={`Quitar la victoria ${i + 1}`}
              >
                <Ionicons name="close" size={16} color={colors.textFaint} />
              </Pressable>
            ) : null}
          </View>
        );
      })}
      {cabeOtra ? (
        <Pressable
          onPress={anadir}
          hitSlop={6}
          style={({ pressed }) => [styles.anadir, pressed && styles.pulsado]}
          accessibilityRole="button"
          accessibilityLabel="Añadir victoria"
        >
          <Ionicons name="add" size={16} color={colors.accentText} />
          <Text style={styles.anadirTexto}>Añadir victoria</Text>
        </Pressable>
      ) : (
        <Text style={styles.nota}>Cinco a mano ya es un gran día. Lo que registró el sistema aún se puede reclamar.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
    paddingVertical: 13,
  },
  quitar: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pulsado: { opacity: 0.6 },
  anadir: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 12 },
  anadirTexto: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accentText },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 10 },
});
