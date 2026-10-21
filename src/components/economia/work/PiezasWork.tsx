// NIVL · WORK: las piezas con las que se dibuja la economía, calcadas de la
// lámina 3 de la P01 («FOCUS, WORK y FOUNDER», el teléfono de WORK):
//
//   · TarjetaWork: placa oscura con esquinas suaves y filete fino. La
//     `destacada` (la primera de la pantalla, como «Prioridades de hoy») va
//     teñida del acento esmeralda y con el filete del acento.
//   · Rótulo de tarjeta: Outfit 700 en mayúsculas espaciadas, gris; a la
//     derecha la `meta` en el acento («1 DE 3», «3 ACTIVOS»).
//   · BotonWork `lleno`: la acción grande de la lámina («BLOQUE DE TRABAJO
//     PROFUNDO»): placa esmeralda a todo el ancho, texto negro espaciado. Una
//     por pantalla. `contorno` y `texto` para lo secundario.
//   · BarraWork: la barra fina de «Proyectos» (pista gris, relleno del acento).
//   · ChipWork: elegir (cuenta, categoría); el elegido, con el filete del acento.
//
// El acento del modo (tokens.ts → modoAcento.work) es el único color; lo
// demás es la escala ink. Ningún texto va sobre el acento salvo en ink0.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { vibrar } from '@/design/haptics';
import { ink, modoAcento, space, type as tipo } from '@/design/tokens';

export const ACENTO = modoAcento.work;

/** El acento con transparencia (tinte de fondo y filetes). */
export function tinte(alfa: number, hex: string = ACENTO): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

export const RADIO = 12;
export const RADIO_BOTON = 10;

type Icono = keyof typeof Ionicons.glyphMap;

export function TarjetaWork({
  rotulo,
  meta,
  onMeta,
  metaA11y,
  destacada,
  children,
  style,
}: {
  rotulo?: string;
  meta?: string;
  onMeta?: () => void;
  metaA11y?: string;
  destacada?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.tarjeta, destacada && styles.destacada, style]}>
      {rotulo || meta ? (
        <View style={styles.cabecera}>
          {rotulo ? (
            <Text style={styles.rotulo} accessibilityRole="header" maxFontSizeMultiplier={1.35} numberOfLines={1}>
              {rotulo}
            </Text>
          ) : (
            <View />
          )}
          {meta ? (
            onMeta ? (
              <Pressable onPress={onMeta} hitSlop={12} accessibilityRole="button" accessibilityLabel={metaA11y ?? meta}>
                <Text style={styles.meta} maxFontSizeMultiplier={1.35}>
                  {meta}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.meta} maxFontSizeMultiplier={1.35} accessibilityLabel={metaA11y}>
                {meta}
              </Text>
            )
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function BotonWork({
  titulo,
  onPress,
  icono,
  variante = 'lleno',
  disabled,
  cargando,
  accessibilityLabel,
  style,
}: {
  titulo: string;
  onPress: () => void;
  icono?: Icono;
  variante?: 'lleno' | 'contorno' | 'texto';
  disabled?: boolean;
  cargando?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const color = variante === 'lleno' ? ink.ink0 : disabled ? ink.ink6 : ACENTO;
  return (
    <Pressable
      onPress={() => {
        if (disabled || cargando) return;
        vibrar('seleccion');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? titulo}
      accessibilityState={{ disabled: !!disabled, busy: !!cargando }}
      style={({ pressed }) => [
        styles.boton,
        variante === 'lleno' && styles.botonLleno,
        variante === 'contorno' && styles.botonContorno,
        variante === 'texto' && styles.botonTexto,
        disabled && variante === 'lleno' && styles.botonApagado,
        pressed && !disabled && styles.pulsado,
        style,
      ]}
    >
      {icono ? <Ionicons name={icono} size={variante === 'texto' ? 14 : 16} color={color} /> : null}
      <Text
        style={[styles.botonTexto_, variante !== 'lleno' && styles.botonTextoMedio, variante === 'texto' && styles.botonTextoChico, { color }]}
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}
      >
        {cargando ? '…' : titulo}
      </Text>
    </Pressable>
  );
}

export function BarraWork({ ratio, alto = 4 }: { ratio: number; alto?: number }) {
  const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <View style={[styles.pista, { height: alto, borderRadius: alto / 2 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.relleno, { width: `${Math.round(r * 1000) / 10}%`, height: alto, borderRadius: alto / 2 }]} />
    </View>
  );
}

export function ChipWork({
  etiqueta,
  elegido,
  onPress,
  icono,
  disabled,
  accessibilityLabel,
}: {
  etiqueta: string;
  elegido?: boolean;
  onPress: () => void;
  icono?: Icono;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        vibrar('seleccion');
        onPress();
      }}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? etiqueta}
      accessibilityState={{ selected: !!elegido, disabled: !!disabled }}
      style={({ pressed }) => [styles.chip, elegido && styles.chipElegido, disabled && styles.chipApagado, pressed && styles.pulsado]}
    >
      {icono ? <Ionicons name={icono} size={14} color={elegido ? ACENTO : ink.ink8} /> : null}
      <Text style={[styles.chipTexto, elegido && styles.chipTextoElegido]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
        {etiqueta}
      </Text>
    </Pressable>
  );
}

export function FilaChips({ children }: { children: ReactNode }) {
  return <View style={styles.filaChips}>{children}</View>;
}

/** El rótulo de un grupo dentro de una hoja («CUENTA», «CATEGORÍA»). */
export function RotuloGrupo({ children }: { children: string }) {
  return (
    <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
      {children}
    </Text>
  );
}

/** Separador fino entre filas. */
export function Filete() {
  return <View style={styles.filete} />;
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: ink.ink1,
    borderColor: ink.ink3,
    borderWidth: 1,
    borderRadius: RADIO,
    paddingHorizontal: space.s4,
    paddingTop: space.s3,
    paddingBottom: space.s4,
    marginBottom: space.s3,
  },
  destacada: {
    backgroundColor: tinte(0.07),
    borderColor: tinte(0.45),
  },
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.s3,
    marginBottom: space.s3,
  },
  rotulo: {
    flexShrink: 1,
    fontFamily: tipo.label.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  meta: {
    fontFamily: tipo.label.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: ACENTO,
  },
  boton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s2,
    paddingHorizontal: space.s4,
    borderRadius: RADIO_BOTON,
  },
  botonLleno: { backgroundColor: ACENTO },
  botonContorno: { borderWidth: 1, borderColor: tinte(0.55), backgroundColor: tinte(0.06) },
  botonTexto: { minHeight: 44, paddingHorizontal: 0, justifyContent: 'flex-start' },
  botonApagado: { backgroundColor: ink.ink3 },
  pulsado: { opacity: 0.8 },
  botonTexto_: {
    fontFamily: tipo.label.family,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  botonTextoMedio: { fontSize: 12, letterSpacing: 1.4 },
  botonTextoChico: { fontSize: tipo.micro.size, letterSpacing: 1.6 },
  pista: { backgroundColor: ink.ink3, overflow: 'hidden' },
  relleno: { backgroundColor: ACENTO },
  chip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    paddingHorizontal: space.s3,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ink.ink4,
    backgroundColor: ink.ink2,
  },
  chipElegido: { borderColor: ACENTO, backgroundColor: tinte(0.12) },
  chipApagado: { opacity: 0.45 },
  chipTexto: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, color: ink.ink8 },
  chipTextoElegido: { color: ink.ink10 },
  filaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  filete: { height: 1, backgroundColor: ink.ink3 },
});
