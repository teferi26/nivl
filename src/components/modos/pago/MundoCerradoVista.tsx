// NIVL · Un mundo sin pagar: en vez de redirigir sin explicación, dice qué es,
// qué abre y cuánto cuesta. Pura. No es un error: la trama marca lo bloqueado y
// la salida a NIVL, que sigue gratis, pesa lo mismo que la compra.

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EncabezadoArena, Entrada, TarjetaArena } from '@/components/arena';
import { GlifoModo } from '@/components/modos/rueda/GlifoModo';
import { Screen } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { LINEA_BASE, LINEA_DATOS, QUE_ABRE, type ModoDePago } from '@/lib/planesmodo';
import { NOMBRE_MODO } from '@/modos/tipos';

export function MundoCerradoVista({ modo, oferta }: { modo: ModoDePago; oferta: ReactNode }) {
  return (
    <Screen>
      <>
        <Entrada indice={0}>
          <EncabezadoArena
            eyebrow={NOMBRE_MODO[modo]}
            titulo="Sigue cerrado." // i18n-ok: pantalla de compra, en español como ProOffer
            subtitulo={QUE_ABRE[modo]}
            derecha={<GlifoModo modo={modo} tamano={40} color={ink.ink10} />}
          />
        </Entrada>
        <Entrada indice={1}>
          <TarjetaArena variante="trama">
            <View style={styles.bloque}>
              <Text style={styles.linea}>{LINEA_DATOS}</Text>
              <Text style={styles.linea}>{LINEA_BASE}</Text>
            </View>
          </TarjetaArena>
        </Entrada>
        <Entrada indice={2}>
          <View style={styles.oferta}>{oferta}</View>
        </Entrada>
      </>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloque: { gap: space.s1 },
  linea: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink9 },
  oferta: { marginTop: space.s4 },
});
