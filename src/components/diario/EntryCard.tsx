// NIVL · Diario: un día del Archivo (FASE3 Lote D).
//
// Una fila entre hairlines, no una tarjeta: la fecha grabada (Cinzel 600), las
// notas y las emociones del día y un extracto de dos líneas. «Leer más» abre
// la entrada entera: las victorias como lista, lo vivido, la lección aparte y
// lo que dejaste para el día siguiente. Una entrada antigua (solo notas y
// texto) pinta solo lo que tiene: ninguna pieza deja hueco al faltar.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { nombreDia, relativoDe } from '@/lib/dates';
import { etiquetaEmocion, extracto, formatoDecimal, limpiarEmociones, limpiarVictorias } from '@/lib/journalmath';
import type { JournalEntry } from '@/lib/types';

/** Lo que cabe en el extracto de dos líneas antes de recortar. */
const LARGO_EXTRACTO = 140;

/** Ánimo, energía y sueño como cifras pequeñas: se comparan de un vistazo entre días. */
export function NotasDelDia({ entry }: { entry: Pick<JournalEntry, 'mood' | 'energy' | 'sleep_hours'> }) {
  const notas: { rotulo: string; valor: string; unidad?: string; leido: string }[] = [];
  if (entry.mood != null) notas.push({ rotulo: 'Ánimo', valor: String(entry.mood), leido: `Ánimo ${entry.mood} de 5` });
  if (entry.energy != null) notas.push({ rotulo: 'Energía', valor: String(entry.energy), leido: `Energía ${entry.energy} de 5` });
  if (entry.sleep_hours != null) {
    const h = formatoDecimal(entry.sleep_hours);
    notas.push({ rotulo: 'Sueño', valor: h, unidad: 'h', leido: `${h} horas de sueño` });
  }
  if (notas.length === 0) return null;
  return (
    <View style={styles.notas}>
      {notas.map((n) => (
        <View key={n.rotulo} style={styles.nota} accessible accessibilityLabel={n.leido}>
          <Text style={styles.notaRotulo} maxFontSizeMultiplier={1.35}>
            {n.rotulo}
          </Text>
          <Text style={styles.notaValor} maxFontSizeMultiplier={1.35}>
            {n.valor}
            {/* Cinzel no tiene minúsculas: la unidad, en Outfit. */}
            {n.unidad ? <Text style={styles.notaUnidad}> {n.unidad}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Las emociones con nombre, como etiquetas de contorno sin interacción. */
export function EmocionesDelDia({ emotions, max }: { emotions: readonly string[]; max?: number }) {
  const ids = limpiarEmociones(emotions);
  if (ids.length === 0) return null;
  const visibles = max ? ids.slice(0, max) : ids;
  return (
    <View style={styles.emociones}>
      {visibles.map((id) => (
        <View key={id} style={styles.emocion}>
          <Text style={styles.emocionTexto} maxFontSizeMultiplier={1.35}>
            {etiquetaEmocion(id)}
          </Text>
        </View>
      ))}
      {visibles.length < ids.length ? <Text style={styles.emocionResto}>+{ids.length - visibles.length}</Text> : null}
    </View>
  );
}

interface Props {
  entry: JournalEntry;
  /** Para relativoDe: «Hace 3 días» desde el hoy de la pantalla. */
  hoy: string;
  /** La primera de la lista no lleva hairline encima. */
  primera?: boolean;
  /** Cuántas fotos tiene ese día (se sabe por una sola consulta del Archivo). */
  photoCount: number;
  /** Carga las miniaturas ya al montar: solo las filas más recientes. */
  eagerPhotos?: boolean;
  /** Pide las URL firmadas de ese día. El Archivo las cachea. */
  loadPhotos: (date: string) => Promise<string[]>;
  onOpen: (date: string) => void;
}

export function EntryCard({ entry, hoy, primera, photoCount, eagerPhotos, loadPhotos, onOpen }: Props) {
  const [abierta, setAbierta] = useState(false);
  const [fotos, setFotos] = useState<string[] | null>(null);
  // Cerrojo: las fotos de un día se piden una sola vez por fila.
  const pedido = useRef(false);
  const montada = useRef(true);

  const wins = limpiarVictorias(entry.wins);
  const texto = entry.text?.trim() ?? '';
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
      // Sin red las miniaturas no salen y la fila sigue valiendo: no es un error que enseñar.
      .catch(() => {
        if (montada.current) setFotos([]);
      });
  }, [quiereFotos, entry.date, loadPhotos]);

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

  // El extracto: lo vivido si lo hay; si no, la primera victoria.
  const resumen = texto ? extracto(texto, LARGO_EXTRACTO) : (wins[0] ?? '');
  const hayMas =
    texto.length > LARGO_EXTRACTO ||
    texto.split('\n').length > 2 ||
    wins.length > (texto ? 0 : 1) ||
    !!entry.lesson?.trim() ||
    !!entry.gratitude?.trim() ||
    !!entry.plan?.trim();
  const fotosOcultas = photoCount > 0 && !eagerPhotos;
  const rotuloMas = hayMas
    ? abierta
      ? 'Leer menos'
      : 'Leer más'
    : abierta
      ? 'Ocultar fotos'
      : `Ver ${photoCount === 1 ? 'la foto' : `las ${photoCount} fotos`}`;

  return (
    <View style={[styles.fila, !primera && styles.conRegla]}>
      <View style={styles.cabecera}>
        <View style={styles.fecha}>
          <Text style={styles.dia} numberOfLines={2} maxFontSizeMultiplier={1.35}>
            {nombreDia(entry.date)}
          </Text>
          <Text style={styles.relativo} maxFontSizeMultiplier={1.35}>
            {relativoDe(entry.date, hoy)}
          </Text>
        </View>
        <Pressable
          onPress={() => onOpen(entry.date)}
          style={({ pressed }) => [styles.abrir, pressed && styles.pulsado]}
          accessibilityRole="button"
          accessibilityLabel={`Abrir y editar el diario del ${nombreDia(entry.date)}`}
        >
          <Ionicons name="create-outline" size={18} color={ink.ink9} />
        </Pressable>
      </View>

      <NotasDelDia entry={entry} />
      <EmocionesDelDia emotions={entry.emotions} max={abierta ? undefined : 4} />

      {!abierta && resumen ? (
        <Text style={styles.extracto} numberOfLines={2} maxFontSizeMultiplier={1.6}>
          {resumen}
        </Text>
      ) : null}

      {abierta && wins.length > 0 ? (
        <View style={styles.bloque}>
          {wins.map((w) => (
            <View key={w} style={styles.victoria}>
              <Ionicons name="checkmark" size={14} color={ink.ink10} style={styles.victoriaMarca} />
              <Text style={styles.victoriaTexto}>{w}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {abierta && texto ? <Text style={styles.texto}>{texto}</Text> : null}

      {abierta && entry.lesson?.trim() ? (
        <View style={styles.leccion}>
          <Text style={styles.rotulo}>Aprendí</Text>
          <Text style={styles.leccionTexto}>{entry.lesson.trim()}</Text>
        </View>
      ) : null}

      {abierta && entry.gratitude?.trim() ? (
        <Text style={styles.linea}>
          <Text style={styles.lineaRotulo}>Agradezco: </Text>
          {entry.gratitude.trim()}
        </Text>
      ) : null}

      {abierta && entry.plan?.trim() ? (
        <Text style={styles.linea}>
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

      {hayMas || fotosOcultas ? (
        <Pressable
          onPress={() => setAbierta((a) => !a)}
          style={({ pressed }) => [styles.mas, pressed && styles.pulsado]}
          accessibilityRole="button"
          accessibilityState={{ expanded: abierta }}
          accessibilityLabel={`${rotuloMas} del ${nombreDia(entry.date)}`}
        >
          <Text style={styles.masTexto}>{rotuloMas}</Text>
          <Ionicons name={abierta ? 'chevron-up' : 'chevron-down'} size={14} color={ink.ink9} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { paddingVertical: space.s4 },
  conRegla: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3 },
  fecha: { flex: 1, minWidth: 0, paddingTop: space.s1 },
  dia: { fontFamily: tipo.number.family, fontSize: 16, lineHeight: 20, letterSpacing: 0.5, color: ink.ink10 },
  relativo: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
    marginTop: space.s1,
  },
  abrir: {
    width: 44,
    height: 44,
    marginRight: -space.s3,
    marginTop: -space.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsado: { opacity: 0.7 },
  notas: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s4, marginTop: space.s2 },
  nota: { flexDirection: 'row', alignItems: 'baseline', gap: space.s2 },
  notaRotulo: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  notaValor: { fontFamily: tipo.number.family, fontSize: 14, color: ink.ink10 },
  notaUnidad: { fontFamily: tipo.micro.family, fontSize: 12, color: ink.ink8 },
  emociones: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s2, marginTop: space.s3 },
  emocion: { borderWidth: stroke.hairline, borderColor: ink.ink4, paddingHorizontal: space.s2, paddingVertical: 2 },
  emocionTexto: { fontFamily: tipo.micro.family, fontSize: 12, lineHeight: 16, color: ink.ink8 },
  emocionResto: { fontFamily: tipo.micro.family, fontSize: 12, color: ink.ink6 },
  extracto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s3,
  },
  bloque: { marginTop: space.s3, gap: space.s2 },
  victoria: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s2 },
  victoriaMarca: { marginTop: 3 },
  victoriaTexto: { flex: 1, minWidth: 0, fontFamily: tipo.bodySm.family, fontSize: 14, lineHeight: 20, color: ink.ink9 },
  texto: { fontFamily: tipo.bodySm.family, fontSize: 14, lineHeight: 21, color: ink.ink8, marginTop: space.s3 },
  // Outfit no trae cursiva: la lección se distingue como cita, con su filo de 2 a la izquierda.
  leccion: { marginTop: space.s3, paddingLeft: space.s3, borderLeftWidth: stroke.rule, borderLeftColor: ink.ink6 },
  rotulo: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
    marginBottom: 2,
  },
  leccionTexto: { fontFamily: tipo.bodySm.family, fontSize: 14, lineHeight: 20, color: ink.ink9 },
  linea: { fontFamily: tipo.bodySm.family, fontSize: 14, lineHeight: 20, color: ink.ink8, marginTop: space.s3 },
  lineaRotulo: { fontFamily: tipo.micro.family, color: ink.ink6 },
  soloNotas: { fontFamily: tipo.bodySm.family, fontSize: 14, lineHeight: 20, color: ink.ink6, marginTop: space.s3 },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginTop: space.s3 },
  foto: { width: 64, height: 64, backgroundColor: ink.ink2 },
  mas: { flexDirection: 'row', alignItems: 'center', gap: space.s1, alignSelf: 'flex-start', minHeight: 44, marginBottom: -space.s3 },
  masTexto: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink9,
  },
});
