// NIVL · Amigos: las filas de un marcador (amigos o ludus), L-RADICAL §B.4.3.
//
// Sin tarjeta envolvente: filas separadas por hairline ink3, como las misiones
// de Hoy. Puesto en Cinzel 600 20 en una columna de 36, Avatar 32 con el marco
// de su rango, nombre en Outfit 600 14 y la cifra en Cinzel 600 16.
//
// MI FILA INVERTIDA = la inversión de la pantalla (SISTEMA §5 bis, excepción 3:
// la inversión puede ser una fila, «lo activo»). Sale a sangre hasta el borde
// con el margen que publica Screen. En el ludus no se invierte (sería la
// segunda): allí mi fila lleva una regla de 2 a la izquierda.
//
// Ni Contador ni Entrada en las filas (L-RADICAL R1): la cifra cambia de golpe
// y las filas se recolocan con el LayoutAnimation que pide el hook.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EliteBadge } from '@/components/EliteBadge';
import { Avatar, Tag } from '@/components/ui';
import { GutterContext } from '@/components/ui/Screen';
import { SIN_DATO } from '@/components/ui/sinDato';
import { ink, space, stroke, type as tipo, type Rank } from '@/design/tokens';
import { INSIGNIA_ELITE_LABEL } from '@/lib/elite';
import { levelFromXp } from '@/lib/game';
import type { BoardEntry } from '@/lib/social';
import { etiquetaPosicion, formatoValor, type Clasificado, type Metrica } from '@/lib/socialmath';
import { cifraDe } from './cifraRanking';

/** Una fila ya clasificada, con la insignia Élite y el título equipado resueltos. */
export type FilaRanking = Clasificado<BoardEntry> & { insignia: boolean; titulo: string | null };

interface ListaRankingProps {
  filas: readonly FilaRanking[];
  metrica: Metrica;
  /** Mientras llegan las cifras de otro periodo. */
  atenuado?: boolean;
  /** Rango propio: el mismo que enseña Perfil (estadoDe(...).rango). */
  miRango: Rank | null;
  /** Rango registrado de los amigos (0052). Sin entrada = marco liso. */
  rangos: ReadonlyMap<string, Rank>;
  /** Sin él (ludus) no se puede quitar a nadie desde aquí. */
  onLongPress?: (b: BoardEntry) => void;
  onSafety: (b: BoardEntry) => void;
  /** Mi fila en blanco (la inversión). Falso en el ludus. */
  invertirMiFila?: boolean;
}

