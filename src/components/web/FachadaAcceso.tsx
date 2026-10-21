// NIVL · Web: la fachada del acceso en escritorio.
//
// En el móvil el acceso es una columna (LoginVista). En una ventana ancha esa
// columna sola en medio de 1440 px parecía una app de móvil estirada: a la
// izquierda va ahora la fachada (marca, qué es esto en el navegador y tres
// líneas), sobre el graderío; a la derecha, la columna de siempre, sin tocar
// (mismo formulario, mismas pruebas). La pone ColumnaWeb (src/app/_layout.tsx)
// en /login y /auth/* a partir de MIN_DOS_PANELES. Su texto va antes del
// formulario en el orden de lectura; los motivos, ocultos al lector.

import { createContext, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Arena, Columna, Laurel, romano } from '@/components/arena';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { mayus } from '@/i18n/formato';

/** Ventana mínima para los dos paneles (la columna de 560 + una fachada que se lea). */
export const MIN_DOS_PANELES = 1024;
const ALTO_ARENA = 220;

/**
 * true dentro de la columna que va junto a la fachada: el acceso no repite su
 * portada (la marca y el lema ya están a la izquierda).
 */
export const ConFachada = createContext(false);

export function FachadaAcceso() {
  const [ancho, setAncho] = useState(0);
  const medir = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== ancho) setAncho(w);
  };
  const puntos = [t('acceso:web.punto1'), t('acceso:web.punto2'), t('acceso:web.punto3')];
  return (
    <View style={styles.fachada} onLayout={medir}>
      <View style={styles.columnas} pointerEvents="none">
        <Columna alto={260} ancho={28} color={ink.ink3} />
        <Columna alto={260} ancho={28} color={ink.ink3} />
      </View>
      <View style={styles.texto}>
        <Text style={styles.eyebrow} maxFontSizeMultiplier={1.35}>
          {mayus(t('acceso:web.eyebrow'))}
        </Text>
        <Text style={styles.marca} accessibilityRole="header" maxFontSizeMultiplier={1}>{/* i18n-ok: la marca */}
          NIVL
        </Text>
        <View style={styles.lema}>
          <Laurel alto={18} lado="izq" />
          <Text style={styles.lemaTexto} maxFontSizeMultiplier={1}>
            {t('comun:lema')}
          </Text>
          <Laurel alto={18} lado="der" />
        </View>
        <Text style={styles.titulo} maxFontSizeMultiplier={1.35}>
          {t('acceso:web.titulo')}
        </Text>
        <Text style={styles.cuerpo} maxFontSizeMultiplier={1.35}>
          {t('acceso:web.cuerpo')}
        </Text>
        <View style={styles.puntos}>
          {puntos.map((p, i) => (
            <View key={p} style={[styles.punto, i === 0 && styles.puntoPrimero]}>
              <Text style={styles.numero} maxFontSizeMultiplier={1}>{/* i18n-ok: numeral romano */}
                {romano(i + 1)}
              </Text>
              <Text style={styles.puntoTexto} maxFontSizeMultiplier={1.35}>
                {p}
              </Text>
            </View>
          ))}
        </View>
      </View>
      {ancho > 0 ? <Arena ancho={ancho} alto={ALTO_ARENA} variante="arco" gradas={5} color={ink.ink3} style={styles.arena} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fachada: {
    flex: 1,
    minWidth: 0,
    backgroundColor: ink.ink1,
    borderRightWidth: stroke.hairline,
    borderRightColor: ink.ink3,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  columnas: {
    position: 'absolute',
    top: space.s10,
    left: space.s10,
    right: space.s10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  texto: { maxWidth: 520, alignSelf: 'center', paddingHorizontal: space.s10, paddingBottom: ALTO_ARENA / 2 },
  eyebrow: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    color: ink.ink6,
  },
  marca: {
    fontFamily: tipo.display.family,
    fontSize: tipo.display.size,
    lineHeight: tipo.display.lineHeight,
    letterSpacing: 16,
    color: ink.ink10,
    marginTop: space.s4,
  },
  lema: { flexDirection: 'row', alignItems: 'center', gap: space.s3, marginTop: space.s3 },
  lemaTexto: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: 3,
    color: ink.ink8,
  },
  titulo: {
    fontFamily: tipo.title.family,
    fontSize: tipo.title.size,
    lineHeight: tipo.title.lineHeight,
    letterSpacing: tipo.title.tracking,
    color: ink.ink10,
    marginTop: space.s10,
  },
  cuerpo: {
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    lineHeight: tipo.body.lineHeight,
    color: ink.ink8,
    marginTop: space.s3,
  },
  puntos: { marginTop: space.s8 },
  punto: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.s4,
    paddingVertical: space.s3,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: ink.ink3,
  },
  puntoPrimero: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  numero: {
    width: 28,
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: 2,
    color: ink.ink6,
  },
  puntoTexto: { flex: 1, fontFamily: tipo.body.family, fontSize: tipo.body.size, lineHeight: tipo.body.lineHeight, color: ink.ink9 },
  arena: { position: 'absolute', left: 0, bottom: 0 },
});
