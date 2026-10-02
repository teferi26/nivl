import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { Check, Row, RowValue, Tag, Trama } from '@/components/ui';
import { ink } from '@/design/tokens';
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
  /**
   * Recuperación aún cerrada (RET-03): la penalización se abre al completar
   * hoy una misión normal. Candado, sin hoja y la razón a la vista.
   */
  bloqueada?: boolean;
}

export const TEXTO_RECUPERACION_CERRADA =
  'Vuelve a la arena: completa una de las misiones que ya tenías y podrás recuperar lo perdido.';

// Una misión de hoy: marca redonda, título, stat y lo que paga.
export function QuestItem({ quest, completed, xpAwarded, busy, streakDays, onComplete, first, bloqueada }: Props) {
  const cerrada = !!bloqueada && !completed;
  const previewXp = quest.is_bonus
    ? BONUS_BY_DIFFICULTY[quest.difficulty]
    : questXp(quest, { evidence: false, streakDays });
  const unit = quest.is_bonus ? 'PB' : 'XP';
  const shown = completed && xpAwarded !== undefined && !quest.is_bonus ? xpAwarded : previewXp;

  return (
    <Row
      first={first}
      leading={
        cerrada ? (
          // Bloqueada = rayado (SISTEMA §0) dentro del aro, con el candado encima.
          <View style={styles.candado}>
            <Trama />
            <View style={styles.candadoPlaca}>
              <Ionicons name="lock-closed-outline" size={12} color={ink.ink9} />
            </View>
          </View>
        ) : (
          <Check checked={completed} busy={busy} />
        )
      }
      title={quest.title}
      done={completed}
      detail={
        <View>
          <View style={styles.meta}>
            {quest.is_penalty ? (
              <Tag tone="alerta">Penalización</Tag>
            ) : (
              <Text style={styles.metaText}>
                {quest.stat} · {STAT_LABEL[quest.stat]}
              </Text>
            )}
            {quest.requires_evidence ? <Ionicons name="camera-outline" size={13} color={colors.textDim} /> : null}
            {quest.is_bonus ? <Tag tone="logro">Extra</Tag> : null}
          </View>
          {cerrada ? <Text style={styles.cerrada}>{TEXTO_RECUPERACION_CERRADA}</Text> : null}
        </View>
      }
      trailing={
        <RowValue tone={completed ? 'accent' : 'dim'} strong={completed}>
          +{shown} {unit}
        </RowValue>
      }
      onPress={() => !completed && !busy && !cerrada && onComplete(quest)}
      disabled={completed || busy || cerrada}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: completed, disabled: completed || busy || cerrada }}
      accessibilityLabel={`${quest.title}, ${
        completed
          ? 'completada'
          : cerrada
            ? `cerrada, ${shown} ${unit} por recuperar. ${TEXTO_RECUPERACION_CERRADA}`
            : `pendiente, ${shown} ${unit}`
      }`}
    />
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  cerrada: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textDim, marginTop: 4 },
  candado: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: ink.ink4,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Placa lisa bajo el candado: el icono no se pinta sobre el rayado.
  candadoPlaca: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: ink.ink0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
