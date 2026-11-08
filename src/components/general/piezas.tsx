// NIVL · Modo GENERAL: las piezas Ónix (puras). Vidrio sobre el fondo casi
// negro, radios de token y el oro solo como hilo:
//   FondoGeneral   el degradado de Ónix (para envolver lo que ya existe)
//   PantallaGeneral .screen + .body
//   TarjetaGeneral vidrio; la héroe lleva el velo de oro
//   RotuloGeneral  mayúsculas con su dato a la derecha, en oro
//   BotonGeneral   el botón hueso (y el de contorno)
//   ChipGeneral    los segmentos (Métricas · Progresión)
//   BarraGeneral   la pista de vidrio con el hilo de oro
//   CifraGeneral   la cifra en Playfair con su rótulo
//   Escudo         el escudo con el nivel
//   BarrasGeneral  la gráfica de barras (XP por semana, cumplimiento)
//   FilaGeneral    la fila con hairline
//   TituloGeneral  el título de una pestaña

import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { EscudoNivel, estiloNivelEscudo } from '@/components/arena/EscudoNivel';
import { Screen } from '@/components/ui';
import { FondoOnix } from '@/components/ui/FondoOnix';
import { menuContextualWeb } from '@/components/ui/pulsacionLarga';
import { ink, oro, radio, type as tipo, vidrio } from '@/design/tokens';
import { t } from '@/i18n';
import { F, G, M, px } from './tema';
import { ariaWeb } from '@/components/ui/ariaWeb';

type Icono = keyof typeof Ionicons.glyphMap;

// ── Fondo y pantalla ─────────────────────────────────────────────────

/** El fondo de la base: el degradado de Ónix, sin brillo de color. */
export function BrilloGeneral() {
  return <FondoOnix />;
}

/** Envuelve una pantalla que ya existe (Arena, el detalle de una campaña) con el fondo de NIVL. */
export function FondoGeneral({ children }: { children: ReactNode }) {
  return (
    <View style={styles.pantalla}>
      <BrilloGeneral />
      {children}
    </View>
  );
}

export interface PantallaGeneralProps {
  children: ReactNode;
  overlay?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function PantallaGeneral({ children, overlay, refreshing, onRefresh }: PantallaGeneralProps) {
  return (
    <FondoGeneral>
      <Screen style={styles.transparente} contentStyle={styles.cuerpo} overlay={overlay} refreshing={refreshing} onRefresh={onRefresh}>
        {children}
      </Screen>
    </FondoGeneral>
  );
}

// ── Tarjeta ──────────────────────────────────────────────────────────

export interface TarjetaGeneralProps {
  children: ReactNode;
  heroe?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}

const ANGULO_HEROE = { start: { x: 0.29, y: 0 }, end: { x: 0.71, y: 1 } };

export function TarjetaGeneral({ children, heroe, style, onPress, accessibilityLabel }: TarjetaGeneralProps) {
  const fondo = heroe ? (
    <LinearGradient
      colors={[oro.fondo, vidrio.suave]}
      start={ANGULO_HEROE.start}
      end={ANGULO_HEROE.end}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  ) : null;
  const caja = [styles.tarjeta, heroe && styles.heroe, style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => [caja, pressed && styles.pulsada]}>
        {fondo}
        {children}
      </Pressable>
    );
  }
  return (
    <View style={caja} accessibilityLabel={accessibilityLabel}>
      {fondo}
      {children}
    </View>
  );
}

// ── Rótulo ───────────────────────────────────────────────────────────

export interface RotuloGeneralProps {
  texto: string;
  em?: string;
  onEm?: () => void;
  emA11y?: string;
  style?: StyleProp<ViewStyle>;
  /** Fuera de tarjeta, con su margen. */
  seccion?: boolean;
  /** El rótulo en oro («Tu coach»). */
  oro?: boolean;
}

export function RotuloGeneral({ texto, em, onEm, emA11y, style, seccion, oro: enOro }: RotuloGeneralProps) {
  return (
    <View style={[styles.rotulo, seccion && styles.rotuloSeccion, style]}>
      <Text style={[styles.rotuloTexto, enOro && styles.rotuloOro]} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.35}>
        {texto}
      </Text>
      {em ? (
        onEm ? (
          <Pressable onPress={onEm} hitSlop={14} accessibilityRole="link" accessibilityLabel={emA11y ?? em}>
            <Text style={styles.rotuloEm} maxFontSizeMultiplier={1.35}>
              {em}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.rotuloEm} maxFontSizeMultiplier={1.35}>
            {em}
          </Text>
        )
      ) : null}
    </View>
  );
}

// ── Botón ────────────────────────────────────────────────────────────

