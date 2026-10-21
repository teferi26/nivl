// NIVL · Mundo IRON: las piezas de la lámina 2 de la P01 (puras). Cada una
// copia una clase de `propuesta.html`:
//   PantallaIron  .screen + .body   (fondo negro con el brillo del acento)
//   TarjetaIron   .card / .card.hero (héroe: degradado del acento a 155°)
//   RotuloIron    .lbl + em          (rótulo en mayúsculas, acento a la derecha)
//   BotonIron     .btn / .btn.ghost  (EMPEZAR ENTRENO, + CATÁLOGO)
//   ChipIron      .rc / .rc.on / .rc.add
//   Linea         la gráfica de un peso (spark)
//   AnilloIron    el anillo de calorías
//   BarraIron     .bar (pista #1b1b20, relleno del acento con brillo)
//   CoachIron     la tarjeta del coach (avatar, burbuja, campo y enviar)
//   FilaIron      .row (filete arriba salvo la primera)

import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Polyline, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Screen } from '@/components/ui';
import { t } from '@/i18n';
import { GlifoIron, type Glifo } from './Glifos';
import { A, acentoA, C, F, fs, M, mezcla, px } from './tema';

// ── Pantalla ─────────────────────────────────────────────────────────

export interface PantallaIronProps {
  children: ReactNode;
  overlay?: ReactNode;
  /** Sin scroll (la pantalla gestiona el suyo). */
  plain?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/** El fondo de IRON: negro y, arriba a la derecha, el brillo del acento. */
export function FondoIron() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="brilloIron" cx="78%" cy="0%" rx="85%" ry="45%" fx="78%" fy="0%">
            <Stop offset="0" stopColor={A} stopOpacity={0.16} />
            <Stop offset="1" stopColor={A} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#brilloIron)" />
      </Svg>
    </View>
  );
}

export function PantallaIron({ children, overlay, plain, refreshing, onRefresh }: PantallaIronProps) {
  return (
    <View style={styles.pantalla}>
      <FondoIron />
      <Screen
        plain={plain}
        style={styles.transparente}
        contentStyle={plain ? undefined : styles.cuerpo}
        overlay={overlay}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        {children}
      </Screen>
    </View>
  );
}

// ── Tarjeta ──────────────────────────────────────────────────────────

export interface TarjetaIronProps {
  children: ReactNode;
  /** La tarjeta héroe: borde del acento y degradado (el entreno de hoy, la técnica). */
  heroe?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Toda la tarjeta es un botón. */
  onPress?: () => void;
  accessibilityLabel?: string;
}

const ANGULO_HEROE = { start: { x: 0.29, y: 0 }, end: { x: 0.71, y: 1 } };

export function TarjetaIron({ children, heroe, style, onPress, accessibilityLabel }: TarjetaIronProps) {
  const fondo = heroe ? (
    <LinearGradient
      colors={[mezcla(0.22, C.tarjeta), C.tarjeta]}
      locations={[0, 0.62]}
      start={ANGULO_HEROE.start}
      end={ANGULO_HEROE.end}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  ) : null;
  const caja = [styles.tarjeta, heroe && styles.heroe, style];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [caja, pressed && styles.pulsada]}
      >
        {fondo}
        {children}
      </Pressable>
    );
  }
  return (
    <View style={caja}>
      {fondo}
      {children}
    </View>
  );
}

// ── Rótulo ───────────────────────────────────────────────────────────

export interface RotuloIronProps {
  texto: string;
  /** Lo de la derecha, en el acento («Semana 3», «Ver todo», «78 %»). */
  em?: string;
  /** Si `em` es un enlace. */
  onEm?: () => void;
  emA11y?: string;
  style?: StyleProp<ViewStyle>;
  /** Rótulo de sección: fuera de tarjeta, con su margen. */
  seccion?: boolean;
}

