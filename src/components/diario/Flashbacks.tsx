// NIVL · Diario: "hace una semana", "hace un mes", "hace un año".
//
// Lo que convierte un registro en algo que apetece abrir: ver quién eras en
// esta misma fecha. Solo salen las que existen; sin recuerdos, la sección no
// se pinta (no hay nada que disculpar). Cada recuerdo, una TarjetaArena de
// contorno con el rótulo grabado; la sección lleva la banda de grano (logro).

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { TarjetaArena } from '@/components/arena';
import { Section } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { nombreDia } from '@/lib/dates';
import { extracto, limpiarVictorias, type Flashback } from '@/lib/journalmath';
import type { JournalEntry } from '@/lib/types';
import { EmocionesDelDia, NotasDelDia } from './EntryCard';

interface Props {
  items: Flashback<JournalEntry>[];
  onOpen: (date: string) => void;
}

export function Flashbacks({ items, onOpen }: Props) {
  if (items.length === 0) return null;
  return (
    <Section title="En esta fecha" tone="logro">
      <View style={styles.pila}>
        {items.map(({ id, titulo, entry }) => {
          const victoria = limpiarVictorias(entry.wins)[0];
          const texto = extracto(entry.text, 120);
          return (
            <TarjetaArena
              key={id}
              variante="contorno"
              rotulo={titulo}
              onPress={() => onOpen(entry.date)}
              accessibilityLabel={`${titulo}, ${nombreDia(entry.date)}. Toca para abrir ese día`}
            >
              <Text style={styles.fecha} maxFontSizeMultiplier={1.35}>
                {nombreDia(entry.date)}
              </Text>
              <NotasDelDia entry={entry} />
              <EmocionesDelDia emotions={entry.emotions} max={4} />
              {victoria ? (
                <View style={styles.victoria}>
                  <Ionicons name="checkmark" size={14} color={ink.ink10} style={styles.marca} />
                  <Text style={styles.victoriaTexto} numberOfLines={2}>
                    {victoria}
                  </Text>
                </View>
              ) : null}
              {texto ? (
                <Text style={styles.texto} numberOfLines={2}>
                  {texto}
                </Text>
              ) : null}
            </TarjetaArena>
          );
        })}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s3 },
  fecha: { fontFamily: tipo.number.family, fontSize: 16, lineHeight: 20, color: ink.ink10 },
  victoria: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s2, marginTop: space.s3 },
  marca: { marginTop: 3 },
  victoriaTexto: { flex: 1, minWidth: 0, fontFamily: tipo.bodySm.family, fontSize: 14, lineHeight: 20, color: ink.ink9 },
  texto: { fontFamily: tipo.bodySm.family, fontSize: 14, lineHeight: 20, color: ink.ink8, marginTop: space.s2 },
});