export function ListaRanking({
  filas,
  metrica,
  atenuado,
  miRango,
  rangos,
  onLongPress,
  onSafety,
  invertirMiFila = true,
}: ListaRankingProps) {
  const gutter = useContext(GutterContext);
  return (
    <View style={[styles.lista, atenuado && styles.atenuado]}>
      {filas.map((c) => {
        const b = c.competidor;
        const invertida = b.isMe && invertirMiFila;
        const nivel = levelFromXp(b.xpTotal).level;
        const valor = formatoValor(c.valor, metrica);
        const { cifra, unidad } = cifraDe(c.valor, metrica);
        const quitar = !b.isMe && onLongPress ? () => onLongPress(b) : undefined;
        const lider = c.posicion === 1 && c.valor !== null;
        const detalle = [
          `Nivel ${nivel}`,
          metrica !== 'racha' && b.streakDays > 0 ? `racha ${b.streakDays}` : null,
          invertida && c.titulo ? c.titulo : null,
          // En mi fila invertida el laurel (ink10) no se vería sobre ink10:
          // la insignia pasa a texto en el detalle.
          invertida && c.insignia ? 'Élite' : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          // La fila y el botón «más» van hermanos, no uno dentro del otro: en
          // la web un botón dentro de otro es HTML inválido.
          <View
            key={b.userId}
            style={[
              styles.fila,
              invertida && [styles.miFila, { marginHorizontal: -gutter, paddingHorizontal: gutter }],
              b.isMe && !invertirMiFila && styles.miFilaRegla,
            ]}
          >
            <Pressable
              onPress={!b.isMe ? () => onSafety(b) : undefined}
              onLongPress={quitar}
              disabled={b.isMe}
              accessibilityActions={quitar ? [{ name: 'longpress', label: 'Quitar' }] : undefined}
              onAccessibilityAction={
                quitar
                  ? (e) => {
                      if (e.nativeEvent.actionName === 'longpress') quitar();
                    }
                  : undefined
              }
              style={({ pressed }) => [styles.toque, pressed && styles.pulsada]}
              accessibilityRole={b.isMe ? undefined : 'button'}
              accessibilityLabel={`${c.valor === null ? 'Sin puesto' : `Puesto ${c.posicion}`}. ${b.isMe ? 'Tú' : b.name}${c.insignia ? `, ${INSIGNIA_ELITE_LABEL}` : ''}, nivel ${nivel}, ${valor}.${!b.isMe ? ' Toca para más opciones.' : ''}${quitar ? ' Mantén pulsado para quitar.' : ''}`}
            >
              <Text
                style={[styles.puesto, lider && styles.puestoLider, invertida && styles.tintaInvertida]}
                maxFontSizeMultiplier={1.35}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {c.valor === null ? SIN_DATO : etiquetaPosicion(c.posicion)}
              </Text>
              <Avatar
                size={32}
                avatarPath={b.avatarPath}
                name={b.name}
                rank={b.isMe ? miRango : (rangos.get(b.userId) ?? null)}
                titulo={c.titulo ?? undefined}
              />
              <View style={styles.centro}>
                <View style={styles.nombreFila}>
                  <Text
                    style={[styles.nombre, invertida && styles.tintaInvertida]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.35}
                  >
                    {b.isMe ? `${b.name} · tú` : b.name}
                  </Text>
                  {c.insignia && !invertida ? <EliteBadge size={14} /> : null}
                </View>
                <View style={styles.detalleFila}>
                  <Text
                    style={[styles.detalle, invertida && styles.detalleInvertido]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.35}
                  >
                    {detalle}
                  </Text>
                  {!invertida && c.titulo ? <Tag tone="logro">{c.titulo}</Tag> : null}
                </View>
              </View>
              <Text style={[styles.cifra, invertida && styles.tintaInvertida]} maxFontSizeMultiplier={1.35}>
                {cifra}
                {unidad ? <Text style={[styles.unidad, invertida && styles.detalleInvertido]}> {unidad}</Text> : null}
              </Text>
            </Pressable>
            {!b.isMe ? <SafetyButton name={b.name} onPress={() => onSafety(b)} /> : null}
          </View>
        );
      })}
    </View>
  );
}

export function SafetyButton({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.safetyButton, pressed && styles.pulsada]}
      accessibilityRole="button"
      accessibilityLabel={`Más opciones con ${name}`}
    >
      <Ionicons name="ellipsis-horizontal" size={20} color={ink.ink6} />
    </Pressable>
  );
}

/** Ancho de la columna del puesto («12.º» cabe a 20 pt). */
const COLUMNA_PUESTO = 36;

const styles = StyleSheet.create({
  lista: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  atenuado: { opacity: 0.45 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: ink.ink3,
  },
  toque: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingVertical: space.s2 },
  miFila: { backgroundColor: ink.ink10, borderBottomColor: ink.ink10 },
  miFilaRegla: { borderLeftWidth: stroke.rule, borderLeftColor: ink.ink10, paddingLeft: space.s2 },
  pulsada: { opacity: 0.7 },
  puesto: {
    width: COLUMNA_PUESTO,
    fontFamily: tipo.number.family,
    fontSize: 20,
    lineHeight: 24,
    color: ink.ink6,
  },
  puestoLider: { color: ink.ink10 },
  centro: { flex: 1, minWidth: 0, gap: 2 },
  nombreFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nombre: {
    flexShrink: 1,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
  detalleFila: { flexDirection: 'row', alignItems: 'center', gap: space.s2, flexWrap: 'wrap' },
  detalle: {
    flexShrink: 1,
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  // Sobre blanco solo ink0 e ink3 llegan al contraste (L-RADICAL R4).
  tintaInvertida: { color: ink.ink0 },
  detalleInvertido: { color: ink.ink3 },
  cifra: {
    fontFamily: tipo.number.family,
    fontSize: 16,
    lineHeight: 20,
    color: ink.ink9,
    fontVariant: ['tabular-nums'],
  },
  unidad: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink6,
  },
  safetyButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -space.s3 },
});
