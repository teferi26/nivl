// NIVL · Amigos, la pantalla entera (L-RADICAL §B.4 y §C; antes en src/app/amigos.tsx). Los datos y efectos viven en
// useAmigos; la vista pura en AmigosVista. Aquí quedan la hoja de seguridad
// (denunciar, bloquear, retar) y el slot de <Competicion>.
//
// La hoja de seguridad es la Sheet del kit (FASE3 Lote B2): centrada a 560 en
// tablet y web, cierre de 44 y escape del lector. Mientras hay una acción en
// curso no se cierra (mismo cerrojo `safetyBusy` que antes). Sin inversión:
// denunciar y bloquear no son la acción principal de la pantalla.

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AmigosVista } from './AmigosVista';
import { Competicion } from './Competicion';
import { useAmigos, type DatosAmigos } from './useAmigos';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { REPORT_REASONS } from '@/lib/socialSafety';

/**
 * La pantalla entera (vista, competición y hoja de seguridad). La usa también
 * la Arena de General ((tabs)/arena.tsx) como pestaña: sin volver y con el
 * ranking abierto por constancia.
 */
export function PantallaAmigos({
  enPestana = false,
  pintar,
}: {
  enPestana?: boolean;
  /** Otra vista con los mismos datos (la Arena de General); la hoja de seguridad sigue aquí. */
  pintar?: (d: DatosAmigos) => ReactNode;
}) {
  const datos = useAmigos(enPestana ? { metricaInicial: 'cumplimiento', enPestana: true } : {});
  const { vista, competicion: comp, hojas } = datos;
  const {
    safetyUser,
    setSafetyUser,
    safetyBusy,
    competicion,
    amigos,
    setRetarA,
    reportReason,
    setReportReason,
    safetyMessage,
    denunciar,
    bloquear,
    abrirSoporte,
  } = hojas;

  const cerrar = () => {
    if (!safetyBusy) setSafetyUser(null);
  };
  const puedeRetar = !!competicion && !!safetyUser && amigos.some((a) => a.userId === safetyUser.userId);

  return (
    <>
      {pintar ? pintar(datos) : <AmigosVista {...vista} competicion={<Competicion {...comp} />} />}

      <Sheet
        visible={safetyUser !== null}
        onClose={cerrar}
        eyebrow={t('amigos:seguridad.eyebrow')}
        title={safetyUser?.name ?? ''}
        footer={
          <>
            <Button title={t('amigos:seguridad.soporte')} variant="ghost" disabled={safetyBusy} onPress={abrirSoporte} />
            <Button title={t('comun:cerrar')} variant="ghost" disabled={safetyBusy} onPress={cerrar} />
          </>
        }
      >
        <View style={styles.pila}>
          {puedeRetar ? (
            <Button
              title={t('amigos:seguridad.retar')}
              icon="flash-outline"
              variant="secondary"
              disabled={safetyBusy}
              onPress={() => {
                const rival = amigos.find((a) => a.userId === safetyUser?.userId) ?? null;
                setSafetyUser(null);
                // La hoja del duelo es otro Modal: en iOS no se presenta
                // mientras este aún se está cerrando.
                setTimeout(() => setRetarA(rival), 350);
              }}
            />
          ) : null}

          <View style={styles.grupo}>
            <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
              {t('amigos:seguridad.denunciar')}
            </Text>
            <Text style={styles.cuerpo}>{t('amigos:seguridad.denunciarCuerpo')}</Text>
            <ChipWrap>
              {REPORT_REASONS.map((reason) => (
                <Chip
                  key={reason.value}
                  label={reason.label}
                  selected={reportReason === reason.value}
                  disabled={safetyBusy}
                  onPress={() => setReportReason(reason.value)}
                />
              ))}
            </ChipWrap>
          </View>

          {safetyMessage ? (
            <Text style={styles.mensaje} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {safetyMessage}
            </Text>
          ) : null}

          <View style={styles.grupo}>
            <Button
              title={t('amigos:seguridad.enviarDenuncia')}
              icon="flag-outline"
              variant="secondary"
              disabled={!reportReason || safetyBusy}
              loading={safetyBusy}
              onPress={denunciar}
            />
            <Button title={t('amigos:seguridad.bloquear')} icon="ban-outline" variant="secondary" disabled={safetyBusy} onPress={bloquear} />
          </View>
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s5 },
  grupo: { gap: space.s3 },
  etiqueta: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  cuerpo: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  mensaje: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
});
