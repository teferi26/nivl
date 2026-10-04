// NIVL · Arena: los estados compartidos de una pantalla (SISTEMA.md §6).
//
//   · ErrorSistema → una carga o una acción que no ha salido. TarjetaArena
//     contorno con el rótulo grabado «El sistema no responde», el mensaje en
//     bodySm ink8 y «Reintentar» en secondary (no gasta la inversión de la
//     pantalla). Se anuncia al lector como alerta.
//   · CargaArena → el hueco con la forma final mientras carga: franja de
//     cifras, rótulo, tarjeta o filas. Un solo `progressbar` con su etiqueta;
//     los bloques de dentro son mudos (Skeleton).
//
// El texto del error lo pone la pantalla (`mensajeSistema(e)` u otro): aquí
// no se traduce nada.

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { TarjetaArena } from './TarjetaArena';

export interface ErrorSistemaProps {
  /** Qué ha pasado, en la voz del sistema. */
  mensaje: string;
  /** Sin él no hay botón (el error no se arregla repitiendo). */
  onReintentar?: () => void;
  /** Mientras reintenta: el botón gira y no admite otro toque. */
  reintentando?: boolean;
  /** Dentro de una sección o una hoja: menos aire y botón pequeño. */
  compacto?: boolean;
  /** Rótulo grabado. Por defecto, «El sistema no responde». */
  rotulo?: string;
  style?: StyleProp<ViewStyle>;
}

export function ErrorSistema({
  mensaje,
  onReintentar,
  reintentando,
  compacto,
  rotulo = 'El sistema no responde',
  style,
}: ErrorSistemaProps) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={style}>
      <TarjetaArena variante="contorno" rotulo={rotulo} style={compacto ? styles.compacta : undefined}>
        <Text style={styles.mensaje} maxFontSizeMultiplier={1.6}>
          {mensaje}
        </Text>
        {onReintentar ? (
          <Button
            title="Reintentar"
            icon="refresh"
            variant="secondary"
            size={compacto ? 'sm' : 'md'}
            loading={reintentando}
            onPress={onReintentar}
            style={[styles.boton, compacto && styles.botonCompacto]}
          />
        ) : null}
      </TarjetaArena>
    </View>
  );
}

/** La forma de cada hueco: lo que habrá cuando llegue el dato. */
export type FormaCarga = 'franja' | 'rotulo' | 'tarjeta' | 'filas';

export interface CargaArenaProps {
  /** Lo que oye el lector: «Cargando la agenda». */
  etiqueta: string;
  /** En orden, de arriba abajo. Se pueden repetir. */
  formas: FormaCarga[];
  /** Filas de cada forma `filas` (3 por defecto). */
  filas?: number;
  style?: StyleProp<ViewStyle>;
}

export function CargaArena({ etiqueta, formas, filas = 3, style }: CargaArenaProps) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={etiqueta}
      accessibilityState={{ busy: true }}
      style={[styles.pila, style]}
    >
      {formas.map((f, i) => (
        <HuecoForma key={`${f}-${i}`} forma={f} filas={filas} />
      ))}
    </View>
  );
}

function HuecoForma({ forma, filas }: { forma: FormaCarga; filas: number }) {
  if (forma === 'franja') {
    // Tres celdas con hairline como FranjaCifras: cifra arriba, rótulo debajo.
    return (
      <View style={styles.franja}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.celda, i > 0 && styles.celdaSep]}>
            <Skeleton height={tipo.cifra.lineHeight - 8} width={56} />
            <Skeleton height={10} width={64} />
          </View>
        ))}
      </View>
    );
  }
  if (forma === 'rotulo') {
    // Un rótulo de sección: la inscripción y la regla hasta el borde.
    return (
      <View style={styles.rotulo}>
        <Skeleton height={12} width="34%" />
        <View style={styles.regla} />
      </View>
    );
  }
  if (forma === 'tarjeta') {
    return (
      <View style={styles.tarjeta}>
        <Skeleton height={12} width="40%" />
        <Skeleton height={14} width="86%" />
        <Skeleton height={14} width="64%" />
      </View>
    );
  }
  return <SkeletonRows rows={filas} />;
}

const styles = StyleSheet.create({
  compacta: { paddingVertical: space.s3 },
  mensaje: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  boton: { marginTop: space.s4, alignSelf: 'flex-start' },
  botonCompacto: { marginTop: space.s3 },
  pila: { gap: space.s5 },
  franja: {
    flexDirection: 'row',
    borderTopWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderColor: ink.ink3,
    paddingVertical: space.s3,
  },
  celda: { flex: 1, alignItems: 'center', gap: space.s2 },
  celdaSep: { borderLeftWidth: stroke.hairline, borderLeftColor: ink.ink3 },
  rotulo: { gap: space.s2 },
  regla: { height: stroke.hairline, backgroundColor: ink.ink3 },
  tarjeta: {
    gap: space.s3,
    padding: space.s4,
    borderWidth: stroke.hairline,
    borderColor: ink.ink3,
    backgroundColor: ink.ink1,
  },
});
