// NIVL · Onboarding: el contrato en piedra (paso 5, L-RADICAL §B.5).
//
// Una losa remachada sobre su zócalo, con la greca arriba y abajo por dentro
// y «CONTRATO» grabado. Los párrafos entran uno tras otro: se lee, no se
// acepta. Abajo, la fecha en que se abre. La firma (HoldToSign) va fuera, y no
// se toca. Sin superficie invertida: la acción del paso es el anillo.

import { StyleSheet, Text, View } from 'react-native';
import { Entrada, Meandro, TarjetaArena } from '@/components/arena';
import { ink, space, type as tipo } from '@/design/tokens';

export interface TablillaContratoProps {
  /** El texto del compromiso, ya partido en párrafos. */
  parrafos: readonly string[];
  /** Fecha de apertura ya escrita: «lunes, 2 de octubre de 2028». */
  abreEl: string;
  /**
   * Ocupa el alto que sobre en el cuerpo y deja la losa arriba, pegada al
   * título: en un cuerpo centrado y alto (tableta) el paso no flota con negro
   * encima. Por defecto sí; el onboarding real lo apaga porque tras la losa
   * vienen la firma y el anillo, y el hueco quedaría entre medias.
   */
  rellenar?: boolean;
}

export function TablillaContrato({ parrafos, abreEl, rellenar = true }: TablillaContratoProps) {
  return (
    <View style={rellenar ? styles.relleno : null}>
      <TarjetaArena variante="piedra" remaches zocalo>
        <Meandro alto={8} />
        <Text style={styles.rotulo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
          CONTRATO
        </Text>
        {/* Clave por posición: al cambiar el plazo cambia el texto, pero los
            párrafos ya leídos no vuelven a entrar. */}
        {parrafos.map((p, i) => (
          <Entrada key={i} indice={i + 1}>
            <Text style={[styles.parrafo, i > 0 && styles.parrafoSig]} maxFontSizeMultiplier={1.35}>
              {p}
            </Text>
          </Entrada>
        ))}
        <Meandro alto={8} style={styles.meandroPie} />
        <Text style={styles.fecha} maxFontSizeMultiplier={1.35}>
          SE ABRE EL {abreEl.toUpperCase()}
        </Text>
      </TarjetaArena>
    </View>
  );
}

const styles = StyleSheet.create({
  relleno: { flexGrow: 1 },
  rotulo: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    marginRight: -tipo.inscripcion.tracking,
    color: ink.ink9,
    textAlign: 'center',
    marginTop: space.s4,
    marginBottom: space.s4,
  },
  parrafo: { fontFamily: tipo.body.family, fontSize: 15, lineHeight: 23, color: ink.ink9 },
  parrafoSig: { marginTop: space.s3 },
  meandroPie: { marginTop: space.s5 },
  fecha: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink6,
    textAlign: 'center',
    marginTop: space.s3,
  },
});
