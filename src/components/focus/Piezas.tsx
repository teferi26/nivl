// NIVL · FOCUS: las piezas de la lámina 3 (P01). Puras.
//
//   TarjetaFocus   la tarjeta redondeada (y la principal, con degradado del acento)
//   Rotulo         «EXÁMENES ........ 2 PRÓXIMOS» (izquierda gris, derecha acento)
//   BotonFocus     el botón grande lleno del acento («EMPEZAR BLOQUE») y su contorno
//   Etiqueta       la pastilla «EN 12 DÍAS»
//   BarraFocus     la barra fina redondeada
//   Casilla        la casilla del temario (vacía, a medias, hecha)
//   AnilloReloj    el reloj del pomodoro (25:00 · BLOQUE)
//   FilaFocus      la fila con separador fino
//   ChipFocus      el chip del plan y de las asignaturas (activo, añadir)
//   VacioFocus     el estado vacío dentro de una tarjeta

import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ink, space, type as tipo } from '@/design/tokens';
import { F, R } from './estilo';

type Icono = keyof typeof Ionicons.glyphMap;

// Los nombres de modo no se traducen.
const NOMBRE_FOCUS = 'FOCUS'; // i18n-ok

export function TarjetaFocus({
  heroe,
  children,
  style,
  accessibilityLabel,
}: {
  heroe?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  if (heroe) {
    return (
      <View style={[styles.tarjeta, styles.heroeBorde, style]} accessibilityLabel={accessibilityLabel}>
        <LinearGradient
          colors={[F.heroe, F.tarjeta]}
          locations={[0, 0.62]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.75, y: 1 }}
          style={styles.degradado}
          pointerEvents="none"
        />
        {children}
      </View>
    );
  }
  return (
    <View style={[styles.tarjeta, style]} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}

export function Rotulo({
  texto,
  derecha,
  onDerecha,
  derechaA11y,
  icono,
  style,
}: {
  texto: string;
  derecha?: string | null;
  onDerecha?: () => void;
  derechaA11y?: string;
  /** Un botón de icono al final (ajustes). */
  icono?: { nombre: Icono; a11y: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}) {
  const der = derecha ? (
    <Text style={styles.rotuloDerecha} maxFontSizeMultiplier={1.35} numberOfLines={1}>
      {derecha}
    </Text>
  ) : null;
  return (
    <View style={[styles.rotulo, style]}>
      <Text style={styles.rotuloTexto} accessibilityRole="header" maxFontSizeMultiplier={1.35} numberOfLines={1}>
        {texto}
      </Text>
      <View style={styles.rotuloDer}>
      {der && onDerecha ? (
        <Pressable
          onPress={onDerecha}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={derechaA11y ?? derecha ?? undefined}
          style={({ pressed }) => pressed && styles.pulsado}
        >
          {der}
        </Pressable>
      ) : (
        der
      )}
      {icono ? (
        <Pressable
          onPress={icono.onPress}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel={icono.a11y}
          style={({ pressed }) => pressed && styles.pulsado}
        >
          <Ionicons name={icono.nombre} size={16} color={F.acento} />
        </Pressable>
      ) : null}
      </View>
    </View>
  );
}

export function BotonFocus({
  titulo,
  onPress,
  icono,
  variante = 'lleno',
  disabled,
  style,
  accessibilityLabel,
  pequeno,
}: {
  titulo: string;
  onPress: () => void;
  icono?: Icono;
  variante?: 'lleno' | 'contorno' | 'texto';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  pequeno?: boolean;
}) {
  const lleno = variante === 'lleno';
  const color = lleno ? F.sobreAcento : F.acento;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? titulo}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.boton,
        pequeno && styles.botonPequeno,
        lleno ? styles.botonLleno : variante === 'contorno' ? styles.botonContorno : styles.botonTexto,
        disabled && styles.apagado,
        pressed && styles.pulsado,
        style,
      ]}
    >
      {icono ? <Ionicons name={icono} size={pequeno ? 16 : 18} color={color} /> : null}
      <Text style={[styles.botonTitulo, pequeno && styles.botonTituloPequeno, { color }]} maxFontSizeMultiplier={1.25} numberOfLines={1}>
        {titulo}
      </Text>
    </Pressable>
  );
}

