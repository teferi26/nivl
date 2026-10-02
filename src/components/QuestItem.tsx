// NIVL · Una misión de Hoy (L-RADICAL B.1, Main.dc). Cuatro caras:
//
//   · siguiente  → la primera pendiente que no es penalización ni extra. Es LA
//                  inversión de Hoy: bloque blanco, título grande en negro, el
//                  XP en Cinzel. Lo que toca ahora no se busca, se ve.
//   · penalización pendiente → losa de trama con el candado en el aro mientras
//                  la recuperación está cerrada (RET-03) y la razón a la vista.
//   · pendiente  → fila de hairline: aro ink4, título, «INT · Inteligencia» y
//                  «+30 XP» apagado.
//   · hecha      → aro blanco, título tachado y el XP pagado en blanco.
//
// Sin tarjeta que envuelva la lista: filas sueltas con su hairline.

import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { TarjetaArena } from '@/components/arena';
import { Check, Tag } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { BONUS_BY_DIFFICULTY, questXp, STAT_LABEL } from '@/lib/game';
import { fonts } from '@/lib/theme';
import type { Quest } from '@/lib/types';

interface Props {
  quest: Quest;
  completed: boolean;
  xpAwarded?: number;
  busy?: boolean;
  streakDays: number;
  onComplete: (quest: Quest) => void;
  /**
   * Recuperación aún cerrada (RET-03): la penalización se abre al completar
   * hoy una misión normal. Candado, sin hoja y la razón a la vista.
   */
  bloqueada?: boolean;
  /** La misión que toca ahora: la inversión de la pantalla (solo una). */
  siguiente?: boolean;
}

export const TEXTO_RECUPERACION_CERRADA =
  'Vuelve a la arena: completa una de las misiones que ya tenías y podrás recuperar lo perdido.';

const TEXTO_RECUPERACION_ABIERTA = 'La arena está abierta. Recupera lo perdido.';

const ARO = 26;

/** «Penalización: 20 flexiones», sin repetirlo si el título ya lo dice. */
function tituloPenalizacion(titulo: string): string {
  return /penalizaci/i.test(titulo) ? titulo : `Penalización: ${titulo}`;
}

