// NIVL · Mundo IRON: las piezas en Ónix (puras). Colores y radios, de tokens
// (./tema):
//   PantallaIron  el fondo de Ónix y el cuerpo con su margen
//   TarjetaIron   vidrio con filete; héroe: velo y marco de oro
//   RotuloIron    rótulo en mayúsculas, oro a la derecha
//   BotonIron     principal en hueso; fantasma con marco de oro
//   ChipIron      filete; elegido con velo y marco de oro
//   Linea         la gráfica de un peso (spark)
//   AnilloIron    el anillo de calorías
//   BarraIron     pista de vidrio y relleno de oro, sin brillo
//   CoachIron     «Tu coach»: su palabra y el campo que lleva al chat
//   FilaIron      fila con hairline arriba salvo la primera

import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { Screen } from '@/components/ui';
import { ariaWeb, pulsadoWeb } from '@/components/ui/ariaWeb';
import { FondoOnix } from '@/components/ui/FondoOnix';
import { menuContextualWeb } from '@/components/ui/pulsacionLarga';
import { vidrio } from '@/design/tokens';
import { t } from '@/i18n';
import { GlifoIron, OCULTO_LECTOR, type Glifo } from './Glifos';
import { A, C, F, H, M, O, px, R } from './tema';

// ── Pantalla ─────────────────────────────────────────────────────────

export interface PantallaIronProps {
  children: ReactNode;
  overlay?: ReactNode;
  /** Sin scroll (la pantalla gestiona el suyo). */
  plain?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** El contenido centrado en vertical (pantallas cortas: la puerta de salud). */
  centrado?: boolean;
}

/** El fondo de IRON: el de Ónix, el mismo de toda la app. */
export const FondoIron = FondoOnix;

