// NIVL · Diario — "hace una semana", "hace un mes", "hace un año".
//
// Lo que convierte un registro en algo que apetece abrir: ver quién eras en
// esta misma fecha. Solo salen las que existen; sin recuerdos, la sección no
// se pinta (no hay nada que disculpar).

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Section } from '@/components/ui';
import { nombreDia } from '@/lib/dates';
import { extracto, limpiarVictorias, type Flashback } from '@/lib/journalmath';
import { colors, fonts } from '@/lib/theme';
import type { JournalEntry } from '@/lib/types';
import { EmocionesDelDia, NotasDelDia } from './EntryCard';

interface Props {
  items: Flashback<JournalEntry>[];
  onOpen: (date: string) => void;
}

export function Flashbacks({ items, onOpen }: Props) {
  if (items.length === 0) return null;
  return (
    <Section title="En esta fecha" tone="gold">
      {items.map(({ id, titulo, entry }) => {
        const victoria = limpiarVictorias(entry.wins)[0];
        const texto = extracto(entry.text, 120);
        return (
          <Card
            key={id}
            // El laurel: un recuerdo es un hito, no un aviso.
            accent={colors.gold}
            onPress={() => onOpen(entry.date)}
            accessibilityLabel={`${titulo}, ${nombreDia(entry.date)}. Toca para abrir ese día`}
          >
            <Text style={styles.titulo}>{titulo}</Text>
            <Text style={styles.fecha}>{nombreDia(entry.date)}</Text>
            <NotasDelDia entry={entry} />
            <EmocionesDelDia emotions={entry.emotions} max={4} />
            {victoria ? (
              <View style={styles.victoria}>
                <Ionicons name="checkmark" size={14} color={colors.accent} style={styles.marca} />
                <Text style={styles.victoriaTexto} numberOfLines={2}>
                  {victoria}
                </Text>
              </View>
            ) : null}
            {texto ? <Text style={styles.texto}>{texto}</Text> : null}
          </Card>
        );
      })}
    </Section>
  );
}

const styles = StyleSheet.create({
  titulo: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', color: colors.gold },
  fecha: { fontFamily: fonts.heading, fontSize: 16, letterSpacing: -0.2, color: colors.text, marginTop: 4 },
  victoria: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12 },
  marca: { marginTop: 3 },
  victoriaTexto: { flex: 1, minWidth: 0, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.text },
  texto: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.textDim, marginTop: 10 },
});
