// NIVL · Mundos WORK y FOUNDER: las piezas de la maqueta Ónix («OnixModos»).
// Puras: todo llega por props.
//
//   · HeroMundo: la tarjeta con velo de oro (rótulo, título, barra y pie). El
//     escudo con nivel solo si se pide: WORK va sin él.
//   · TarjetaCoach: «TU COACH», una frase y la entrada al coach.
//   · TresCifras: tres placas con la cifra en Playfair.

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Barra, TarjetaArena } from '@/components/arena';
import { Button } from '@/components/ui';
import { ink, oro, radio, space, stroke, type as tipo, vidrio } from '@/design/tokens';
import { t } from '@/i18n';

export interface HeroMundoProps {
  rotulo: string;
  /** Dato discreto a la derecha del rótulo («NV 11»). */
  meta?: string;
  titulo: string;
  /** 0 a 1. */
  ratio: number;
  pie: string;
  /** Qué mide la barra, para el lector. */
  etiquetaBarra: string;
  /** El número del escudo; sin él no hay escudo. */
  escudo?: number;
}

/** El escudo con la N de la marca, llevado al nivel (maqueta Ónix). */
function Escudo({ nivel }: { nivel: number }) {
  return (
    <View style={styles.escudo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={62} height={72} viewBox="0 0 120 138">
        <Path d="M60 4 L114 20 V62 C114 100 88 122 60 134 C32 122 6 100 6 62 V20 Z" fill={ink.ink1} stroke={oro.hilo} strokeWidth={3} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.escudoCentro]}>
        <Text style={styles.escudoNumero} maxFontSizeMultiplier={1} numberOfLines={1}>
          {nivel}
        </Text>
      </View>
    </View>
  );
}

export function HeroMundo({ rotulo, meta, titulo, ratio, pie, etiquetaBarra, escudo }: HeroMundoProps) {
  return (
    <View style={styles.heroe} accessible accessibilityLabel={[rotulo, titulo, pie].join('. ')}>
      {escudo !== undefined ? <Escudo nivel={escudo} /> : null}
      <View style={styles.heroeTextos}>
        <View style={styles.heroeCabecera}>
          <Text style={styles.rotulo} maxFontSizeMultiplier={1.35} numberOfLines={1}>
            {rotulo}
          </Text>
          {meta ? (
            <Text style={styles.rotulo} maxFontSizeMultiplier={1.35} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        <Text style={styles.heroeTitulo} maxFontSizeMultiplier={1.35} numberOfLines={2}>
          {titulo}
        </Text>
        <Barra ratio={ratio} alto={4} tono="oro" etiqueta={etiquetaBarra} enGrupo />
        <Text style={styles.heroePie} maxFontSizeMultiplier={1.35} numberOfLines={2}>
          {pie}
        </Text>
      </View>
    </View>
  );
}

export function TarjetaCoach({ cuerpo, onAbrir }: { cuerpo: string; onAbrir: () => void }) {
  return (
    <TarjetaArena variante="contorno">
      <Text style={styles.rotuloOro} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
        {t('mundos:mundo.tuCoach')}
      </Text>
      <Text style={styles.coach} maxFontSizeMultiplier={1.35} numberOfLines={4}>
        {cuerpo}
      </Text>
      <Button title={t('mundos:mundo.coachAbrir')} icon="chatbubble-ellipses-outline" variant="ghost" size="sm" onPress={onAbrir} style={styles.coachBoton} />
    </TarjetaArena>
  );
}

export interface CifraMundo {
  valor: string;
  rotulo: string;
}

export function TresCifras({ cifras }: { cifras: readonly CifraMundo[] }) {
  return (
    <View style={styles.cifras}>
      {cifras.map((c) => (
        <View key={c.rotulo} style={styles.cifra} accessible accessibilityLabel={[c.rotulo, c.valor].join('. ')}>
          <Text style={styles.cifraValor} maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {c.valor}
          </Text>
          <Text style={styles.cifraRotulo} maxFontSizeMultiplier={1.35} numberOfLines={2}>
            {c.rotulo}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** El título grande de la tarjeta «Ahora», igual en WORK y en FOUNDER. */
export const tituloAhora = {
  fontFamily: tipo.headline.family,
  fontSize: tipo.number.size,
  lineHeight: tipo.number.lineHeight,
  letterSpacing: tipo.headline.tracking,
  color: ink.ink9,
} as const;

const styles = StyleSheet.create({
  heroe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s4,
    borderRadius: radio.tarjeta,
    borderWidth: stroke.hairline,
    borderColor: oro.borde,
    backgroundColor: oro.fondo,
  },
  heroeTextos: { flex: 1, minWidth: 0 },
  heroeCabecera: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s3 },
  heroeTitulo: {
    fontFamily: tipo.headline.family,
    fontSize: tipo.headline.size,
    lineHeight: tipo.headline.lineHeight,
    letterSpacing: tipo.headline.tracking,
    color: ink.ink9,
    marginTop: 2,
    marginBottom: space.s2,
  },
  heroePie: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8, marginTop: space.s1 },
  escudo: { width: 62, height: 72 },
  escudoCentro: { alignItems: 'center', justifyContent: 'center' },
  escudoNumero: { fontFamily: tipo.number.family, fontSize: tipo.number.size, lineHeight: tipo.number.lineHeight, color: oro.claro },
  rotulo: {
    flexShrink: 1,
    minWidth: 0,
    fontFamily: tipo.label.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink8,
  },
  rotuloOro: {
    fontFamily: tipo.label.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: oro.claro,
  },
  coach: { fontFamily: tipo.body.family, fontSize: tipo.body.size, lineHeight: tipo.body.lineHeight, color: ink.ink9, marginTop: space.s1 },
  coachBoton: { alignSelf: 'flex-start', marginTop: space.s2 },
  cifras: { flexDirection: 'row', gap: space.s2 },
  cifra: {
    flex: 1,
    minWidth: 0,
    padding: space.s3,
    borderRadius: radio.control,
    borderWidth: stroke.hairline,
    borderColor: vidrio.borde,
    backgroundColor: vidrio.tarjeta,
  },
  cifraValor: { fontFamily: tipo.number.family, fontSize: tipo.headline.size, lineHeight: tipo.headline.lineHeight, color: ink.ink9 },
  cifraRotulo: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, lineHeight: tipo.micro.lineHeight, color: ink.ink8 },
});
