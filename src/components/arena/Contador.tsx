// NIVL · Arena: el contador que sube (Reanimated).
//
// Un número que cuenta desde `desde` hasta `valor` en 700 ms con salida suave.
// El valor vive en un SharedValue del hilo de UI; solo cuando cambia el entero
// se avisa al hilo de JS (scheduleOnRN) para volver a pintar el texto. El
// lector de pantalla oye siempre el valor FINAL, nunca la cuenta.
//
// Límite de uso: como mucho 4 por pantalla y ninguno en filas de una lista.
// Con «reducir movimiento» el número aparece ya en su valor.
//
// Con `sufijo`, la cifra y la unidad son dos textos en fila (la unidad en
// Outfit pequeña, nunca «…»). Con `adjustsFontSizeToFit` el ajuste lo hace el
// propio Contador en todas las plataformas (en web el de React Native no
// existe): mide la cifra FINAL y la unidad a tamaño completo y, si no caben,
// encoge solo la cifra hasta ESCALA_MINIMA; si ni así caben, la unidad baja a
// la línea de debajo.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle } from 'react-native';
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { type as tipo } from '@/design/tokens';
import { escalaCifra, formatoMiles } from './cifras';
import { useMovimientoArena } from './quieto';

export interface ContadorProps {
  valor: number;
  /** Desde dónde cuenta. null o ausente: aparece ya en `valor` (sin cuenta). */
  desde?: number | null;
  duracion?: number;
  formato?: (n: number) => string;
  /** Unidad pequeña pegada a la cifra («d», «%», « XP»). */
  sufijo?: string;
  /** Estilo de la unidad. Por defecto, Outfit al 42 % de la cifra (mínimo `micro`). */
  sufijoStyle?: StyleProp<TextStyle>;
  style?: StyleProp<TextStyle>;
  /** Por defecto, el valor final formateado más el sufijo. */
  accessibilityLabel?: string;
  maxFontSizeMultiplier?: number;
  adjustsFontSizeToFit?: boolean;
  numberOfLines?: number;
}

