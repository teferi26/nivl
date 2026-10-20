// NIVL · Modos: el marco del emblema según la marca de maestría (MK I a V).
//
// Cinco marcos de trazo, sin relleno, en UN solo color (el acento del modo,
// `modoAcento` de tokens.ts): la marca se lee por el peso y el número de
// trazos, no por colores nuevos (línea «Mármol y tinta»).
//   MK I   un aro fino.
//   MK II  aro de regla y cuatro muescas cardinales.
//   MK III aro doble (regla + fino) y ocho muescas.
//   MK IV  aro doble de marco y doce muescas, con cuatro remaches en diagonal.
//   MK V   el de MK IV con el remate: dos ramas de laurel (la geometría del
//          kit arena, `pathLaurel`) abrazando el aro por los lados, en oro laurel.
//
// El oro es la ÚNICA excepción al monocromo y solo vive en MK V: lo pide la
// propuesta P07 como remate de la marca máxima. Si se descarta, basta con
// pasar `oro={color}` (o cambiar ORO_LAUREL) y el laurel sale en el acento.
//
// Envuelve el emblema del modo (`children`), que se centra en el hueco
// interior (`interiorMarco(tamano)`). Lo dibujado es decorativo: oculto al
// lector salvo que se pase `etiqueta` (entonces el conjunto es una imagen con
// ese nombre, p. ej. «IRON, marca 3 de 5»).

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { LAUREL_ALTO, LAUREL_ANCHO, pathLaurel } from '@/components/arena/geometria';
import { stroke } from '@/design/tokens';
import type { Marca } from '@/modos/maestria';

/** Oro laurel del manual de marca (acento opcional), solo para el remate de MK V. */
export const ORO_LAUREL = '#D6B76A'; // i18n-ok: color

/** Radio del aro exterior respecto al lado: deja sitio al laurel de MK V. */
const R_ARO = 0.32;
/** Lado del hueco interior (el emblema) respecto al lado del marco. */
const HUECO = 0.46;

/** Lado del hueco donde va el emblema para un marco de `tamano`. */
export function interiorMarco(tamano: number): number {
  return Math.round(tamano * HUECO);
}

interface Forma {
  /** Grosor del aro exterior. */
  aro: number;
  /** Aro interior (null = no hay). */
  interior: { separacion: number; grosor: number } | null;
  muescas: number;
  remaches: boolean;
  laurel: boolean;
}

/** La receta de cada marca (pura: la usan la vista y la prueba de la galería). */
export const FORMA_MARCA: Readonly<Record<Marca, Forma>> = {
  1: { aro: stroke.hairline, interior: null, muescas: 0, remaches: false, laurel: false },
  2: { aro: stroke.rule, interior: null, muescas: 4, remaches: false, laurel: false },
  3: { aro: stroke.rule, interior: { separacion: 0.05, grosor: stroke.hairline }, muescas: 8, remaches: false, laurel: false },
  4: { aro: stroke.frame, interior: { separacion: 0.055, grosor: stroke.hairline }, muescas: 12, remaches: true, laurel: false },
  5: { aro: stroke.frame, interior: { separacion: 0.055, grosor: stroke.rule }, muescas: 12, remaches: true, laurel: true },
};

export interface MarcoEmblemaProps {
  marca: Marca;
  /** El acento del modo (`modoAcento[modo]`). */
  color: string;
  /** Lado del marco en pt (por defecto 64). */
  tamano?: number;
  /** Color del laurel de MK V (por defecto ORO_LAUREL). */
  oro?: string;
  /** El emblema del modo, centrado en el hueco interior. */
  children?: ReactNode;
  /** Nombre para el lector; sin él, todo el marco es decorativo. */
  etiqueta?: string;
  style?: StyleProp<ViewStyle>;
}

export function MarcoEmblema({ marca, color, tamano = 64, oro = ORO_LAUREL, children, etiqueta, style }: MarcoEmblemaProps) {
  const forma = FORMA_MARCA[marca];
  const c = tamano / 2;
  const r = tamano * R_ARO;
  // Con poco tamaño los trazos de marco se comen el dibujo: se adelgazan.
  const escala = tamano < 40 ? 0.67 : 1;
  const aro = Math.max(1, forma.aro * escala);
  const rInterior = forma.interior ? r - tamano * forma.interior.separacion : null;
  const largoMuesca = tamano * 0.045;
  const muescas = Array.from({ length: forma.muescas }, (_, i) => {
    const a = (i / forma.muescas) * Math.PI * 2 - Math.PI / 2;
    const r0 = r + aro / 2 + 1;
    const r1 = r0 + largoMuesca;
    return { x1: c + r0 * Math.cos(a), y1: c + r0 * Math.sin(a), x2: c + r1 * Math.cos(a), y2: c + r1 * Math.sin(a) };
  });
  const remaches = forma.remaches
    ? [45, 135, 225, 315].map((g) => {
        const a = (g * Math.PI) / 180;
        const rr = rInterior !== null ? (r + rInterior) / 2 : r;
        return { cx: c + rr * Math.cos(a), cy: c + rr * Math.sin(a) };
      })
    : [];
  // Laurel: dos ramas de alto 0,56 × lado, con la base a la altura del pie
  // del aro y el tallo por fuera de él, a izquierda y derecha (la derecha es
  // el espejo de la izquierda, como en Motivos.tsx).
  const altoLaurel = tamano * 0.56;
  const anchoLaurel = (altoLaurel * LAUREL_ANCHO) / LAUREL_ALTO;
  const yLaurel = c + r - altoLaurel * 0.97;
  const xIzq = c - r - anchoLaurel * 0.75;
  const xDer = c + r + anchoLaurel * 0.75;
  const trazoLaurel = altoLaurel < 32 ? 1 : 1.5;
  const hueco = interiorMarco(tamano);

  return (
    <View
      style={[{ width: tamano, height: tamano }, style]}
      {...(etiqueta
        ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: etiqueta }
        : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const })}
    >
      <Svg width={tamano} height={tamano} viewBox={`0 0 ${tamano} ${tamano}`} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={r} stroke={color} strokeWidth={aro} fill="none" />
        {rInterior !== null && forma.interior ? (
          <Circle cx={c} cy={c} r={rInterior} stroke={color} strokeWidth={Math.max(1, forma.interior.grosor * escala)} fill="none" />
        ) : null}
        {muescas.map((m, i) => (
          <Line key={`m${i}`} {...m} stroke={color} strokeWidth={Math.max(1, stroke.rule * escala)} strokeLinecap="round" />
        ))}
        {remaches.map((p, i) => (
          <Circle key={`r${i}`} cx={p.cx} cy={p.cy} r={Math.max(1, tamano * 0.018)} fill={color} />
        ))}
        {forma.laurel ? (
          <G>
            <G transform={`translate(${xIzq}, ${yLaurel})`}>
              <Path d={pathLaurel(altoLaurel)} stroke={oro} strokeWidth={trazoLaurel} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </G>
            <G transform={`translate(${xDer}, ${yLaurel}) scale(-1, 1)`}>
              <Path d={pathLaurel(altoLaurel)} stroke={oro} strokeWidth={trazoLaurel} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </G>
          </G>
        ) : null}
      </Svg>
      {children ? (
        <View style={styles.centro} pointerEvents="box-none">
          <View style={{ width: hueco, height: hueco, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
