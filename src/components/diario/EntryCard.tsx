// NIVL · Diario — un día del Archivo.
//
// Releer tiene que dar gusto: la fecha, cómo estabas (notas y emociones), lo
// que lograste como lista, lo vivido a cuatro líneas con "leer más", la lección
// aparte y lo que dejaste para el día siguiente. Una entrada antigua —solo
// notas y texto— pinta solo lo que tiene: ninguna pieza deja hueco al faltar.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui';
import { nombreDia, relativoDe } from '@/lib/dates';
import { etiquetaEmocion, formatoDecimal, limpiarEmociones, limpiarVictorias } from '@/lib/journalmath';
import { colors, fonts } from '@/lib/theme';
import type { JournalEntry } from '@/lib/types';

/** A partir de aquí el texto se da por largo y sale el "leer más". Es una
 *  estimación a propósito: medir las líneas reales obliga a pintar dos veces. */
const LARGO_PARA_PLEGAR = 190;

/** Ánimo, energía y sueño como cifras pequeñas: se comparan de un vistazo entre tarjetas. */
export function NotasDelDia({ entry }: { entry: Pick<JournalEntry, 'mood' | 'energy' | 'sleep_hours'> }) {
  const notas: { rotulo: string; valor: string; leido: string }[] = [];
  if (entry.mood != null) notas.push({ rotulo: 'Ánimo', valor: String(entry.mood), leido: `Ánimo ${entry.mood} de 5` });
  if (entry.energy != null) notas.push({ rotulo: 'Energía', valor: String(entry.energy), leido: `Energía ${entry.energy} de 5` });
  if (entry.sleep_hours != null) {
    const h = formatoDecimal(entry.sleep_hours);
    notas.push({ rotulo: 'Sueño', valor: `${h} h`, leido: `${h} horas de sueño` });
  }
  if (notas.length === 0) return null;
  return (
    <View style={styles.notas}>
      {notas.map((n) => (
        <View key={n.rotulo} style={styles.nota} accessible accessibilityLabel={n.leido}>
          <Text style={styles.notaRotulo}>{n.rotulo}</Text>
          <Text style={styles.notaValor}>{n.valor}</Text>
        </View>
      ))}
    </View>
  );
}

/** Las emociones con nombre, como etiquetas sin interacción. */
export function EmocionesDelDia({ emotions, max }: { emotions: readonly string[]; max?: number }) {
  const ids = limpiarEmociones(emotions);
  if (ids.length === 0) return null;
  const visibles = max ? ids.slice(0, max) : ids;
  return (
    <View style={styles.emociones}>
      {visibles.map((id) => (
        <View key={id} style={styles.emocion}>
          <Text style={styles.emocionTexto}>{etiquetaEmocion(id)}</Text>
        </View>
      ))}
      {visibles.length < ids.length ? <Text style={styles.emocionResto}>+{ids.length - visibles.length}</Text> : null}
    </View>
  );
}

interface Props {
  entry: JournalEntry;
  /** Cuántas fotos tiene ese día (se sabe por una sola consulta del Archivo). */
  photoCount: number;
  /** Carga las miniaturas ya al montar: solo las tarjetas más recientes. */
  eagerPhotos?: boolean;
  /** Pide las URL firmadas de ese día. El Archivo las cachea. */
  loadPhotos: (date: string) => Promise<string[]>;
  onOpen: (date: string) => void;
}

