// NIVL · Modos: la cabecera común de cada mundo (IRON, FOCUS, WORK, FOUNDER),
// el «HUD» de la lámina 2 de la P01. Pura.
//
//   [emblema] NIVL                  IRON
//                                  NV 14
//                                  ▬▬▬▬▬▬▬
//                                  2.160 / 3.000 XP
//
// · `emblema`: la ranura del emblema del modo (EmblemaMundo: la placa del
//   modo, que abre la rueda). Sin él, la placa quieta con el glifo.
// · El nivel es el del modo (`mode_xp`, misma curva que el global): suma
//   también al nivel global, que vive en NIVL.
// · `conNivel`: WORK y FOUNDER lo apagan en Hoy, donde el nivel va en el héroe.
// Ónix: «NIVL» en Playfair, el modo en rótulo de oro y la barra con el hilo.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatoMiles, ratioSeguro } from '@/components/arena';
import { Skeleton } from '@/components/ui';
import { GlifoModo } from '@/components/modos/rueda/GlifoModo';
import { acentoRueda, ink, oro, radio, space, type as tipo, vidrio } from '@/design/tokens';
import { t } from '@/i18n';
import type { NivelModo } from '@/modos/niveles';
import { NOMBRE_MODO, type ModoEtiqueta } from '@/modos/tipos';
import { usePrestado } from './Prestado';

export interface CabeceraMundoProps {
  modo: ModoEtiqueta;
  /** El nivel del modo; null mientras se lee (huecos). */
  nivel: NivelModo | null;
  /** La ranura del emblema del modo (EmblemaMundo). */
  emblema?: ReactNode;
  /** Nivel y barra bajo el nombre del modo. Por defecto, sí. */
  conNivel?: boolean;
}

/** Lado de la placa del emblema (lámina 2: su centro casa con el del bloque de texto). */
export const LADO_RANURA = 44;

export function CabeceraMundo({ modo, nivel, emblema, conNivel = true }: CabeceraMundoProps) {
  const acento = acentoRueda[modo];
  const nombre = NOMBRE_MODO[modo];
  const maximo = nivel !== null && nivel.xpSiguiente <= 0;
  const ratio = nivel === null ? 0 : maximo ? 1 : ratioSeguro(nivel.xpEnNivel, nivel.xpSiguiente);
  // Prestada a General (Prestado.tsx): en la ranura del emblema, volver a NIVL.
  const prestado = usePrestado();

  return (
    <View style={styles.wrap}>
      <View style={styles.izquierda}>
        <View style={styles.ranura}>
          {prestado ? (
            <Pressable
              onPress={prestado.volver}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('general:prestado.volverA11y')}
              style={({ pressed }) => [styles.placa, pressed && styles.pulsado]}
            >
              <Ionicons name="chevron-back" size={22} color={acento} />
            </Pressable>
          ) : emblema ?? (
            <View
              style={styles.placa}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <GlifoModo modo={modo} tamano={22} color={acento} />
            </View>
          )}
        </View>
        <Text style={styles.marca} maxFontSizeMultiplier={1.35} numberOfLines={1}>
          {t('mundos:cabecera.baseCorto')}
        </Text>
      </View>

      <View style={styles.derecha}>
        <Text style={[styles.nombre, { color: acento }]} accessibilityRole="header" maxFontSizeMultiplier={1.35} numberOfLines={1}>
          {nombre}
        </Text>
      {!conNivel ? null : nivel === null ? (
        <View style={styles.nivel} accessibilityRole="progressbar" accessibilityLabel={t('mundos:cabecera.cargandoA11y', { modo: nombre })}>
          <Skeleton height={34} />
        </View>
      ) : (
        <View
          style={styles.nivel}
          accessible
          accessibilityLabel={t('mundos:cabecera.nivelA11y', { modo: nombre, nivel: nivel.nivel, xp: formatoMiles(nivel.xp) })}
        >
          <Text style={styles.nv} maxFontSizeMultiplier={1.35}>
            {t('mundos:cabecera.nivel', { nivel: nivel.nivel })}
          </Text>
          <View style={styles.pista}>
            <View style={[styles.relleno, { width: `${Math.round(ratio * 100)}%` }]} />
          </View>
          <Text style={styles.xp} maxFontSizeMultiplier={1.35} numberOfLines={1}>
            {maximo
              ? t('mundos:cabecera.xpMax')
              : t('mundos:cabecera.xp', { xp: formatoMiles(nivel.xpEnNivel), total: formatoMiles(nivel.xpSiguiente) })}
          </Text>
        </View>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
    paddingTop: space.s1,
    paddingBottom: space.s3,
  },
  izquierda: { flexDirection: 'row', alignItems: 'center', gap: space.s3, flex: 1, minWidth: 0 },
  ranura: { width: LADO_RANURA, height: LADO_RANURA, alignItems: 'center', justifyContent: 'center' },
  placa: {
    width: LADO_RANURA,
    height: LADO_RANURA,
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: oro.borde,
    backgroundColor: oro.fondo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsado: { opacity: 0.7 },
  marca: { flexShrink: 1, fontFamily: tipo.number.family, fontSize: tipo.number.size, lineHeight: tipo.number.lineHeight, letterSpacing: 3, color: ink.ink9 },
  derecha: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '45%' },
  nombre: { fontFamily: tipo.label.family, fontSize: tipo.label.size, lineHeight: tipo.label.lineHeight, letterSpacing: tipo.label.tracking },
  nivel: { width: 96, alignItems: 'flex-end', marginTop: space.s1 },
  nv: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, lineHeight: tipo.micro.lineHeight, letterSpacing: tipo.micro.tracking, color: ink.ink8 },
  pista: { width: 89, height: 5, borderRadius: radio.pastilla, backgroundColor: vidrio.pista, marginTop: space.s1, overflow: 'hidden' },
  relleno: { height: 5, borderRadius: radio.pastilla, backgroundColor: oro.hilo },
  xp: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, lineHeight: tipo.micro.lineHeight, color: ink.ink6, marginTop: space.s1 },
});
