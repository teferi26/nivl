// NIVL · WORK: las piezas con las que se dibuja la economía, calcadas de la
// lámina 3 de la P01 («FOCUS, WORK y FOUNDER», el teléfono de WORK):
//
//   · TarjetaWork: vidrio redondeado con filete fino. La `destacada` (la
//     primera de la pantalla) lleva el velo y el marco de oro.
//   · Rótulo de tarjeta: Outfit 700 en mayúsculas espaciadas, gris; a la
//     derecha la `meta` en oro («1 DE 3», «3 ACTIVOS»).
//   · BotonWork `lleno`: la acción de la pantalla, hueso y con texto oscuro.
//     Una por pantalla: el oro nunca rellena un botón. `contorno` y `texto`
//     para lo secundario.
//   · BarraWork: la barra fina de «Proyectos» (pista de vidrio, hilo de oro).
//   · ChipWork: elegir (cuenta, categoría); el elegido, con velo de oro.
//
// El oro (tokens.ts → modoAcento) es solo un hilo. La misma economía sirve a
// WORK y a FOUNDER: el modo llega por `AcentoEconomia` y cada pieza lo lee con
// `useAcento()`.

import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ariaWeb } from '@/components/ui/ariaWeb';
import { vibrar } from '@/design/haptics';
import { ink, modoAcento, oro, radio, space, type as tipo, vidrio } from '@/design/tokens';

/** El acento de WORK (el de por defecto; las demos lo usan tal cual). */
export const ACENTO = modoAcento.work;

/** El acento con transparencia (tinte de fondo y filetes). */
export function tinte(alfa: number, hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

/** Los modos que comparten esta economía. */
export type ModoEconomia = 'work' | 'founder';

const AcentoCtx = createContext<ModoEconomia>('work');

/** Da el modo (WORK o FOUNDER) y su acento a toda la economía que envuelve. */
export function AcentoEconomia({ modo, children }: { modo: ModoEconomia; children: ReactNode }) {
  return <AcentoCtx.Provider value={modo}>{children}</AcentoCtx.Provider>;
}

export type Acento = {
  modo: ModoEconomia;
  /** El nombre del modo tal como se lee («WORK», «FOUNDER»). */
  nombre: string;
  acento: string;
  tinte: (alfa: number) => string;
};

/** El acento del modo en curso y su tinte con transparencia. */
export function useAcento(): Acento {
  const modo = useContext(AcentoCtx);
  return useMemo(() => {
    const acento = modoAcento[modo];
    return { modo, nombre: modo.toUpperCase(), acento, tinte: (alfa: number) => tinte(alfa, acento) };
  }, [modo]);
}

export const RADIO = radio.tarjeta;
export const RADIO_BOTON = radio.control;

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
  const a = useAcento();
  const colorMeta = { color: a.acento };
  return (
    <View style={[styles.tarjeta, destacada && styles.tarjetaDestacada, style]}>
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
                <Text style={[styles.meta, colorMeta]} maxFontSizeMultiplier={1.35}>
                  {meta}
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.meta, colorMeta]} maxFontSizeMultiplier={1.35} accessibilityLabel={metaA11y}>
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
  const a = useAcento();
  const color = disabled ? ink.ink6 : variante === 'lleno' ? ink.ink0 : variante === 'texto' ? a.acento : ink.ink9;
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
      disabled={!!disabled}
      {...ariaWeb({ busy: !!cargando })}
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
      <View style={[{ backgroundColor: oro.hilo, width: `${Math.round(r * 1000) / 10}%`, height: alto, borderRadius: alto / 2 }]} />
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
  const a = useAcento();
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
      disabled={!!disabled}
      {...(Platform.OS === 'web' && elegido !== undefined ? { 'aria-pressed': elegido } : null)}
      style={({ pressed }) => [styles.chip, elegido && styles.chipElegido, disabled && styles.chipApagado, pressed && styles.pulsado]}
    >
      {icono ? <Ionicons name={icono} size={14} color={elegido ? a.acento : ink.ink8} /> : null}
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

/**
 * En la web, Intro en un campo guarda la hoja, como en cualquier formulario del
 * navegador. En nativo no añade nada: la tecla de retorno sigue cerrando el teclado.
 */
export function enterGuarda(accion: () => void): { onSubmitEditing: () => void; blurOnSubmit: false } | null {
  // Sin blurOnSubmit: si falla la validación, el foco sigue en el campo.
  return Platform.OS === 'web' ? { onSubmitEditing: accion, blurOnSubmit: false } : null;
}

/** Separador fino entre filas. */
export function Filete() {
  return <View style={styles.filete} />;
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: vidrio.tarjeta,
    borderColor: vidrio.borde,
    borderWidth: 1,
    borderRadius: RADIO,
    paddingHorizontal: space.s4,
    paddingTop: space.s3,
    paddingBottom: space.s4,
    marginBottom: space.s3,
  },
  tarjetaDestacada: { backgroundColor: oro.fondo, borderColor: oro.borde },
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
  botonLleno: { backgroundColor: ink.ink10 },
  botonContorno: { borderWidth: 1, borderColor: vidrio.borde, backgroundColor: vidrio.suave },
  botonTexto: { minHeight: 44, paddingHorizontal: 0, justifyContent: 'flex-start' },
  botonApagado: { backgroundColor: vidrio.campo },
  pulsado: { opacity: 0.8 },
  botonTexto_: {
    fontFamily: tipo.label.family,
    fontSize: 15,
    lineHeight: 20,
  },
  botonTextoMedio: { fontSize: 13 },
  botonTextoChico: { fontSize: 13 },
  pista: { backgroundColor: vidrio.pista, overflow: 'hidden' },
  chip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    paddingHorizontal: space.s3,
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: vidrio.borde,
    backgroundColor: vidrio.suave,
  },
  chipElegido: { borderColor: oro.borde, backgroundColor: oro.tenue },
  chipApagado: { opacity: 0.45 },
  chipTexto: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, color: ink.ink8 },
  chipTextoElegido: { color: ink.ink10 },
  filaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  filete: { height: 1, backgroundColor: vidrio.linea },
});
