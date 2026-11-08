// NIVL · Web: «Planes», el sitio de la compra en el navegador.
//
// En la web no hay compras de Apple ni de Google, y el pago web (Stripe) aún
// no existe: aquí NO se cobra, no se enlaza a ninguna tienda ni a ningún pago
// y no se recoge interés. Se enseña lo mismo que la app con la tienda cerrada
// (ProOfferBody, precios de solo lectura) y se explica, sin rodeos, que la
// suscripción se contrata y se gestiona por ahora en la app de iPhone. La
// cuenta es la misma: quien ya paga no llega aquí (pro.tsx le enseña su plan).
//
// En escritorio, a dos columnas: los planes a la izquierda; cómo se contrata y
// la salida, a la derecha.

import { StyleSheet, Text, View } from 'react-native';
import { EncabezadoArena, Entrada, TarjetaArena } from '@/components/arena';
import { ProOfferBody, useProOffer } from '@/components/ProOffer';
import { Button, Screen } from '@/components/ui';
import { DosColumnas } from '@/components/web/DosColumnas';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';

interface Props {
  userId: string | undefined;
  kind: unknown;
  onVolver: () => void;
  refrescando?: boolean;
  onRefrescar?: () => void;
}

export function PlanesWeb({ userId, kind, onVolver, refrescando, onRefrescar }: Props) {
  const oferta = useProOffer({ userId });
  return (
    <Screen amplio refreshing={refrescando} onRefresh={onRefrescar}>
      <Entrada indice={0}>
        <EncabezadoArena onVolver={onVolver} eyebrow={t('oferta:web.eyebrow')} titulo={t('oferta:web.titulo')} subtitulo={t('oferta:web.subtitulo')} />
      </Entrada>
      <DosColumnas
        principal={
          <Entrada indice={1}>
            <ProOfferBody oferta={oferta} kind={kind} />
          </Entrada>
        }
        lateral={
          <Entrada indice={2}>
            <TarjetaArena variante="contorno" rotulo={t('oferta:web.rotulo')}>
              <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
                {t('oferta:web.cuerpo')}
              </Text>
              <Text style={[styles.cuerpo, styles.segundo]} maxFontSizeMultiplier={1.6}>
                {t('oferta:web.cuenta')}
              </Text>
            </TarjetaArena>
            <View style={styles.salida}>
              <Button title={t('oferta:web.seguir')} variant="secondary" onPress={onVolver} />
            </View>
          </Entrada>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cuerpo: { fontFamily: tipo.body.family, fontSize: tipo.body.size, lineHeight: tipo.body.lineHeight, color: ink.ink9 },
  segundo: { marginTop: space.s3, color: ink.ink8 },
  salida: { marginTop: space.s5, marginBottom: space.s8 },
});
