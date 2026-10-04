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
import { Version } from '@/components/Version';
import { Button, Card, Chip, ChipWrap, Row, RowValue, Section, Tag } from '@/components/ui';
import { Interruptor } from '@/components/ui/Interruptor';
import { ink, space, type as tipo } from '@/design/tokens';
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

  return (
    <>
      <Section title="Para qué uso NIVL">
        <ChipWrap>
          {PROFILE_KINDS.map((k) => (
            <Chip
              key={k}
              label={KINDS[k].label}
              icon={KINDS[k].icon as never}
              selected={profile.profile_kind === k}
              onPress={() => onPerfilDeUso(k)}
              disabled={busy}
              accessibilityLabel={`Perfil ${KINDS[k].label}`}
            />
          ))}
        </ChipWrap>
        <Text style={styles.nota}>{kind.tagline}</Text>
      </Section>

      <Section title="Válvulas del sistema">
        <Card padded={false} style={styles.lista}>
          <Row
            first
            leading={<Ionicons name="shield-half-outline" size={20} color={ink.ink9} />}
            title="Piedras de protección"
            detail="Se forja una por semana de racha perfecta. Se consume sola al fallar un día y absorbe todo el daño."
            trailing={
              <RowValue tone="accent" strong>
                {profile.protection_stones}/{MAX_STONES}
              </RowValue>
            }
          />
          <Row
            leading={<Ionicons name="snow-outline" size={20} color={frozen ? ink.ink9 : ink.ink6} />}
            title={frozen ? `En pausa · ${profile.freeze_reason ?? 'pausa'}` : 'Pausar el sistema'}
            detail={
              frozen
                ? `${profile.freeze_until ? `Vuelve el ${nombreDia(addDays(profile.freeze_until, 1)).toLocaleLowerCase('es-ES')}. ` : ''}Toca para reanudar antes.`
                : 'Exámenes, enfermedad, viaje. Sin misiones ni penalizaciones mientras dure.'
            }
            trailing={frozen ? <Tag tone="accent">Pausa</Tag> : undefined}
            chevron
            onPress={frozen ? onReanudar : onPausar}
            accessibilityLabel={frozen ? 'Reanudar el sistema' : 'Pausar el sistema'}
          />
          <Row
            leading={<Ionicons name="phone-portrait-outline" size={20} color={vibraciones ? ink.ink9 : ink.ink6} />}
            title="Vibraciones"
            detail="Al completar, subir de nivel o de rango."
            trailing={
              <Interruptor value={vibraciones} onValueChange={onVibraciones} accessibilityLabel="Vibraciones" />
            }
          />
        </Card>
      </Section>

      {/* Sin esto no había forma de saber si los avisos estaban vivos: fallaban
          en silencio y el gladiador se enteraba por no recibirlos. */}
      <Section title="Avisos">
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
                avisos === null ? 'Comprobando los avisos' : avisos.permitido ? 'Avisos activos' : 'Avisos desactivados'
              }
              detail={
                avisos?.permitido
                  ? 'Despertador, bloques del día y cierre. Una notificación no suena en silencio ni en Modo Concentración: mantén también la alarma del reloj.'
                  : avisos === null
                    ? undefined
                    : 'Sin permiso no hay despertador ni avisos de bloque. Toca para activarlos.'
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
                    ? 'Activar avisos'
                    : 'Abrir ajustes del sistema para activar los avisos'
                  : undefined
              }
            />
            {avisos?.error ? (
              <Row
                leading={<Ionicons name="alert-circle-outline" size={20} color={ink.ink9} />}
                title="Último error"
                detail={avisos.error}
                muted
              />
            ) : null}
          </View>
        </Card>
        {avisos?.permitido ? <Text style={styles.nota}>{avisos.programados} avisos programados.</Text> : null}
      </Section>

      {/* Stripe solo existe fuera de la app de tienda (paywallEnabled es
          false en iOS y Android, Guideline 3.1.1): allí lo de pago es /pro. */}
      {paywallEnabled() ? (
        <Section title="El Oráculo">
          <Card padded={false} style={styles.lista}>
            <Row
              first
              leading={<Ionicons name="sparkles-outline" size={20} color={ink.ink8} />}
              title={premium ? 'Premium activo' : 'Hazte Premium'}
              detail={
                premium
                  ? `El Oráculo va incluido${subscription?.current_period_end ? `. Renueva el ${subscription.current_period_end.slice(0, 10)}` : ''}.`
                  : paymentsConfigured()
                    ? 'La IA (misiones desde objetivos y análisis semanal) consume API real. Con la suscripción va incluida; sin ella puedes usar tu propia key en el módulo Oráculo.'
                    : 'Pagos aún no configurados en este servidor. Puedes usar tu propia key en el módulo Oráculo.'
              }
              trailing={premium ? <Tag>Activo</Tag> : undefined}
              chevron={!premium && paymentsConfigured()}
              onPress={!premium && paymentsConfigured() ? onCheckout : undefined}
              accessibilityLabel={!premium && paymentsConfigured() ? 'Hazte Premium' : undefined}
            />
          </Card>
        </Section>
      ) : null}

      <Section title="Datos y la IA">
        <Card padded={false} style={styles.lista}>
          <Row
            first
            leading={<Ionicons name="shield-checkmark-outline" size={20} color={ink.ink9} />}
            title="Envío de datos al coach"
            detail={consent ? lineaPerfil(consent) : 'Qué datos van al proveedor de IA y a quién.'}
            chevron
            onPress={onConsentimiento}
            accessibilityLabel="Consentimiento para el envío de datos al proveedor de IA"
          />
        </Card>
        <Text style={styles.nota}>{`${DESCARGO_SALUD} ${LINEA_CRISIS}`}</Text>
      </Section>

      {salud ?? (sinSalud ? null : <HealthPrivacySection />)}
      <Section title="Cuenta">
        <Card padded={false} style={styles.lista}>
          <View ref={filaExportar} collapsable={false}>
            <Row
              first
              leading={<Ionicons name="download-outline" size={20} color={ink.ink9} />}
              title="Exportar mis datos"
              detail="Copia de seguridad con todo tu progreso."
              trailing={busy ? <ActivityIndicator size="small" color={ink.ink10} /> : undefined}
              chevron={!busy}
              onPress={exportar}
              disabled={busy}
              accessibilityLabel="Exportar mis datos"
              accessibilityState={{ disabled: busy }}
            />
          </View>
          <Row
            leading={<Ionicons name="log-out-outline" size={20} color={ink.ink9} />}
            title="Cerrar sesión"
            detail="Tu progreso queda guardado en tu cuenta."
            chevron
            onPress={onCerrarSesion}
            accessibilityLabel="Cerrar sesión"
          />
          <Row
            leading={<Ionicons name="document-text-outline" size={20} color={ink.ink9} />}
            title="Términos de uso"
            chevron
            onPress={() => Linking.openURL(LEGAL_URLS.terminos).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel="Términos de uso de NIVL"
          />
          <Row
            leading={<Ionicons name="shield-checkmark-outline" size={20} color={ink.ink9} />}
            title="Política de privacidad"
            chevron
            onPress={() => Linking.openURL(LEGAL_URLS.privacidad).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel="Política de privacidad de NIVL"
          />
        </Card>
        <Button
          title="Eliminar cuenta"
          variant="danger"
          icon="trash-outline"
          onPress={onBorrar}
          style={styles.borrar}
        />
        <Text style={styles.nota}>
          Borra para siempre tu perfil y todo tu progreso en NIVL.
        </Text>
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
