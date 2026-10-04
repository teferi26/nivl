// NIVL · Amigos (L-RADICAL §B.4 y §C). Los datos y efectos viven en
// useAmigos; la vista pura en AmigosVista. Aquí quedan la hoja de seguridad
// (denunciar, bloquear, retar) y el slot de <Competicion>.
//
// La hoja de seguridad es la Sheet del kit (FASE3 Lote B2): centrada a 560 en
// tablet y web, cierre de 44 y escape del lector. Mientras hay una acción en
// curso no se cierra (mismo cerrojo `safetyBusy` que antes). Sin inversión:
// denunciar y bloquear no son la acción principal de la pantalla.

import { StyleSheet, Text, View } from 'react-native';
import { AmigosVista } from '@/components/amigos/AmigosVista';
import { Competicion } from '@/components/amigos/Competicion';
import { useAmigos } from '@/components/amigos/useAmigos';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { REPORT_REASONS } from '@/lib/socialSafety';

export default function Amigos() {
  const { vista, competicion: comp, hojas } = useAmigos();
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
      <AmigosVista {...vista} competicion={<Competicion {...comp} />} />

      <Sheet
        visible={safetyUser !== null}
        onClose={cerrar}
        eyebrow="Seguridad"
        title={safetyUser?.name ?? ''}
        footer={
          <>
            <Button title="Contactar con soporte" variant="ghost" disabled={safetyBusy} onPress={abrirSoporte} />
            <Button title="Cerrar" variant="ghost" disabled={safetyBusy} onPress={cerrar} />
          </>
        }
      >
        <View style={styles.pila}>
          {puedeRetar ? (
            <Button
              title="Retar a un duelo"
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
              Denunciar
            </Text>
            <Text style={styles.cuerpo}>
              Elige qué quieres denunciar. El equipo revisará el perfil y podrá retirar contenido o suspender su acceso
              social.
            </Text>
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
              title="Enviar denuncia"
              icon="flag-outline"
              variant="secondary"
              disabled={!reportReason || safetyBusy}
              loading={safetyBusy}
              onPress={denunciar}
            />
            <Button title="Bloquear usuario" icon="ban-outline" variant="secondary" disabled={safetyBusy} onPress={bloquear} />
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
