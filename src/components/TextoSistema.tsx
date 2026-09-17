import { StyleSheet, Text, View } from 'react-native';
import { parsear } from '@/lib/markdown';
import { colors, fonts } from '@/lib/theme';

/**
 * El texto del coach, con su formato puesto.
 *
 * Antes se pintaba en crudo y salían los asteriscos a la vista. La negrita del
 * coach no es decorativa: marca la cifra o la orden que importa de un párrafo,
 * y perderla es perder la jerarquía de lo que dice.
 */
export function TextoSistema({ texto, tono = 'normal' }: { texto: string; tono?: 'normal' | 'tenue' }) {
  const lineas = parsear(texto);
  const base = tono === 'tenue' ? styles.tenue : styles.normal;

  return (
    <View>
      {lineas.map((l, i) => {
        const trozos = l.trozos.map((t, j) => (
          <Text key={j} style={t.negrita ? styles.negrita : undefined}>
            {t.texto}
          </Text>
        ));

        if (l.tipo === 'titulo') {
          return (
            <Text key={i} style={[styles.titulo, i > 0 && styles.tituloSeparado]}>
              {l.trozos.map((t) => t.texto).join('')}
            </Text>
          );
        }

        if (l.tipo === 'vineta' || l.tipo === 'numerada') {
          return (
            <View key={i} style={styles.fila}>
              <Text style={[base, styles.marca]}>{l.tipo === 'numerada' ? `${l.marca}.` : '·'}</Text>
              <Text style={[base, styles.cuerpoFila]}>{trozos}</Text>
            </View>
          );
        }

        return (
          <Text key={i} style={[base, i > 0 && styles.parrafoSeparado]}>
            {trozos}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  normal: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.text },
  tenue: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textDim },
  negrita: { fontFamily: fonts.semibold, color: colors.accentText },
  titulo: {
    fontFamily: fonts.heading,
    fontSize: 13,
    letterSpacing: 1.5,
    color: colors.accentText,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  tituloSeparado: { marginTop: 12 },
  parrafoSeparado: { marginTop: 8 },
  fila: { flexDirection: 'row', gap: 8, marginTop: 5 },
  // Ancho fijo para que los números de una lista queden alineados entre sí.
  marca: { minWidth: 16, color: colors.accent },
  cuerpoFila: { flex: 1 },
});
