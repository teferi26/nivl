// NIVL · Modos: la cabecera común de cada mundo (IRON, FOCUS, WORK, FOUNDER),
// el «HUD» de la lámina 2 de la P01 con la marca MK de la P07. Pura.
//
//   [emblema] IRON                         NV 14
//             Gimnasio y dieta · MK III    ▬▬▬▬▬▬▬
//                                          2.160 / 3.000 XP
//
// · `emblema`: la ranura del emblema del modo (EmblemaMundo: la placa del
//   modo, que abre la rueda, dentro del visor de su marca MK). Sin él, la
//   placa quieta con el glifo.
// · `marca`: la marca de maestría (MK I a V), junto al subtítulo. Si no se
//   pasa, sale de la XP del nivel (progresoMarca, la misma que useMaestria).
// · El nivel es el del modo (`mode_xp`, misma curva que el global): suma
//   también al nivel global, que vive en NIVL.
// Tipos y medidas de la lámina (pantalla de 342 llevada a 390): nombre en
// Cinzel Black blanco, subtítulo gris, «NV» y barra en el acento con su halo.

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatoMiles, ratioSeguro, romano } from '@/components/arena';
import { Skeleton } from '@/components/ui';
import { conAlfa, halo, mezcla } from '@/components/modos/rueda/color';
import { GlifoModo } from '@/components/modos/rueda/GlifoModo';
import { acentoRueda, ink, space } from '@/design/tokens';
import { t } from '@/i18n';
import { progresoMarca, type Marca } from '@/modos/maestria';
import type { NivelModo } from '@/modos/niveles';
import { NOMBRE_MODO, type ModoEtiqueta } from '@/modos/tipos';

export interface CabeceraMundoProps {
  modo: ModoEtiqueta;
  /** El nivel del modo; null mientras se lee (huecos). */
  nivel: NivelModo | null;
  /** La ranura del emblema del modo (EmblemaMundo). */
  emblema?: ReactNode;
  /** La marca de maestría del modo; por defecto, la de la XP del nivel (la misma lectura que useMaestria). */
  marca?: Marca | null;
}

/** Lado de la ranura del emblema (placa de 44 dentro del visor). */
export const LADO_RANURA = 58;

const GRIS = '#8B8B92';
const GRIS_XP = '#6D6D74';
const PISTA = '#1B1B20';

export function CabeceraMundo({ modo, nivel, emblema, marca: marcaPedida }: CabeceraMundoProps) {
  const acento = acentoRueda[modo];
  const nombre = NOMBRE_MODO[modo];
  const maximo = nivel !== null && nivel.xpSiguiente <= 0;
  const ratio = nivel === null ? 0 : maximo ? 1 : ratioSeguro(nivel.xpEnNivel, nivel.xpSiguiente);
  const sub = t(`mundos:subtitulo.${modo}`);
  const marca = marcaPedida ?? (nivel ? progresoMarca(nivel.xp).marca : null);

  return (
    <View style={styles.wrap}>
      <View style={styles.izquierda}>
        <View style={styles.ranura}>
          {emblema ?? (
            <View
              style={[styles.placa, { borderColor: acento, backgroundColor: mezcla(acento, 0.14), boxShadow: halo(acento, 16, 0.45) }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <GlifoModo modo={modo} tamano={24} color={acento} />
            </View>
          )}
        </View>
        <View style={styles.textos}>
          <Text style={styles.nombre} accessibilityRole="header" maxFontSizeMultiplier={1.35} numberOfLines={1}>
            {nombre}
          </Text>
          <Text style={styles.subtitulo} maxFontSizeMultiplier={1.35} numberOfLines={1}>
            {marca ? `${sub} · ${t('modos:maestria.marca', { n: romano(marca) })}` : sub}
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
                { width: `${Math.round(ratio * 100)}%`, backgroundColor: acento, boxShadow: `0px 0px 8px ${conAlfa(acento, 0.9)}` },
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
  izquierda: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  ranura: { width: LADO_RANURA, height: LADO_RANURA, alignItems: 'center', justifyContent: 'center', marginLeft: -7 },
  placa: { width: 44, height: 44, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, minWidth: 0 },
  nombre: { fontFamily: 'Cinzel_900Black', fontSize: 24, lineHeight: 27, letterSpacing: 1.9, color: ink.ink10 },
  subtitulo: { fontFamily: 'Outfit_500Medium', fontSize: 12, lineHeight: 15, letterSpacing: 0.7, color: GRIS, marginTop: 2 },
  nivel: { width: 96, alignItems: 'flex-end' },
  nv: { fontFamily: 'Outfit_700Bold', fontSize: 13, lineHeight: 16, letterSpacing: 1.6 },
  pista: { width: 89, height: 5, borderRadius: 5, backgroundColor: PISTA, marginTop: 5, overflow: 'visible' },
  relleno: { height: 5, borderRadius: 5 },
  xp: { fontFamily: 'Outfit_500Medium', fontSize: 11, lineHeight: 14, color: GRIS_XP, marginTop: 4 },
});