export function EntryCard({ entry, photoCount, eagerPhotos, loadPhotos, onOpen }: Props) {
  const [abierta, setAbierta] = useState(false);
  const [fotos, setFotos] = useState<string[] | null>(null);
  // Cerrojo: las fotos de un día se piden una sola vez por tarjeta.
  const pedido = useRef(false);
  const montada = useRef(true);

  const wins = limpiarVictorias(entry.wins);
  const texto = entry.text?.trim() ?? '';
  const largo = texto.length > LARGO_PARA_PLEGAR || texto.split('\n').length > 4;
  const quiereFotos = photoCount > 0 && (eagerPhotos || abierta);

  useEffect(() => {
    montada.current = true;
    return () => {
      montada.current = false;
    };
  }, []);

  useEffect(() => {
    if (!quiereFotos || pedido.current) return;
    pedido.current = true;
    loadPhotos(entry.date)
      .then((urls) => {
        if (montada.current) setFotos(urls);
      })
      // Sin red las miniaturas no salen y la tarjeta sigue valiendo: no es un error que enseñar.
      .catch(() => {
        if (montada.current) setFotos([]);
      });
  }, [quiereFotos, entry.date, loadPhotos]);

  const rotuloMas = largo
    ? abierta
      ? 'Leer menos'
      : 'Leer más'
    : abierta
      ? 'Ocultar fotos'
      : `Ver ${photoCount === 1 ? 'la foto' : `las ${photoCount} fotos`}`;
  // Antes de la 0023 `plan` era "el plan del día", no "lo primero de mañana".
  // No hay marca en la fila: se deduce de que no tenga ninguna pieza nueva.
  const antigua =
    wins.length === 0 &&
    limpiarEmociones(entry.emotions).length === 0 &&
    !entry.lesson &&
    !entry.gratitude &&
    entry.sleep_hours == null;
  const hayNotas =
    entry.mood != null || entry.energy != null || entry.sleep_hours != null || limpiarEmociones(entry.emotions).length > 0;
  const soloNotas = !texto && wins.length === 0 && !entry.lesson && !entry.gratitude && !entry.plan;

  return (
    <Card>
      <View style={styles.cabecera}>
        <View style={styles.fecha}>
          <Text style={styles.dia} numberOfLines={1}>
            {nombreDia(entry.date)}
          </Text>
          <Text style={styles.relativo}>{relativoDe(entry.date)}</Text>
        </View>
        <Pressable
          onPress={() => onOpen(entry.date)}
          hitSlop={10}
          style={({ pressed }) => [styles.abrir, pressed && styles.pulsado]}
          accessibilityRole="button"
          accessibilityLabel={`Abrir y editar el diario del ${nombreDia(entry.date)}`}
        >
          <Ionicons name="create-outline" size={16} color={colors.textDim} />
        </Pressable>
      </View>

      <NotasDelDia entry={entry} />
      <EmocionesDelDia emotions={entry.emotions} />

      {wins.length > 0 ? (
        <View style={styles.bloque}>
          {wins.map((w) => (
            <View key={w} style={styles.victoria}>
              <Ionicons name="checkmark" size={14} color={colors.accent} style={styles.victoriaMarca} />
              <Text style={styles.victoriaTexto}>{w}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {texto ? (
        <Text style={styles.texto} numberOfLines={abierta || !largo ? undefined : 4}>
          {texto}
        </Text>
      ) : null}

      {entry.lesson?.trim() ? (
        <View style={styles.leccion}>
          <Text style={styles.rotulo}>Aprendí</Text>
          <Text style={styles.leccionTexto}>{entry.lesson.trim()}</Text>
        </View>
      ) : null}

      {entry.gratitude?.trim() ? (
        <Text style={styles.linea}>
          <Text style={styles.lineaRotulo}>Agradezco: </Text>
          {entry.gratitude.trim()}
        </Text>
      ) : null}

      {entry.plan?.trim() ? (
        <Text style={styles.linea} numberOfLines={abierta ? undefined : 2}>
          <Text style={styles.lineaRotulo}>{antigua ? 'Plan: ' : 'Mañana: '}</Text>
          {entry.plan.trim()}
        </Text>
      ) : null}

      {soloNotas ? (
        <Text style={styles.soloNotas}>
          {hayNotas ? 'Ese día solo dejaste las notas.' : 'Entrada en blanco. Ábrela para completarla.'}
        </Text>
      ) : null}

      {quiereFotos && fotos && fotos.length > 0 ? (
        <View style={styles.fotos}>
          {fotos.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.foto} contentFit="cover" accessibilityLabel="Comprobante de ese día" />
          ))}
        </View>
      ) : null}

      {largo || (photoCount > 0 && !eagerPhotos) ? (
        <Pressable
          onPress={() => setAbierta((a) => !a)}
          hitSlop={8}
          style={({ pressed }) => [styles.mas, pressed && styles.pulsado]}
          accessibilityRole="button"
          accessibilityState={{ expanded: abierta }}
          accessibilityLabel={`${rotuloMas} del ${nombreDia(entry.date)}`}
        >
          <Text style={styles.masTexto}>{rotuloMas}</Text>
          <Ionicons name={abierta ? 'chevron-up' : 'chevron-down'} size={13} color={colors.accentText} />
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  fecha: { flex: 1, minWidth: 0 },
  dia: { fontFamily: fonts.heading, fontSize: 16, letterSpacing: -0.2, color: colors.text },
  relativo: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 2 },
  abrir: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsado: { opacity: 0.6 },
  notas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  nota: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    backgroundColor: colors.accentFaint,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  notaRotulo: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint },
  notaValor: { fontFamily: fonts.number, fontSize: 14, color: colors.text },
  emociones: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 },
  emocion: { borderWidth: 1, borderColor: colors.accentDim, paddingHorizontal: 8, paddingVertical: 3 },
  emocionTexto: { fontFamily: fonts.semibold, fontSize: 12, color: colors.accentText },
  emocionResto: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  bloque: { marginTop: 14, gap: 6 },
  victoria: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  victoriaMarca: { marginTop: 3 },
  victoriaTexto: { flex: 1, minWidth: 0, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.text },
  texto: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textDim, marginTop: 14 },
  // Outfit no trae cursiva: la lección se distingue como cita, con su filo a la izquierda.
  leccion: { marginTop: 14, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.accentDim },
  rotulo: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginBottom: 3,
  },
  leccionTexto: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.accentText },
  linea: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textDim, marginTop: 12 },
  lineaRotulo: { fontFamily: fonts.semibold, color: colors.textFaint },
  soloNotas: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textFaint, marginTop: 12 },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  foto: { width: 64, height: 64, backgroundColor: colors.accentFaint },
  mas: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 12, paddingVertical: 2 },
  masTexto: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.accentText },
});
