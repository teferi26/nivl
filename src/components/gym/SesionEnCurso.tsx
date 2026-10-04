// NIVL · Gimnasio: la sesión en curso (FASE3 Lote E1). Pura: las series, las
// notas y la foto viven en useGym.
//
// Una TarjetaArena piedra por ejercicio con su tabla de series: número en
// Cinzel, y peso, repeticiones y RPE en celdas compactas con la caja de
// `Campo` (ink2, borde ink4, foco 2 ink10) pero sin etiqueta propia: la
// cabecera de la tabla hace de etiqueta y el lector oye «Peso de la serie 2
// de Press banca». Debajo, «Cómo fue» (Campo multilínea) y la foto. El botón
// «Terminar sesión» (la inversión de este estado) lo pone la vista.
//
// Sin `Entrada`: un campo con el foco no debe moverse al aparecer.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Campo, TarjetaArena } from '@/components/arena';
import { ink, space, stroke, type as tipo } from '@/design/tokens';

export interface SerieInput {
  weight: string;
  reps: string;
  // El RPE es lo que decide la carga de la próxima sesión: sin él, el coach
  // sube peso por calendario en vez de por cómo salió la serie.
  rpe: string;
}

/**
 * Un ejercicio con SUS series, cada una con su peso y sus repeticiones.
 *
 * Antes era una sola fila por ejercicio (el mismo peso para todas las series)
 * y eso no es entrenar: una pirámide de 12 a 60 kg, 8 a 70 y 5 a 80 se
 * registraba como si hubieran sido tres series iguales, y el coach programaba
 * la siguiente sesión sobre un dato falso.
 */
export interface LiftInput {
  exercise: string;
  series: SerieInput[];
}

export interface SesionEnCursoProps {
  series: LiftInput[];
  notas: string;
  fotoLista: boolean;
  onCambiarSerie: (iEj: number, iSerie: number, campo: keyof SerieInput, valor: string) => void;
  onAnadirSerie: (iEj: number) => void;
  onQuitarSerie: (iEj: number, iSerie: number) => void;
  onNotas: (v: string) => void;
  onFoto: () => void;
}

const BOTON = 44;
const COL_NUM = 24;

/** Celda de la tabla de series: la caja de `Campo`, compacta y centrada. */
function CeldaSerie({
  value,
  onChangeText,
  placeholder,
  decimal,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  decimal: boolean;
  accessibilityLabel: string;
}) {
  const [foco, setFoco] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      placeholder={placeholder}
      placeholderTextColor={ink.ink6}
      selectionColor={ink.ink10}
      cursorColor={ink.ink10}
      maxFontSizeMultiplier={1.35}
      accessibilityLabel={accessibilityLabel}
      onFocus={() => setFoco(true)}
      onBlur={() => setFoco(false)}
      style={[
        styles.celda,
        // El borde de 2 come 1 de relleno: la caja no cambia de tamaño.
        foco ? { borderWidth: stroke.rule, borderColor: ink.ink10, paddingHorizontal: space.s1 - 1 } : null,
      ]}
    />
  );
}

