import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { hhmm } from '@/lib/plan';
import { ALTO_HORA, disponer, rangoHoras, yDeMinuto, type ItemTiempo } from '@/lib/timeline';
import { colors, fonts } from '@/lib/theme';

export type TipoItem = 'bloque' | 'evento' | 'campaña';

export interface ItemAgenda extends ItemTiempo {
  titulo: string;
  detalle?: string | null;
  tipo: TipoItem;
  hecho?: boolean;
  icono?: string;
}

const COLOR: Record<TipoItem, string> = {
  bloque: colors.accent,
  evento: colors.gold,
  campaña: colors.steel,
};

const ANCHO_HORAS = 46;

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

      {colocados.map(({ item, top, alto: altoItem, columna, columnas }) => {
        const anchoPct = 100 / columnas;
        return (
          <Pressable
            key={item.id}
            onPress={() => onPress?.(item)}
            style={[
              styles.bloque,
              {
                top,
                height: altoItem - 3,
                left: `${columna * anchoPct}%`,
                width: `${anchoPct}%`,
                borderLeftColor: COLOR[item.tipo],
              },
              item.hecho && styles.bloqueHecho,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${hhmm(item.inicio)} ${item.titulo}`}
          >
            <View style={styles.bloqueCabecera}>
              {item.icono ? (
                <Ionicons name={item.icono as never} size={11} color={COLOR[item.tipo]} />
              ) : null}
              <Text style={[styles.bloqueTitulo, item.hecho && styles.tachado]} numberOfLines={1}>
                {item.titulo}
              </Text>
              {item.hecho ? <Ionicons name="checkmark" size={12} color={colors.accent} /> : null}
            </View>
            {/* La hora solo cabe si el bloque pasa de media hora; en uno de 20
                minutos taparía el título, que es lo que de verdad importa. */}
            {altoItem >= ALTO_HORA * 0.6 ? (
              <Text style={styles.bloqueHora} numberOfLines={1}>
                {hhmm(item.inicio)}
                {item.fin > item.inicio ? `–${hhmm(item.fin)}` : ''}
                {item.detalle ? ` · ${item.detalle}` : ''}
              </Text>
            ) : null}
          </Pressable>
        );
      })}

      {yAhora !== null ? (
        <View style={[styles.ahora, { top: yAhora }]} pointerEvents="none">
          <View style={styles.ahoraPunto} />
          <View style={styles.ahoraLinea} />
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
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.textFaint,
  },
  reglaHora: { flex: 1, height: 1, backgroundColor: colors.line },
  bloque: {
    position: 'absolute',
    marginLeft: ANCHO_HORAS,
    // El left/width van en % del contenedor, así que el margen de las horas se
    // compensa con padding para que el bloque no se salga por la derecha.
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 4,
    backgroundColor: colors.panel,
    borderLeftWidth: 2.5,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: colors.line,
    borderRightColor: colors.line,
    borderBottomColor: colors.line,
    overflow: 'hidden',
  },
  bloqueHecho: { opacity: 0.55 },
  bloqueCabecera: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bloqueTitulo: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.text,
  },
  tachado: { textDecorationLine: 'line-through', color: colors.textDim },
  bloqueHora: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textFaint, marginTop: 2 },
  ahora: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
  ahoraPunto: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.red,
    marginLeft: ANCHO_HORAS - 4,
  },
  ahoraLinea: { flex: 1, height: 1.5, backgroundColor: colors.red },
});
