// NIVL · Avances: las dos hojas (FASE3 Lote F). Puras: el formulario, la
// validación y el guardado viven en useAvances. Antes eran `Modal` sueltos
// con su KeyboardAvoidingView; ahora son `Sheet` (un solo mecanismo de
// teclado, centradas a 560 en tableta y web).
//
//   · «Nueva meta»: Campo título, chips radio de la métrica (sin salud
//     aceptada, solo «Libre»), ejercicio si toca, inicial y objetivo, la
//     línea del premio y el fallo en línea. Pie: primary «Fijar la meta» +
//     ghost «Cancelar».
//   · «Progreso manual»: el valor actual de una meta libre.

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { Campo } from '@/components/arena';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { GOAL_ACHIEVED_XP } from '@/lib/game';
import type { Goal, GoalMetric } from '@/lib/types';

const METRIC_OPTIONS: { key: GoalMetric; label: string }[] = [
  { key: 'peso_corporal', label: 'Peso corporal' },
  { key: 'ejercicio', label: 'Ejercicio (PR)' },
  { key: 'libre', label: 'Libre' },
];

export interface HojaMetaProps {
  visible: boolean;
  saludAceptada: boolean;
  titulo: string;
  metrica: GoalMetric;
  ejercicio: string;
  inicio: string;
  objetivo: string;
  guardando: boolean;
  /** El fallo del dato o del servidor, ya escrito para el usuario. */
  error: string | null;
  onTitulo: (v: string) => void;
  onMetrica: (m: GoalMetric) => void;
  onEjercicio: (v: string) => void;
  onInicio: (v: string) => void;
  onObjetivo: (v: string) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaMeta(p: HojaMetaProps) {
  return (
    <Sheet
      visible={p.visible}
      onClose={p.onCerrar}
      eyebrow="Nueva meta"
      title="¿Qué cifra vas a alcanzar?"
      footer={
        <>
          <Button title="Fijar la meta" onPress={p.onGuardar} loading={p.guardando} disabled={!p.titulo.trim()} />
          <Button title="Cancelar" variant="ghost" onPress={p.onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Campo
          etiqueta="Título"
          value={p.titulo}
          onChangeText={p.onTitulo}
          placeholder={p.saludAceptada ? 'Ej. Press banca 100 kg' : 'Ej. Leer doce libros'}
          accessibilityLabel="Título de la meta"
          autoFocus
        />

        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            Se mide con
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Cómo se mide la meta">
            <ChipWrap>
              {METRIC_OPTIONS.filter((m) => p.saludAceptada || m.key === 'libre').map((m) => (
                <Chip
                  key={m.key}
                  label={m.label}
                  selected={p.metrica === m.key}
                  onPress={() => p.onMetrica(m.key)}
                  accessibilityLabel={`Medir con ${m.label}`}
                />
              ))}
            </ChipWrap>
          </View>
        </View>

        {p.metrica === 'ejercicio' ? (
          <Campo
            etiqueta="Ejercicio (nombre exacto del gym)"
            value={p.ejercicio}
            onChangeText={p.onEjercicio}
            placeholder="Ej. Press banca"
            accessibilityLabel="Nombre del ejercicio"
          />
        ) : null}

        <View style={styles.dos}>
          <Campo
            etiqueta="Valor inicial"
            value={p.inicio}
            onChangeText={p.onInicio}
            keyboardType="decimal-pad"
            placeholder="85"
            accessibilityLabel="Valor inicial"
            estiloBloque={styles.columna}
          />
          <Campo
            etiqueta="Objetivo"
            value={p.objetivo}
            onChangeText={p.onObjetivo}
            keyboardType="decimal-pad"
            placeholder="78"
            accessibilityLabel="Valor objetivo"
            estiloBloque={styles.columna}
          />
        </View>

        <Text style={styles.ayuda} maxFontSizeMultiplier={1.6}>
          Al alcanzarla, el sistema paga +{GOAL_ACHIEVED_XP} XP.
        </Text>

        {p.error ? (
          <View style={styles.fallo} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={16} color={ink.ink9} style={styles.falloIcono} />
            <Text style={styles.falloTexto} maxFontSizeMultiplier={1.6}>
              {p.error}
            </Text>
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

export interface HojaValorProps {
  /** La meta libre que se actualiza; null = hoja cerrada. */
  meta: Goal | null;
  valor: string;
  error: string | null;
  onValor: (v: string) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaValor({ meta, valor, error, onValor, onGuardar, onCerrar }: HojaValorProps) {
  return (
    <Sheet
      visible={meta !== null}
      onClose={onCerrar}
      eyebrow="Progreso manual"
      title={meta?.title}
      footer={
        <>
          <Button title="Guardar" onPress={onGuardar} />
          <Button title="Cancelar" variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <Campo
        etiqueta={`Valor actual (${meta?.unit ?? ''})`}
        value={valor}
        onChangeText={onValor}
        keyboardType="decimal-pad"
        accessibilityLabel="Valor actual de la meta"
        error={error}
        autoFocus
      />
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
  ayuda: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink6 },
  dos: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3 },
  columna: { flex: 1, minWidth: 0 },
  fallo: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s2 },
  falloIcono: { marginTop: 2 },
  falloTexto: {
    flex: 1,
    minWidth: 0,
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
});
