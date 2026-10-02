// NIVL · La hoja de denunciar una respuesta de la IA (coach y Oráculo).
//
// Requisito de Google Play para apps con IA generativa: desde la propia
// respuesta se puede señalar como dañina u ofensiva. Se envía el motivo y el
// texto de esa burbuja (se avisa antes); si el servidor aún no tiene la
// función, se abre un correo a soporte con el id y el motivo, sin el texto.

import * as Linking from 'expo-linking';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SystemButton } from '@/components/SystemButton';
import { ChipWrap, Chip } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { mensajeSistema } from '@/lib/validation';
import { CORREO_SOPORTE, correoDenuncia, extractoDenuncia, faltaLaRpc, MOTIVOS_IA, type FuenteIA, type MotivoIA } from './denunciaIA';

export interface RespuestaDenunciada {
  fuente: FuenteIA;
  /** Id del mensaje en servidor; null en el Oráculo, que no los guarda. */
  messageId: string | null;
  texto: string;
  /** Hilo y hora, para localizarla si no hay id de servidor. Nunca el texto. */
  contexto?: string;
}

interface Props {
  /** La respuesta que se denuncia; null = hoja cerrada. */
  respuesta: RespuestaDenunciada | null;
  onClose: () => void;
}

export function DenunciarIA({ respuesta, onClose }: Props) {
  const [motivo, setMotivo] = useState<MotivoIA | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const insets = useSafeAreaInsets();

  const cerrar = () => {
    if (lock.current) return;
    setMotivo(null);
    setAviso(null);
    setEnviada(false);
    onClose();
  };

  const enviar = async () => {
    if (!respuesta || !motivo || lock.current) return;
    lock.current = true;
    setBusy(true);
    setAviso(null);
    try {
      const { error } = await supabase.rpc('report_ai_message', {
        p_source: respuesta.fuente,
        p_message_id: respuesta.messageId,
        p_reason: motivo,
        p_excerpt: extractoDenuncia(respuesta.texto),
      });
      if (error && faltaLaRpc(error)) {
        // Aún sin la función en el servidor: el correo de respaldo, sin el texto.
        try {
          await Linking.openURL(correoDenuncia(respuesta.fuente, motivo, respuesta.messageId, respuesta.contexto));
          setAviso('Se ha abierto tu correo con la denuncia. Envíalo para que llegue a revisión.');
        } catch {
          // Sin app de correo: que sepa a dónde escribir.
          setAviso(`No se ha podido abrir el correo. Escribe a ${CORREO_SOPORTE} con el motivo de la denuncia.`);
        }
        setEnviada(true);
      } else if (error) {
        throw error;
      } else {
        setEnviada(true);
        setAviso('Denuncia registrada. El equipo revisará esta respuesta.');
      }
    } catch (e) {
      setAviso(mensajeSistema(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal visible={respuesta !== null} transparent animationType="slide" onRequestClose={cerrar}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={cerrar} accessibilityRole="button" accessibilityLabel="Cerrar" />
        <ScrollView
          style={styles.sheet}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: Math.max(34, insets.bottom + 20) }]}
          accessibilityViewIsModal
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetEyebrow}>DENUNCIAR RESPUESTA</Text>
          <Text style={styles.sheetTitle}>¿Qué falla en esta respuesta?</Text>
          <Text style={styles.hint}>
            Se envía el motivo y el texto de esta respuesta para que el equipo la revise. Nada más de tu conversación.
          </Text>

          {!enviada ? (
            <ChipWrap style={styles.motivos}>
              {MOTIVOS_IA.map((m) => (
                <Chip key={m.value} label={m.label} selected={motivo === m.value} disabled={busy} onPress={() => setMotivo(m.value)} />
              ))}
            </ChipWrap>
          ) : null}

          {aviso ? (
            <Text style={styles.aviso} accessibilityRole="alert" selectable>
              {aviso}
            </Text>
          ) : null}

          {!enviada ? (
            <SystemButton
              title="Enviar denuncia"
              icon="flag-outline"
              size="lg"
              disabled={!motivo || busy}
              loading={busy}
              onPress={enviar}
              style={styles.first}
            />
          ) : null}
          <SystemButton title={enviada ? 'Cerrar' : 'Cancelar'} variant="ghost" disabled={busy} onPress={cerrar} style={styles.cancel} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  backdropTap: { flex: 1 },
  sheet: {
    flexGrow: 0,
    maxHeight: '85%',
    backgroundColor: colors.panel,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  sheetContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 34 },
  sheetHandle: { alignSelf: 'center', width: 36, height: 3, backgroundColor: colors.accentDim, marginBottom: 16 },
  sheetEyebrow: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, color: colors.textFaint },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 27, letterSpacing: -0.4, color: colors.text, marginTop: 6 },
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textDim, marginTop: 8 },
  motivos: { marginTop: 16 },
  aviso: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19, color: colors.accentText, marginTop: 16 },
  first: { marginTop: 20 },
  cancel: { marginTop: 6 },
});
