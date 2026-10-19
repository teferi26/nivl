// NIVL · IRON · Ficha de un ejercicio a pantalla completa (galería /kit/iron).
//
// El maniquí en la pose más exigente con el principal encendido, el mapa
// muscular grande por delante y por detrás, los músculos nombrados con su
// leyenda (principal, secundario, resto) y la técnica. Pura.

import { StyleSheet, Text, View } from 'react-native';
import { ink, space, type } from '@/design/tokens';
import { t } from '@/i18n';
import type { Ejercicio, MusculoId } from '@/iron/tipos';
import { ACENTO_IRON, BRILLO_IRON, ESTILO_CAPA } from './estilo';
import { Maniqui, msQuieto } from './Maniqui';
import { MapaMuscular } from './MapaMuscular';
import { nombreIron, textoIron } from './texto';

function Muestra({ tipo }: { tipo: 'principal' | 'secundario' | 'resto' }) {
  const estilo =
    tipo === 'principal'
      ? { backgroundColor: ACENTO_IRON, borderColor: BRILLO_IRON }
      : tipo === 'secundario'
        ? { backgroundColor: ACENTO_IRON, borderColor: ACENTO_IRON, opacity: 0.45 }
        : { backgroundColor: ESTILO_CAPA.musculo.fill, borderColor: ink.ink6 };
  return <View style={[styles.muestra, estilo]} />;
}

function Grupo({ titulo, lista, tipo }: { titulo: string; lista: readonly MusculoId[]; tipo: 'principal' | 'secundario' }) {
  if (lista.length === 0) return null;
  return (
    <View style={styles.grupo}>
      <View style={styles.filaTitulo}>
        <Muestra tipo={tipo} />
        <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
          {titulo}
        </Text>
      </View>
      <Text style={tipo === 'principal' ? styles.nombresFuertes : styles.nombres} maxFontSizeMultiplier={1.35}>
        {lista.map((m) => nombreIron('musculo', m)).join(' · ')}
      </Text>
    </View>
  );
}

/**
 * `incrustada`: dentro de otra pantalla (la técnica de /iron/[id]), sin la
 * cabecera, sin el maniquí quieto (ya está la animación encima) y sin relleno.
 */
export function FichaIron({ ejercicio: ej, ancho, incrustada = false }: { ejercicio: Ejercicio; ancho: number; incrustada?: boolean }) {
  const nombre = textoIron(ej.nombre);
  const util = incrustada ? ancho : ancho - 2 * space.s5;
  return (
    <View style={[incrustada ? styles.incrustada : styles.ficha, { width: ancho }]} nativeID={incrustada ? undefined : 'iron-ficha'}>
      {incrustada ? null : (
        <>
          <Text style={styles.eyebrow} maxFontSizeMultiplier={1.35}>
            {t('iron:demo.ficha')}
          </Text>
          <Text style={styles.titulo} maxFontSizeMultiplier={1}>
            {nombre.toUpperCase()}
          </Text>
          <Text style={styles.meta} maxFontSizeMultiplier={1.35}>
            {[nombreIron('grupo', ej.grupo), t(`iron:nivel.${ej.nivel}`), ...ej.material.map((m) => nombreIron('material', m))].join(' · ')}
          </Text>

          <View style={styles.escena}>
            <Maniqui ejercicio={ej} ancho={util} ms={msQuieto(ej)} esfuerzo={1} accessibilityLabel={t('iron:demo.animacion', { nombre })} />
          </View>
        </>
      )}

      <Grupo titulo={t('iron:demo.leyendaPrincipal')} lista={ej.musculos.principales} tipo="principal" />
      <Grupo titulo={t('iron:demo.leyendaSecundario')} lista={ej.musculos.secundarios} tipo="secundario" />
      <View style={styles.filaTitulo}>
        <Muestra tipo="resto" />
        <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
          {t('iron:demo.leyendaResto')}
        </Text>
      </View>

      <View style={styles.mapa}>
        <MapaMuscular musculos={ej.musculos} ancho={util} etiqueta={t('iron:demo.mapa', { nombre })} />
      </View>

      <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
        {t('iron:demo.tecnica')}
      </Text>
      {ej.cues.map((c) => (
        <Text key={c} style={styles.cue} maxFontSizeMultiplier={1.35}>
          {`· ${textoIron(c)}`}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ficha: { backgroundColor: ink.ink0, paddingHorizontal: space.s5, paddingVertical: space.s6, gap: space.s2 },
  incrustada: { gap: space.s2 },
  eyebrow: {
    fontFamily: type.label.family,
    fontSize: type.label.size,
    lineHeight: type.label.lineHeight,
    letterSpacing: type.label.tracking,
    color: ink.ink6,
    textTransform: 'uppercase',
  },
  titulo: { fontFamily: type.rank.family, fontSize: 26, lineHeight: 32, letterSpacing: 2, color: ink.ink10 },
  meta: { fontFamily: type.bodySm.family, fontSize: type.bodySm.size, lineHeight: type.bodySm.lineHeight, color: ink.ink8 },
  escena: { alignItems: 'center', marginVertical: space.s3, borderTopWidth: 1, borderBottomWidth: 1, borderColor: ink.ink3 },
  grupo: { gap: space.s1, marginTop: space.s1 },
  filaTitulo: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  muestra: { width: 14, height: 14, borderWidth: 1.5, borderRadius: 7 },
  rotulo: {
    fontFamily: type.label.family,
    fontSize: type.label.size,
    lineHeight: type.label.lineHeight,
    letterSpacing: type.label.tracking,
    color: ink.ink6,
    textTransform: 'uppercase',
  },
  nombresFuertes: { fontFamily: type.headline.family, fontSize: 18, lineHeight: 24, color: ink.ink10 },
  nombres: { fontFamily: type.body.family, fontSize: type.body.size, lineHeight: type.body.lineHeight, color: ink.ink8 },
  mapa: { alignItems: 'center', marginVertical: space.s4 },
  cue: { fontFamily: type.bodySm.family, fontSize: type.bodySm.size, lineHeight: type.bodySm.lineHeight, color: ink.ink8 },
});
