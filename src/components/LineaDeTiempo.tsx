import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { ink, stroke } from '@/design/tokens';
import { hhmm } from '@/lib/plan';
import { ALTO_HORA, disponer, rangoHoras, yDeMinuto, type ItemTiempo } from '@/lib/timeline';
import { fonts } from '@/lib/theme';

export type TipoItem = 'bloque' | 'evento' | 'campaña';

export interface ItemAgenda extends ItemTiempo {
  titulo: string;
  detalle?: string | null;
  tipo: TipoItem;
  hecho?: boolean;
  icono?: string;
}

/** Columna de las horas, en Cinzel (FASE3 Lote C). */
const ANCHO_HORAS = 48;
/** Lado de la marca de evento (punto) y de campaña (aro). */
const MARCA = 7;
/** Alto del lienzo de la línea de «ahora»: cabe el trazo de 1,5 sin cortarse. */
const ALTO_AHORA = 4;

/**
 * Qué es cada cosa se dice con la forma, no con el color (SISTEMA §0): el
 * bloque del plan lleva su icono; el evento, un punto sólido; el plazo de
 * campaña, un aro hueco.
 */
function Marca({ item }: { item: ItemAgenda }) {
  if (item.tipo === 'evento') return <View style={styles.punto} />;
  if (item.tipo === 'campaña') return <View style={styles.aro} />;
  return item.icono ? <Ionicons name={item.icono as never} size={11} color={ink.ink9} /> : null;
}

/**
 * El día sobre un eje de horas, como en un calendario de verdad.
 *
 * Antes las tres vistas de la agenda pintaban la misma lista de tarjetas: un
 * bloque de 20 minutos y otro de tres horas ocupaban lo mismo, y no había forma
 * de ver de un vistazo dónde estaban los huecos. Aquí una hora mide siempre lo
 * mismo, así que el día se lee por su forma.
 */