export function RotuloIron({ texto, em, onEm, emA11y, style, seccion }: RotuloIronProps) {
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

export interface BotonIronProps {
  titulo: string;
  onPress: () => void;
  icono?: Glifo;
  /** `.btn.ghost`: contorno del acento. */
  fantasma?: boolean;
  /** El bajo (26 en la lámina): + CATÁLOGO. */
  fino?: boolean;
  ocupado?: boolean;
  desactivado?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function BotonIron({ titulo, onPress, icono, fantasma, fino, ocupado, desactivado, style, accessibilityLabel }: BotonIronProps) {
  const color = fantasma ? A : C.fondo;
  const apagado = desactivado || ocupado;
  return (
    <Pressable
      onPress={onPress}
      disabled={apagado}
      // La lámina los dibuja de 36 y 30: el toque llega a 44 con el margen.
      hitSlop={fino ? 8 : 4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? titulo}
      accessibilityState={{ disabled: !!apagado, busy: !!ocupado }}
      style={({ pressed }) => [
        styles.boton,
        fino && styles.botonFino,
        fantasma && styles.botonFantasma,
        pressed && styles.pulsada,
        desactivado && styles.apagado,
        style,
      ]}
    >
      {ocupado ? <ActivityIndicator size="small" color={color} /> : icono ? <GlifoIron nombre={icono} lado={px(15)} color={color} grosor={2.2} /> : null}
      <Text style={[styles.botonTexto, fino && styles.botonTextoFino, { color }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {titulo.toUpperCase()}
      </Text>
    </Pressable>
  );
}

// ── Chip ─────────────────────────────────────────────────────────────

export interface ChipIronProps {
  texto: string;
  onPress?: () => void;
  activo?: boolean;
  /** `.rc.add`: discontinuo, en el acento («+ Nueva»). */
  nuevo?: boolean;
  accessibilityLabel?: string;
  /** Pestaña de un selector (Rutinas · Pesos · Cardio). */
  pestana?: boolean;
}

export function ChipIron({ texto, onPress, activo, nuevo, accessibilityLabel, pestana }: ChipIronProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={pestana ? 'tab' : 'button'}
      accessibilityState={{ selected: !!activo }}
      accessibilityLabel={accessibilityLabel ?? texto}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [styles.chip, activo && styles.chipActivo, nuevo && styles.chipNuevo, pressed && styles.pulsada]}
    >
      <Text
        style={[styles.chipTexto, activo && styles.chipTextoActivo, nuevo && styles.chipTextoNuevo]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.35}
      >
        {texto}
      </Text>
    </Pressable>
  );
}

// ── Gráficas ─────────────────────────────────────────────────────────

/** La línea de un peso (`spark` de la lámina): área tenue, trazo y el último punto en blanco. */
export function Linea({ puntos, ancho, alto, grosor = 1.6 }: { puntos: readonly number[]; ancho: number; alto: number; grosor?: number }) {
  if (puntos.length === 0 || ancho <= 0) return <View style={{ height: alto }} />;
  const lista = puntos.length === 1 ? [puntos[0]!, puntos[0]!] : puntos;
  const max = Math.max(...lista);
  const min = Math.min(...lista);
  const r = 3;
  const util = ancho - r * 2;
  const xy = lista.map((v, i) => {
    const x = r + (i * util) / (lista.length - 1);
    const y = alto - 2 - ((v - min) / (max - min || 1)) * (alto - 6);
    return [x, max === min ? alto / 2 : y] as const;
  });
  const p = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [ux, uy] = xy[xy.length - 1]!;
  return (
    <Svg width={ancho} height={alto} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Polyline points={`${r},${alto} ${p} ${ux},${alto}`} fill={A} fillOpacity={0.12} stroke="none" />
      <Polyline points={p} fill="none" stroke={A} strokeWidth={grosor} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={ux} cy={uy} r={2.4} fill={C.blanco} stroke={A} strokeWidth={1.4} />
    </Svg>
  );
}

/** La gráfica al ancho de su hueco (mide el padre). */
export function LineaAncha({ puntos, alto, grosor }: { puntos: readonly number[]; alto: number; grosor?: number }) {
  const [ancho, setAncho] = useState(0);
  return (
    <View onLayout={(ev) => setAncho(Math.floor(ev.nativeEvent.layout.width))} style={{ height: alto }}>
      {ancho > 0 ? <Linea puntos={puntos} ancho={ancho} alto={alto} grosor={grosor} /> : null}
    </View>
  );
}

/** El anillo de la dieta: pista #1b1b20, arco del acento, la cifra dentro. */
export function AnilloIron({ ratio, lado, valor, unidad }: { ratio: number; lado: number; valor: string; unidad: string }) {
  const grosor = lado * (6 / 54);
  const radio = (lado - grosor) / 2 - lado * 0.0;
  const circ = 2 * Math.PI * radio;
  const r = Math.max(0, Math.min(1, ratio));
  return (
    <View style={{ width: lado, height: lado }}>
      <Svg width={lado} height={lado} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Circle cx={lado / 2} cy={lado / 2} r={radio} fill="none" stroke={C.pista} strokeWidth={grosor} />
        {r > 0 ? (
          <Circle
            cx={lado / 2}
            cy={lado / 2}
            r={radio}
            fill="none"
            stroke={A}
            strokeWidth={grosor}
            strokeLinecap="round"
            strokeDasharray={`${circ * r} ${circ}`}
            transform={`rotate(-90 ${lado / 2} ${lado / 2})`}
          />
        ) : null}
      </Svg>
      <View style={styles.anilloDentro}>
        <Text style={[styles.anilloValor, { fontSize: Math.round(lado * 0.2) }]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1}>
          {valor}
        </Text>
        <Text style={[styles.anilloUnidad, { fontSize: Math.max(9, Math.round(lado * 0.13)) }]} maxFontSizeMultiplier={1}>
          {unidad}
        </Text>
      </View>
    </View>
  );
}

/** `.bar`: pista y relleno del acento con su brillo. */
export function BarraIron({ ratio, alto = 3, style }: { ratio: number; alto?: number; style?: StyleProp<ViewStyle> }) {
  const r = Math.max(0, Math.min(1, ratio));
  return (
    <View style={[styles.barra, { height: alto, borderRadius: alto }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.barraRelleno, { width: `${Math.round(r * 100)}%`, borderRadius: alto }]} />
    </View>
  );
}

// ── Coach ────────────────────────────────────────────────────────────

export function AvatarIron({ lado = px(26) }: { lado?: number }) {
  return (
    <View style={[styles.avatar, { width: lado, height: lado, borderRadius: lado / 2 }]}>
      <GlifoIron nombre="pesa" lado={lado * 0.5} color={A} grosor={2} />
    </View>
  );
}

/** La tarjeta del coach de IRON: su última palabra y el campo que lleva al chat. */
export function CoachIron({ mensaje, onAbrir }: { mensaje: string; onAbrir: () => void }) {
  return (
    <TarjetaIron>
      <RotuloIron texto={t('ironmundo:coach.rotulo')} em={t('ironmundo:coach.enLinea')} style={styles.coachRotulo} />
      <View style={styles.chat}>
        <AvatarIron />
        <View style={styles.burbuja}>
          <Text style={styles.burbujaTexto} maxFontSizeMultiplier={1.6}>
            {mensaje}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onAbrir}
        hitSlop={5}
        accessibilityRole="button"
        accessibilityLabel={t('ironmundo:coach.preguntarA11y')}
        style={({ pressed }) => [styles.campo, pressed && styles.pulsada]}
      >
        <Text style={styles.campoTexto} numberOfLines={1} maxFontSizeMultiplier={1.35}>
          {t('ironmundo:coach.preguntar')}
        </Text>
        <View style={styles.enviar}>
          <GlifoIron nombre="flecha" lado={px(12)} color={C.fondo} grosor={2.6} />
        </View>
      </Pressable>
    </TarjetaIron>
  );
}

// ── Fila ─────────────────────────────────────────────────────────────

export function FilaIron({
  children,
  primera,
  onPress,
  onLongPress,
  accessibilityLabel,
  style,
  accessibilityActions,
  onAccessibilityAction,
}: {
  children: ReactNode;
  primera?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityActions?: { name: string; label?: string }[];
  onAccessibilityAction?: (e: { nativeEvent: { actionName: string } }) => void;
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
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      style={({ pressed }) => [caja, pressed && styles.pulsada]}
    >
      {children}
    </Pressable>
  );
}

/** El cuadro del acento con un icono (`.mini-fig`, y el de las filas del catálogo). */
export function CuadroIron({ lado = px(44), radio, children }: { lado?: number; radio?: number; children: ReactNode }) {
  return <View style={[styles.cuadro, { width: lado, height: lado, borderRadius: radio ?? px(10) }]}>{children}</View>;
}

/** Huecos de carga con la forma de una tarjeta de IRON. */
export function HuecoIron({ alto, style }: { alto: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.hueco, { height: alto }, style]} />;
}

