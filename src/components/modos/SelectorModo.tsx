// NIVL · Modos F1: el selector de modo de la cabecera de Hoy (puro).
//
// Una fila de pestañas: NIVL (General) y los modos activados. La activa va en
// ink10 con su acento debajo (un trazo `rule`); las demás, en ink6. El acento
// es lo único de color de la pantalla y solo existe con `modos_activos`
// encendido: con el interruptor apagado este componente no se monta.
//
// Se desplaza en horizontal si no cabe (cinco modos a 360 de ancho).

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { vibrar } from '@/design/haptics';
import { ink, modoAcento, space, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { NOMBRE_MODO, type ModoId } from '@/modos/tipos';

export interface SelectorModoProps {
  modo: ModoId;
  disponibles: readonly ModoId[];
  alCambiar: (modo: ModoId) => void;
}

export function SelectorModo({ modo, disponibles, alCambiar }: SelectorModoProps) {
  return (
    <View style={styles.marco}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.fila}
        accessibilityRole="tablist"
        accessibilityLabel={t('modos:selector.a11y')}
      >
        {disponibles.map((m) => {
          const activo = m === modo;
          return (
            <Pressable
              key={m}
              onPress={() => {
                if (activo) return;
                vibrar('seleccion');
                alCambiar(m);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={t('modos:selector.opcionA11y', { modo: NOMBRE_MODO[m] })}
              style={({ pressed }) => [styles.pestana, pressed && !activo && styles.pulsada]}
            >
              <Text
                style={[styles.texto, activo && { color: modoAcento[m] }]}
                maxFontSizeMultiplier={1.35}
                numberOfLines={1}
              >
                {NOMBRE_MODO[m]}
              </Text>
              <View style={[styles.trazo, activo && { backgroundColor: modoAcento[m] }]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  marco: {
    borderBottomWidth: stroke.hairline,
    borderBottomColor: ink.ink3,
    marginBottom: space.s4,
  },
  fila: { flexDirection: 'row', gap: space.s1 },
  pestana: {
    minHeight: 44,
    minWidth: 56,
    paddingHorizontal: space.s3,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  pulsada: { opacity: 0.7 },
  texto: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    color: ink.ink6,
    paddingBottom: space.s2,
  },
  // El trazo de la activa; las demás, transparente para que no salte el alto.
  trazo: { alignSelf: 'stretch', height: stroke.rule, backgroundColor: 'transparent', marginBottom: -stroke.hairline },
});
