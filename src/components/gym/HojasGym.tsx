// NIVL · Gimnasio: las dos hojas (FASE3 Lote E1). Puras: el formulario y los
// cerrojos viven en useGym.
//
//   · HojaDia → chips radio con el día de la semana y Campo «Nombre». Pie:
//     primary «Crear día» + ghost «Cancelar».
//   · HojaEjercicio → Campo «Ejercicio» y series, reps y kg en tres Campo a lo
//     ancho. Pie: primary «Añadir ejercicio» o «Guardar cambios» + ghost.
//
// Los fallos del servidor van en línea (ErrorSistema compacto): nada de avisos
// encima de una hoja abierta ni mientras se cierra.

import { StyleSheet, Text, View } from 'react-native';
import { Campo, ErrorSistema } from '@/components/arena';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import type { GymDay, GymExercise } from '@/lib/types';
import { DAY_NAMES } from './RutinaSemanal';

export interface HojaDiaProps {
  visible: boolean;
  /** Día ISO elegido (1 lunes … 7 domingo). */
  diaSemana: number;
  nombre: string;
  guardando: boolean;
  error: string | null;
  onDiaSemana: (d: number) => void;
  onNombre: (v: string) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaDia({ visible, diaSemana, nombre, guardando, error, onDiaSemana, onNombre, onGuardar, onCerrar }: HojaDiaProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow="Nuevo día de rutina"
      title="¿Qué día entrenas?"
      footer={
        <>
          <Button title="Crear día" onPress={onGuardar} loading={guardando} disabled={!nombre.trim()} />
          <Button title="Cancelar" variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            Día
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Día de la semana">
            <ChipWrap>
              {DAY_NAMES.map((name, i) => (
                <Chip
                  key={name}
                  label={name.slice(0, 3)}
                  selected={diaSemana === i + 1}
                  onPress={() => onDiaSemana(i + 1)}
                  accessibilityLabel={name}
                />
              ))}
            </ChipWrap>
          </View>
        </View>
        <Campo
          etiqueta="Nombre"
          value={nombre}
          onChangeText={onNombre}
          placeholder="Ej. Empuje · Pierna · Full body"
          accessibilityLabel="Nombre del día de rutina"
          returnKeyType="done"
          onSubmitEditing={() => {
            if (nombre.trim()) onGuardar();
          }}
        />
        {error ? <ErrorSistema compacto mensaje={error} /> : null}
      </View>
    </Sheet>
  );
}

export interface HojaEjercicioProps {
  visible: boolean;
  /** El día al que va el ejercicio. Se queda puesto al cerrar: el título no se vacía en la salida. */
  dia: GymDay | null;
  /** Con un ejercicio, la hoja edita en vez de crear. */
  editando: GymExercise | null;
  nombre: string;
  series: string;
  reps: string;
  kg: string;
  guardando: boolean;
  error: string | null;
  onNombre: (v: string) => void;
  onSeries: (v: string) => void;
  onReps: (v: string) => void;
  onKg: (v: string) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaEjercicio({
  visible,
  dia,
  editando,
  nombre,
  series,
  reps,
  kg,
  guardando,
  error,
  onNombre,
  onSeries,
  onReps,
  onKg,
  onGuardar,
  onCerrar,
}: HojaEjercicioProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow={`${editando ? 'Editar ejercicio' : 'Nuevo ejercicio'}${dia ? ` · ${dia.name}` : ''}`}
      title={editando ? editando.name : '¿Qué movimiento?'}
      footer={
        <>
          <Button
            title={editando ? 'Guardar cambios' : 'Añadir ejercicio'}
            onPress={onGuardar}
            loading={guardando}
            disabled={!nombre.trim()}
          />
          <Button title="Cancelar" variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Campo
          etiqueta="Ejercicio"
          value={nombre}
          onChangeText={onNombre}
          placeholder="Ej. Press banca"
          accessibilityLabel="Nombre del ejercicio"
        />
        <View style={styles.tres}>
          <Campo
            etiqueta="Series"
            value={series}
            onChangeText={onSeries}
            keyboardType="number-pad"
            accessibilityLabel="Número de series"
            estiloBloque={styles.columna}
          />
          <Campo
            etiqueta="Reps"
            value={reps}
            onChangeText={onReps}
            keyboardType="number-pad"
            accessibilityLabel="Repeticiones por serie"
            estiloBloque={styles.columna}
          />
          <Campo
            etiqueta="Kg"
            value={kg}
            onChangeText={onKg}
            keyboardType="decimal-pad"
            placeholder="-"
            accessibilityLabel="Peso de referencia en kilos"
            estiloBloque={styles.columna}
          />
        </View>
        <Text style={styles.ayuda} maxFontSizeMultiplier={1.6}>
          Al entrenar, cada serie sale ya rellena con este peso y estas repeticiones: solo tocas lo que cambie.
        </Text>
        {error ? <ErrorSistema compacto mensaje={error} /> : null}
      </View>
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
  tres: { flexDirection: 'row', gap: space.s3 },
  columna: { flex: 1, minWidth: 0 },
  ayuda: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: -space.s2,
  },
});
