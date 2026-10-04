// NIVL · Agenda: las dos hojas (FASE3 Lote C). Puras: el estado del
// formulario y los cerrojos viven en useAgenda.
//
//   · HojaEvento → Campo nombre, chips del día con su Campo de fecha, Campo de
//     hora con «Todo el día». Los fallos van en línea (la fecha en su Campo,
//     el del servidor en ErrorSistema compacto): nada de avisos encima de una
//     hoja abierta. Pie: primary «Añadir evento» + ghost «Cancelar».
//   · HojaDetalle → la fecha en inscripción, la hora en Cinzel y la nota; pie
//     danger «Eliminar evento» (con confirmar y vibración `destructiva`, en
//     useAgenda) + ghost «Cerrar».

import { StyleSheet, Text, View } from 'react-native';
import { Campo, ErrorSistema } from '@/components/arena';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { addDays, nombreDia } from '@/lib/dates';
import { hhmm, horaAMinutos } from '@/lib/plan';
import type { CalendarEvent } from '@/lib/types';
import { diaCorto, fechaInscrita } from './derivarAgenda';

export interface HojaEventoProps {
  visible: boolean;
  hoy: string;
  /** El día elegido en la agenda. */
  dia: string;
  titulo: string;
  fecha: string;
  hora: string;
  guardando: boolean;
  /** La fecha escrita no vale (se enseña en su campo). */
  errorFecha: string | null;
  /** Lo que ha contestado el sistema al guardar, ya escrito para el usuario. */
  errorGuardar: string | null;
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
  errorFecha,
  errorGuardar,
  onTitulo,
  onFecha,
  onHora,
  onGuardar,
  onCerrar,
}: HojaEventoProps) {
  const manana = addDays(hoy, 1);
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow="Nuevo evento"
      title="¿Qué hay que recordar?"
      footer={
        <>
          <Button title="Añadir evento" onPress={onGuardar} loading={guardando} disabled={!titulo.trim()} />
          <Button title="Cancelar" variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Campo
          etiqueta="Nombre"
          value={titulo}
          onChangeText={onTitulo}
          placeholder="Llamada, cita, demo, examen"
          accessibilityLabel="Nombre del evento"
          autoFocus
        />

        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            Día
          </Text>
          <ChipWrap>
            <Chip small label="Hoy" selected={fecha === hoy} onPress={() => onFecha(hoy)} accessibilityLabel="Hoy" />
            <Chip small label="Mañana" selected={fecha === manana} onPress={() => onFecha(manana)} accessibilityLabel="Mañana" />
            {dia !== hoy && dia !== manana ? (
              <Chip
                small
                label={diaCorto(dia)}
                selected={fecha === dia}
                onPress={() => onFecha(dia)}
                accessibilityLabel={`El día elegido, ${nombreDia(dia)}`}
              />
            ) : null}
          </ChipWrap>
          <Campo
            etiqueta="Fecha"
            value={fecha}
            onChangeText={onFecha}
            placeholder="AAAA-MM-DD"
            autoCapitalize="none"
            error={errorFecha}
          />
        </View>

        <View style={styles.horaFila}>
          <Campo
            etiqueta="Hora"
            value={hora}
            onChangeText={onHora}
            placeholder="09:30"
            keyboardType="numbers-and-punctuation"
            estiloBloque={styles.horaCampo}
          />
          <Chip
            small
            label="Todo el día"
            selected={!hora.trim()}
            onPress={() => onHora('')}
            accessibilityLabel="Sin hora, todo el día"
            style={styles.todoElDia}
          />
        </View>
        <Text style={styles.ayuda} maxFontSizeMultiplier={1.35}>
          Con hora, el evento se pinta sobre el eje del día. Sin hora, cuenta como de todo el día.
        </Text>

        {errorGuardar ? <ErrorSistema compacto mensaje={errorGuardar} /> : null}
      </View>
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
  const min = evento ? horaAMinutos(evento.time) : null;
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow="Evento"
      title={evento?.title ?? ''}
      footer={
        <>
          <Button title="Eliminar evento" variant="danger" icon="trash-outline" loading={eliminando} onPress={onEliminar} />
          <Button title="Cerrar" variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      {evento ? (
        <View style={styles.pila}>
          <View style={styles.grupo} accessible accessibilityLabel={`Fecha: ${nombreDia(evento.date)}`}>
            <Text style={styles.etiqueta}>Fecha</Text>
            <Text style={styles.fecha} maxFontSizeMultiplier={1.35}>
              {fechaInscrita(evento.date)}
            </Text>
          </View>
          <View
            style={styles.grupo}
            accessible
            accessibilityLabel={min === null ? 'Hora: todo el día' : `Hora: ${hhmm(min)}`}
          >
            <Text style={styles.etiqueta}>Hora</Text>
            {min === null ? (
              <Text style={styles.fecha} maxFontSizeMultiplier={1.35}>
                TODO EL DÍA
              </Text>
            ) : (
              <Text style={styles.hora} maxFontSizeMultiplier={1.2}>
                {hhmm(min)}
              </Text>
            )}
          </View>
          {evento.notes ? (
            <View style={styles.grupo}>
              <Text style={styles.etiqueta}>Nota</Text>
              <Text style={styles.nota}>{evento.notes}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s5 },
  grupo: { gap: space.s2 },
  etiqueta: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  horaFila: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s3 },
  horaCampo: { flex: 1, minWidth: 0 },
  // El chip se alinea con la caja de 48 del campo, no con su etiqueta.
  todoElDia: { marginBottom: 8 },
  ayuda: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: -space.s2,
  },
  fecha: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink9,
  },
  hora: {
    fontFamily: tipo.cifra.family,
    fontSize: tipo.cifra.size,
    lineHeight: tipo.cifra.lineHeight,
    color: ink.ink10,
    fontVariant: ['tabular-nums'],
  },
  nota: {
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    lineHeight: tipo.body.lineHeight,
    color: ink.ink9,
  },
});
