// NIVL · Modo GENERAL: las piezas de la lámina 4 de la P01 (puras). Son las
// mismas formas que las de IRON (ironmundo/piezas.tsx, la referencia
// aprobada) con el oro de NIVL:
//   FondoGeneral   el negro con el brillo de oro arriba (para envolver lo que ya existe)
//   PantallaGeneral .screen + .body
//   TarjetaGeneral .card / .card.hero (héroe: degradado de oro a 155°)
//   RotuloGeneral  .lbl + em (mayúsculas grises, lo de la derecha en oro)
//   BotonGeneral   el botón grande lleno de oro (y el de contorno)
//   ChipGeneral    los segmentos (Métricas · Progresión)
//   BarraGeneral   la pista #1b1b20 con el relleno de oro
//   CifraGeneral   la cifra grande con su rótulo (las métricas)
//   Escudo         el escudo dorado con el nivel (lámina 4, «23»)
//   BarrasGeneral  la gráfica de barras (XP por semana, cumplimiento)
//   FilaGeneral    la fila con filete
//   TituloGeneral  el título de una pestaña (NIVL · CAMPAÑAS)

import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Screen } from '@/components/ui';
import { C, F, fs, G, M, oroA, oroMezcla, px } from './tema';

type Icono = keyof typeof Ionicons.glyphMap;

// ── Fondo y pantalla ─────────────────────────────────────────────────

/** El fondo de NIVL: negro y, arriba, el brillo del oro (la recarga dorada sube del centro). */
export function BrilloGeneral() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="brilloGeneral" cx="50%" cy="0%" rx="90%" ry="40%" fx="50%" fy="0%">
            <Stop offset="0" stopColor={G} stopOpacity={0.13} />
            <Stop offset="1" stopColor={G} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#brilloGeneral)" />
      </Svg>
    </View>
  );
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
      colors={[oroMezcla(0.2, C.tarjeta), C.tarjeta]}
      locations={[0, 0.66]}
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
}

