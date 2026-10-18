// NIVL · Perfil: los ajustes (de «Para qué uso NIVL» a «Eliminar cuenta»).
//
// Lo pinta la ruta en el hueco `ajustes` de PerfilVista. Los datos y los
// efectos llegan de usePerfil. FASE3 Lote B2: sin FadeIn (la Entrada de
// PerfilVista ya mueve los bloques 0 a 7 y nunca se anima fila a fila), los
// avisos sin permiso en trama, colores de ink y «Eliminar cuenta» como Button
// danger (la trama es el peligro, no el rojo).

import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, type ReactNode } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { HealthPrivacySection } from '@/components/ConsentimientoSalud';
import { MedicionUsoSection } from '@/components/consentimiento/ConsentimientoAnalitica';
import { Version } from '@/components/Version';
import { Button, Card, Chip, ChipWrap, Row, RowValue, Section, Tag } from '@/components/ui';
import { Interruptor } from '@/components/ui/Interruptor';
import { ink, space, type as tipo } from '@/design/tokens';
import { NOMBRE_IDIOMA, t, type Idioma, type Preferencia } from '@/i18n';
import {
  DESCARGO_SALUD,
  LINEA_CRISIS,
  lineaPerfil,
  type EstadoConsentimiento,
} from '@/lib/consent';
import { addDays, nombreDia } from '@/lib/dates';
import type { EstadoAvisos } from '@/lib/notifications';
import { LEGAL_URLS } from '@/lib/proplans';
import { paymentsConfigured, paywallEnabled, type Subscription } from '@/lib/subscription';
import { MAX_STONES } from '@/lib/game';
import { KINDS, kindMeta, PROFILE_KINDS, type ProfileKind } from '@/lib/kinds';
import type { Ancla } from '@/lib/share';
import type { Profile } from '@/lib/types';

export interface PerfilAjustesProps {
  profile: Profile;
  busy: boolean;
  frozen: boolean;
  onPerfilDeUso: (k: ProfileKind) => void;
  onPausar: () => void;
  onReanudar: () => void;
  vibraciones: boolean;
  onVibraciones: (v: boolean) => void;
  avisos: EstadoAvisos | null;
  onActivarAvisos: () => void;
  premium: boolean;
  subscription: Subscription | null;
  onCheckout: () => void;
  consent: EstadoConsentimiento | null;
  onConsentimiento: () => void;
  /** El idioma del coach: lo elegido (null: aún no se sabe) y lo que habla ahora. */
  idioma: { preferencia: Preferencia | null; coach: Idioma };
  /** Abre la hoja del idioma (HojaIdioma). */
  onIdioma: () => void;
  /** Recibe el rectángulo de la fila (ventana) para anclar la hoja en iPad. */
  onExportar: (ancla?: Ancla | null) => void;
  onCerrarSesion: () => void;
  onBorrar: () => void;
  /** Solo la galería: sin la sección de salud (consulta el permiso a Supabase). */
  sinSalud?: boolean;
  /** Solo la galería: la vista del bloque de salud con datos fijos (SaludAjustesVista). */
  salud?: ReactNode;
}

