// NIVL · Modos: la cabecera común de cada mundo (IRON, FOCUS, WORK, FOUNDER),
// el «HUD» de la lámina 2 de la P01. Pura.
//
//   [emblema] IRON                 NV 14
//             Gimnasio y dieta     ▬▬▬▬▬▬▬
//                                  2.160 / 3.000 XP
//
// · `emblema`: la ranura del emblema del modo (EmblemaMundo: la placa del
//   modo, que abre la rueda). Sin él, la placa quieta con el glifo.
// · El nivel es el del modo (`mode_xp`, misma curva que el global): suma
//   también al nivel global, que vive en NIVL.
// Tipos y medidas de la lámina (pantalla de 342 llevada a 390): nombre en
// Cinzel Black blanco, subtítulo gris, «NV» y barra en el acento con su halo.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatoMiles, ratioSeguro } from '@/components/arena';
import { Skeleton } from '@/components/ui';
import { conAlfa, halo, mezcla } from '@/components/modos/rueda/color';
import { GlifoModo } from '@/components/modos/rueda/GlifoModo';
import { acentoRueda, ink, space } from '@/design/tokens';
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
}

/** Lado de la placa del emblema (lámina 2: su centro casa con el del bloque de texto). */
export const LADO_RANURA = 44;

const GRIS = '#8B8B92';
const GRIS_XP = '#6D6D74';
const PISTA = '#1B1B20';

export function CabeceraMundo({ modo, nivel, emblema }: CabeceraMundoProps) {
  const acento = acentoRueda[modo];
  const nombre = NOMBRE_MODO[modo];
  const maximo = nivel !== null && nivel.xpSiguiente <= 0;
  const ratio = nivel === null ? 0 : maximo ? 1 : ratioSeguro(nivel.xpEnNivel, nivel.xpSiguiente);
  const sub = t(`mundos:subtitulo.${modo}`);
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
              style={({ pressed }) => [styles.placa, { borderColor: acento, backgroundColor: mezcla(acento, 0.14) }, pressed && styles.pulsado]}
            >
              <Ionicons name="chevron-back" size={22} color={acento} />
            </Pressable>
          ) : emblema ?? (
            <View
              style={[styles.placa, { borderColor: acento, backgroundColor: mezcla(acento, 0.14), boxShadow: halo(acento, 16, 0.45) }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <GlifoModo modo={modo} tamano={22} color={acento} />
            </View>
          )}
        </View>
        <View style={styles.textos}>
          <Text style={styles.nombre} accessibilityRole="header" maxFontSizeMultiplier={1.35} numberOfLines={1}>
            {nombre}
          </Text>
          <Text style={styles.subtitulo} maxFontSizeMultiplier={1.35} numberOfLines={1}>
            {sub}
          </Text>
        </View>
      </View>

      {nivel === null ? (
        <View style={styles.nivel} accessibilityRole="progressbar" accessibilityLabel={t('mundos:cabecera.cargandoA11y', { modo: nombre })}>
          <Skeleton height={34} />
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
          <View style={styles.pista}>
            <View
              style={[
                styles.relleno,
                { width: `${Math.round(ratio * 100)}%`, backgroundColor: acento, boxShadow: `0px 0px 6px ${conAlfa(acento, 0.9)}` },
              ]}
            />
          </View>
          <Text style={styles.xp} maxFontSizeMultiplier={1.35} numberOfLines={1}>
            {maximo
              ? t('mundos:cabecera.xpMax')
              : t('mundos:cabecera.xp', { xp: formatoMiles(nivel.xpEnNivel), total: formatoMiles(nivel.xpSiguiente) })}
          </Text>
        </View>
      )}
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
  izquierda: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  ranura: { width: LADO_RANURA, height: LADO_RANURA, alignItems: 'center', justifyContent: 'center' },
  placa: { width: LADO_RANURA, height: LADO_RANURA, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, minWidth: 0 },
  pulsado: { opacity: 0.7 },
  nombre: { fontFamily: 'Cinzel_900Black', fontSize: 24, lineHeight: 27, letterSpacing: 1.9, color: ink.ink10 },
  subtitulo: { fontFamily: 'Outfit_500Medium', fontSize: 12, lineHeight: 15, letterSpacing: 0.7, color: GRIS, marginTop: 2 },
  nivel: { width: 96, alignItems: 'flex-end' },
  nv: { fontFamily: 'Outfit_800ExtraBold', fontSize: 13, lineHeight: 16, letterSpacing: 1.6 },
  pista: { width: 89, height: 5, borderRadius: 3, backgroundColor: PISTA, marginTop: 5, overflow: 'visible' },
  relleno: { height: 5, borderRadius: 3 },
  xp: { fontFamily: 'Outfit_500Medium', fontSize: 11, lineHeight: 14, color: GRIS_XP, marginTop: 4 },
});