export function RotuloGeneral({ texto, em, onEm, emA11y, style, seccion }: RotuloGeneralProps) {
  return (
    <View style={[styles.rotulo, seccion && styles.rotuloSeccion, style]}>
      <Text style={styles.rotuloTexto} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.35}>
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
  const color = fantasma ? G : C.fondo;
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
        {titulo.toUpperCase()}
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
          style={({ pressed }) => [styles.segmento, o.id === valor && styles.segmentoActivo, pressed && styles.pulsada]}
        >
          <Text style={[styles.segmentoTexto, o.id === valor && styles.segmentoTextoActivo]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {o.texto.toUpperCase()}
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
    <View style={[styles.barra, { height: alto, borderRadius: alto }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.barraRelleno, { width: `${Math.round(r * 100)}%`, borderRadius: alto, backgroundColor: color, shadowColor: color }]} />
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
      <View style={styles.cifraCabeza}>
        {icono ? <Ionicons name={icono} size={px(11)} color={G} /> : null}
        <Text style={styles.cifraRotulo} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {rotulo}
        </Text>
      </View>
      <Text style={styles.cifraValor} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.3}>
        {valor}
        {unidad ? <Text style={styles.cifraUnidad}>{` ${unidad}`}</Text> : null}
      </Text>
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

/** El escudo de oro de la lámina 4 con el nivel global dentro. */
export function Escudo({ nivel, lado = px(66) }: { nivel: number | string; lado?: number }) {
  const alto = lado * 1.12;
  return (
    <View style={{ width: lado, height: alto }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={lado} height={alto} viewBox="0 0 100 112">
        <Path d="M50 4 L92 18 L92 52 C92 80 72 98 50 108 C28 98 8 80 8 52 L8 18 Z" fill={oroMezcla(0.14, C.fondo)} stroke={G} strokeWidth={5} strokeLinejoin="round" />
        <Path d="M50 14 L83 25 L83 52 C83 74 67 89 50 97 C33 89 17 74 17 52 L17 25 Z" fill="none" stroke={oroA(0.35)} strokeWidth={1.5} strokeLinejoin="round" />
      </Svg>
      <View style={styles.escudoDentro}>
        <Text style={[styles.escudoNivel, { fontSize: Math.round(lado * (String(nivel).length > 2 ? 0.34 : 0.42)) }]} numberOfLines={1} maxFontSizeMultiplier={1}>
          {nivel}
        </Text>
      </View>
    </View>
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

export function FilaGeneral({ children, primera, onPress, accessibilityLabel, style }: { children: ReactNode; primera?: boolean; onPress?: () => void; accessibilityLabel?: string; style?: StyleProp<ViewStyle> }) {
  const caja = [styles.fila, !primera && styles.filaRegla, style];
  if (!onPress) {
    return (
      <View style={caja} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => [caja, pressed && styles.pulsada]}>
      {children}
    </Pressable>
  );
}

/** El cuadro de oro con un icono (accesos, campañas). */
export function CuadroGeneral({ lado = px(40), children }: { lado?: number; children: ReactNode }) {
  return <View style={[styles.cuadro, { width: lado, height: lado, borderRadius: px(10) }]}>{children}</View>;
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
  titulo: { fontFamily: F.b, fontSize: fs(17), lineHeight: Math.round(fs(17) * 1.2), color: C.blanco },
  cuerpo: { fontFamily: F.r, fontSize: fs(11), lineHeight: Math.round(fs(11) * 1.42), color: C.claro },
  detalle: { fontFamily: F.r, fontSize: fs(9.5), lineHeight: Math.round(fs(9.5) * 1.35), color: C.suave },
  fila: { fontFamily: F.m, fontSize: fs(11.5), lineHeight: Math.round(fs(11.5) * 1.32), color: C.texto, flexShrink: 1 },
  oro: { fontFamily: F.b, fontSize: fs(10), lineHeight: Math.round(fs(10) * 1.3), color: G },
  cinzel: { fontFamily: F.cinzel, color: C.blanco },
});

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  transparente: { backgroundColor: 'transparent' },
  cuerpo: { paddingHorizontal: M.margen, paddingTop: px(2), paddingBottom: px(30), gap: px(9) },
  flex: { flex: 1, minWidth: 0 },
  tarjeta: {
    backgroundColor: C.tarjeta,
    borderWidth: 1,
    borderColor: C.filete,
    borderRadius: M.radio,
    paddingVertical: px(11),
    paddingHorizontal: px(12),
    overflow: 'hidden',
  },
  heroe: { borderColor: oroA(0.45) },
  pulsada: { opacity: 0.8 },
  apagado: { opacity: 0.45 },
  rotulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: px(8) },
  rotuloSeccion: { marginHorizontal: px(2), marginTop: px(6), marginBottom: px(1) },
  rotuloTexto: {
    fontFamily: F.b,
    fontSize: fs(8.5),
    lineHeight: Math.round(fs(8.5) * 1.3),
    letterSpacing: fs(8.5) * 0.16,
    color: C.mudo,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  rotuloEm: { fontFamily: F.b, fontSize: fs(8.5), lineHeight: Math.round(fs(8.5) * 1.3), letterSpacing: fs(8.5) * 0.1, color: G, textTransform: 'uppercase' },
  boton: {
    marginTop: px(8),
    minHeight: px(36),
    borderRadius: M.radioBoton,
    backgroundColor: G,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: px(7),
    paddingHorizontal: px(10),
  },
  botonFino: { minHeight: px(28) },
  botonFantasma: { backgroundColor: 'transparent', borderWidth: 1, borderColor: oroA(0.5) },
  botonTexto: { fontFamily: F.xb, fontSize: fs(11), letterSpacing: fs(11) * 0.16 },
  botonTextoFino: { fontSize: fs(9.5), letterSpacing: fs(9.5) * 0.16 },
  chip: { paddingVertical: px(7), paddingHorizontal: px(11), borderRadius: M.radioChip, borderWidth: 1, borderColor: C.borde, backgroundColor: C.tarjeta },
  chipActivo: { borderColor: G, backgroundColor: oroMezcla(0.16, C.tarjeta) },
  chipTexto: { fontFamily: F.sb, fontSize: fs(10.5), color: C.texto },
  chipTextoActivo: { color: C.blanco },
  segmentos: { flexDirection: 'row', gap: px(5), padding: px(3), borderRadius: M.radioBoton + px(3), backgroundColor: C.tarjeta, borderWidth: 1, borderColor: C.filete },
  segmento: { flex: 1, minHeight: px(32), borderRadius: M.radioBoton, alignItems: 'center', justifyContent: 'center' },
  segmentoActivo: { backgroundColor: oroMezcla(0.18, C.tarjeta), borderWidth: 1, borderColor: oroA(0.6) },
  segmentoTexto: { fontFamily: F.xb, fontSize: fs(9.5), letterSpacing: fs(9.5) * 0.16, color: C.mudo },
  segmentoTextoActivo: { color: G },
  barra: { backgroundColor: C.pista, overflow: 'hidden' },
  barraRelleno: { height: '100%', shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  cifra: { flex: 1, minWidth: 0, backgroundColor: C.tarjeta, borderWidth: 1, borderColor: C.filete, borderRadius: px(13), paddingVertical: px(9), paddingHorizontal: px(10) },
  cifraCabeza: { flexDirection: 'row', alignItems: 'center', gap: px(4) },
  cifraRotulo: { fontFamily: F.m, fontSize: fs(9), color: C.meta, flexShrink: 1 },
  cifraValor: { fontFamily: F.xb, fontSize: fs(19), lineHeight: Math.round(fs(19) * 1.25), color: C.blanco, marginTop: px(2) },
  cifraUnidad: { fontFamily: F.sb, fontSize: fs(9), color: C.mudo },
  cifraNota: { fontFamily: F.b, fontSize: fs(8.5), color: G, marginTop: px(1) },
  filaCifras: { flexDirection: 'row', gap: px(7) },
  escudoDentro: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingBottom: '8%' },
  escudoNivel: { fontFamily: F.cinzel, color: G, textShadowColor: oroA(0.6), textShadowRadius: 8 },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: px(5), marginTop: px(8) },
  barraCol: { flex: 1, alignItems: 'center', minWidth: 0 },
  barraVertical: { width: '70%', maxWidth: px(26), borderTopLeftRadius: px(5), borderTopRightRadius: px(5), backgroundColor: oroA(0.32) },
  barraVerticalFuerte: { backgroundColor: G, shadowColor: G, shadowOpacity: 0.7, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  barraCifra: { fontFamily: F.b, fontSize: fs(8), color: C.mudo, marginBottom: px(3) },
  barraCifraFuerte: { color: G },
  barraEtiqueta: { fontFamily: F.m, fontSize: fs(8), color: C.mudo, marginTop: px(5) },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: px(7), gap: px(9) },
  filaRegla: { borderTopWidth: 1, borderTopColor: C.regla },
  cuadro: { alignItems: 'center', justifyContent: 'center', backgroundColor: oroMezcla(0.1, C.fondo), borderWidth: 1, borderColor: oroA(0.35) },
  titulo: { flexDirection: 'row', alignItems: 'flex-end', gap: px(10), paddingTop: px(4), paddingBottom: px(4) },
  tituloEyebrow: { fontFamily: F.b, fontSize: fs(9), letterSpacing: fs(9) * 0.22, color: G },
  tituloTexto: { fontFamily: 'Cinzel_900Black', fontSize: 26, lineHeight: 31, letterSpacing: 1.6, color: C.blanco, marginTop: 2 },
  hueco: { backgroundColor: C.tarjeta, borderRadius: M.radio, borderWidth: 1, borderColor: C.filete },
});
