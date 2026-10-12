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
import { mayus } from '@/i18n/formato';
import { t } from '@/i18n';
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
      eyebrow={t('agenda:vista.nuevoEvento')}
      title={t('agenda:hojas.pregunta')}
      footer={
        <>
          <Button title={t('agenda:vista.anadirEvento')} onPress={onGuardar} loading={guardando} disabled={!titulo.trim()} />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Campo
          etiqueta={t('comun:nombre')}
          value={titulo}
          onChangeText={onTitulo}
          placeholder={t('agenda:hojas.placeholderNombre')}
          accessibilityLabel={t('agenda:hojas.nombreA11y')}
          autoFocus
        />

        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            {t('agenda:hojas.dia')}
          </Text>
          <ChipWrap>
            <Chip
              small
              label={t('agenda:vista.hoy')}
              selected={fecha === hoy}
              onPress={() => onFecha(hoy)}
              accessibilityLabel={t('agenda:vista.hoy')}
            />
            <Chip
              small
              label={t('agenda:hojas.manana')}
              selected={fecha === manana}
              onPress={() => onFecha(manana)}
              accessibilityLabel={t('agenda:hojas.manana')}
            />
            {dia !== hoy && dia !== manana ? (
              <Chip
                small
                label={diaCorto(dia)}
                selected={fecha === dia}
                onPress={() => onFecha(dia)}
                accessibilityLabel={t('agenda:hojas.diaElegidoA11y', { dia: nombreDia(dia) })}
              />
            ) : null}
          </ChipWrap>
          <Campo
            etiqueta={t('agenda:hojas.fecha')}
            value={fecha}
            onChangeText={onFecha}
            placeholder={t('agenda:hojas.placeholderFecha')}
            autoCapitalize="none"
            error={errorFecha}
          />
        </View>

        <View style={styles.horaFila}>
          <Campo
            etiqueta={t('agenda:hojas.hora')}
            value={hora}
            onChangeText={onHora}
            placeholder="09:30"
            keyboardType="numbers-and-punctuation"
            estiloBloque={styles.horaCampo}
          />
          <Chip
            small
            label={t('agenda:vista.todoElDia')}
            selected={!hora.trim()}
            onPress={() => onHora('')}
            accessibilityLabel={t('agenda:hojas.sinHoraA11y')}
            style={styles.todoElDia}
          />
        </View>
        <Text style={styles.ayuda} maxFontSizeMultiplier={1.35}>
          {t('agenda:hojas.ayudaHora')}
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
      eyebrow={t('agenda:hojas.evento')}
      title={evento?.title ?? ''}
      footer={
        <>
          <Button
            title={t('agenda:hojas.eliminarEvento')}
            variant="danger"
            icon="trash-outline"
            loading={eliminando}
            onPress={onEliminar}
          />
          <Button title={t('comun:cerrar')} variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      {evento ? (
        <View style={styles.pila}>
          <View style={styles.grupo} accessible accessibilityLabel={t('agenda:hojas.fechaA11y', { dia: nombreDia(evento.date) })}>
            <Text style={styles.etiqueta}>{t('agenda:hojas.fecha')}</Text>
            <Text style={styles.fecha} maxFontSizeMultiplier={1.35}>
              {fechaInscrita(evento.date)}
            </Text>
          </View>
          <View
            style={styles.grupo}
            accessible
            accessibilityLabel={
              min === null ? t('agenda:hojas.horaTodoElDiaA11y') : t('agenda:hojas.horaA11y', { hora: hhmm(min) })
            }
          >
            <Text style={styles.etiqueta}>{t('agenda:hojas.hora')}</Text>
            {min === null ? (
              <Text style={styles.fecha} maxFontSizeMultiplier={1.35}>
                {mayus(t('agenda:vista.todoElDia'))}
              </Text>
            ) : (
              <Text style={styles.hora} maxFontSizeMultiplier={1.2}>
                {hhmm(min)}
              </Text>
            )}
          </View>
          {evento.notes ? (
            <View style={styles.grupo}>
              <Text style={styles.etiqueta}>{t('agenda:hojas.nota')}</Text>
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
