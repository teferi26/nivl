// NIVL · Modos F1: los niveles por modo en Perfil (la vista, pura).
//
// Una sección «Niveles por modo»: arriba tu nivel global (NIVL) como
// referencia y debajo un modo por fila con su acento (cuadrado y nombre), su
// nivel en Cinzel y la barra del nivel. Mientras carga, huecos con la forma
// final; sin modos, una línea y la acción «Elegir modos».

import { StyleSheet, Text, View } from 'react-native';
import { Barra, CargaArena, ratioSeguro } from '@/components/arena';
import { Section } from '@/components/ui';
import { ink, modoAcento, space, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { mayus } from '@/i18n/formato';
import type { NivelModo } from '@/modos/niveles';
import { NOMBRE_MODO, type ModoId } from '@/modos/tipos';

export interface NivelesModoVistaProps {
  cargando: boolean;
  /** Fallo de la lectura, ya escrito para el usuario (mensajeSistema). */
  error?: string | null;
  /** Nivel global (el del Hero). */
  nivelGlobal: number | null;
  niveles: NivelModo[];
  onElegir: () => void;
}

function Fila({ modo, nivel, ratio, xp }: { modo: ModoId; nivel: number; ratio: number | null; xp?: number }) {
  const nombre = modo === 'general' ? t('modos:perfil.global') : NOMBRE_MODO[modo];
  return (
    <View
      style={styles.fila}
      accessible
      accessibilityLabel={
        xp === undefined
          ? t('modos:perfil.filaGlobalA11y', { modo: nombre, nivel })
          : t('modos:perfil.filaA11y', { modo: nombre, nivel, xp })
      }
    >
      <View style={[styles.marca, { backgroundColor: modoAcento[modo] }]} />
      <View style={styles.centro}>
        <Text style={[styles.nombre, modo !== 'general' && { color: modoAcento[modo] }]} maxFontSizeMultiplier={1.35} numberOfLines={1}>
          {mayus(nombre)}
        </Text>
        {ratio !== null ? (
          <View style={styles.barra}>
            <Barra ratio={ratio} alto={4} etiqueta={nombre} enGrupo />
          </View>
        ) : null}
      </View>
      <Text style={styles.nivel} maxFontSizeMultiplier={1.35}>
        {mayus(t('modos:perfil.nivel', { nivel }))}
      </Text>
    </View>
  );
}

export function NivelesModoVista({ cargando, error, nivelGlobal, niveles, onElegir }: NivelesModoVistaProps) {
  return (
    <Section title={t('modos:perfil.titulo')} action={{ label: t('modos:perfil.elegir'), icon: 'options-outline', onPress: onElegir }}>
      {cargando ? (
        <CargaArena etiqueta={t('modos:perfil.cargandoA11y')} formas={['filas']} filas={3} />
      ) : (
        <>
          {nivelGlobal !== null ? <Fila modo="general" nivel={nivelGlobal} ratio={null} /> : null}
          {niveles.map((n) => (
            <Fila
              key={n.modo}
              modo={n.modo}
              nivel={n.nivel}
              xp={n.xp}
              ratio={n.xpSiguiente > 0 ? ratioSeguro(n.xpEnNivel, n.xpSiguiente) : 1}
            />
          ))}
          {error ? (
            <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
              {error}
            </Text>
          ) : (
            <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
              {niveles.length > 0 ? t('modos:perfil.ayuda') : t('modos:perfil.vacio')}
            </Text>
          )}
        </>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 52,
    paddingVertical: space.s2,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: ink.ink3,
  },
  marca: { width: 10, height: 10 },
  centro: { flex: 1, minWidth: 0 },
  nombre: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink9,
  },
  barra: { marginTop: space.s2 },
  nivel: {
    fontFamily: tipo.number.family,
    fontSize: tipo.bodySm.size + 2,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink10,
  },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s3,
  },
});