export function LineaDeTiempo({
  items,
  ahoraMin,
  onPress,
}: {
  items: ItemAgenda[];
  /** Minutos desde medianoche para la línea de "ahora". Null si no es hoy. */
  ahoraMin?: number | null;
  onPress?: (item: ItemAgenda) => void;
}) {
  const { desde, hasta } = rangoHoras(items);
  const horas = Array.from({ length: hasta - desde }, (_, i) => desde + i);
  const colocados = disponer(items, desde);
  const alto = horas.length * ALTO_HORA;
  const yAhora =
    ahoraMin !== null && ahoraMin !== undefined && ahoraMin >= desde * 60 && ahoraMin <= hasta * 60
      ? yDeMinuto(ahoraMin, desde)
      : null;

  return (
    <View style={[styles.caja, { height: alto }]}>
      {horas.map((h, i) => (
        <View key={h} style={[styles.filaHora, { top: i * ALTO_HORA }]}>
          <Text style={styles.horaTexto}>{String(h).padStart(2, '0')}:00</Text>
          <View style={styles.reglaHora} />
        </View>
      ))}

      {/* El carril de los bloques empieza donde acaba la columna de horas. Con
          el margen en el propio bloque y left/width en %, el % se medía sobre
          la caja entera y el bloque se salía 46 pt por la derecha. */}
      <View style={styles.carril} pointerEvents="box-none">
        {colocados.map(({ item, top, alto: altoItem, columna, columnas }) => {
          const anchoPct = 100 / columnas;
          const estilo = [
            styles.bloque,
            {
              top,
              height: altoItem - 3,
              left: `${columna * anchoPct}%` as const,
              width: `${anchoPct}%` as const,
            },
          ];
          const etiqueta = `${hhmm(item.inicio)} ${item.titulo}${item.hecho ? ', hecho' : ''}`;
          const contenido = (
            <>
              <View style={styles.bloqueCabecera}>
                <Marca item={item} />
                <Text style={[styles.bloqueTitulo, item.hecho && styles.tachado]} numberOfLines={1}>
                  {item.titulo}
                </Text>
                {item.hecho ? <Ionicons name="checkmark" size={12} color={ink.ink10} /> : null}
              </View>
              {/* La hora solo cabe si el bloque pasa de media hora; en uno de 20
                  minutos taparía el título, que es lo que de verdad importa. */}
              {altoItem >= ALTO_HORA * 0.6 ? (
                <Text style={styles.bloqueHora} numberOfLines={1}>
                  {hhmm(item.inicio)}
                  {item.fin > item.inicio ? ` a ${hhmm(item.fin)}` : ''}
                  {item.detalle ? ` · ${item.detalle}` : ''}
                </Text>
              ) : null}
            </>
          );
          // Los bloques del plan no hacen nada al tocarlos en la Agenda (se
          // marcan desde Hoy): no se anuncian como botón. Los eventos, sí.
          if (!onPress || item.tipo === 'bloque') {
            return (
              <View key={item.id} style={estilo} accessible accessibilityRole="text" accessibilityLabel={etiqueta}>
                {contenido}
              </View>
            );
          }
          return (
            <Pressable
              key={item.id}
              onPress={() => onPress(item)}
              style={estilo}
              accessibilityRole="button"
              accessibilityLabel={etiqueta}
            >
              {contenido}
            </Pressable>
          );
        })}
      </View>

      {/* «Ahora»: una línea discontinua blanca sobre el carril y la hora exacta
          en la columna de horas. Sin punto rojo: el blanco ya es el acento. */}
      {yAhora !== null && ahoraMin != null ? (
        <View style={[styles.ahora, { top: yAhora - ALTO_AHORA / 2 }]} pointerEvents="none">
          <Text style={styles.ahoraHora} accessibilityLabel={`Ahora, ${hhmm(ahoraMin)}`}>
            {hhmm(ahoraMin)}
          </Text>
          <Svg style={styles.ahoraLienzo} height={ALTO_AHORA}>
            <Line
              x1="0"
              y1={ALTO_AHORA / 2}
              x2="100%"
              y2={ALTO_AHORA / 2}
              stroke={ink.ink10}
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { position: 'relative', marginTop: 4 },
  filaHora: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
  horaTexto: {
    width: ANCHO_HORAS,
    fontFamily: 'Cinzel_600SemiBold',
    fontSize: 11,
    color: ink.ink6,
    fontVariant: ['tabular-nums'],
  },
  reglaHora: { flex: 1, height: stroke.hairline, backgroundColor: ink.ink3 },
  carril: { position: 'absolute', top: 0, bottom: 0, left: ANCHO_HORAS, right: 0 },
  bloque: {
    position: 'absolute',
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 4,
    backgroundColor: ink.ink1,
    // Borde izquierdo igual para todo: el tipo lo dice la marca de la cabecera.
    borderLeftWidth: stroke.rule,
    borderLeftColor: ink.ink6,
    borderTopWidth: stroke.hairline,
    borderRightWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderTopColor: ink.ink3,
    borderRightColor: ink.ink3,
    borderBottomColor: ink.ink3,
    overflow: 'hidden',
  },
  bloqueCabecera: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  punto: { width: MARCA, height: MARCA, borderRadius: MARCA / 2, backgroundColor: ink.ink9 },
  aro: {
    width: MARCA,
    height: MARCA,
    borderRadius: MARCA / 2,
    borderWidth: stroke.hairline,
    borderColor: ink.ink9,
  },
  bloqueTitulo: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: ink.ink9,
  },
  // Hecho: tachado y en terciario. Nada de opacidad sobre texto.
  tachado: { textDecorationLine: 'line-through', color: ink.ink6 },
  bloqueHora: { fontFamily: fonts.body, fontSize: 11, color: ink.ink6, marginTop: 2 },
  ahora: { position: 'absolute', left: 0, right: 0, height: ALTO_AHORA, flexDirection: 'row', alignItems: 'center' },
  // Fondo negro: tapa la "hh:00" de debajo si la hora actual cae cerca.
  ahoraHora: {
    width: ANCHO_HORAS,
    fontFamily: 'Cinzel_700Bold',
    fontSize: 11,
    lineHeight: 14,
    color: ink.ink10,
    backgroundColor: ink.ink0,
  },
  ahoraLienzo: { flex: 1 },
});
