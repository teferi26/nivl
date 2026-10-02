// NIVL · Arena: la franja de cifras.
//
// De 2 a 4 celdas iguales separadas por hairlines verticales ink3: el número
// grande en Cinzel (`type.cifra`) y debajo su rótulo `micro` en mayúsculas.
// Un número cuenta con Contador (si trae `desde`); un texto («3/5», «A») se
// pinta tal cual. Cada celda es un elemento del lector: «Racha: 12 d».

import { StyleSheet, Text, View } from 'react-native';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { CIFRA_VACIA, formatoMiles } from './cifras';
import { Contador } from './Contador';

export interface Cifra {
  valor: number | string;
  rotulo: string;
  sufijo?: string;
  desde?: number | null;
  /** Lo que oye el lector en vez de «{rótulo}: {valor}». */
  etiqueta?: string;
}

export interface FranjaCifrasProps {
  cifras: Cifra[];
  /** Celdas centradas (Hero, Perfil). Por defecto, alineadas a la izquierda. */
  centrado?: boolean;
  /**
   * Dentro de un bloque que ya se lee entero (el Hero): las celdas no se
   * anuncian una a una. Por defecto, false.
   */
  enGrupo?: boolean;
}

const MAX_CELDAS = 4;

/** Texto del valor tal y como se lee. */
export function textoCifra(c: Cifra): string {
  const v = typeof c.valor === 'number' ? formatoMiles(c.valor) : c.valor || CIFRA_VACIA;
  return `${v}${c.sufijo ?? ''}`;
}

export function FranjaCifras({ cifras, centrado, enGrupo = false }: FranjaCifrasProps) {
  const celdas = cifras.slice(0, MAX_CELDAS);
  return (
    <View
      style={styles.franja}
      importantForAccessibility={enGrupo ? 'no-hide-descendants' : undefined}
      accessibilityElementsHidden={enGrupo || undefined}
    >
      {celdas.map((c, i) => (
        <View
          key={`${c.rotulo}-${i}`}
          accessible={!enGrupo}
          accessibilityLabel={enGrupo ? undefined : (c.etiqueta ?? `${c.rotulo}: ${textoCifra(c)}`)}
          style={[styles.celda, i > 0 && styles.conRegla, centrado ? styles.centrada : i === 0 && styles.primera]}
        >
          {/* Alto fijo: el sufijo (otra familia) no debe empujar el rótulo. */}
          <View style={[styles.hueco, centrado && styles.centrada]}>
            {typeof c.valor === 'number' ? (
              <Contador
                valor={c.valor}
                desde={c.desde}
                sufijo={c.sufijo}
                style={styles.valor}
                maxFontSizeMultiplier={1}
                adjustsFontSizeToFit
              />
            ) : (
              <Text style={styles.valor} maxFontSizeMultiplier={1} adjustsFontSizeToFit numberOfLines={1}>
                {c.valor || CIFRA_VACIA}
                {c.sufijo ? <Text style={styles.sufijo}>{c.sufijo}</Text> : null}
              </Text>
            )}
          </View>
          <Text style={[styles.rotulo, centrado && styles.rotuloCentrado]} maxFontSizeMultiplier={1.35} numberOfLines={2}>
            {c.rotulo}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  franja: { flexDirection: 'row', alignItems: 'stretch' },
  celda: { flex: 1, minWidth: 0, paddingHorizontal: space.s3, paddingVertical: space.s1, gap: space.s1 },
  conRegla: { borderLeftWidth: stroke.hairline, borderLeftColor: ink.ink3 },
  centrada: { alignItems: 'center' },
  // Alineada a la izquierda, la primera cifra arranca en el margen del texto.
  primera: { paddingLeft: 0 },
  hueco: { height: tipo.cifra.lineHeight, justifyContent: 'center', overflow: 'hidden' },
  valor: {
    fontFamily: tipo.cifra.family,
    fontSize: tipo.cifra.size,
    lineHeight: tipo.cifra.lineHeight,
    letterSpacing: tipo.cifra.tracking,
    color: ink.ink10,
  },
  sufijo: { fontFamily: tipo.micro.family, fontSize: 14, letterSpacing: tipo.micro.tracking },
  rotulo: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  rotuloCentrado: { textAlign: 'center' },
});
