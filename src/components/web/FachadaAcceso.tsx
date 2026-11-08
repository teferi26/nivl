// NIVL · Web: la fachada del acceso en escritorio (Ónix).
//
// En el móvil el acceso es una columna (LoginVista). En una ventana ancha esa
// columna sola en medio de 1440 px parecía una app de móvil estirada: a la
// izquierda va la fachada (escudo, marca, título y una línea); a la derecha,
// el mismo formulario dentro de una tarjeta. La pone ColumnaWeb
// (src/app/_layout.tsx) en /login y /auth/* a partir de MIN_DOS_PANELES. Su
// texto va antes del formulario en el orden de lectura.

import { createContext } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Escudo } from '@/components/acceso/Escudo';
import { FondoOnix } from '@/components/ui/FondoOnix';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';

/** Ventana mínima para los dos paneles (la columna de 560 + una fachada que se lea). */
export const MIN_DOS_PANELES = 1024;
const TRACKING_MARCA = 6;

/**
 * true dentro de la columna que va junto a la fachada: el acceso no repite su
 * portada (la marca ya está a la izquierda) y el formulario va en tarjeta.
 */
export const ConFachada = createContext(false);

export function FachadaAcceso() {
  return (
    <View style={styles.fachada}>
      <FondoOnix />
      {/* Con scroll: en una ventana baja el bloque centrado se cortaba por arriba. */}
      <ScrollView style={styles.flex} contentContainerStyle={styles.centrado}>
      <View style={styles.texto}>
        <Escudo ancho={104} />
        <Text style={styles.marca} accessibilityRole="header" maxFontSizeMultiplier={1}>{/* i18n-ok: la marca */}
          NIVL
        </Text>
        <Text style={styles.titulo} maxFontSizeMultiplier={1.35}>
          {t('acceso:web.titulo')}
        </Text>
        <Text style={styles.cuerpo} maxFontSizeMultiplier={1.35}>
          {t('acceso:web.cuerpo')}
        </Text>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fachada: { flex: 1, minWidth: 0, justifyContent: 'center', overflow: 'hidden' },
  texto: { maxWidth: 520, alignSelf: 'center', paddingHorizontal: space.s10 },
  flex: { flex: 1 },
  centrado: { flexGrow: 1, justifyContent: 'center' },
  marca: {
    fontFamily: tipo.monumentoSm.family,
    fontSize: tipo.monumentoSm.size,
    lineHeight: tipo.monumentoSm.lineHeight,
    letterSpacing: TRACKING_MARCA,
    color: ink.ink9,
    marginTop: space.s3,
  },
  titulo: {
    fontFamily: tipo.display.family,
    fontSize: tipo.display.size,
    lineHeight: tipo.display.lineHeight,
    letterSpacing: tipo.display.tracking,
    color: ink.ink9,
    marginTop: space.s3,
  },
  cuerpo: { fontFamily: tipo.body.family, fontSize: 18, lineHeight: 27, color: ink.ink8, marginTop: space.s4 },
});