export interface BotonGeneralProps {
  titulo: string;
  onPress: () => void;
  icono?: Icono;
  fantasma?: boolean;
  fino?: boolean;
  ocupado?: boolean;
  desactivado?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function BotonGeneral({ titulo, onPress, icono, fantasma, fino, ocupado, desactivado, style, accessibilityLabel }: BotonGeneralProps) {
  const color = fantasma ? ink.ink9 : ink.ink0;
  const apagado = desactivado || ocupado;
  return (
    <Pressable
      onPress={onPress}
      disabled={apagado}
      hitSlop={fino ? 8 : 4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? titulo}
      accessibilityState={{ disabled: !!apagado, busy: !!ocupado }}
      style={({ pressed }) => [styles.boton, fino && styles.botonFino, fantasma && styles.botonFantasma, pressed && styles.pulsada, desactivado && styles.apagado, style]}
    >
      {ocupado ? <ActivityIndicator size="small" color={color} /> : icono ? <Ionicons name={icono} size={px(15)} color={color} /> : null}
      <Text style={[styles.botonTexto, fino && styles.botonTextoFino, { color }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {titulo}
      </Text>
    </Pressable>
  );
}

// ── Chip y segmentos ─────────────────────────────────────────────────

export function ChipGeneral({ texto, onPress, activo, accessibilityLabel, pestana }: { texto: string; onPress?: () => void; activo?: boolean; accessibilityLabel?: string; pestana?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={pestana ? 'tab' : 'button'}
      accessibilityState={{ selected: !!activo }}
      accessibilityLabel={accessibilityLabel ?? texto}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [styles.chip, activo && styles.chipActivo, pressed && styles.pulsada]}
    >
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
        {texto}
      </Text>
    </Pressable>
  );
}

/** Dos o más pestañas dentro de una pantalla, a todo lo ancho. */
export function Segmentos<T extends string>({ opciones, valor, alCambiar }: { opciones: readonly { id: T; texto: string }[]; valor: T; alCambiar: (v: T) => void }) {
  return (
    <View style={styles.segmentos} accessibilityRole="tablist">
      {opciones.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => alCambiar(o.id)}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.id === valor }}
          {...ariaWeb({ selected: o.id === valor })}
          style={({ pressed }) => [styles.segmento, o.id === valor && styles.segmentoActivo, pressed && styles.pulsada]}
        >
          <Text style={[styles.segmentoTexto, o.id === valor && styles.segmentoTextoActivo]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {o.texto}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── Barra y cifras ───────────────────────────────────────────────────

export function BarraGeneral({ ratio, alto = 4, color = G, style }: { ratio: number; alto?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <View style={[styles.barra, { height: alto, borderRadius: radio.pastilla }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.barraRelleno, { width: `${Math.round(r * 100)}%`, borderRadius: radio.pastilla, backgroundColor: color }]} />
    </View>
  );
}

export interface CifraGeneralProps {
  valor: string;
  unidad?: string;
  rotulo: string;
  /** La línea de abajo, en oro («▲ 12 %», «récord»). */
  nota?: string;
  icono?: Icono;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function CifraGeneral({ valor, unidad, rotulo, nota, icono, style, accessibilityLabel }: CifraGeneralProps) {
  return (
    <View style={[styles.cifra, style]} accessible accessibilityLabel={accessibilityLabel ?? `${rotulo}: ${valor}${unidad ? ` ${unidad}` : ''}${nota ? `, ${nota}` : ''}`}>
      <Text style={styles.cifraValor} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.3}>
        {valor}
        {unidad ? <Text style={styles.cifraUnidad}>{` ${unidad}`}</Text> : null}
      </Text>
      <View style={styles.cifraCabeza}>
        {icono ? <Ionicons name={icono} size={px(11)} color={G} /> : null}
        <Text style={styles.cifraRotulo} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {rotulo}
        </Text>
      </View>
      {nota ? (
        <Text style={styles.cifraNota} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {nota}
        </Text>
      ) : null}
    </View>
  );
}

/** Fila de cifras del mismo ancho. */
export function FilaCifras({ children }: { children: ReactNode }) {
  return <View style={styles.filaCifras}>{children}</View>;
}

// ── Escudo ───────────────────────────────────────────────────────────

/** El escudo de Ónix con el nivel global dentro. */
export function Escudo({ nivel, lado = 62 }: { nivel: number | string; lado?: number }) {
  return (
    <EscudoNivel lado={lado}>
      <Text style={estiloNivelEscudo(lado, nivel)} numberOfLines={1} maxFontSizeMultiplier={1}>
        {nivel}
      </Text>
    </EscudoNivel>
  );
}

// ── Gráfica de barras ────────────────────────────────────────────────

export interface BarrasGeneralProps {
  valores: readonly number[];
  etiquetas: readonly string[];
  alto?: number;
  /** El índice que va en oro lleno (la semana en curso); el resto, oro tenue. */
  resaltar?: number;
  /** Las cifras encima de cada barra. */
  cifras?: readonly string[];
  accessibilityLabel: string;
}

export function BarrasGeneral({ valores, etiquetas, alto = px(96), resaltar, cifras, accessibilityLabel }: BarrasGeneralProps) {
  const max = Math.max(1, ...valores);
  return (
    <View style={styles.barras} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {valores.map((v, i) => {
        const h = v <= 0 ? 2 : Math.max(4, Math.round((v / max) * alto));
        const fuerte = i === resaltar;
        return (
          <View key={`${etiquetas[i]}-${i}`} style={styles.barraCol}>
            {cifras ? (
              <Text style={[styles.barraCifra, fuerte && styles.barraCifraFuerte]} numberOfLines={1} maxFontSizeMultiplier={1}>
                {cifras[i]}
              </Text>
            ) : null}
            <View style={{ height: alto, justifyContent: 'flex-end', alignSelf: 'stretch', alignItems: 'center' }}>
              <View style={[styles.barraVertical, { height: h }, fuerte ? styles.barraVerticalFuerte : null]} />
            </View>
            <Text style={[styles.barraEtiqueta, fuerte && styles.barraCifraFuerte]} numberOfLines={1} maxFontSizeMultiplier={1}>
              {etiquetas[i]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Fila, título y huecos ────────────────────────────────────────────

export function FilaGeneral({
  children,
  primera,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityLongPressLabel,
  style,
}: {
  children: ReactNode;
  primera?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  /** El nombre de la acción de la pulsación larga para el lector de pantalla. */
  accessibilityLongPressLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const caja = [styles.fila, !primera && styles.filaRegla, style];
  if (!onPress && !onLongPress) {
    return (
      <View style={caja} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      {...menuContextualWeb(onLongPress)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      // La pulsación larga no se descubre con el lector: va como acción.
      accessibilityActions={onLongPress ? [{ name: 'longpress', label: accessibilityLongPressLabel ?? t('ui:row.masOpciones') }] : undefined}
      onAccessibilityAction={onLongPress ? (e) => e.nativeEvent.actionName === 'longpress' && onLongPress() : undefined}
      style={({ pressed }) => [caja, pressed && styles.pulsada]}
    >
      {children}
    </Pressable>
  );
}

/** El cuadro con un icono (accesos, campañas). */
export function CuadroGeneral({ lado = px(40), children }: { lado?: number; children: ReactNode }) {
  return <View style={[styles.cuadro, { width: lado, height: lado, borderRadius: radio.chip }]}>{children}</View>;
}

export function TituloGeneral({ eyebrow, titulo, derecha }: { eyebrow: string; titulo: string; derecha?: ReactNode }) {
  return (
    <View style={styles.titulo}>
      <View style={styles.flex}>
        <Text style={styles.tituloEyebrow} maxFontSizeMultiplier={1.35} numberOfLines={1}>
          {eyebrow}
        </Text>
        <Text style={styles.tituloTexto} accessibilityRole="header" maxFontSizeMultiplier={1.25} numberOfLines={1} adjustsFontSizeToFit>
          {titulo}
        </Text>
      </View>
      {derecha}
    </View>
  );
}

export function HuecoGeneral({ alto, style }: { alto: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.hueco, { height: alto }, style]} />;
}

export const textoGeneral = StyleSheet.create({
  titulo: { fontFamily: tipo.headline.family, fontSize: tipo.headline.size, lineHeight: tipo.headline.lineHeight, letterSpacing: tipo.headline.tracking, color: ink.ink9 },
  cuerpo: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink9 },
  detalle: { fontFamily: tipo.body.family, fontSize: 13, lineHeight: 18, color: ink.ink8 },
  fila: { fontFamily: F.sb, fontSize: 15, lineHeight: 20, color: ink.ink9, flexShrink: 1 },
  oro: { fontFamily: F.b, fontSize: 13, lineHeight: 18, color: oro.claro },
  serif: { fontFamily: F.serif, color: ink.ink9 },
});

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: ink.ink0 },
  transparente: { backgroundColor: 'transparent' },
  cuerpo: { paddingHorizontal: M.margen, paddingTop: px(2), paddingBottom: px(30), gap: px(9) },
  flex: { flex: 1, minWidth: 0 },
  tarjeta: {
    backgroundColor: vidrio.tarjeta,
    borderWidth: 1,
    borderColor: vidrio.borde,
    borderRadius: radio.tarjeta,
    paddingVertical: 13,
    paddingHorizontal: 15,
    overflow: 'hidden',
  },
  heroe: { backgroundColor: 'transparent', borderColor: oro.borde },
  pulsada: { opacity: 0.8 },
  apagado: { opacity: 0.45 },
  rotulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: px(8) },
  rotuloSeccion: { marginHorizontal: px(2), marginTop: px(6), marginBottom: px(1) },
  rotuloTexto: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    color: ink.ink8,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  rotuloOro: { color: oro.claro },
  rotuloEm: { fontFamily: tipo.label.family, fontSize: tipo.label.size, lineHeight: tipo.label.lineHeight, letterSpacing: 1, color: oro.claro, textTransform: 'uppercase' },
  boton: {
    marginTop: px(8),
    minHeight: M.boton,
    borderRadius: radio.control,
    backgroundColor: ink.ink10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: px(7),
    paddingHorizontal: px(10),
  },
  botonFino: { minHeight: M.botonFino },
  botonFantasma: { backgroundColor: 'transparent', borderWidth: 1, borderColor: vidrio.borde },
  botonTexto: { fontFamily: tipo.label.family, fontSize: 16, lineHeight: 22 },
  botonTextoFino: { fontSize: 14, lineHeight: 20 },
  chip: { paddingVertical: px(7), paddingHorizontal: px(11), borderRadius: radio.chip, borderWidth: 1, borderColor: vidrio.borde, backgroundColor: vidrio.tarjeta },
  chipActivo: { borderColor: oro.borde, backgroundColor: oro.fondo },
  chipTexto: { fontFamily: F.sb, fontSize: 13, color: ink.ink8 },
  chipTextoActivo: { color: ink.ink9 },
  segmentos: { flexDirection: 'row', gap: px(5), padding: px(3), borderRadius: radio.control, backgroundColor: vidrio.suave, borderWidth: 1, borderColor: vidrio.borde },
  segmento: { flex: 1, minHeight: 36, borderRadius: radio.chip, alignItems: 'center', justifyContent: 'center' },
  segmentoActivo: { backgroundColor: oro.fondo, borderWidth: 1, borderColor: oro.borde },
  segmentoTexto: { fontFamily: F.sb, fontSize: 13, color: ink.ink8 },
  segmentoTextoActivo: { fontFamily: F.b, color: oro.claro },
  barra: { backgroundColor: vidrio.pista, overflow: 'hidden' },
  barraRelleno: { height: '100%' },
  cifra: { flex: 1, minWidth: 0, backgroundColor: vidrio.tarjeta, borderWidth: 1, borderColor: vidrio.borde, borderRadius: radio.control, paddingVertical: 10, paddingHorizontal: 11 },
  cifraCabeza: { flexDirection: 'row', alignItems: 'center', gap: px(4) },
  cifraRotulo: { fontFamily: tipo.body.family, fontSize: 12, lineHeight: 15, color: ink.ink8, flexShrink: 1 },
  // Sin lineHeight: con adjustsFontSizeToFit, en @3x la cifra salía microscópica.
  cifraValor: { fontFamily: tipo.number.family, fontSize: 20, color: ink.ink9 },
  cifraUnidad: { fontFamily: F.sb, fontSize: 12, color: ink.ink8 },
  cifraNota: { fontFamily: F.b, fontSize: 12, lineHeight: 15, color: oro.claro, marginTop: px(1) },
  filaCifras: { flexDirection: 'row', gap: 8 },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: px(5), marginTop: px(8) },
  barraCol: { flex: 1, alignItems: 'center', minWidth: 0 },
  barraVertical: { width: '70%', maxWidth: px(26), borderTopLeftRadius: radio.chip, borderTopRightRadius: radio.chip, backgroundColor: oro.borde },
  barraVerticalFuerte: { backgroundColor: oro.hilo },
  barraCifra: { fontFamily: F.b, fontSize: 11, color: ink.ink6, marginBottom: px(3) },
  barraCifraFuerte: { color: oro.claro },
  barraEtiqueta: { fontFamily: tipo.body.family, fontSize: 11, color: ink.ink8, marginTop: px(5) },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, gap: px(9) },
  filaRegla: { borderTopWidth: 1, borderTopColor: vidrio.linea },
  cuadro: { alignItems: 'center', justifyContent: 'center', backgroundColor: oro.fondo, borderWidth: 1, borderColor: oro.borde },
  titulo: { flexDirection: 'row', alignItems: 'flex-end', gap: px(10), paddingTop: px(4), paddingBottom: px(4) },
  tituloEyebrow: { fontFamily: tipo.label.family, fontSize: tipo.label.size, lineHeight: tipo.label.lineHeight, letterSpacing: tipo.label.tracking, color: oro.claro },
  // Sin lineHeight a propósito: con adjustsFontSizeToFit, en @3x iOS encogía el título al mínimo.
  tituloTexto: { fontFamily: tipo.title.family, fontSize: tipo.title.size, color: ink.ink9, marginTop: 2 },
  hueco: { backgroundColor: vidrio.suave, borderRadius: radio.tarjeta, borderWidth: 1, borderColor: vidrio.linea },
});
