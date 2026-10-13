// NIVL · Puertas: el permiso de salud fuera de la puerta (FASE3, Lote Z).
// Vistas puras de `HealthPrivacySection` (Perfil, ajustes) y de
// `HealthConsentNotice` (Avances). La lógica (lectura, cerrojo del borrado,
// confirmación y vibración) sigue en ConsentimientoSalud.tsx; aquí solo se
// pinta, con los mismos textos.
//
// Ajustes: TarjetaArena contorno (trama si el borrado quedó pendiente o no se
// pudo comprobar), el estado en bodySm, «Revisar permiso de salud» o «Volver a
// comprobar» en secondary y «Retirar y borrar salud» en danger: ninguna
// inversión (la de Perfil es suya).
//
// Las pruebas de Seguridad (health.test.ts) simulan `@/components/ui` y
// `@/components/arena` con cadenas: solo Text/View de RN y nombres simulados.
import { StyleSheet, Text, View } from 'react-native';
import { TarjetaArena } from '@/components/arena';
import { Button, Section, Skeleton } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';

export interface SaludAjustesVistaProps {
  cargando: boolean;
  /** Fallo al comprobar el permiso (del contexto). */
  errorComprobar: string | null;
  /** Fallo del último borrado. */
  error: string | null;
  borradoPendiente: boolean;
  aceptado: boolean;
  ocupada: boolean;
  onReintentar: () => void;
  onRevisar: () => void;
  onRetirar: () => void;
}

export function estadoSalud(p: Pick<SaludAjustesVistaProps, 'cargando' | 'errorComprobar' | 'borradoPendiente' | 'aceptado'>): string {
  if (p.cargando) return t('puertas:saludAjustes.comprobando');
  if (p.errorComprobar) return t('puertas:saludAjustes.noComprobado');
  if (p.borradoPendiente) return t('puertas:saludAjustes.borradoPendiente');
  if (p.aceptado) return t('puertas:saludAjustes.aceptado');
  return t('puertas:saludAjustes.sinPermiso');
}

export function SaludAjustesVista(p: SaludAjustesVistaProps) {
  const fallo = p.error ?? p.errorComprobar;
  const alerta = p.borradoPendiente || !!p.errorComprobar;
  return (
    <Section title={t('puertas:saludAjustes.seccion')}>
      <TarjetaArena variante={alerta ? 'trama' : 'contorno'}>
        <Text style={styles.estado} maxFontSizeMultiplier={1.6}>
          {estadoSalud(p)}
        </Text>
        <View style={styles.botones}>
          {p.errorComprobar ? (
            <Button title={t('puertas:volverAComprobar')} variant="secondary" onPress={p.onReintentar} disabled={p.ocupada} />
          ) : !p.aceptado && !p.borradoPendiente ? (
            <Button title={t('puertas:saludAjustes.revisar')} variant="secondary" onPress={p.onRevisar} disabled={p.cargando || p.ocupada} />
          ) : null}
          <Button
            title={p.borradoPendiente ? t('puertas:saludAjustes.terminarBorrado') : t('puertas:saludAjustes.retirar')}
            variant="danger"
            onPress={p.onRetirar}
            loading={p.ocupada}
            disabled={p.cargando}
          />
        </View>
        <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
          {t('puertas:saludAjustes.nota')}
        </Text>
        {fallo ? (
          <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
            {fallo}
          </Text>
        ) : null}
      </TarjetaArena>
    </Section>
  );
}

export interface AvisoSaludVistaProps {
  cargando: boolean;
  error: string | null;
  borradoPendiente: boolean;
  onReintentar: () => void;
  onRevisar: () => void;
}

/** El aviso de Avances sin salud aceptada (con salud aceptada no se pinta). */
export function AvisoSaludVista(p: AvisoSaludVistaProps) {
  if (p.cargando) {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel={t('puertas:salud.comprobandoA11y')}>
        <Skeleton height={90} />
      </View>
    );
  }
  if (p.error) {
    return (
      <TarjetaArena variante="trama">
        <Text style={styles.estado} maxFontSizeMultiplier={1.6}>
          {t('puertas:avisoSalud.error')}
        </Text>
        <Button title={t('puertas:volverAComprobar')} variant="secondary" size="sm" onPress={p.onReintentar} style={styles.solo} />
      </TarjetaArena>
    );
  }
  return (
    <TarjetaArena variante="contorno">
      <Text style={styles.estado} maxFontSizeMultiplier={1.6}>
        {t('puertas:avisoSalud.desactivado')}
      </Text>
      <Button
        title={t('puertas:saludAjustes.revisar')}
        variant="secondary"
        size="sm"
        onPress={p.onRevisar}
        disabled={p.borradoPendiente}
        style={styles.solo}
      />
    </TarjetaArena>
  );
}

const styles = StyleSheet.create({
  estado: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
  botones: { gap: space.s2, marginTop: space.s4 },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s4,
  },
  error: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
    marginTop: space.s3,
  },
  solo: { alignSelf: 'flex-start', marginTop: space.s3 },
});
