// NIVL · Idiomas: frases con partes en negrita.
//
// La frase entera vive en el catálogo con sus negritas marcadas con <b></b>
// («Te quedan <b>{{n}} días</b> de pausa.»): así el traductor puede mover la
// parte fuerte donde la pida su idioma, cosa que no se puede si la frase va
// partida en tres <Text>. Solo se entiende <b>; cualquier otra etiqueta se
// pinta tal cual.

import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { type as tipo } from '@/design/tokens';

export interface Tramo {
  texto: string;
  negrita: boolean;
}

/** «a <b>b</b> c» → [a, b (negrita), c]. Una <b> sin cerrar llega hasta el final. */
export function partirNegritas(texto: string): Tramo[] {
  const tramos: Tramo[] = [];
  let negrita = false;
  for (const trozo of texto.split(/(<\/?b>)/)) {
    if (trozo === '<b>') negrita = true;
    else if (trozo === '</b>') negrita = false;
    else if (trozo) tramos.push({ texto: trozo, negrita });
  }
  return tramos;
}

/** El texto sin las marcas, para accessibilityLabel o para medir. */
export function sinMarcas(texto: string): string {
  return texto.replace(/<\/?b>/g, '');
}

export interface TextoRicoProps extends Omit<TextProps, 'children'> {
  /** La frase del catálogo, ya con las variables puestas: `t('ns:clave', { n })`. */
  children: string;
  /** El estilo de las partes en negrita (por defecto, Outfit 700). */
  estiloNegrita?: StyleProp<TextStyle>;
}

export function TextoRico({ children, estiloNegrita, ...resto }: TextoRicoProps) {
  return (
    <Text {...resto}>
      {partirNegritas(children).map((tramo, i) =>
        tramo.negrita ? (
          <Text key={i} style={[{ fontFamily: tipo.headline.family }, estiloNegrita]}>
            {tramo.texto}
          </Text>
        ) : (
          tramo.texto
        ),
      )}
    </Text>
  );
}
