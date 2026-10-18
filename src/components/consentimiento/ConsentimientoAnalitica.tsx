// NIVL · Consentimiento de la medición de uso (dictamen LSSI-ANALITICA-NIVL.md,
// apartados 3.1 a 3.5). Piezas puras:
//   · `CuerpoConsentimiento`: el texto del dictamen (3.2) y «Más información».
//   · `AccionesConsentimiento`: «Rechazar» y «Aceptar» con el MISMO componente,
//     variante, tamaño y ancho (secondary los dos: ninguno gasta la inversión),
//     Rechazar primero. Nada premarcado.
//   · `HojaConsentimientoAnalitica`: la hoja única para quien ya tiene la app.
//     Cerrarla sin decidir (asa, fondo, atrás) cuenta como «Rechazar».
//   · `MedicionUsoSection`: Perfil > Privacidad > Medición de uso.
// Rechazar no quita nada ni hay incentivo por aceptar.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Row, Section, Sheet } from '@/components/ui';
import { Interruptor } from '@/components/ui/Interruptor';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { URL_PRIVACIDAD_ANALITICA } from '@/lib/consentimientoAnaliticamath';
import { useConsentimientoAnalitica } from './useConsentimientoAnalitica';

export function CuerpoConsentimiento() {
  return (
    <View style={styles.pila}>
      <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
        {t('perfil:medicion.cuerpo')}
      </Text>
      <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
        {t('perfil:medicion.rechazo')}
      </Text>
      <Pressable
        onPress={() => Linking.openURL(URL_PRIVACIDAD_ANALITICA).catch(() => {})}
        accessibilityRole="link"
        accessibilityLabel={t('perfil:medicion.masInfoA11y')}
        hitSlop={12}
        style={styles.enlace}
      >
        <Text style={styles.enlaceTexto} maxFontSizeMultiplier={1.35}>
          {t('perfil:medicion.masInfo')}
        </Text>
      </Pressable>
    </View>
  );
}

export function AccionesConsentimiento({
  onRechazar,
  onAceptar,
  ocupado,
}: {
  onRechazar: () => void;
  onAceptar: () => void;
  ocupado: boolean;
}) {
  return (
    <View style={styles.acciones}>
      <Button title={t('perfil:medicion.rechazar')} variant="secondary" size="lg" onPress={onRechazar} disabled={ocupado} style={styles.boton} />
      <Button title={t('perfil:medicion.aceptar')} variant="secondary" size="lg" onPress={onAceptar} disabled={ocupado} style={styles.boton} />
    </View>
  );
}

export interface HojaConsentimientoProps {
  visible: boolean;
  ocupado: boolean;
  onAceptar: () => void;
  onRechazar: () => void;
}

export function HojaConsentimientoAnalitica({ visible, ocupado, onAceptar, onRechazar }: HojaConsentimientoProps) {
  return (
    <Sheet
      visible={visible}
      onClose={() => undefined}
      // Cerrar sin decidir = rechazar (dictamen 3.1). No se vuelve a preguntar hasta que caduque.
      onDismiss={onRechazar}
      eyebrow={t('perfil:medicion.eyebrow')}
      title={t('perfil:medicion.titulo')}
      footer={<AccionesConsentimiento onRechazar={onRechazar} onAceptar={onAceptar} ocupado={ocupado} />}
    >
      <CuerpoConsentimiento />
    </Sheet>
  );
}

/** Para Hoy: pregunta una vez a quien ya tenía la app, nunca encima de una ceremonia. */
export function PreguntaMedicionUso({ enPausa }: { enPausa: boolean }) {
  const c = useConsentimientoAnalitica();
  return <HojaConsentimientoAnalitica visible={c.preguntar && !enPausa} ocupado={c.ocupado} onAceptar={c.aceptar} onRechazar={c.rechazar} />;
}

/** Perfil > Privacidad > Medición de uso. Encender abre la misma hoja; apagar revoca y borra. */
export function MedicionUsoSection() {
  const c = useConsentimientoAnalitica();
  const activada = c.decision === 'acepta';
  // Con el flag apagado y sin haber decidido nunca, no hay nada que gestionar.
  if (c.cargando || (!c.activa && c.decision === null)) return null;
  return (
    <Section title={t('perfil:medicion.seccion')}>
      <Card padded={false} style={styles.lista}>
        <Row
          first
          leading={<Ionicons name="analytics-outline" size={20} color={activada ? ink.ink9 : ink.ink6} />}
          title={t('perfil:medicion.fila')}
          detail={activada ? t('perfil:medicion.activada') : t('perfil:medicion.desactivada')}
          trailing={
            <Interruptor
              value={activada}
              disabled={c.ocupado}
              onValueChange={(v) => (v ? c.aceptar() : c.revocar())}
              accessibilityLabel={t('perfil:medicion.fila')}
            />
          }
        />
      </Card>
      <CuerpoConsentimiento />
    </Section>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s3 },
  texto: {
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    lineHeight: tipo.body.lineHeight,
    letterSpacing: tipo.body.tracking,
    color: ink.ink8,
  },
  enlace: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  enlaceTexto: {
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    lineHeight: tipo.body.lineHeight,
    color: ink.ink10,
    textDecorationLine: 'underline',
  },
  acciones: { gap: space.s3 },
  boton: { alignSelf: 'stretch' },
  lista: { paddingHorizontal: space.s4, paddingVertical: 2 },
});
