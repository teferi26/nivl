// NIVL · Onboarding: la portada (paso 0, L-RADICAL §B.5).
//
// La primera impresión de la app. El graderío de la arena a sangre, de borde a
// borde, y en su centro «NIVL» en piedra; debajo el lema entre dos ramas de
// laurel, las reglas en una tabla remachada y el descargo. Nada invertido
// aquí: la única inversión del paso es «Entrar en la arena», en el pie.

import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Arena, ASangre, Entrada, Laurel, TarjetaArena } from '@/components/arena';
import { ink, space, type as tipo } from '@/design/tokens';
import { DESCARGO_SALUD } from '@/lib/consentmath';

/** Alto del graderío. */
const ALTO_ARENA = 200;
/** Tracking de la marca: más abierto que el `display` normal, es una fachada. */
const TRACKING_MARCA = 16;

/** Las reglas de la arena, en tres párrafos. */
export const LORE_ARENA: readonly string[] = [
  'Esto no es una lista de tareas. Es una arena.',
  'Cada día tienes misiones. Cumplirlas da XP y sube tu nivel; fallarlas lo resta. La racha multiplica. Los proyectos grandes son campañas con un jefe final. Y hay un coach que dicta tu día, te juzga por la noche y recuerda todo lo que aprende de ti.',
  'Nada de trampas: las evidencias se hacen con la cámara, en el momento. El sistema no opina. Registra.',
];

export interface PortadaArenaProps {
  /** Descargo de salud bajo las reglas. Por defecto, el de consentmath. */
  descargo?: string;
}

export function PortadaArena({ descargo = DESCARGO_SALUD }: PortadaArenaProps) {
  // El graderío necesita su ancho en pt: se mide el hueco a sangre.
  const [ancho, setAncho] = useState(0);
  const medir = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== ancho) setAncho(w);
  };

  return (
    <View>
      <Entrada indice={0}>
        <ASangre>
          <View style={styles.escena} onLayout={medir}>
            {ancho > 0 ? (
              <Arena ancho={ancho} alto={ALTO_ARENA} variante="arco" gradas={4} color={ink.ink4} style={styles.arena} />
            ) : null}
            <View style={styles.placa}>
              <Text
                style={styles.marca}
                accessibilityRole="header"
                accessibilityLabel="NIVL"
                maxFontSizeMultiplier={1}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                NIVL
              </Text>
            </View>
          </View>
        </ASangre>
      </Entrada>

      <Entrada indice={1}>
        <View style={styles.lema}>
          <Laurel alto={24} lado="izq" />
          <Text style={styles.lemaTexto} maxFontSizeMultiplier={1.35}>
            UN 1 % MEJOR CADA DÍA
          </Text>
          <Laurel alto={24} lado="der" />
        </View>
      </Entrada>

      <Entrada indice={2}>
        <TarjetaArena variante="contorno" remaches rotulo="Las reglas">
          {LORE_ARENA.map((p, i) => (
            <Text key={i} style={[styles.lore, i > 0 && styles.loreParrafo]} maxFontSizeMultiplier={1.35}>
              {p}
            </Text>
          ))}
        </TarjetaArena>
      </Entrada>

      <Entrada indice={3}>
        <Text style={styles.descargo} maxFontSizeMultiplier={1.35}>
          {descargo}
        </Text>
      </Entrada>
    </View>
  );
}

const styles = StyleSheet.create({
  escena: { height: ALTO_ARENA, justifyContent: 'flex-end', alignItems: 'center' },
  arena: { position: 'absolute', left: 0, bottom: 0 },
  // Placa negra bajo la marca: tapa los arranques del graderío detrás de las
  // letras, que quedan de pie sobre la arena en vez de cruzadas por el trazo.
  placa: { backgroundColor: ink.ink0, paddingHorizontal: space.s3, marginBottom: space.s2 },
  marca: {
    fontFamily: tipo.display.family,
    fontSize: tipo.display.size,
    lineHeight: tipo.display.lineHeight,
    letterSpacing: TRACKING_MARCA,
    // El tracking también se suma tras la última letra: se compensa para centrar.
    marginRight: -TRACKING_MARCA,
    color: ink.ink10,
    textAlign: 'center',
  },
  lema: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s3,
    marginTop: space.s5,
    marginBottom: space.s6,
  },
  lemaTexto: {
    flexShrink: 1,
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink8,
    textAlign: 'center',
  },
  lore: { fontFamily: tipo.body.family, fontSize: 15, lineHeight: 23, color: ink.ink9 },
  loreParrafo: { marginTop: space.s3 },
  descargo: { fontFamily: tipo.bodySm.family, fontSize: 12, lineHeight: 17, color: ink.ink6, marginTop: space.s3 },
});
