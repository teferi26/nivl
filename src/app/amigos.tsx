// NIVL · Amigos (L-RADICAL §B.4 y §C). Los datos y efectos viven en
// useAmigos; la vista pura en AmigosVista. Aquí quedan la hoja de seguridad
// (denunciar, bloquear, retar) y el slot de <Competicion>.

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AmigosVista } from '@/components/amigos/AmigosVista';
import { Competicion } from '@/components/amigos/Competicion';
import { useAmigos } from '@/components/amigos/useAmigos';
import { SystemButton } from '@/components/SystemButton';
import { Chip, ChipWrap } from '@/components/ui';
import { REPORT_REASONS } from '@/lib/socialSafety';
import { colors, fonts } from '@/lib/theme';

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

  return (
    <>
      <AmigosVista {...vista} competicion={<Competicion {...comp} />} />

      <Modal visible={safetyUser !== null} transparent animationType="slide" onRequestClose={() => { if (!safetyBusy) setSafetyUser(null); }}>
        <View style={styles.safetyBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => { if (!safetyBusy) setSafetyUser(null); }} accessibilityLabel="Cerrar seguridad" accessibilityRole="button" />
          <ScrollView style={styles.safetySheet} contentContainerStyle={{ padding: 20, paddingBottom: 34 }} accessibilityViewIsModal>
            <Text style={styles.safetyTitle}>{safetyUser?.name}</Text>
            {competicion && safetyUser && amigos.some((a) => a.userId === safetyUser.userId) ? (
              <SystemButton
                title="Retar a un duelo"
                icon="flash-outline"
                variant="outline"
                disabled={safetyBusy}
                onPress={() => {
                  const rival = amigos.find((a) => a.userId === safetyUser.userId) ?? null;
                  setSafetyUser(null);
                  // La hoja del duelo es otro Modal: en iOS no se presenta
                  // mientras este aún se está cerrando.
                  setTimeout(() => setRetarA(rival), 350);
                }}
                style={{ marginTop: 14 }}
              />
            ) : null}
            <Text style={[styles.eyebrow, { marginTop: 22 }]}>Seguridad</Text>
            <Text style={styles.safetyText}>Elige qué quieres denunciar. El equipo revisará el perfil y podrá retirar contenido o suspender su acceso social.</Text>
            <ChipWrap style={{ marginTop: 16 }}>
              {REPORT_REASONS.map((reason) => <Chip key={reason.value} label={reason.label}
                selected={reportReason === reason.value} disabled={safetyBusy} onPress={() => setReportReason(reason.value)} />)}
            </ChipWrap>
            {safetyMessage ? <Text style={styles.safetyText} accessibilityRole="alert">{safetyMessage}</Text> : null}
            <SystemButton title="Enviar denuncia" icon="flag-outline" variant="outline" disabled={!reportReason || safetyBusy} loading={safetyBusy}
              onPress={denunciar} style={{ marginTop: 16 }} />
            <SystemButton title="Bloquear usuario" icon="ban-outline" variant="outline" disabled={safetyBusy} onPress={bloquear} style={{ marginTop: 10 }} />
            <SystemButton title="Contactar con soporte" variant="ghost" disabled={safetyBusy} onPress={abrirSoporte} />
            <SystemButton title="Cerrar" variant="ghost" disabled={safetyBusy} onPress={() => setSafetyUser(null)} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safetyBackdrop: { flex: 1, backgroundColor: colors.bg, justifyContent: 'flex-end' },
  safetySheet: { maxHeight: '85%', backgroundColor: colors.panel, borderTopWidth: 1, borderTopColor: colors.line },
  safetyTitle: { color: colors.text, fontFamily: fonts.heading, fontSize: 20 },
  safetyText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: 10 },
  eyebrow: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
});
