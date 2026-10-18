// NIVL · Modos F1: el selector de modo de la cabecera de Hoy (puro).
//
// Una fila de pestañas: NIVL (General) y los modos activados. La activa va en
// ink10 con su acento debajo (un trazo `rule`); las demás, en ink6. El acento
// es lo único de color de la pantalla y solo existe con `modos_activos`
// encendido: con el interruptor apagado este componente no se monta.
//
// QA F1 (M5): nada se ve cortado. Si caben, las pestañas se reparten el ancho
// (con cinco modos van más compactas); si no caben (texto grande del sistema,
// pantallas estrechas), la fila se desplaza en horizontal con un degradado y
// un chevrón en el borde que dicen que hay más, y la activa se trae a la vista.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
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

/** Con tantos modos o más, las pestañas van compactas (menos aire y menos espaciado). */
const COMPACTO_DESDE = 5;
/** El degradado del borde: tramos de negro cada vez más opaco. */
const TRAMOS = [0.35, 0.6, 0.85, 1];
const ANCHO_TRAMO = 8;

/** ¿El contenido no cabe en el hueco? (con un píxel de margen por redondeos). */
export function desborda(anchoHueco: number, anchoContenido: number): boolean {
  return anchoHueco > 0 && anchoContenido > anchoHueco + 1;
}

export function SelectorModo({ modo, disponibles, alCambiar }: SelectorModoProps) {
  const [hueco, setHueco] = useState(0);
  const [contenido, setContenido] = useState(0);
  const [desplazado, setDesplazado] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const posiciones = useRef<Partial<Record<ModoId, { x: number; ancho: number }>>>({});
  const compacto = disponibles.length >= COMPACTO_DESDE;
  const hayMas = desborda(hueco, contenido);
  const alFinal = desplazado + hueco >= contenido - 2;

  // La activa siempre a la vista (al montar y al cambiar de modo).
  useEffect(() => {
    if (!hayMas) return;
    const p = posiciones.current[modo];
    if (!p) return;
    if (p.x < desplazado || p.x + p.ancho > desplazado + hueco) {
      scroll.current?.scrollTo({ x: Math.max(0, p.x - space.s4), animated: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar de modo o de reparto
  }, [modo, hayMas]);

  return (
    <View style={styles.marco} onLayout={(e) => setHueco(Math.round(e.nativeEvent.layout.width))}>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.fila, !hayMas && styles.filaRepartida]}
        onContentSizeChange={(w) => setContenido(Math.round(w))}
        onScroll={(e) => setDesplazado(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={32}
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
              onLayout={(e) => {
                posiciones.current[m] = { x: e.nativeEvent.layout.x, ancho: e.nativeEvent.layout.width };
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={t('modos:selector.opcionA11y', { modo: NOMBRE_MODO[m] })}
              style={({ pressed }) => [
                styles.pestana,
                compacto && styles.pestanaCompacta,
                !hayMas && styles.pestanaRepartida,
                pressed && !activo && styles.pulsada,
              ]}
            >
              <Text
                style={[styles.texto, compacto && styles.textoCompacto, activo && { color: modoAcento[m] }]}
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
      {hayMas && !alFinal ? (
        <View style={styles.borde} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {TRAMOS.map((o) => (
            <View key={o} style={[styles.tramo, { opacity: o }]} />
          ))}
          <View style={styles.chevron}>
            <Ionicons name="chevron-forward" size={14} color={ink.ink6} />
          </View>
        </View>
      ) : null}
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
  // Si caben, se reparten el ancho entero: ninguna queda pegada al borde.
  filaRepartida: { flexGrow: 1 },
  pestana: {
    minHeight: 44,
    minWidth: 56,
    paddingHorizontal: space.s3,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  pestanaCompacta: { minWidth: 44, paddingHorizontal: space.s2 },
  pestanaRepartida: { flexGrow: 1 },
  pulsada: { opacity: 0.7 },
  texto: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    color: ink.ink6,
    paddingBottom: space.s2,
  },
  textoCompacto: { letterSpacing: tipo.label.tracking / 2 },
  // El trazo de la activa; las demás, transparente para que no salte el alto.
  trazo: { alignSelf: 'stretch', height: stroke.rule, backgroundColor: 'transparent', marginBottom: -stroke.hairline },
  borde: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: stroke.hairline,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  tramo: { width: ANCHO_TRAMO, backgroundColor: ink.ink0 },
  chevron: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