export function Contador({
  valor,
  desde,
  duracion = 700,
  formato = formatoMiles,
  sufijo,
  sufijoStyle,
  style,
  accessibilityLabel,
  maxFontSizeMultiplier,
  adjustsFontSizeToFit,
  numberOfLines,
}: ContadorProps) {
  const reducido = useMovimientoArena();
  const inicio = desde ?? valor;
  const sv = useSharedValue(inicio);
  const [shown, setShown] = useState(() => Math.round(reducido ? valor : inicio));

  useAnimatedReaction(
    () => Math.round(sv.value),
    (v, previo) => {
      if (v !== previo) scheduleOnRN(setShown, v);
    },
  );

  useEffect(() => {
    if (reducido) {
      cancelAnimation(sv);
      sv.value = valor;
      setShown(Math.round(valor));
      return;
    }
    sv.value = withTiming(valor, {
      duration: duracion,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [valor, duracion, reducido, sv]);

  // Al llegar se pinta el valor exacto (por si no es entero).
  const llegado = shown === Math.round(valor);
  const texto = formato(llegado ? valor : shown);
  const final = `${formato(valor)}${sufijo ?? ''}`;
  const plano = StyleSheet.flatten(style) ?? {};
  const tamSufijo = Math.max(tipo.micro.size, Math.round((plano.fontSize ?? tipo.cifra.size) * 0.42));

  if (!sufijo) {
    return (
      <Text
        style={[styles.base, style]}
        accessibilityLabel={accessibilityLabel ?? final}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        adjustsFontSizeToFit={adjustsFontSizeToFit}
        numberOfLines={numberOfLines ?? (adjustsFontSizeToFit ? 1 : undefined)}
      >
        {texto}
      </Text>
    );
  }

  return (
    <CifraConUnidad
      texto={texto}
      cifraFinal={formato(valor)}
      sufijo={sufijo}
      estiloCifra={[styles.base, style]}
      estiloSufijo={[styles.sufijo, { fontSize: tamSufijo, color: plano.color }, sufijoStyle]}
      etiqueta={accessibilityLabel ?? final}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      ajustar={!!adjustsFontSizeToFit}
    />
  );
}

/** El hueco de « XP» entre la cifra y la unidad (un espacio de Outfit 14). */
const SEPARACION_SUFIJO = 4;

export interface CifraConUnidadProps {
  texto: string;
  cifraFinal: string;
  sufijo: string;
  estiloCifra: StyleProp<TextStyle>;
  estiloSufijo: StyleProp<TextStyle>;
  etiqueta: string;
  maxFontSizeMultiplier?: number;
  ajustar: boolean;
}

/**
 * La cifra y su unidad en fila; con `ajustar`, encoge la cifra para caber.
 * La usa también FranjaCifras para las cifras de texto («45», «3/5») con unidad.
 */
export function CifraConUnidad({
  texto,
  cifraFinal,
  sufijo,
  estiloCifra,
  estiloSufijo,
  etiqueta,
  maxFontSizeMultiplier,
  ajustar,
}: CifraConUnidadProps) {
  const [hueco, setHueco] = useState(0);
  const [anchoCifra, setAnchoCifra] = useState(0);
  const [anchoSufijo, setAnchoSufijo] = useState(0);
  const ancho = (set: (n: number) => void) => (e: LayoutChangeEvent) => set(e.nativeEvent.layout.width);

  const plano = StyleSheet.flatten(estiloCifra) ?? {};
  // El espacio inicial de « XP» se pierde en web al ser un texto aparte: va como margen.
  const separado = /^\s/.test(sufijo);
  const unidad = sufijo.trimStart();
  const margen = separado ? SEPARACION_SUFIJO : 0;
  const { escala, partir } = ajustar
    ? escalaCifra(hueco, anchoCifra, anchoSufijo + margen)
    : { escala: 1, partir: false };
  const encogida =
    escala < 1
      ? {
          fontSize: (plano.fontSize ?? tipo.cifra.size) * escala,
          ...(typeof plano.lineHeight === 'number' ? { lineHeight: plano.lineHeight * escala } : null),
        }
      : null;
  // La alineación de la cifra (textAlign) decide dónde va la fila en su caja
  // (y, partida, dónde cae la unidad). La fila alinea siempre por la línea base.
  const alinear =
    plano.textAlign === 'center' ? styles.alCentro : plano.textAlign === 'right' ? styles.alFinal : styles.alInicio;
  const repartir =
    plano.textAlign === 'center' ? styles.juntoCentro : plano.textAlign === 'right' ? styles.juntoFinal : null;

  return (
    <View
      style={[styles.caja, alinear, ajustar && styles.recortada]}
      onLayout={ajustar ? ancho(setHueco) : undefined}
      accessible
      accessibilityRole="text"
      accessibilityLabel={etiqueta}
    >
      <View
        style={[styles.fila, partir && styles.filaPartida, repartir]}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Text style={[estiloCifra, encogida]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={1}>
          {texto}
        </Text>
        <Text
          style={[estiloSufijo, { marginLeft: partir ? 0 : margen }, partir && styles.sufijoPartido]}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          numberOfLines={1}
        >
          {unidad}
        </Text>
      </View>
      {ajustar ? (
        // La medida: cifra final y unidad a tamaño completo, invisibles y sin límite de ancho.
        <View style={styles.medida} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Text
            style={[estiloCifra, styles.medido]}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            numberOfLines={1}
            onLayout={ancho(setAnchoCifra)}
          >
            {cifraFinal}
          </Text>
          <Text
            style={[estiloSufijo, styles.medido]}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            numberOfLines={1}
            onLayout={ancho(setAnchoSufijo)}
          >
            {unidad}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Cifras tabulares: la anchura no baila mientras cuenta.
  base: { fontVariant: ['tabular-nums'], includeFontPadding: false },
  sufijo: { fontFamily: tipo.micro.family, letterSpacing: tipo.micro.tracking, includeFontPadding: false },
  caja: { alignSelf: 'stretch', minWidth: 0 },
  // La medida invisible mide 4000 de ancho: que no ensanche el scroll de nadie.
  recortada: { overflow: 'hidden' },
  fila: { flexDirection: 'row', alignItems: 'baseline' },
  filaPartida: { flexWrap: 'wrap' },
  // Partida, la unidad pega por arriba a la cifra encogida: las dos líneas caben en la franja.
  sufijoPartido: { lineHeight: tipo.micro.lineHeight },
  alInicio: { alignItems: 'flex-start' },
  alCentro: { alignItems: 'center' },
  alFinal: { alignItems: 'flex-end' },
  juntoCentro: { justifyContent: 'center' },
  juntoFinal: { justifyContent: 'flex-end' },
  medida: { position: 'absolute', top: 0, left: 0, width: 4000, opacity: 0, pointerEvents: 'none' },
  medido: { alignSelf: 'flex-start', flexShrink: 0 },
});
