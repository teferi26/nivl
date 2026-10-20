// NIVL · Modos: la cabecera común de cada mundo (IRON, FOCUS, WORK, FOUNDER),
// lámina 2 de la P01. Pura.
//
//   [emblema] NOMBRE DEL MODO           NV 14
//             subtítulo          ▬▬▬▬▬▬▬▬▬▬
//                                2.160 / 3.000 XP
//
// · `emblema`: la ranura del EmblemaModo de la rueda (lo pone el integrador).
//   Sin él, un cuadrado del acento: la misma marca que en Perfil.
// · El nivel es el del modo (`mode_xp`, misma curva que el global): suma
//   también al nivel global, que vive en NIVL.
// · `onBase`: volver a NIVL (el modo general). Hasta que llegue la rueda es la
//   salida del mundo; con la rueda puede quitarse.
// El acento del modo es lo único de color (tokens.ts → modoAcento).

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatoMiles, ratioSeguro } from '@/components/arena';
import { Skeleton } from '@/components/ui';
import { ink, modoAcento, space, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import type { NivelModo } from '@/modos/niveles';
import { NOMBRE_MODO, type ModoEtiqueta } from '@/modos/tipos';

export interface CabeceraMundoProps {
  modo: ModoEtiqueta;
  /** El nivel del modo; null mientras se lee (huecos). */
  nivel: NivelModo | null;
  /** La ranura del emblema del modo (EmblemaModo de la rueda). */
  emblema?: ReactNode;
  /** Volver a NIVL. Sin él no se pinta el botón. */
  onBase?: () => void;
}

const LADO_EMBLEMA = 44;

export function CabeceraMundo({ modo, nivel, emblema, onBase }: CabeceraMundoProps) {
  const acento = modoAcento[modo];
  const nombre = NOMBRE_MODO[modo];
  const maximo = nivel !== null && nivel.xpSiguiente <= 0;
  const ratio = nivel === null ? 0 : maximo ? 1 : ratioSeguro(nivel.xpEnNivel, nivel.xpSiguiente);

  return (
    <View style={styles.wrap}>
      <View style={styles.fila}>
        <View style={[styles.emblema, !emblema && { borderColor: acento }]}>
          {emblema ?? <View style={[styles.marca, { backgroundColor: acento }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />}
        </View>
        <View style={styles.textos}>
          <Text style={[styles.nombre, { color: acento }]} accessibilityRole="header" maxFontSizeMultiplier={1.35} numberOfLines={1}>
            {nombre}
          </Text>
          <Text style={styles.subtitulo} maxFontSizeMultiplier={1.35} numberOfLines={1}>
            {t(`mundos:subtitulo.${modo}`)}
          </Text>
        </View>
        {onBase ? (
          <Pressable
            onPress={onBase}
            style={({ pressed }) => [styles.base, pressed && styles.pulsado]}
            accessibilityRole="button"
            accessibilityLabel={t('mundos:cabecera.base')}
            hitSlop={4}
          >
            <Ionicons name="shield-outline" size={16} color={ink.ink9} />
            <Text style={styles.baseTexto} maxFontSizeMultiplier={1.2}>
              {t('mundos:cabecera.baseCorto')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {nivel === null ? (
        <View accessibilityRole="progressbar" accessibilityLabel={t('mundos:cabecera.cargandoA11y', { modo: nombre })}>
          <Skeleton height={28} />
        </View>
      ) : (
        <View
          style={styles.nivel}
          accessible
          accessibilityLabel={t('mundos:cabecera.nivelA11y', { modo: nombre, nivel: nivel.nivel, xp: formatoMiles(nivel.xp) })}
        >
          <Text style={[styles.nv, { color: acento }]} maxFontSizeMultiplier={1.35}>
            {t('mundos:cabecera.nivel', { nivel: nivel.nivel })}
          </Text>
          <View style={styles.barraZona}>
            <View style={styles.pista}>
              <View style={[styles.relleno, { width: `${Math.round(ratio * 100)}%`, backgroundColor: acento }]} />
            </View>
            <Text style={styles.xp} maxFontSizeMultiplier={1.35} numberOfLines={1}>
              {maximo
                ? t('mundos:cabecera.xpMax')
                : t('mundos:cabecera.xp', { xp: formatoMiles(nivel.xpEnNivel), total: formatoMiles(nivel.xpSiguiente) })}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s3, paddingTop: space.s2, paddingBottom: space.s4 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  emblema: {
    width: LADO_EMBLEMA,
    height: LADO_EMBLEMA,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: stroke.hairline,
    borderColor: 'transparent',
  },
  marca: { width: 14, height: 14 },
  textos: { flex: 1, minWidth: 0 },
  nombre: {
    fontFamily: tipo.rank.family,
    fontSize: tipo.rank.size,
    lineHeight: tipo.rank.lineHeight,
    letterSpacing: tipo.rank.tracking,
  },
  subtitulo: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  base: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: space.s3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
  },
  pulsado: { backgroundColor: ink.ink2 },
  baseTexto: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink9,
  },
  nivel: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  nv: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
  },
  barraZona: { flex: 1, gap: space.s1 },
  pista: { height: 4, backgroundColor: ink.ink4 },
  relleno: { height: 4 },
  xp: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    color: ink.ink6,
    textAlign: 'right',
  },
});
