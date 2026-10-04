// NIVL · Diario: las victorias del día, una por línea.
//
// "Qué logré" era antes un párrafo perdido dentro de "lo vivido". Como lista se
// escribe en diez segundos y se relee de un vistazo, y el coach puede contarla.
// Las filas vacías no molestan: se tiran al guardar (`limpiarVictorias`).

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { MAX_LARGO_VICTORIA, VICTORIAS_VISIBLES } from '@/lib/journalmath';

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
              color={escrita ? ink.ink10 : ink.ink4}
            />
            <TextInput
              style={styles.input}
              value={fila}
              onChangeText={(t) => escribir(i, t)}
              placeholder={i === 0 ? 'Algo que hoy hiciste bien' : 'Otra victoria'}
              placeholderTextColor={ink.ink6}
              selectionColor={ink.ink10}
              cursorColor={ink.ink10}
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
                style={({ pressed }) => [styles.quitar, pressed && styles.pulsado]}
                accessibilityRole="button"
                accessibilityLabel={`Quitar la victoria ${i + 1}`}
              >
                <Ionicons name="close" size={18} color={ink.ink6} />
              </Pressable>
            ) : null}
          </View>
        );
      })}
      {cabeOtra ? (
        <Pressable
          onPress={anadir}
          style={({ pressed }) => [styles.anadir, pressed && styles.pulsado]}
          accessibilityRole="button"
          accessibilityLabel="Añadir victoria"
        >
          <Ionicons name="add" size={16} color={ink.ink9} />
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
    gap: space.s3,
    minHeight: 48,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: ink.ink3,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: ink.ink9,
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    paddingVertical: space.s3,
    // En la web el navegador pinta su propio anillo de foco.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  quitar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -space.s3 },
  pulsado: { opacity: 0.7 },
  anadir: { flexDirection: 'row', alignItems: 'center', gap: space.s2, alignSelf: 'flex-start', minHeight: 44 },
  anadirTexto: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink9,
  },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: space.s3,
  },
});