export function PantallaIron({ children, overlay, plain, refreshing, onRefresh, centrado }: PantallaIronProps) {
  return (
    <View style={styles.pantalla}>
      <FondoIron />
      <Screen
        plain={plain}
        style={styles.transparente}
        contentStyle={plain ? undefined : [styles.cuerpo, centrado && styles.centrado]}
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
  /** La tarjeta héroe: marco y velo de oro (el nivel, la técnica). */
  heroe?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Toda la tarjeta es un botón. */
  onPress?: () => void;
  accessibilityLabel?: string;
}

const ANGULO_HEROE = { start: { x: 0.25, y: 0 }, end: { x: 0.75, y: 1 } };

export function TarjetaIron({ children, heroe, style, onPress, accessibilityLabel }: TarjetaIronProps) {
  const fondo = heroe ? (
    <LinearGradient
      colors={[O.fondo, vidrio.suave]}
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
  /** Lo de la derecha, en oro («Semana 3», «Ver todo», «78 %»). */
  em?: string;
  /** Si `em` es un enlace. */
  onEm?: () => void;
  emA11y?: string;
  style?: StyleProp<ViewStyle>;
  /** Rótulo de sección: fuera de tarjeta, con su margen. */
  seccion?: boolean;
  /** Sube la letra a 12 pt, para las pantallas de lectura. */
  legible?: boolean;
  /** El propio rótulo en oro («Tu coach»). */
  oro?: boolean;
}

export function RotuloIron({ texto, em, onEm, emA11y, style, seccion, legible, oro: enOro }: RotuloIronProps) {
  return (
    <View style={[styles.rotulo, seccion && styles.rotuloSeccion, style]}>
      <Text style={[styles.rotuloTexto, legible && styles.rotuloLegible, enOro && styles.rotuloOro]} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.35}>
        {texto}
      </Text>
      {em ? (
        onEm ? (
          <Pressable onPress={onEm} hitSlop={{ top: 16, bottom: 16, left: 14, right: 14 }} accessibilityRole="link" accessibilityLabel={emA11y ?? em}>
            <Text style={[styles.rotuloEm, legible && styles.rotuloLegible]} maxFontSizeMultiplier={1.35}>
              {em}
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.rotuloEm, legible && styles.rotuloLegible]} maxFontSizeMultiplier={1.35}>
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
  /** Secundario: sin relleno, con marco fino de oro. */
  fantasma?: boolean;
  /** El bajo: + CATÁLOGO. */
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
      // El fino mide 40: el toque llega a 44 con el margen.
      hitSlop={fino ? 4 : 0}
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
        {titulo}
      </Text>
    </Pressable>
  );
}

// ── Chip ─────────────────────────────────────────────────────────────

export interface ChipIronProps {
  texto: string;
  onPress?: () => void;
  activo?: boolean;
  /** Discontinuo, en oro («+ Nueva»). */
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
      {...(pestana ? ariaWeb({ selected: !!activo }) : pulsadoWeb(!!activo))}
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

/** La línea de un peso: área tenue, trazo y el último punto en hueso. */
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
    <Svg width={ancho} height={alto} {...OCULTO_LECTOR}>
      <Polyline points={`${r},${alto} ${p} ${ancho},${uy} ${ancho},${alto}`} fill={O.hilo} fillOpacity={0.12} stroke="none" />
      <Polyline points={p} fill="none" stroke={O.hilo} strokeWidth={grosor} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={ux} cy={uy} r={2.4} fill={C.blanco} stroke={O.hilo} strokeWidth={1.4} />
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

/** El anillo de la dieta: pista de vidrio, arco de oro, la cifra dentro. */
export function AnilloIron({ ratio, lado, valor, unidad }: { ratio: number; lado: number; valor: string; unidad: string }) {
  const grosor = lado * (6 / 54);
  const r0 = (lado - grosor) / 2;
  const circ = 2 * Math.PI * r0;
  const r = Math.max(0, Math.min(1, ratio));
  return (
    <View style={{ width: lado, height: lado }}>
      <Svg width={lado} height={lado} {...OCULTO_LECTOR}>
        <Circle cx={lado / 2} cy={lado / 2} r={r0} fill="none" stroke={C.pista} strokeWidth={grosor} />
        {r > 0 ? (
          <Circle
            cx={lado / 2}
            cy={lado / 2}
            r={r0}
            fill="none"
            stroke={O.hilo}
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

/** La barra de progreso: pista de vidrio y relleno de oro. */
export function BarraIron({ ratio, alto = 3, style }: { ratio: number; alto?: number; style?: StyleProp<ViewStyle> }) {
  const r = Math.max(0, Math.min(1, ratio));
  return (
    <View style={[styles.barra, { height: alto }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.barraRelleno, { width: `${Math.round(r * 100)}%` }]} />
    </View>
  );
}

// ── Coach ────────────────────────────────────────────────────────────

export function AvatarIron({ lado = px(26) }: { lado?: number }) {
  return (
    <View style={[styles.avatar, { width: lado, height: lado }]}>
      <GlifoIron nombre="pesa" lado={lado * 0.5} color={A} grosor={2} />
    </View>
  );
}

/** «Tu coach»: su última palabra y el campo que lleva al chat. */
export function CoachIron({ mensaje, onAbrir }: { mensaje: string; onAbrir: () => void }) {
  return (
    <TarjetaIron>
      <RotuloIron oro texto={t('ironmundo:coach.tuCoach')} />
      <Text style={styles.coachMensaje} maxFontSizeMultiplier={1.6}>
        {mensaje}
      </Text>
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
  seleccionada,
  accessibilityState,
  accessibilityHint,
}: {
  children: ReactNode;
  primera?: boolean;
  /** Lo abierto en el panel de al lado (maestro-detalle). */
  seleccionada?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityActions?: { name: string; label?: string }[];
  onAccessibilityAction?: (e: { nativeEvent: { actionName: string } }) => void;
  accessibilityState?: { expanded?: boolean };
  accessibilityHint?: string;
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
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      accessibilityState={seleccionada ? { ...accessibilityState, selected: true } : accessibilityState}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [caja, pressed && styles.pulsada]}
    >
      {children}
    </Pressable>
  );
}

/** El cuadro con marco de oro y un icono (la figura de Añadir y las filas del catálogo). */
export function CuadroIron({ lado = px(44), radio, children }: { lado?: number; radio?: number; children: ReactNode }) {
  return <View style={[styles.cuadro, { width: lado, height: lado, borderRadius: radio ?? R.chip }]}>{children}</View>;
}

/** Huecos de carga con la forma de una tarjeta de IRON. */
export function HuecoIron({ alto, style }: { alto: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.hueco, { height: alto }, style]} />;
}

export const estilosIron = StyleSheet.create({
  titulo: { fontFamily: F.b, fontSize: 24, lineHeight: 29, letterSpacing: -0.3, color: C.blanco, marginTop: 4 },
  meta: { fontFamily: F.m, fontSize: 13, lineHeight: 18, color: C.meta, marginTop: 2 },
  cuerpo: { fontFamily: F.m, fontSize: 13, lineHeight: 18, color: C.claro },
  detalle: { fontFamily: F.m, fontSize: 12, lineHeight: 15, color: C.suave },
  filaNombre: { fontFamily: F.sb, fontSize: 15, lineHeight: 20, color: C.texto, flexShrink: 1, minWidth: 0 },
  filaSerie: { fontFamily: F.m, fontSize: 13, lineHeight: 20, color: C.meta },
  filaKg: { fontFamily: F.b, fontSize: 13, lineHeight: 20, color: C.blanco },
  kg: { fontFamily: F.serif, fontSize: 20, lineHeight: 25, color: C.blanco },
  kgUnidad: { fontFamily: F.m, fontSize: 12, color: C.meta },
  delta: { fontFamily: F.b, fontSize: 11, lineHeight: 14, color: A },
  etiqueta: {
    fontFamily: F.b,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    color: A,
    backgroundColor: O.tenue,
    borderRadius: R.pastilla,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  error: { fontFamily: F.m, fontSize: 13, lineHeight: 18, color: C.claro, marginTop: 6 },
});

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  transparente: { backgroundColor: 'transparent' },
  // Abajo, aire para que lo último quepa entero sobre la barra.
  cuerpo: { paddingHorizontal: M.margen, paddingTop: 2, paddingBottom: 28, gap: M.hueco },
  centrado: { flexGrow: 1 },
  tarjeta: {
    backgroundColor: C.tarjeta,
    borderWidth: 1,
    borderColor: C.filete,
    borderRadius: M.radio,
    paddingVertical: 13,
    paddingHorizontal: 15,
    overflow: 'hidden',
  },
  heroe: { backgroundColor: 'transparent', borderColor: O.borde },
  pulsada: { opacity: 0.8 },
  apagado: { opacity: 0.45 },
  rotulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rotuloSeccion: { marginHorizontal: 2, marginBottom: 6, marginTop: 4 },
  rotuloTexto: {
    fontFamily: F.b,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2,
    color: C.meta,
    textTransform: 'uppercase',
    flexShrink: 1,
    minWidth: 0,
  },
  rotuloLegible: { fontSize: 12, lineHeight: 16 },
  rotuloOro: { color: A },
  rotuloEm: {
    fontFamily: F.b,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2,
    color: A,
    textTransform: 'uppercase',
  },
  boton: {
    marginTop: 3,
    minHeight: M.boton,
    borderRadius: M.radioBoton,
    backgroundColor: H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  botonFino: { minHeight: M.botonFino, marginTop: 8 },
  botonFantasma: { backgroundColor: 'transparent', borderWidth: 1, borderColor: O.borde },
  botonTexto: { fontFamily: F.b, fontSize: 16, lineHeight: 20, flexShrink: 1, minWidth: 0 },
  botonTextoFino: { fontSize: 13, lineHeight: 18 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: M.radioChip,
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.tarjeta,
  },
  chipActivo: { borderColor: O.borde, backgroundColor: O.tenue },
  chipNuevo: { borderStyle: 'dashed', borderColor: O.borde },
  chipTexto: { fontFamily: F.sb, fontSize: 13, lineHeight: 18, color: C.texto },
  chipTextoActivo: { color: A },
  chipTextoNuevo: { color: A },
  anilloDentro: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  anilloValor: { fontFamily: F.serif, color: C.blanco },
  anilloUnidad: { fontFamily: F.m, color: C.meta, marginTop: -1 },
  barra: { backgroundColor: C.pista, overflow: 'hidden', borderRadius: R.pastilla },
  barraRelleno: { height: '100%', backgroundColor: O.hilo, borderRadius: R.pastilla },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: O.borde, backgroundColor: O.fondo, borderRadius: R.pastilla },
  coachMensaje: { fontFamily: F.sb, fontSize: 16, lineHeight: 22, color: C.texto, marginTop: 5 },
  campo: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: R.control,
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.hueco,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 6,
  },
  campoTexto: { fontFamily: F.m, fontSize: 14, lineHeight: 20, color: C.meta, flex: 1, minWidth: 0 },
  enviar: { width: 32, height: 32, borderRadius: R.chip, backgroundColor: H, alignItems: 'center', justifyContent: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, gap: 10 },
  filaRegla: { borderTopWidth: 1, borderTopColor: C.regla },
  cuadro: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: O.fondo,
    borderWidth: 1,
    borderColor: O.borde,
  },
  hueco: { backgroundColor: C.tarjeta, borderRadius: M.radio, borderWidth: 1, borderColor: C.filete },
});