export function SesionEnCurso({
  series,
  notas,
  fotoLista,
  onCambiarSerie,
  onAnadirSerie,
  onQuitarSerie,
  onNotas,
  onFoto,
}: SesionEnCursoProps) {
  return (
    <View style={styles.pila}>
      <Text style={styles.pista} maxFontSizeMultiplier={1.6}>
        RPE = cuánto te quedaba. 7 son tres repeticiones en el depósito, 10 es no poder con una más.
        Es el dato con el que el sistema decide la carga de la próxima.
      </Text>

      {series.map((l, i) => (
        <TarjetaArena key={l.exercise} variante="piedra">
          <View style={styles.cabecera}>
            <Text style={styles.nombre} numberOfLines={2} maxFontSizeMultiplier={1.35}>
              {l.exercise}
            </Text>
            <Pressable
              onPress={() => onAnadirSerie(i)}
              accessibilityRole="button"
              accessibilityLabel={`Añadir serie a ${l.exercise}`}
              style={({ pressed }) => [styles.mas, pressed && styles.pulsado]}
            >
              <Ionicons name="add" size={16} color={ink.ink10} />
              <Text style={styles.masTexto} maxFontSizeMultiplier={1.35}>
                Serie
              </Text>
            </Pressable>
          </View>

          <View style={styles.fila} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={[styles.colNum, styles.rotulo]}>#</Text>
            <Text style={[styles.colDato, styles.rotulo]} maxFontSizeMultiplier={1.35}>
              Kg
            </Text>
            <Text style={[styles.colDato, styles.rotulo]} maxFontSizeMultiplier={1.35}>
              Reps
            </Text>
            <Text style={[styles.colDato, styles.rotulo]} maxFontSizeMultiplier={1.35}>
              RPE
            </Text>
            <View style={styles.colQuitar} />
          </View>

          {l.series.map((serie, si) => {
            const unica = l.series.length === 1;
            return (
              <View key={si} style={[styles.fila, styles.filaSerie]}>
                <Text style={[styles.colNum, styles.numero]} maxFontSizeMultiplier={1.2}>
                  {si + 1}
                </Text>
                <View style={styles.colDato}>
                  <CeldaSerie
                    value={serie.weight}
                    onChangeText={(v) => onCambiarSerie(i, si, 'weight', v)}
                    placeholder="kg"
                    decimal
                    accessibilityLabel={`Peso de la serie ${si + 1} de ${l.exercise}`}
                  />
                </View>
                <View style={styles.colDato}>
                  <CeldaSerie
                    value={serie.reps}
                    onChangeText={(v) => onCambiarSerie(i, si, 'reps', v)}
                    placeholder="reps"
                    decimal={false}
                    accessibilityLabel={`Repeticiones de la serie ${si + 1} de ${l.exercise}`}
                  />
                </View>
                <View style={styles.colDato}>
                  <CeldaSerie
                    value={serie.rpe}
                    onChangeText={(v) => onCambiarSerie(i, si, 'rpe', v)}
                    placeholder="RPE"
                    decimal
                    accessibilityLabel={`Esfuerzo de la serie ${si + 1} de ${l.exercise}`}
                  />
                </View>
                <Pressable
                  onPress={() => onQuitarSerie(i, si)}
                  disabled={unica}
                  style={({ pressed }) => [styles.colQuitar, styles.quitar, pressed && styles.pulsado]}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar la serie ${si + 1} de ${l.exercise}`}
                  accessibilityState={{ disabled: unica }}
                >
                  <Ionicons name="close" size={18} color={unica ? ink.ink4 : ink.ink6} />
                </Pressable>
              </View>
            );
          })}
        </TarjetaArena>
      ))}

      <TarjetaArena variante="contorno" rotulo="Cómo fue">
        <View style={styles.notas}>
          <Campo
            etiqueta="Notas de la sesión"
            value={notas}
            onChangeText={onNotas}
            placeholder="Cómo te has encontrado, qué se torció, qué notaste"
            multiline
            ayuda="Esto lo lee el coach: es lo que le dice por qué un día salió mal aunque los kilos fueran los mismos."
          />
          <Pressable
            onPress={onFoto}
            style={({ pressed }) => [styles.foto, fotoLista && styles.fotoLista, pressed && styles.pulsado]}
            accessibilityRole="button"
            accessibilityLabel={fotoLista ? 'Foto lista. Hacer otra foto del entreno' : 'Hacer una foto del entreno'}
          >
            <Ionicons name={fotoLista ? 'checkmark-circle' : 'camera-outline'} size={18} color={ink.ink10} />
            <Text style={styles.fotoTexto} maxFontSizeMultiplier={1.35}>
              {fotoLista ? 'Foto lista. Entra en tu resumen.' : 'Foto del entreno'}
            </Text>
          </Pressable>
        </View>
      </TarjetaArena>
    </View>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s4 },
  pista: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: space.s3, marginBottom: space.s2 },
  nombre: { flex: 1, minWidth: 0, fontFamily: 'Outfit_600SemiBold', fontSize: 16, lineHeight: 22, color: ink.ink10 },
  mas: {
    minHeight: BOTON,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    paddingHorizontal: space.s3,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
  },
  masTexto: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: ink.ink10,
  },
  pulsado: { backgroundColor: ink.ink2 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  filaSerie: { marginTop: space.s2 },
  colNum: { width: COL_NUM, textAlign: 'center' },
  colDato: { flex: 1, minWidth: 0 },
  colQuitar: { width: BOTON },
  rotulo: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
    textAlign: 'center',
  },
  numero: { fontFamily: 'Cinzel_600SemiBold', fontSize: 14, color: ink.ink6 },
  celda: {
    height: BOTON,
    backgroundColor: ink.ink2,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
    borderRadius: 0,
    paddingHorizontal: space.s1,
    paddingVertical: 0,
    color: ink.ink10,
    fontFamily: 'Cinzel_600SemiBold',
    fontSize: 16,
    textAlign: 'center',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  quitar: { height: BOTON, alignItems: 'center', justifyContent: 'center' },
  notas: { gap: space.s4 },
  foto: {
    minHeight: BOTON,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingHorizontal: space.s3,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
  },
  fotoLista: { borderColor: ink.ink10 },
  fotoTexto: { flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 14, lineHeight: 20, color: ink.ink9 },
});
