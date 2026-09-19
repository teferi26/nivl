// NIVL · Diario — lo que registró el sistema ese día.
//
// La crónica era una lista de solo lectura al fondo de la pantalla. Ahora vive
// debajo de las victorias y cada línea se puede reclamar con un toque: lo que
// el sistema vio pasa a ser algo que él dice haber logrado. Una penalización o
// una piedra gastada se enseñan, pero no son victorias.

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { Card, EmptyState, Row } from '@/components/ui';
import type { SystemEvent } from '@/lib/journal';
import { MAX_LARGO_VICTORIA } from '@/lib/journalmath';
import { colors, fonts } from '@/lib/theme';

export interface LineaCronica {
  id: string;
  /** Lo que se lee en la crónica. */
  linea: string;
  /** Cómo queda escrita como victoria; null si no es algo que reclamar. */
  victoria: string | null;
}

export function lineaDeCronica(e: SystemEvent): LineaCronica | null {
  const p = e.payload as Record<string, unknown>;
  const o = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
  // La victoria sale ya con la forma en que se guardaría (una línea, con tope):
  // así "reclamada" se decide comparando texto con texto.
  const con = (linea: string, victoria: string | null): LineaCronica => ({
    id: e.id,
    linea,
    victoria: victoria ? o(victoria).slice(0, MAX_LARGO_VICTORIA).trim() || null : null,
  });
  switch (e.type) {
    case 'quest_completed':
      return con(`Misión completada: ${o(p.quest)} (+${Number(p.xp ?? 0)} XP)`, o(p.quest) || null);
    case 'level_up':
      return con(`SUBIDA DE NIVEL → ${Number(p.level ?? 0)}`, `Subí al nivel ${Number(p.level ?? 0)}`);
    case 'penalty':
      return con(`Penalización aplicada: −${Number(p.xp ?? 0)} XP`, null);
    case 'dungeon_task':
      return con(`Objetivo de campaña: ${o(p.task)}`, o(p.task) || null);
    case 'dungeon_cleared':
      return con(`Campaña despejada: ${o(p.dungeon)}`, `Campaña despejada: ${o(p.dungeon)}`);
    case 'gym_session':
      return con(`Sesión de gimnasio registrada (+${Number(p.xp ?? 0)} XP)`, 'Sesión de gimnasio');
    case 'gym_pr':
      return con(
        `RÉCORD personal: ${o(p.exercise)} · ${Number(p.weight ?? 0)} kg`,
        `Récord en ${o(p.exercise)}: ${Number(p.weight ?? 0)} kg`,
      );
    case 'stone_used':
      return con('Una Piedra de Protección se consumió por ti', null);
    case 'stone_earned':
      return con('Piedra de Protección forjada', 'Piedra de Protección forjada');
    default:
      return null;
  }
}

interface Props {
  lineas: LineaCronica[];
  /** Victorias ya escritas, en minúsculas: esas líneas salen como reclamadas. */
  reclamadas: Set<string>;
  /** False cuando ya no caben más victorias. */
  cabenMas: boolean;
  onReclamar: (victoria: string) => void;
}

export function Cronica({ lineas, reclamadas, cabenMas, onReclamar }: Props) {
  if (lineas.length === 0) {
    return (
      <Card variant="outline">
        <EmptyState compact icon="time-outline" title="Sin actividad ese día" body="El sistema no registró nada." />
      </Card>
    );
  }
  return (
    <>
      <Card padded={false} style={styles.lista}>
        {lineas.map((l, i) => {
          const hecha = l.victoria !== null && reclamadas.has(l.victoria.toLocaleLowerCase('es'));
          const pulsable = l.victoria !== null && !hecha && cabenMas;
          return (
            <Row
              key={l.id}
              first={i === 0}
              leading={
                <View style={styles.marca}>
                  <Ionicons
                    name={hecha ? 'checkmark-circle' : l.victoria ? 'add-circle-outline' : 'ellipse'}
                    size={l.victoria ? 18 : 6}
                    color={hecha ? colors.accent : colors.accentDim}
                  />
                </View>
              }
              title={l.linea}
              muted={l.victoria === null}
              onPress={pulsable ? () => onReclamar(l.victoria!) : undefined}
              accessibilityLabel={pulsable ? `${l.linea}. Toca para añadirla a tus victorias` : l.linea}
            />
          );
        })}
      </Card>
      <Text style={styles.nota}>Toca una línea para reclamarla como victoria.</Text>
    </>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  marca: { width: 18, alignItems: 'center' },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: -2 },
});
