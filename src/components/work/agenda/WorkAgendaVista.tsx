// NIVL · WORK: la Agenda. AgendaVista tal cual (es compartida y no se toca) con
// un pie fijo debajo: reunión o bloque en dos toques y, si este binario puede,
// la fila del calendario. Pura: todo llega por props.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AgendaVista, type AgendaVistaProps } from '@/components/agenda/AgendaVista';
import { Button } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import type { EstadoCalendario } from '@/work/calendario';

export interface BarraAgendaProps {
  estadoCalendario: EstadoCalendario;
  onReunion: () => void;
  onBloque: () => void;
  onCalendario: () => void;
}

export interface WorkAgendaVistaProps {
  agenda: AgendaVistaProps;
  barra: BarraAgendaProps;
}

function textoFila(e: EstadoCalendario): string {
  if (e === 'conectado') return t('trabajoagenda:calendario.conectado');
  if (e === 'denegado') return t('trabajoagenda:calendario.denegado');
  return t('trabajoagenda:calendario.optInTitulo');
}

function BarraAgenda({ estadoCalendario, onReunion, onBloque, onCalendario }: BarraAgendaProps) {
  return (
    <View style={styles.barra}>
      {estadoCalendario !== 'oculto' ? (
        <Pressable onPress={onCalendario} accessibilityRole="button" accessibilityLabel={textoFila(estadoCalendario)} style={styles.fila}>
          <Ionicons name="calendar-outline" size={16} color={ink.ink8} />
          <Text style={styles.filaTexto} numberOfLines={1} maxFontSizeMultiplier={1.35}>
            {textoFila(estadoCalendario)}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={ink.ink6} />
        </Pressable>
      ) : null}
      <View style={styles.botones}>
        <Button
          title={t('trabajoagenda:agenda.anadirReunion')}
          accessibilityLabel={t('trabajoagenda:agenda.anadirReunionA11y')}
          variant="secondary"
          icon="people-outline"
          onPress={onReunion}
          style={styles.boton}
        />
        <Button
          title={t('trabajoagenda:agenda.anadirBloque')}
          accessibilityLabel={t('trabajoagenda:agenda.anadirBloqueA11y')}
          variant="secondary"
          icon="time-outline"
          onPress={onBloque}
          style={styles.boton}
        />
      </View>
    </View>
  );
}

export function WorkAgendaVista({ agenda, barra }: WorkAgendaVistaProps) {
  return (
    <View style={styles.raiz}>
      <View style={styles.raiz}>
        <AgendaVista {...agenda} />
      </View>
      <BarraAgenda {...barra} />
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  barra: {
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
    backgroundColor: ink.ink0,
    paddingHorizontal: space.s5,
    paddingVertical: space.s2,
    gap: space.s1,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.s2, minHeight: 44 },
  filaTexto: { flex: 1, fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8 },
  botones: { flexDirection: 'row', gap: space.s3 },
  boton: { flex: 1 },
});
