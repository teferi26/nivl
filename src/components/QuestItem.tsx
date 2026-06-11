import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { questXp, STAT_LABEL } from '@/lib/game';
import { colors, fonts } from '@/lib/theme';
import type { Quest } from '@/lib/types';

interface Props {
  quest: Quest;
  completed: boolean;
  xpAwarded?: number;
  busy?: boolean;
  streakDays: number;
  onComplete: (quest: Quest) => void;
}

export function QuestItem({ quest, completed, xpAwarded, busy, streakDays, onComplete }: Props) {
  const previewXp = questXp(quest, { evidence: false, streakDays });

  return (
    <Pressable
      onPress={() => !completed && !busy && onComplete(quest)}
      disabled={completed || busy}
      style={({ pressed }) => [styles.row, pressed && !completed && styles.pressed]}
    >
      <View style={[styles.box, completed && styles.boxDone, quest.is_penalty && styles.boxPenalty]}>
        {busy ? (
          <ActivityIndicator size="small" color={colors.cyan} />
        ) : completed ? (
          <Ionicons name="checkmark" size={14} color={colors.cyan} />
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, completed ? styles.titleDone : null]} numberOfLines={1}>
          {quest.title}
        </Text>
        <View style={styles.meta}>
          {quest.is_penalty ? (
            <Text style={styles.penaltyTag}>PENALIZACIÓN</Text>
          ) : (
            <Text style={styles.metaText}>
              {quest.stat} · {STAT_LABEL[quest.stat]}
            </Text>
          )}
          {quest.requires_evidence ? (
            <Ionicons name="camera-outline" size={13} color={colors.cyan} />
          ) : null}
        </View>
      </View>
      <Text style={[styles.xp, completed ? styles.xpDone : null]}>
        +{completed && xpAwarded !== undefined ? xpAwarded : previewXp} XP
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  pressed: {
    opacity: 0.7,
  },
  box: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.cyanDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: {
    backgroundColor: colors.cyanFaint,
    borderColor: colors.cyan,
  },
  boxPenalty: {
    borderColor: colors.red,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  titleDone: {
    color: colors.textDim,
    textDecorationLine: 'line-through',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
  },
  metaText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textFaint,
  },
  penaltyTag: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.red,
  },
  xp: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: colors.textFaint,
  },
  xpDone: {
    color: colors.cyan,
  },
});
