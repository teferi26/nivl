// NIVL · Gimnasio: la rutina semanal y la fila de ejercicio (FASE3 Lote E1).
// Puras: los datos y las acciones llegan de GymVista.
//
// Cada día es una TarjetaArena contorno (el de hoy con marco 2): eyebrow con
// el día de la semana, el nombre en Outfit 600, «+» de 44 para añadir un
// ejercicio y, al pie, «Borrar día» en danger sm (confirmación y vibración en
// useGym). Los ejercicios van en filas con hairline: tocar edita, mantener
// pulsado borra (también como acción del lector de pantalla).

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BotonArena, TarjetaArena } from '@/components/arena';
import { Button, EmptyState, Tag } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import type { GymDay, GymExercise } from '@/lib/types';

export const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** «3×8 · 60 kg»; sin peso, «3×8». */
export function cargaTexto(sets: number, reps: number | string, kg: number | null): string {
  return kg !== null ? `${sets}×${reps} · ${String(kg).replace('.', ',')} kg` : `${sets}×${reps}`;
}

/**
 * Un ejercicio en una lista con hairline: ordinal opcional en Cinzel ink6,
 * nombre Outfit 600 16 y la carga en Cinzel 600 14 ink8. Sin Entrada ni
 * Contador (es una fila).
 */
export function FilaEjercicio({
  primera,
  ordinal,
  nombre,
  carga,
  detalle,
  onPress,
  onLongPress,
  accessibilityLabel,
}: {
  primera?: boolean;
  ordinal?: number;
  nombre: string;
  carga: string;
  detalle?: string | null;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
}) {
  const contenido = (
    <>
      {ordinal !== undefined ? (
        <Text style={styles.ordinal} maxFontSizeMultiplier={1.2}>
          {ordinal}
        </Text>
      ) : null}
      <View style={styles.filaTexto}>
        <Text style={styles.nombre} numberOfLines={2} maxFontSizeMultiplier={1.35}>
          {nombre}
        </Text>
        <Text style={styles.carga} maxFontSizeMultiplier={1.35}>
          {carga}
        </Text>
        {detalle ? (
          <Text style={styles.detalle} maxFontSizeMultiplier={1.35}>
            {detalle}
          </Text>
        ) : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={ink.ink6} /> : null}
    </>
  );
  const estilo = [styles.fila, !primera && styles.conRegla];
  if (!onPress) {
    return (
      <View style={estilo} accessible accessibilityLabel={accessibilityLabel ?? `${nombre}, ${carga}`}>
        {contenido}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${nombre}, ${carga}`}
      accessibilityActions={onLongPress ? [{ name: 'longpress', label: 'Eliminar' }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'longpress') onLongPress?.();
      }}
      style={({ pressed }) => [...estilo, pressed && styles.pulsado]}
    >
      {contenido}
    </Pressable>
  );
}

export interface RutinaSemanalProps {
  dias: GymDay[];
  ejercicios: GymExercise[];
  /** Día ISO de hoy (1 lunes … 7 domingo). */
  hoyDia: number;
  onNuevoDia: () => void;
  onNuevoEjercicio: (dia: GymDay) => void;
  onEditarEjercicio: (dia: GymDay, ejercicio: GymExercise) => void;
  onBorrarDia: (dia: GymDay) => void;
  onBorrarEjercicio: (ejercicio: GymExercise) => void;
}

export function RutinaSemanal({
  dias,
  ejercicios,
  hoyDia,
  onNuevoDia,
  onNuevoEjercicio,
  onEditarEjercicio,
  onBorrarDia,
  onBorrarEjercicio,
}: RutinaSemanalProps) {
  if (dias.length === 0) {
    return (
      <TarjetaArena variante="contorno">
        <EmptyState
          compact
          icon="calendar-outline"
          title="Sin rutina aún"
          body="Crea tus días de entreno, por ejemplo Lunes · Empuje, y añade ejercicios a cada uno."
          action={{ label: 'Crear el primer día', onPress: onNuevoDia }}
        />
      </TarjetaArena>
    );
  }

  return (
    <View style={styles.pila}>
      {dias.map((d) => {
        const esHoy = d.day_of_week === hoyDia;
        const exs = ejercicios.filter((e) => e.gym_day_id === d.id);
        return (
          <TarjetaArena key={d.id} variante="contorno" marco={esHoy ? 2 : undefined}>
            <View style={styles.cabecera}>
              <View style={styles.cabeceraTexto}>
                <View style={styles.eyebrowFila}>
                  <Text style={styles.eyebrow} maxFontSizeMultiplier={1.35}>
                    {DAY_NAMES[d.day_of_week - 1]}
                  </Text>
                  {esHoy ? <Tag>Hoy</Tag> : null}
                </View>
                <Text style={styles.titulo} numberOfLines={2} maxFontSizeMultiplier={1.35}>
                  {d.name}
                </Text>
              </View>
              <BotonArena icono="add" etiqueta={`Añadir ejercicio a ${d.name}`} onPress={() => onNuevoEjercicio(d)} />
            </View>

            {exs.length === 0 ? (
              <Text style={styles.sinEjercicios} maxFontSizeMultiplier={1.6}>
                Sin ejercicios. Toca + para añadir el primero.
              </Text>
            ) : (
              <View style={styles.lista}>
                {exs.map((e, i) => (
                  <FilaEjercicio
                    key={e.id}
                    primera={i === 0}
                    nombre={e.name}
                    carga={cargaTexto(e.sets, e.reps, e.weight)}
                    detalle={e.weight !== null ? null : 'Sin peso de referencia'}
                    onPress={() => onEditarEjercicio(d, e)}
                    onLongPress={() => onBorrarEjercicio(e)}
                    accessibilityLabel={`Editar ${e.name}, ${cargaTexto(e.sets, e.reps, e.weight)}. Mantén pulsado para eliminarlo.`}
                  />
                ))}
              </View>
            )}

            <View style={styles.pie}>
              <Button
                title="Borrar día"
                variant="danger"
                size="sm"
                icon="trash-outline"
                onPress={() => onBorrarDia(d)}
              />
            </View>
          </TarjetaArena>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s4 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  cabeceraTexto: { flex: 1, minWidth: 0, gap: space.s1 },
  eyebrowFila: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  eyebrow: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  titulo: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, lineHeight: 22, color: ink.ink10 },
  sinEjercicios: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    paddingVertical: space.s3,
  },
  lista: { marginTop: space.s2 },
  pie: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: space.s3 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: 56, paddingVertical: space.s3 },
  conRegla: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  pulsado: { backgroundColor: ink.ink2 },
  ordinal: { width: 24, fontFamily: 'Cinzel_600SemiBold', fontSize: 14, color: ink.ink6, textAlign: 'center' },
  filaTexto: { flex: 1, minWidth: 0, gap: 2 },
  nombre: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, lineHeight: 22, color: ink.ink9 },
  carga: { fontFamily: 'Cinzel_600SemiBold', fontSize: 14, lineHeight: 20, color: ink.ink8 },
  detalle: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
});
