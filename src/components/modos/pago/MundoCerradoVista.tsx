// NIVL · Un mundo sin pagar: en vez de redirigir sin explicación, dice qué es,
// qué abre y cuánto cuesta. Pura. No es un error: una tarjeta de vidrio cuenta
// que lo tuyo sigue siendo tuyo, y la salida a NIVL, que sigue gratis, está
// siempre a la vista.

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EncabezadoArena, Entrada, TarjetaArena } from '@/components/arena';
import { GlifoModo } from '@/components/modos/rueda/GlifoModo';
import { Screen } from '@/components/ui';
import { ink, oro, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { queAbre, type ModoDePago } from '@/lib/planesmodo';
import { NOMBRE_MODO } from '@/modos/tipos';

export function MundoCerradoVista({ modo, oferta }: { modo: ModoDePago; oferta: ReactNode }) {
  return (
    <Screen>
      <>
        <Entrada indice={0}>
          <EncabezadoArena
            eyebrow={NOMBRE_MODO[modo]}
            titulo={t('oferta:pago.cerrado.titulo')}
            subtitulo={queAbre(modo)}
            derecha={<GlifoModo modo={modo} tamano={40} color={oro.claro} />}
          />
        </Entrada>
        <Entrada indice={1}>
          <TarjetaArena variante="piedra">
            <View style={styles.bloque}>
              <Text style={styles.linea}>{t('oferta:pago.cerrado.datos')}</Text>
              <Text style={styles.linea}>{t('oferta:pago.legal.base')}</Text>
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
