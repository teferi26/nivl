// NIVL · Perfil (L-RADICAL B.3). La ruta solo junta las piezas: usePerfil
// (datos y efectos), PerfilVista (la pantalla), PerfilAjustes (los ajustes) y,
// debajo, las tres hojas: borrar la cuenta, pausar y el código de creador.
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PerfilAjustes } from '@/components/perfil/PerfilAjustes';
import { PerfilVista } from '@/components/perfil/PerfilVista';
import { FREEZE_DAYS, FREEZE_REASONS, usePerfil } from '@/components/perfil/usePerfil';
import { SystemButton } from '@/components/SystemButton';
import { Chip, ChipWrap, Screen } from '@/components/ui';
import { CODIGO_MAX_LENGTH } from '@/lib/creatormath';
import { addDays } from '@/lib/dates';
import { ink } from '@/design/tokens';
import { colors, fonts } from '@/lib/theme';

export default function Perfil() {
  const { vista, ajustes, hojas } = usePerfil();
  const { pausa, codigo, borrar, today } = hojas;

  return (
    <Screen>
      <PerfilVista {...vista} ajustes={ajustes ? <PerfilAjustes {...ajustes} /> : null} />

      {hojas.consentimientoHoja}

      <Modal visible={borrar.abierta} transparent animationType="slide" onRequestClose={() => !borrar.borrando && borrar.cerrar()}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            style={styles.backdropTap}
            onPress={() => !borrar.borrando && borrar.cerrar()}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>ELIMINAR CUENTA</Text>
            <Text style={styles.sheetTitle}>Borrar para siempre</Text>
            <Text style={styles.sheetHint}>
              Se borran tu perfil, misiones, campañas, diario, datos de cuerpo y dinero, la conversación con el coach,
              tus fotos y todo tu progreso. No hay vuelta atrás.
            </Text>
            <Text style={styles.hint}>
              {/* En iOS no se nombra Google Play (guideline 2.3.10), y al revés. */}
              {Platform.OS === 'android'
                ? 'Borrar la cuenta no cancela una suscripción de NIVL Pro: cancélala en Play Store > Pagos y suscripciones > Suscripciones.'
                : Platform.OS === 'ios'
                  ? 'Borrar la cuenta no cancela una suscripción de NIVL Pro: cancélala en Ajustes > tu nombre > Suscripciones.'
                  : 'Borrar la cuenta no cancela una suscripción de NIVL Pro: cancélala en la tienda donde la contrataste.'}
            </Text>
            {borrar.esCreador ? (
              <Text style={styles.hint}>
                Eres creador del programa. Si borras la cuenta, pierdes el saldo pendiente de cobro. Si quieres cobrar lo
                disponible,{' '}
                <Text
                  style={styles.enlace}
                  onPress={() => Linking.openURL('https://nivl.app/soporte').catch(() => {})}
                  accessibilityRole="link"
                >
                  escríbenos antes
                </Text>
                .
              </Text>
            ) : null}
            {borrar.aviso ? (
              <Text style={styles.avisoCodigo} accessibilityRole="alert">
                {borrar.aviso}
              </Text>
            ) : null}
            <SystemButton
              title="Eliminar para siempre"
              variant="danger"
              icon="trash-outline"
              onPress={borrar.confirmar}
              loading={borrar.borrando}
              style={{ marginTop: 22 }}
            />
            <SystemButton
              title="Cancelar"
              variant="ghost"
              onPress={borrar.cerrar}
              disabled={borrar.borrando}
              style={{ marginTop: 6 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={pausa.abierta} transparent animationType="slide" onRequestClose={pausa.cerrar}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            style={styles.backdropTap}
            onPress={pausa.cerrar}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>PAUSAR EL SISTEMA</Text>
            <Text style={styles.sheetTitle}>¿Cuánto tiempo?</Text>
            <Text style={styles.sheetHint}>
              Sin misiones, sin penalizaciones, sin pérdida de racha. Pausar no es rendirse: es estrategia.
            </Text>
            <Text style={styles.label}>Motivo</Text>
            <ChipWrap>
              {FREEZE_REASONS.map((r) => (
                <Chip
                  key={r}
                  label={r}
                  selected={pausa.motivo === r}
                  onPress={() => pausa.setMotivo(r)}
                  accessibilityLabel={`Motivo: ${r}`}
                />
              ))}
            </ChipWrap>
            <Text style={styles.label}>Duración, desde hoy</Text>
            <ChipWrap>
              {FREEZE_DAYS.map((d) => (
                <Chip
                  key={d}
                  label={`${d} día${d > 1 ? 's' : ''}`}
                  selected={pausa.dias === d}
                  onPress={() => pausa.setDias(d)}
                  accessibilityLabel={`${d} día${d > 1 ? 's' : ''}`}
                />
              ))}
            </ChipWrap>
            <Text style={styles.hint}>El sistema se reanuda solo el {addDays(today, pausa.dias)}.</Text>
            <SystemButton title="Activar pausa" onPress={pausa.activar} style={{ marginTop: 22 }} />
            <SystemButton title="Cancelar" variant="ghost" onPress={pausa.cerrar} style={{ marginTop: 6 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={codigo.abierta} transparent animationType="slide" onRequestClose={codigo.cerrar}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            style={styles.backdropTap}
            onPress={codigo.cerrar}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>CÓDIGO DE CREADOR</Text>
            <Text style={styles.sheetTitle}>¿Quién te trajo?</Text>
            <Text style={styles.sheetHint}>
              Si te recomendó NIVL alguien del programa de creadores, escribe su código. No cambia nada para ti y solo
              se puede poner una vez.
            </Text>
            <Text style={styles.label}>Código</Text>
            <TextInput
              style={styles.codigoInput}
              value={codigo.valor}
              onChangeText={codigo.cambiar}
              placeholder="CÓDIGO"
              placeholderTextColor={colors.textFaint}
              maxLength={CODIGO_MAX_LENGTH + 4}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={codigo.enviar}
              accessibilityLabel="Código del creador que te trajo"
            />
            {codigo.aviso ? (
              <Text style={styles.avisoCodigo} accessibilityRole="alert">
                {codigo.aviso}
              </Text>
            ) : null}
            <SystemButton
              title="Guardar código"
              onPress={codigo.enviar}
              loading={codigo.ocupado}
              disabled={!codigo.valor.trim()}
              style={{ marginTop: 22 }}
            />
            <SystemButton title="Cancelar" variant="ghost" onPress={codigo.cerrar} style={{ marginTop: 6 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  enlace: { color: colors.text, textDecorationLine: 'underline' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  backdropTap: { flex: 1 },
  sheet: {
    backgroundColor: colors.panel,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },
  sheetHandle: { alignSelf: 'center', width: 36, height: 3, backgroundColor: colors.accentDim, marginBottom: 16 },
  sheetEyebrow: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, color: colors.accentText },
  sheetTitle: {
    fontFamily: fonts.heading,
    fontSize: 24,
    letterSpacing: -0.5,
    color: colors.text,
    marginTop: 6,
    marginBottom: 4,
  },
  sheetHint: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, lineHeight: 18 },
  label: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 10, lineHeight: 17 },
  codigoInput: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.number,
    fontSize: 17,
    letterSpacing: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avisoCodigo: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: ink.ink9, marginTop: 10 },
});
