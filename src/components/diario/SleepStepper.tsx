// NIVL · Diario: horas dormidas anoche (FASE3 Lote D).
//
// Un contador de media en media hora: escribir "7,5" con el teclado numérico
// español (coma, punto, nada) es justo la fricción que hace que el dato no se
// apunte. Arranca sin valor (no registrar no es lo mismo que dormir 7 horas)
// y el primer toque lo deja en 7. La cifra en Cinzel (`type.cifra`), los
// botones −/+ de 44 en contorno ink4.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LEIDO_SIN_DATO, SIN_DATO } from '@/components/ui/sinDato';
import { vibrar } from '@/design/haptics';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { SUENO_MAX, SUENO_MIN, formatoDecimal, formatoHoras, pasoDeSueno } from '@/lib/journalmath';

interface Props {
  value: number | null;
  onChange: (next: number | null) => void;
}

const BOTON = 44;

export function SleepStepper({ value, onChange }: Props) {
  const mover = (dir: 1 | -1) => {
    const next = pasoDeSueno(value, dir);
    if (next === value) return;
    vibrar('seleccion');
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
          style={({ pressed }) => [styles.boton, enMinimo && styles.off, pressed && styles.pulsado]}
          accessibilityRole="button"
          accessibilityLabel="Media hora menos de sueño"
          accessibilityState={{ disabled: enMinimo }}
        >
          <Ionicons name="remove" size={20} color={enMinimo ? ink.ink6 : ink.ink9} />
        </Pressable>
        <View style={styles.centro}>
          {/* La cifra en Cinzel y la unidad en Outfit: Cinzel no tiene minúsculas
              y "7,5 H" se leería como otra cosa. */}
          <Text
            style={[styles.valor, value === null && styles.valorVacio]}
            accessibilityLabel={value === null ? LEIDO_SIN_DATO : undefined}
            maxFontSizeMultiplier={1}
          >
            {value === null ? SIN_DATO : formatoDecimal(value)}
            {value !== null ? <Text style={styles.unidad}> h</Text> : null}
          </Text>
        </View>
        <Pressable
          onPress={() => mover(1)}
          disabled={enMaximo}
          style={({ pressed }) => [styles.boton, enMaximo && styles.off, pressed && styles.pulsado]}
          accessibilityRole="button"
          accessibilityLabel="Media hora más de sueño"
          accessibilityState={{ disabled: enMaximo }}
        >
          <Ionicons name="add" size={20} color={enMaximo ? ink.ink6 : ink.ink9} />
        </Pressable>
      </View>
      <View style={styles.pie}>
        <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
          {value === null ? 'Sin registrar. Toca + o −.' : 'Anoche.'}
        </Text>
        {value !== null ? (
          <Pressable
            onPress={() => onChange(null)}
            style={({ pressed }) => [styles.quitar, pressed && styles.pulsado]}
            accessibilityRole="button"
            accessibilityLabel="Quitar las horas de sueño"
          >
            <Text style={styles.quitarTexto}>Quitar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  boton: {
    width: BOTON,
    height: BOTON,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  off: { borderColor: ink.ink3 },
  pulsado: { opacity: 0.7 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: BOTON },
  valor: {
    fontFamily: tipo.cifra.family,
    fontSize: tipo.cifra.size,
    lineHeight: tipo.cifra.lineHeight,
    color: ink.ink10,
    fontVariant: ['tabular-nums'],
  },
  valorVacio: { color: ink.ink6 },
  unidad: { fontFamily: tipo.micro.family, fontSize: 14, letterSpacing: tipo.micro.tracking, color: ink.ink8 },
  pie: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.s2 },
  nota: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink6 },
  quitar: { minHeight: BOTON, minWidth: BOTON, alignItems: 'flex-end', justifyContent: 'center' },
  quitarTexto: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink9,
  },
});
