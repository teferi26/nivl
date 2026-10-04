// NIVL · Agenda: las dos hojas (nuevo evento y detalle). Puras: el estado del
// formulario y los cerrojos viven en useAgenda.

import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { addDays, nombreDia } from '@/lib/dates';
import { hhmm, horaAMinutos } from '@/lib/plan';
import { colors, fonts } from '@/lib/theme';
import type { CalendarEvent } from '@/lib/types';
import { tituloDelDia } from './AgendaVista';

export interface HojaEventoProps {
  visible: boolean;
  hoy: string;
  /** El día elegido en la agenda. */
  dia: string;
  titulo: string;
  fecha: string;
  hora: string;
  guardando: boolean;
  onTitulo: (v: string) => void;
  onFecha: (v: string) => void;
  onHora: (v: string) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaEvento({
  visible,
  hoy,
  dia,
  titulo,
  fecha,
  hora,
  guardando,
  onTitulo,
  onFecha,
  onHora,
  onGuardar,
  onCerrar,
}: HojaEventoProps) {
  const today = hoy;
  const anchor = dia;
  const title = titulo;
  const date = fecha;
  const time = hora;
  const setTitle = onTitulo;
  const setDate = onFecha;
  const setTime = onHora;
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow="Nuevo evento"
      title="¿Qué hay que recordar?"
      footer={
        <>
          <Button title="Añadir evento" onPress={onGuardar} loading={guardando} disabled={!title.trim()} />
          <Button title="Cancelar" variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <Text style={[styles.label, styles.labelPrimero]}>Nombre</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Llamada, cita, demo, examen"
        placeholderTextColor={colors.textFaint}
        accessibilityLabel="Nombre del evento"
        autoFocus
      />
      <Text style={styles.label}>Día</Text>
      <ChipWrap style={styles.chipsDia}>
        <Chip small label="Hoy" selected={date === today} onPress={() => setDate(today)} accessibilityLabel="Hoy" />
        <Chip
          small
          label="Mañana"
          selected={date === addDays(today, 1)}
          onPress={() => setDate(addDays(today, 1))}
          accessibilityLabel="Mañana"
        />
        {anchor !== today && anchor !== addDays(today, 1) ? (
          <Chip
            small
            label={tituloDelDia(anchor, today)}
            selected={date === anchor}
            onPress={() => setDate(anchor)}
            accessibilityLabel={`El día elegido, ${nombreDia(anchor)}`}
          />
        ) : null}
      </ChipWrap>
      <TextInput
        style={styles.input}
        value={date}
        onChangeText={setDate}
        placeholder="AAAA-MM-DD"
        placeholderTextColor={colors.textFaint}
        accessibilityLabel="Fecha"
        autoCapitalize="none"
      />
      <Text style={styles.label}>Hora</Text>
      <View style={styles.inline}>
        <TextInput
          style={[styles.input, styles.inputHora]}
          value={time}
          onChangeText={setTime}
          placeholder="09:30"
          placeholderTextColor={colors.textFaint}
          accessibilityLabel="Hora"
          keyboardType="numbers-and-punctuation"
        />
        <Chip
          small
          label="Todo el día"
          selected={!time.trim()}
          onPress={() => setTime('')}
          accessibilityLabel="Sin hora, todo el día"
        />
      </View>
      <Text style={styles.hint}>
        Con hora, el evento se pinta sobre el eje del día. Sin hora, cuenta como de todo el día.
      </Text>
    </Sheet>
  );
}

export interface HojaDetalleProps {
  visible: boolean;
  /** Se queda puesto al cerrar: el título no se vacía durante la salida. */
  evento: CalendarEvent | null;
  eliminando: boolean;
  onEliminar: () => void;
  onCerrar: () => void;
}

export function HojaDetalle({ visible, evento, eliminando, onEliminar, onCerrar }: HojaDetalleProps) {
  const detalle = evento;
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow="Evento"
      title={detalle?.title ?? ''}
      footer={
        <>
          <Button
            title="Eliminar evento"
            variant="danger"
            icon="trash-outline"
            loading={eliminando}
            onPress={onEliminar}
          />
          <Button title="Cerrar" variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      {detalle ? (
        <>
          <Text style={[styles.label, styles.labelPrimero]}>Fecha</Text>
          <Text style={styles.detalleValor}>{nombreDia(detalle.date)}</Text>
          <Text style={styles.label}>Hora</Text>
          <Text style={styles.detalleValor}>
            {horaAMinutos(detalle.time) === null ? 'Todo el día' : hhmm(horaAMinutos(detalle.time) ?? 0)}
          </Text>
          {detalle.notes ? (
            <>
              <Text style={styles.label}>Nota</Text>
              <Text style={styles.detalleValor}>{detalle.notes}</Text>
            </>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  labelPrimero: { marginTop: 0 },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 8, lineHeight: 17 },
  detalleValor: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.text },
  chipsDia: { marginBottom: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputHora: { flex: 1, minWidth: 0 },
});
