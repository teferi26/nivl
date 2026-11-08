// NIVL · Una palabra o cifra del juego que se puede tocar para saber qué es.
//
// Es un Pressable, no un Text: dentro de un párrafo no llegaría a 44 pt. Va en
// una fila junto al texto (flexDirection row), no anidado en un <Text>.

import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { usePiel } from '@/design/piel';
import { ink, type as tipo, vidrio } from '@/design/tokens';
import { t } from '@/i18n';
import type { TerminoId } from '@/lib/glosario';
import { tituloTermino } from './GlosarioVista';
import { HojaTermino } from './HojaTermino';

// 20 de alto o ancho + 12 por cada lado = 44 pt de zona táctil, sin mover nada alrededor.
const ZONA_EXTRA = 12;

export interface TerminoProps {
  termino: TerminoId;
  children: ReactNode;
  /** El estilo del texto vecino, para que no desentone (una cifra en Playfair, por ejemplo). */
  textoStyle?: StyleProp<TextStyle>;
  /** Para el lector, si el texto solo no se entiende («12» → «12 días de racha»). */
  accessibilityLabel?: string;
}

export function Termino({ termino, children, textoStyle, accessibilityLabel }: TerminoProps) {
  const [abierta, setAbierta] = useState(false);
  // La hoja se monta la primera vez que hace falta y luego se queda, para que
  // el fundido de salida se vea. Una pantalla puede tener varios términos.
  const [usada, setUsada] = useState(false);
  const piel = usePiel();

  const texto = typeof children === 'string' || typeof children === 'number' ? String(children) : tituloTermino(termino);

  return (
    <>
      <Pressable
        onPress={() => {
          setUsada(true);
          setAbierta(true);
        }}
        hitSlop={ZONA_EXTRA}
        style={({ pressed }) => [styles.zona, pressed && styles.pulsado]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? texto}
        accessibilityHint={t('ayuda:termino.hint')}
      >
        <Text
          maxFontSizeMultiplier={1.35}
          style={[styles.texto, piel && { textDecorationColor: piel.acentoBorde }, textoStyle]}
        >
          {children}
        </Text>
      </Pressable>
      {usada ? <HojaTermino termino={termino} visible={abierta} onClose={() => setAbierta(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  zona: { minWidth: 20, minHeight: 20, alignItems: 'center', justifyContent: 'center' },
  pulsado: { backgroundColor: vidrio.campo },
  texto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textDecorationColor: ink.ink6,
  },
});
