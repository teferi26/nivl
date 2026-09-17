import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { Check, Row, RowValue, Tag } from '@/components/ui';
import { BONUS_BY_DIFFICULTY, questXp, STAT_LABEL } from '@/lib/game';
import { colors, fonts } from '@/lib/theme';
import type { Quest } from '@/lib/types';

interface Props {
  quest: Quest;
  completed: boolean;
  xpAwarded?: number;
  busy?: boolean;
  streakDays: number;
  onComplete: (quest: Quest) => void;
  first?: boolean;
}

// Una misión de hoy: marca redonda, título, stat y lo que paga.
export function QuestItem({ quest, completed, xpAwarded, busy, streakDays, onComplete, first }: Props) {
  const previewXp = quest.is_bonus
    ? BONUS_BY_DIFFICULTY[quest.difficulty]
    : questXp(quest, { evidence: false, streakDays });
  const unit = quest.is_bonus ? 'PB' : 'XP';
  const shown = completed && xpAwarded !== undefined && !quest.is_bonus ? xpAwarded : previewXp;

  return (
    <Row
      first={first}
      leading={<Check checked={completed} busy={busy} tone={quest.is_penalty ? 'red' : 'accent'} />}
      title={quest.title}
      done={completed}
      detail={
        <View style={styles.meta}>
          {quest.is_penalty ? (
            <Tag tone="red">Penalización</Tag>
          ) : (
            <Text style={styles.metaText}>
              {quest.stat} · {STAT_LABEL[quest.stat]}
            </Text>
          )}
          {quest.requires_evidence ? <Ionicons name="camera-outline" size={13} color={colors.textDim} /> : null}
          {quest.is_bonus ? <Tag tone="gold">Extra</Tag> : null}
        </View>
      }
      trailing={
        <RowValue tone={completed ? 'accent' : quest.is_bonus ? 'gold' : 'dim'} strong={completed}>
          +{shown} {unit}
        </RowValue>
      }
      onPress={() => !completed && !busy && onComplete(quest)}
      disabled={completed || busy}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: completed, disabled: completed || busy }}
      accessibilityLabel={`${quest.title}, ${completed ? 'completada' : `pendiente, ${shown} ${unit}`}`}
    />
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
});