export function PerfilAjustes({
  profile,
  busy,
  frozen,
  onPerfilDeUso,
  onPausar,
  onReanudar,
  vibraciones,
  onVibraciones,
  avisos,
  onActivarAvisos,
  premium,
  subscription,
  onCheckout,
  consent,
  onConsentimiento,
  idioma,
  onIdioma,
  onExportar,
  onCerrarSesion,
  onBorrar,
  sinSalud,
  salud,
}: PerfilAjustesProps) {
  const kind = kindMeta(profile.profile_kind);
  // iPad: la hoja de compartir apunta a la fila que la abrió (patrón HojaCompartir).
  const filaExportar = useRef<View>(null);
  const exportar = () => {
    const fila = filaExportar.current;
    if (!fila) return onExportar(null);
    fila.measureInWindow((x, y, width, height) => onExportar({ x, y, width, height }));
  };
  const sinPermiso = !!avisos && !avisos.permitido;
  const idiomaAuto = idioma.preferencia === 'auto';
  const nombreIdioma = NOMBRE_IDIOMA[idioma.coach];

  return (
    <>
      <Section title={t('perfil:ajustes.paraQue')}>
        <ChipWrap>
          {PROFILE_KINDS.map((k) => (
            <Chip
              key={k}
              label={KINDS[k].label}
              icon={KINDS[k].icon as never}
              selected={profile.profile_kind === k}
              onPress={() => onPerfilDeUso(k)}
              disabled={busy}
              accessibilityLabel={t('perfil:ajustes.perfilA11y', { perfil: KINDS[k].label })}
            />
          ))}
        </ChipWrap>
        <Text style={styles.nota}>{kind.tagline}</Text>
      </Section>

      <Section title={t('perfil:ajustes.valvulas')}>
        <Card padded={false} style={styles.lista}>
          <Row
            first
            leading={<Ionicons name="shield-half-outline" size={20} color={ink.ink9} />}
            title={t('perfil:ajustes.piedras')}
            detail={t('perfil:ajustes.piedrasDetalle')}
            trailing={
              <RowValue tone="accent" strong>
                {profile.protection_stones}/{MAX_STONES}
              </RowValue>
            }
          />
          <Row
            leading={<Ionicons name="snow-outline" size={20} color={frozen ? ink.ink9 : ink.ink6} />}
            title={frozen ? t('perfil:ajustes.enPausa', { motivo: profile.freeze_reason ?? t('perfil:ajustes.pausaMotivo') }) : t('perfil:ajustes.pausar')}
            detail={
              frozen
                ? profile.freeze_until
                  ? t('perfil:ajustes.pausaVuelve', { dia: nombreDia(addDays(profile.freeze_until, 1)).toLocaleLowerCase('es-ES') })
                  : t('perfil:ajustes.pausaReanudar')
                : t('perfil:ajustes.pausarDetalle')
            }
            trailing={frozen ? <Tag tone="accent">{t('perfil:ajustes.pausaTag')}</Tag> : undefined}
            chevron
            onPress={frozen ? onReanudar : onPausar}
            accessibilityLabel={frozen ? t('perfil:ajustes.reanudar') : t('perfil:ajustes.pausar')}
          />
          <Row
            leading={<Ionicons name="phone-portrait-outline" size={20} color={vibraciones ? ink.ink9 : ink.ink6} />}
            title={t('perfil:ajustes.vibraciones')}
            detail={t('perfil:ajustes.vibracionesDetalle')}
            trailing={
              <Interruptor value={vibraciones} onValueChange={onVibraciones} accessibilityLabel={t('perfil:ajustes.vibraciones')} />
            }
          />
        </Card>
      </Section>

      {/* Sin esto no había forma de saber si los avisos estaban vivos: fallaban
          en silencio y el gladiador se enteraba por no recibirlos. */}
      <Section title={t('perfil:ajustes.avisos')}>
        <Card padded={false} variant={sinPermiso ? 'alerta' : 'surface'}>
          {/* El relleno va dentro: en alerta la trama hace de marco de 3 pt. Sin
              permiso, la trama va solo en la tarjeta (no también en el rótulo). */}
          <View style={styles.lista}>
            <Row
              first
              leading={
                <Ionicons
                  name={avisos?.permitido ? 'notifications-outline' : 'notifications-off-outline'}
                  size={20}
                  color={avisos === null ? ink.ink6 : ink.ink9}
                />
              }
              title={
                avisos === null
                  ? t('perfil:ajustes.avisosComprobando')
                  : avisos.permitido
                    ? t('perfil:ajustes.avisosActivos')
                    : t('perfil:ajustes.avisosDesactivados')
              }
              detail={
                avisos?.permitido
                  ? t('perfil:ajustes.avisosActivosDetalle')
                  : avisos === null
                    ? undefined
                    : t('perfil:ajustes.avisosSinPermiso')
              }
              trailing={
                avisos?.permitido ? (
                  <RowValue tone="accent" strong>
                    {avisos.programados}
                  </RowValue>
                ) : undefined
              }
              chevron={sinPermiso}
              onPress={sinPermiso ? onActivarAvisos : undefined}
              accessibilityLabel={
                avisos && !avisos.permitido
                  ? avisos.puedePreguntar
                    ? t('perfil:ajustes.activarAvisos')
                    : t('perfil:ajustes.abrirAjustesAvisos')
                  : undefined
              }
            />
            {avisos?.error ? (
              <Row
                leading={<Ionicons name="alert-circle-outline" size={20} color={ink.ink9} />}
                title={t('perfil:ajustes.ultimoError')}
                detail={avisos.error}
                muted
              />
            ) : null}
          </View>
        </Card>
        {avisos?.permitido ? <Text style={styles.nota}>{t('perfil:ajustes.programados', { n: avisos.programados })}</Text> : null}
      </Section>

      {/* Stripe solo existe fuera de la app de tienda (paywallEnabled es
          false en iOS y Android, Guideline 3.1.1): allí lo de pago es /pro. */}
      {paywallEnabled() ? (
        <Section title={t('perfil:ajustes.oraculo')}>
          <Card padded={false} style={styles.lista}>
            <Row
              first
              leading={<Ionicons name="sparkles-outline" size={20} color={ink.ink8} />}
              title={premium ? t('perfil:ajustes.premiumActivo') : t('perfil:ajustes.haztePremium')}
              detail={
                premium
                  ? subscription?.current_period_end
                    ? t('perfil:ajustes.oraculoRenueva', { fecha: subscription.current_period_end.slice(0, 10) })
                    : t('perfil:ajustes.oraculoIncluido')
                  : paymentsConfigured()
                    ? t('perfil:ajustes.oraculoPagos')
                    : t('perfil:ajustes.oraculoSinPagos')
              }
              trailing={premium ? <Tag>{t('perfil:ajustes.activo')}</Tag> : undefined}
              chevron={!premium && paymentsConfigured()}
              onPress={!premium && paymentsConfigured() ? onCheckout : undefined}
              accessibilityLabel={!premium && paymentsConfigured() ? t('perfil:ajustes.haztePremium') : undefined}
            />
          </Card>
        </Section>
      ) : null}

      {/* 1.0.10: solo el coach cambia de idioma; la interfaz sigue en español.
          En 1.1.0 esta sección pasa a ser «Idioma». */}
      <Section title={t('perfil:ajustes.idioma')}>
        <Card padded={false} style={styles.lista}>
          <Row
            first
            leading={<Ionicons name="language-outline" size={20} color={ink.ink9} />}
            title={t('perfil:ajustes.teHablaEn')}
            detail={idiomaAuto ? t('perfil:ajustes.idiomaAuto') : undefined}
            trailing={<RowValue strong>{nombreIdioma}</RowValue>}
            chevron
            onPress={onIdioma}
            accessibilityLabel={t(idiomaAuto ? 'perfil:ajustes.idiomaAutoA11y' : 'perfil:ajustes.idiomaA11y', { idioma: nombreIdioma })}
          />
        </Card>
        <Text style={styles.nota}>{t('perfil:ajustes.interfazEspanol')}</Text>
      </Section>

      <Section title={t('perfil:ajustes.datosIA')}>
        <Card padded={false} style={styles.lista}>
          <Row
            first
            leading={<Ionicons name="shield-checkmark-outline" size={20} color={ink.ink9} />}
            title={t('perfil:ajustes.envioDatos')}
            detail={consent ? lineaPerfil(consent) : t('perfil:ajustes.envioDatosDetalle')}
            chevron
            onPress={onConsentimiento}
            accessibilityLabel={t('perfil:ajustes.envioDatosA11y')}
          />
        </Card>
        <Text style={styles.nota}>{`${DESCARGO_SALUD} ${LINEA_CRISIS}`}</Text>
      </Section>

      {salud ?? (sinSalud ? null : <HealthPrivacySection />)}
      {/* Perfil > Privacidad > Medición de uso (consulta el móvil y el flag: fuera de la galería). */}
      {sinSalud ? null : <MedicionUsoSection />}
      <Section title={t('perfil:ajustes.cuenta')}>
        <Card padded={false} style={styles.lista}>
          <View ref={filaExportar} collapsable={false}>
            <Row
              first
              leading={<Ionicons name="download-outline" size={20} color={ink.ink9} />}
              title={t('perfil:ajustes.exportar')}
              detail={t('perfil:ajustes.exportarDetalle')}
              trailing={busy ? <ActivityIndicator size="small" color={ink.ink10} /> : undefined}
              chevron={!busy}
              onPress={exportar}
              disabled={busy}
              accessibilityLabel={t('perfil:ajustes.exportar')}
              accessibilityState={{ disabled: busy }}
            />
          </View>
          <Row
            leading={<Ionicons name="log-out-outline" size={20} color={ink.ink9} />}
            title={t('comun:cerrarSesion')}
            detail={t('perfil:ajustes.cerrarSesionDetalle')}
            chevron
            onPress={onCerrarSesion}
            accessibilityLabel={t('comun:cerrarSesion')}
          />
          <Row
            leading={<Ionicons name="document-text-outline" size={20} color={ink.ink9} />}
            title={t('perfil:ajustes.terminos')}
            chevron
            onPress={() => Linking.openURL(LEGAL_URLS.terminos).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel={t('perfil:ajustes.terminosA11y')}
          />
          <Row
            leading={<Ionicons name="shield-checkmark-outline" size={20} color={ink.ink9} />}
            title={t('perfil:ajustes.privacidad')}
            chevron
            onPress={() => Linking.openURL(LEGAL_URLS.privacidad).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel={t('perfil:ajustes.privacidadA11y')}
          />
        </Card>
        <Button
          title={t('perfil:ajustes.eliminarCuenta')}
          variant="danger"
          icon="trash-outline"
          onPress={onBorrar}
          style={styles.borrar}
        />
        <Text style={styles.nota}>{t('perfil:ajustes.eliminarNota')}</Text>
      </Section>

      <Version />
    </>
  );
}

const styles = StyleSheet.create({
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: space.s2,
  },
  lista: { paddingHorizontal: space.s4, paddingVertical: 2 },
  borrar: { marginTop: space.s2 },
});
