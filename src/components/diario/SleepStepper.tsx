// NIVL · Diario — horas dormidas anoche.
//
// Un contador de media en media hora: escribir "7,5" con el teclado numérico
// español (coma, punto, nada) es justo la fricción que hace que el dato no se
// apunte. Arranca sin valor —no registrar no es lo mismo que dormir 7 horas— y
// el primer toque lo deja en 7.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SUENO_MAX, SUENO_MIN, formatoDecimal, formatoHoras, pasoDeSueno } from '@/lib/journalmath';
import { colors, fonts } from '@/lib/theme';

interface Props {
  value: number | null;
  onChange: (next: number | null) => void;
}

export function SleepStepper({ value, onChange }: Props) {
  const mover = (dir: 1 | -1) => {
    const next = pasoDeSueno(value, dir);
    if (next === value) return;
    Haptics.selectionAsync().catch(() => {});
    onChange(next);
  };
  const enMinimo = value !== null && value <= SUENO_MIN;
  const enMaximo = value !== null && value >= SUENO_MAX;

  return (
    <View>
      <View
        style={styles.fila}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Horas dormidas anoche"
        accessibilityValue={{ text: value === null ? 'Sin registrar' : formatoHoras(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(ev) => mover(ev.nativeEvent.actionName === 'increment' ? 1 : -1)}
      >
        <Pressable
          onPress={() => mover(-1)}
          disabled={enMinimo}
          hitSlop={6}
          style={({ pressed }) => [styles.boton, enMinimo && styles.off, pressed && styles.pulsado]}
          accessibilityRole="button"
          accessibilityLabel="Media hora menos de sueño"
          accessibilityState={{ disabled: enMinimo }}
        >
          <Ionicons name="remove" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.centro}>
          {/* La cifra en Cinzel y la unidad en Outfit: Cinzel no tiene minúsculas
              y "7,5 H" se leería como otra cosa. */}
          <View style={styles.cifra}>
            <Text style={[styles.valor, value === null && styles.valorVacio]}>
              {value === null ? '—' : formatoDecimal(value)}
            </Text>
            {value !== null ? <Text style={styles.unidad}>h</Text> : null}
          </View>
        </View>
        <Pressable
          onPress={() => mover(1)}
          disabled={enMaximo}
          hitSlop={6}
          style={({ pressed }) => [styles.boton, enMaximo && styles.off, pressed && styles.pulsado]}
          accessibilityRole="button"
          accessibilityLabel="Media hora más de sueño"
          accessibilityState={{ disabled: enMaximo }}
        >
          <Ionicons name="add" size={20} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.pie}>
        <Text style={styles.nota}>{value === null ? 'Sin registrar. Toca + o −.' : 'Anoche.'}</Text>
        {value !== null ? (
          <Pressable
            onPress={() => onChange(null)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Quitar las horas de sueño"
          >
            <Text style={styles.quitar}>Quitar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  boton: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  off: { opacity: 0.3 },
  pulsado: { opacity: 0.6 },
  centro: {
    flex: 1,
    height: 48,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cifra: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  valor: { fontFamily: fonts.number, fontSize: 22, letterSpacing: 0.5, color: colors.text },
  valorVacio: { color: colors.textFaint },
  unidad: { fontFamily: fonts.heading, fontSize: 12, letterSpacing: 1, color: colors.textDim },
  pie: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  nota: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  quitar: { fontFamily: fonts.semibold, fontSize: 12, color: colors.accentText },
});