export function Etiqueta({ texto, apagada }: { texto: string; apagada?: boolean }) {
  return (
    <View style={[styles.etiqueta, apagada && styles.etiquetaApagada]}>
      <Text style={[styles.etiquetaTexto, apagada && styles.etiquetaTextoApagada]} maxFontSizeMultiplier={1.25} numberOfLines={1}>
        {texto}
      </Text>
    </View>
  );
}

export function BarraFocus({ ratio, style }: { ratio: number; style?: StyleProp<ViewStyle> }) {
  const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <View style={[styles.pista, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.relleno, { width: `${Math.round(r * 100)}%` }]} />
    </View>
  );
}

export function Casilla({ estado, redonda }: { estado: 'vacia' | 'media' | 'hecha'; /** Elección única (radio). */ redonda?: boolean }) {
  return (
    <View
      style={[styles.casilla, redonda && styles.redonda, estado !== 'vacia' && styles.casillaOn, estado === 'hecha' && !redonda && styles.casillaHecha]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {estado === 'hecha' && !redonda ? <Ionicons name="checkmark" size={14} color={F.sobreAcento} /> : null}
      {estado === 'hecha' && redonda ? <View style={styles.punto} /> : null}
    </View>
  );
}

const LADO_ANILLO = 80;
const RADIO = 37;
const GROSOR = 7;

export function AnilloReloj({ ratio, reloj, pie, lado = LADO_ANILLO, apagado }: { ratio: number; reloj: string; pie: string; lado?: number; /** El descanso: arco gris, no violeta. */ apagado?: boolean }) {
  const c = 2 * Math.PI * RADIO;
  const r = Math.max(0, Math.min(1, ratio));
  const escala = lado / LADO_ANILLO;
  return (
    <View style={{ width: lado, height: lado }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={lado} height={lado} viewBox="0 0 88 88">
        <Circle cx={44} cy={44} r={RADIO} stroke={F.anilloPista} strokeWidth={GROSOR} fill="none" />
        {r > 0 ? (
          <Circle
            cx={44}
            cy={44}
            r={RADIO}
            stroke={apagado ? F.meta : F.acento}
            strokeWidth={GROSOR}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * r} ${c}`}
            transform="rotate(-90 44 44)"
          />
        ) : null}
      </Svg>
      <View style={styles.anilloCentro}>
        <Text style={[styles.reloj, { fontSize: 20 * escala, lineHeight: 24 * escala }]} maxFontSizeMultiplier={1} adjustsFontSizeToFit numberOfLines={1}>
          {reloj}
        </Text>
        <Text style={[styles.relojPie, { fontSize: 9 * Math.max(1, escala * 0.9) }]} maxFontSizeMultiplier={1} numberOfLines={1}>
          {pie}
        </Text>
      </View>
    </View>
  );
}

export function FilaFocus({
  primera,
  children,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityActions,
  onAccessibilityAction,
  style,
}: {
  primera?: boolean;
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityActions?: { name: string; label: string }[];
  onAccessibilityAction?: (e: { nativeEvent: { actionName: string } }) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const base = [styles.fila, !primera && styles.filaSeparada, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      style={({ pressed }) => [...base, pressed && styles.pulsado]}
    >
      {children}
    </Pressable>
  );
}

export function ChipFocus({
  arriba,
  titulo,
  activo,
  anadir,
  onPress,
  accessibilityLabel,
  style,
}: {
  arriba?: string;
  titulo: string;
  activo?: boolean;
  anadir?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const contenido = (
    <>
      {arriba ? (
        <Text style={styles.chipArriba} maxFontSizeMultiplier={1.25} numberOfLines={1}>
          {arriba}
        </Text>
      ) : null}
      <Text style={[styles.chipTitulo, anadir && styles.chipAnadirTexto]} maxFontSizeMultiplier={1.25} numberOfLines={1}>
        {titulo}
      </Text>
    </>
  );
  const estilo = [styles.chip, activo && styles.chipActivo, anadir && styles.chipAnadir, style];
  if (!onPress) return <View style={estilo}>{contenido}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!activo }}
      accessibilityLabel={accessibilityLabel ?? (arriba ? `${arriba}, ${titulo}` : titulo)}
      style={({ pressed }) => [...estilo, pressed && styles.pulsado]}
    >
      {contenido}
    </Pressable>
  );
}

export function VacioFocus({
  icono,
  titulo,
  cuerpo,
  accion,
  rotulo,
}: {
  icono: Icono;
  titulo: string;
  cuerpo?: string;
  accion?: { titulo: string; onPress: () => void };
  rotulo?: string;
}) {
  return (
    <View style={styles.vacio}>
      {rotulo ? <Rotulo texto={rotulo} style={styles.vacioRotulo} /> : null}
      <View style={styles.vacioCabeza}>
        <Ionicons name={icono} size={20} color={F.acento} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <Text style={[styles.vacioTitulo, styles.flexTexto]} maxFontSizeMultiplier={1.35}>
          {titulo}
        </Text>
      </View>
      {cuerpo ? (
        <Text style={styles.vacioCuerpo} maxFontSizeMultiplier={1.5}>
          {cuerpo}
        </Text>
      ) : null}
      {accion ? <BotonFocus titulo={accion.titulo} icono="add" onPress={accion.onPress} variante="contorno" style={styles.vacioBoton} /> : null}
    </View>
  );
}

/** El título de una pestaña de FOCUS: «FOCUS» en el acento y el nombre en Cinzel. */
export function TituloFocus({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <View style={styles.titulo}>
      <Text style={styles.tituloEyebrow} maxFontSizeMultiplier={1.35}>
        {NOMBRE_FOCUS}
      </Text>
      <Text style={styles.tituloTexto} accessibilityRole="header" maxFontSizeMultiplier={1.25} numberOfLines={1} adjustsFontSizeToFit>
        {titulo}
      </Text>
      {subtitulo ? (
        <Text style={styles.tituloSub} maxFontSizeMultiplier={1.5}>
          {subtitulo}
        </Text>
      ) : null}
    </View>
  );
}

/** Texto de cuerpo y de detalle con la escala de FOCUS. */
export const textoFocus = StyleSheet.create({
  fila: { fontFamily: tipo.body.family, fontSize: 15, lineHeight: 19, color: F.texto },
  filaFuerte: { fontFamily: tipo.headline.family, fontSize: 15, lineHeight: 20, color: ink.ink10 },
  detalle: { fontFamily: tipo.bodySm.family, fontSize: 12, lineHeight: 17, color: F.rotulo },
  cuerpo: { fontFamily: tipo.bodySm.family, fontSize: 14, lineHeight: 20, color: F.meta },
  titulo: { fontFamily: tipo.headline.family, fontSize: 19, lineHeight: 23, letterSpacing: -0.2, color: ink.ink10 },
  acento: { fontFamily: tipo.micro.family, fontSize: 14, lineHeight: 20, color: F.acento },
  cifra: { fontFamily: tipo.headline.family, fontSize: 28, lineHeight: 32, letterSpacing: -0.4, color: ink.ink10 },
});

const styles = StyleSheet.create({
  titulo: { paddingTop: space.s2, paddingBottom: space.s4, gap: 2 },
  tituloEyebrow: { fontFamily: tipo.label.family, fontSize: 12, lineHeight: 16, letterSpacing: 3, color: F.acento },
  tituloTexto: { fontFamily: tipo.rank.family, fontSize: 32, lineHeight: 38, letterSpacing: 3, color: ink.ink10, textTransform: 'uppercase' },
  tituloSub: { fontFamily: tipo.bodySm.family, fontSize: 14, lineHeight: 20, color: F.meta },
  tarjeta: {
    backgroundColor: F.tarjeta,
    borderWidth: 1,
    borderColor: F.linea,
    borderRadius: R.tarjeta,
    paddingHorizontal: space.s4,
    paddingVertical: space.s3 - 1,
    overflow: 'hidden',
  },
  heroeBorde: { borderColor: F.bordeHeroe },
  degradado: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  rotulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s3, minHeight: 20 },
  rotuloDer: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  rotuloTexto: {
    flexShrink: 1,
    fontFamily: tipo.label.family,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: F.rotulo,
  },
  rotuloDerecha: {
    fontFamily: tipo.label.family,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: F.acento,
  },
  boton: {
    minHeight: 46,
    borderRadius: R.boton,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s2,
    paddingHorizontal: space.s5,
  },
  botonPequeno: { minHeight: 44, paddingHorizontal: space.s4, borderRadius: 12 },
  botonLleno: { backgroundColor: F.acento },
  botonContorno: { borderWidth: 1, borderColor: F.bordeActivo },
  botonTexto: {},
  botonTitulo: { fontFamily: tipo.label.family, fontSize: 14, lineHeight: 18, letterSpacing: 2.6, textTransform: 'uppercase' },
  botonTituloPequeno: { fontSize: 13, letterSpacing: 1.8 },
  apagado: { opacity: 0.45 },
  pulsado: { opacity: 0.7 },
  etiqueta: { backgroundColor: F.acento, borderRadius: R.etiqueta, paddingHorizontal: 6, paddingVertical: 2 },
  etiquetaApagada: { backgroundColor: 'transparent', borderWidth: 1, borderColor: F.control },
  etiquetaTexto: { fontFamily: tipo.label.family, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, color: F.sobreAcento, textTransform: 'uppercase' },
  etiquetaTextoApagada: { color: F.meta },
  pista: { height: 5, borderRadius: R.barra, backgroundColor: F.pista, overflow: 'hidden' },
  relleno: { height: 5, borderRadius: R.barra, backgroundColor: F.acento },
  casilla: {
    width: 20,
    height: 20,
    borderRadius: R.casilla,
    borderWidth: 1.5,
    borderColor: F.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaOn: { borderColor: F.acento },
  casillaHecha: { backgroundColor: F.acento },
  redonda: { borderRadius: 10 },
  punto: { width: 10, height: 10, borderRadius: 5, backgroundColor: F.acento },
  anilloCentro: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  reloj: { fontFamily: tipo.headline.family, color: ink.ink10, letterSpacing: 0.2 },
  relojPie: { fontFamily: tipo.micro.family, color: F.rotulo, letterSpacing: 1.2, marginTop: 1 },
  // 36 de alto visible y 4 de hitSlop arriba y abajo: la zona táctil sigue siendo de 44.
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s3, minHeight: 36, paddingVertical: space.s1 },
  filaSeparada: { borderTopWidth: 1, borderTopColor: F.separador },
  chip: {
    borderRadius: R.chip,
    borderWidth: 1,
    borderColor: F.linea,
    backgroundColor: ink.ink1,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipActivo: { borderColor: F.bordeActivo, backgroundColor: F.activo },
  chipAnadir: { borderStyle: 'dashed', borderColor: F.bordeActivo, backgroundColor: 'transparent' },
  chipAnadirTexto: { color: F.acento },
  chipArriba: { fontFamily: tipo.label.family, fontSize: 11, lineHeight: 14, color: F.rotulo, letterSpacing: 0.4 },
  chipTitulo: { fontFamily: tipo.micro.family, fontSize: 14, lineHeight: 19, color: ink.ink10 },
  vacio: { alignItems: 'flex-start', gap: space.s2, paddingVertical: space.s1 },
  vacioRotulo: { alignSelf: 'stretch', paddingBottom: space.s2, borderBottomWidth: 1, borderBottomColor: F.linea, marginBottom: space.s1 },
  vacioCabeza: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  flexTexto: { flexShrink: 1 },
  vacioTitulo: { fontFamily: tipo.headline.family, fontSize: 16, lineHeight: 22, color: ink.ink10 },
  vacioCuerpo: { fontFamily: tipo.bodySm.family, fontSize: 14, lineHeight: 20, color: F.meta },
  vacioBoton: { marginTop: space.s2, alignSelf: 'stretch' },
});
