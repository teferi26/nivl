// NIVL · La opinión interna: «¿Qué te gusta? ¿Qué cambiarías?». Pura: el
// estado y el envío viven en `usePeticiones`. Sale una vez, el día 2-3, tras
// un momento bueno, y se cierra con «Ahora no», el asa o el fondo. No tiene
// nada que ver con la valoración de la tienda (peticionesmath.ts).
//
// Hoja con dos Campo multilínea y pie fijo: Enviar (la inversión) y Ahora no
// (ghost). Tras enviar, la misma hoja da las gracias y se cierra.

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Campo, ErrorSistema } from '@/components/arena';
import { Button, Sheet } from '@/components/ui';
import { useAnunciar } from '@/components/ui/useAnunciar';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { MAX_OPINION } from '@/lib/peticionesmath';
import { LEGAL_URLS } from '@/lib/proplans';

export interface HojaOpinionProps {
  visible: boolean;
  gusta: string;
  cambiaria: string;
  enviando: boolean;
  enviada: boolean;
  /** Fallo ya escrito para el usuario (mensajeSistema) o «escribe al menos una». */
  error: string | null;
  onGusta: (v: string) => void;
  onCambiaria: (v: string) => void;
  onEnviar: () => void;
  onCerrar: () => void;
}

export function HojaOpinion({
  visible,
  gusta,
  cambiaria,
  enviando,
  enviada,
  error,
  onGusta,
  onCambiaria,
  onEnviar,
  onCerrar,
}: HojaOpinionProps) {
  useAnunciar(enviada ? t('hoy:opinion.gracias') : null);
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow={t('hoy:opinion.eyebrow')}
      title={t('hoy:opinion.titulo')}
      footer={
        enviada ? (
          <Button title={t('comun:cerrar')} onPress={onCerrar} />
        ) : (
          <>
            <Button title={t('hoy:opinion.enviar')} onPress={onEnviar} loading={enviando} />
            <Button title={t('comun:ahoraNo')} variant="ghost" onPress={onCerrar} disabled={enviando} />
          </>
        )
      }
    >
      {enviada ? (
        <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
          {t('hoy:opinion.gracias')}
        </Text>
      ) : (
        <View style={styles.pila}>
          <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
            {t('hoy:opinion.intro')}
          </Text>
          {/* Información en la recogida (art. 13 RGPD) y consentimiento al enviar (dictamen LSSI 2.5). */}
          <Text style={styles.aviso} maxFontSizeMultiplier={1.35}>
            {t('hoy:opinion.aviso')}
          </Text>
          <Pressable
            onPress={() => Linking.openURL(LEGAL_URLS.privacidad).catch(() => {})}
            accessibilityRole="link"
            hitSlop={12}
            style={styles.enlace}
          >
            <Text style={styles.enlaceTexto} maxFontSizeMultiplier={1.35}>
              {t('hoy:opinion.privacidad')}
            </Text>
          </Pressable>
          <Campo
            etiqueta={t('hoy:opinion.gusta')}
            value={gusta}
            onChangeText={onGusta}
            multiline
            maxLength={MAX_OPINION}
            editable={!enviando}
          />
          <Campo
            etiqueta={t('hoy:opinion.cambiaria')}
            value={cambiaria}
            onChangeText={onCambiaria}
            multiline
            maxLength={MAX_OPINION}
            editable={!enviando}
            ayuda={t('hoy:opinion.ayuda')}
          />
          {error ? <ErrorSistema compacto mensaje={error} /> : null}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s4 },
  texto: {
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    lineHeight: tipo.body.lineHeight,
    letterSpacing: tipo.body.tracking,
    color: ink.ink8,
  },
  aviso: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    letterSpacing: tipo.bodySm.tracking,
    color: ink.ink8,
  },
  enlace: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  enlaceTexto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink10,
    textDecorationLine: 'underline',
  },
});