export function QuestItem({ quest, completed, xpAwarded, busy, streakDays, onComplete, bloqueada, siguiente }: Props) {
  const cerrada = !!bloqueada && !completed;
  const previewXp = quest.is_bonus
    ? BONUS_BY_DIFFICULTY[quest.difficulty]
    : questXp(quest, { evidence: false, streakDays });
  const unit = quest.is_bonus ? 'PB' : 'XP';
  const shown = completed && xpAwarded !== undefined && !quest.is_bonus ? xpAwarded : previewXp;
  const inactiva = completed || !!busy || cerrada;
  const pulsar = () => {
    if (!inactiva) onComplete(quest);
  };
  const etiqueta = `${siguiente && !completed ? 'Siguiente: ' : ''}${quest.title}, ${
    completed
      ? 'completada'
      : cerrada
        ? `cerrada, ${shown} ${unit} por recuperar. ${TEXTO_RECUPERACION_CERRADA}`
        : `pendiente, ${shown} ${unit}`
  }`;
  const comunes = {
    onPress: pulsar,
    disabled: inactiva,
    accessibilityRole: 'checkbox' as const,
    accessibilityState: { checked: completed, disabled: inactiva },
    accessibilityLabel: etiqueta,
  };
  const meta = (
    <>
      <Text style={[styles.meta, siguiente && styles.metaInvertida]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
        {quest.is_penalty ? 'Penalización · recuperada' : `${quest.stat} · ${STAT_LABEL[quest.stat]}`}
      </Text>
      {quest.requires_evidence ? (
        <Ionicons name="camera-outline" size={13} color={siguiente ? ink.ink3 : ink.ink6} />
      ) : null}
    </>
  );

  // ── Penalización pendiente: losa de trama ──
  if (quest.is_penalty && !completed) {
    return (
      <TarjetaArena variante="trama" padded={false} style={styles.losa}>
        <Pressable {...comunes} style={({ pressed }) => [styles.filaPena, pressed && styles.pulsada]}>
          {cerrada ? (
            <View style={styles.candado}>
              <Ionicons name="lock-closed-outline" size={12} color={ink.ink8} />
            </View>
          ) : (
            <Check checked={false} busy={busy} />
          )}
          <View style={styles.cuerpo}>
            <Text style={styles.tituloPena} numberOfLines={2}>
              {tituloPenalizacion(quest.title)}
            </Text>
            <Text style={styles.textoPena}>{cerrada ? TEXTO_RECUPERACION_CERRADA : TEXTO_RECUPERACION_ABIERTA}</Text>
          </View>
          <Text style={styles.xpPena} maxFontSizeMultiplier={1.35}>
            +{shown}
          </Text>
        </Pressable>
      </TarjetaArena>
    );
  }

  // ── La siguiente: la inversión ──
  if (siguiente && !completed) {
    return (
      <Pressable {...comunes} style={({ pressed }) => [styles.siguiente, pressed && styles.pulsadaInvertida]}>
        <View style={styles.aroInvertido}>
          {busy ? <ActivityIndicator size="small" color={ink.ink0} /> : null}
        </View>
        <View style={styles.cuerpo}>
          <Text style={styles.rotuloSiguiente} maxFontSizeMultiplier={1.35}>
            SIGUIENTE
          </Text>
          <Text style={styles.tituloSiguiente} numberOfLines={2}>
            {quest.title}
          </Text>
          <View style={styles.metaFila}>{meta}</View>
        </View>
        <View style={styles.xp}>
          <Text style={styles.xpSiguiente} maxFontSizeMultiplier={1.35}>
            +{shown}
          </Text>
          <Text style={[styles.unidad, styles.unidadInvertida]} maxFontSizeMultiplier={1.35}>
            {unit}
          </Text>
        </View>
      </Pressable>
    );
  }

  // ── Pendiente u hecha: fila de hairline ──
  return (
    <Pressable {...comunes} style={({ pressed }) => [styles.fila, pressed && styles.pulsada]}>
      <Check checked={completed} busy={busy} />
      <View style={styles.cuerpo}>
        <Text style={[styles.titulo, completed && styles.tituloHecho]} numberOfLines={2}>
          {quest.title}
        </Text>
        <View style={styles.metaFila}>
          {meta}
          {quest.is_bonus ? <Tag tone="logro">Extra</Tag> : null}
        </View>
      </View>
      <View style={styles.xp}>
        <Text style={[styles.xpValor, completed && styles.xpHecho]} maxFontSizeMultiplier={1.35}>
          +{shown}
        </Text>
        <Text style={styles.unidad} maxFontSizeMultiplier={1.35}>
          {unit}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
    paddingVertical: space.s4,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: ink.ink3,
  },
  pulsada: { opacity: 0.6 },
  pulsadaInvertida: { opacity: 0.85 },
  cuerpo: { flex: 1, minWidth: 0, gap: 3 },
  titulo: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21, color: ink.ink9 },
  tituloHecho: { color: ink.ink6, textDecorationLine: 'line-through' },
  metaFila: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  meta: {
    flexShrink: 1,
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink6,
  },
  metaInvertida: { color: ink.ink3 },
  xp: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  xpValor: { fontFamily: tipo.number.family, fontSize: 16, lineHeight: 20, color: ink.ink6 },
  xpHecho: { color: ink.ink10 },
  unidad: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink6,
  },
  unidadInvertida: { color: ink.ink3 },

  // La siguiente (inversión).
  siguiente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: space.s4,
    marginVertical: space.s2,
    backgroundColor: ink.ink10,
  },
  aroInvertido: {
    width: ARO,
    height: ARO,
    borderRadius: ARO / 2,
    borderWidth: 1.5,
    borderColor: ink.ink0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotuloSiguiente: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: 2,
    color: ink.ink0,
  },
  tituloSiguiente: {
    fontFamily: tipo.headline.family,
    fontSize: tipo.headline.size,
    lineHeight: tipo.headline.lineHeight,
    letterSpacing: tipo.headline.tracking,
    color: ink.ink0,
  },
  xpSiguiente: { fontFamily: tipo.number.family, fontSize: 18, lineHeight: 22, color: ink.ink0 },

  // Penalización pendiente.
  losa: { marginVertical: space.s2 },
  filaPena: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: space.s3 },
  candado: {
    width: ARO,
    height: ARO,
    borderRadius: ARO / 2,
    borderWidth: stroke.hairline,
    borderColor: ink.ink6,
    backgroundColor: ink.ink0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tituloPena: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: ink.ink10 },
  textoPena: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8 },
  xpPena: { fontFamily: tipo.number.family, fontSize: 16, lineHeight: 20, color: ink.ink8 },
});
