// NIVL · Diario: lo que registró el sistema ese día.
//
// La crónica era una lista de solo lectura al fondo de la pantalla. Ahora vive
// debajo de las victorias y cada línea se puede reclamar con un toque: lo que
// el sistema vio pasa a ser algo que él dice haber logrado. Una penalización o
// una piedra gastada se enseñan, pero no son victorias.

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { TarjetaArena } from '@/components/arena';
import { Row } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import type { SystemEvent } from '@/lib/journal';
import { MAX_LARGO_VICTORIA } from '@/lib/journalmath';

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
      return con(t('diario:cronica.mision', { mision: o(p.quest), xp: Number(p.xp ?? 0) }), o(p.quest) || null);
    case 'level_up':
      return con(
        t('diario:cronica.subida', { nivel: Number(p.level ?? 0) }),
        t('diario:cronica.subidaVictoria', { nivel: Number(p.level ?? 0) }),
      );
    case 'penalty':
      return con(t('diario:cronica.penalizacion', { xp: Number(p.xp ?? 0) }), null);
    case 'dungeon_task':
      return con(t('diario:cronica.objetivo', { tarea: o(p.task) }), o(p.task) || null);
    case 'dungeon_cleared':
      return con(t('diario:cronica.despejada', { campana: o(p.dungeon) }), t('diario:cronica.despejada', { campana: o(p.dungeon) }));
    case 'gym_session':
      return con(t('diario:cronica.gimnasio', { xp: Number(p.xp ?? 0) }), t('diario:cronica.gimnasioVictoria'));
    case 'gym_pr':
      return con(
        t('diario:cronica.record', { ejercicio: o(p.exercise), peso: Number(p.weight ?? 0) }),
        t('diario:cronica.recordVictoria', { ejercicio: o(p.exercise), peso: Number(p.weight ?? 0) }),
      );
    case 'stone_used':
      return con(t('diario:cronica.piedraUsada'), null);
    case 'stone_earned':
      return con(t('diario:cronica.piedraForjada'), t('diario:cronica.piedraForjada'));
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
    // Una línea y no una tarjeta: que el sistema no viera nada no es un aviso.
    return (
      <Text style={styles.vacio} maxFontSizeMultiplier={1.6}>
        {t('diario:cronica.vacio')}
      </Text>
    );
  }
  return (
    <>
      <TarjetaArena variante="contorno" padded={false} style={styles.lista}>
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
                    color={hecha ? ink.ink10 : ink.ink6}
                  />
                </View>
              }
              title={l.linea}
              muted={l.victoria === null}
              onPress={pulsable ? () => onReclamar(l.victoria!) : undefined}
              accessibilityLabel={pulsable ? t('diario:cronica.reclamarA11y', { linea: l.linea }) : l.linea}
            />
          );
        })}
      </TarjetaArena>
      <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
        {t('diario:cronica.nota')}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: space.s4, paddingVertical: 2 },
  marca: { width: 18, alignItems: 'center' },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: space.s2,
  },
  vacio: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink6 },
});