export const estilosIron = StyleSheet.create({
  titulo: { fontFamily: F.b, fontSize: fs(21), lineHeight: fs(21) * 1.12, color: C.blanco, marginTop: px(4) },
  meta: { fontFamily: F.r, fontSize: fs(10), lineHeight: fs(10) * 1.35, color: C.meta, marginTop: px(2) },
  cuerpo: { fontFamily: F.r, fontSize: fs(10.5), lineHeight: fs(10.5) * 1.4, color: C.claro },
  detalle: { fontFamily: F.r, fontSize: fs(9.5), lineHeight: fs(9.5) * 1.3, color: C.suave },
  filaNombre: { fontFamily: F.m, fontSize: fs(11), color: C.texto, flexShrink: 1 },
  filaSerie: { fontFamily: F.r, fontSize: fs(10), color: C.mudo },
  filaKg: { fontFamily: F.b, fontSize: fs(11), color: C.blanco },
  kg: { fontFamily: F.xb, fontSize: fs(17), color: C.blanco },
  kgUnidad: { fontFamily: F.sb, fontSize: fs(9), color: C.mudo },
  delta: { fontFamily: F.b, fontSize: fs(8.5), color: A },
  etiqueta: {
    fontFamily: F.xb,
    fontSize: fs(7.5),
    letterSpacing: fs(7.5) * 0.14,
    color: C.fondo,
    backgroundColor: A,
    borderRadius: px(5),
    paddingHorizontal: px(5),
    paddingVertical: px(2),
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  error: { fontFamily: F.m, fontSize: fs(10.5), color: C.claro, marginTop: px(6) },
});

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  transparente: { backgroundColor: 'transparent' },
  cuerpo: { paddingHorizontal: M.margen, paddingTop: px(2), gap: M.hueco },
  tarjeta: {
    backgroundColor: C.tarjeta,
    borderWidth: 1,
    borderColor: C.filete,
    borderRadius: M.radio,
    paddingVertical: px(10),
    paddingHorizontal: px(12),
    overflow: 'hidden',
  },
  heroe: { borderColor: acentoA(0.45) },
  pulsada: { opacity: 0.8 },
  apagado: { opacity: 0.45 },
  rotulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: px(8) },
  rotuloSeccion: { marginHorizontal: px(2), marginBottom: px(6), marginTop: px(4) },
  rotuloTexto: {
    fontFamily: F.b,
    fontSize: fs(8.5),
    letterSpacing: fs(8.5) * 0.16,
    color: C.mudo,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  rotuloEm: {
    fontFamily: F.b,
    fontSize: fs(8.5),
    letterSpacing: fs(8.5) * 0.1,
    color: A,
    textTransform: 'uppercase',
  },
  boton: {
    marginTop: px(7),
    minHeight: M.boton,
    borderRadius: M.radioBoton,
    backgroundColor: A,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: px(7),
    paddingHorizontal: px(10),
  },
  botonFino: { minHeight: M.botonFino },
  botonFantasma: { backgroundColor: 'transparent', borderWidth: 1, borderColor: acentoA(0.5) },
  botonTexto: { fontFamily: F.xb, fontSize: fs(11), letterSpacing: fs(11) * 0.16 },
  botonTextoFino: { fontSize: fs(9.5), letterSpacing: fs(9.5) * 0.16 },
  chip: {
    paddingVertical: px(7),
    paddingHorizontal: px(11),
    borderRadius: M.radioChip,
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.tarjeta,
  },
  chipActivo: { borderColor: A, backgroundColor: mezcla(0.16, C.tarjeta) },
  chipNuevo: { borderStyle: 'dashed', borderColor: acentoA(0.55) },
  chipTexto: { fontFamily: F.sb, fontSize: fs(10.5), color: C.texto },
  chipTextoActivo: { color: C.blanco },
  chipTextoNuevo: { color: A },
  anilloDentro: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  anilloValor: { fontFamily: F.xb, color: C.blanco },
  anilloUnidad: { fontFamily: F.r, color: C.mudo, marginTop: -1 },
  barra: { backgroundColor: C.pista, overflow: 'hidden' },
  barraRelleno: {
    height: '100%',
    backgroundColor: A,
    shadowColor: A,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: A, backgroundColor: C.fondo },
  coachRotulo: { marginBottom: px(7) },
  chat: { flexDirection: 'row', alignItems: 'flex-start', gap: px(8) },
  burbuja: {
    flex: 1,
    backgroundColor: C.burbuja,
    borderTopLeftRadius: px(4),
    borderTopRightRadius: px(13),
    borderBottomLeftRadius: px(13),
    borderBottomRightRadius: px(13),
    paddingVertical: px(7),
    paddingHorizontal: px(9),
  },
  burbujaTexto: { fontFamily: F.r, fontSize: fs(10.5), lineHeight: fs(10.5) * 1.35, color: C.claro },
  campo: {
    marginTop: px(7),
    minHeight: px(30),
    borderRadius: px(10),
    borderWidth: 1,
    borderColor: C.borde,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: px(10),
    paddingRight: px(4),
  },
  campoTexto: { fontFamily: F.r, fontSize: fs(10), color: C.tenue, flex: 1 },
  enviar: { width: px(24), height: px(24), borderRadius: px(8), backgroundColor: A, alignItems: 'center', justifyContent: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: px(4), gap: px(8) },
  filaRegla: { borderTopWidth: 1, borderTopColor: C.regla },
  cuadro: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: mezcla(0.12, C.fondo),
    borderWidth: 1,
    borderColor: acentoA(0.35),
  },
  hueco: { backgroundColor: C.tarjeta, borderRadius: M.radio, borderWidth: 1, borderColor: C.filete },
});
