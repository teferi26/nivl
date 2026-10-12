import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Campo } from '@/components/arena';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { vibrar } from '@/design/haptics';
import { ink, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { capital, nombreDia } from '@/i18n/formato';
import type { QuestInput } from '@/lib/data';
import {
  BONUS_BY_DIFFICULTY,
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  STAT_LABEL,
  STATS,
  XP_BY_DIFFICULTY,
} from '@/lib/game';
import { mensajeSistema } from '@/lib/validation';
import type { Difficulty, Quest, Stat } from '@/lib/types';

/** Lunes a domingo: índices 0..6 de `nombreDia` (el día de la misión es índice + 1). */
const SEMANA = [0, 1, 2, 3, 4, 5, 6];
const DIARIA = [1, 2, 3, 4, 5, 6, 7];
const LABORABLES = [1, 2, 3, 4, 5];
const FINDE = [6, 7];

const mismosDias = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d));

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: QuestInput) => Promise<void>;
  // Modo edición: precarga la misión y muestra Guardar/Eliminar.
  initial?: Quest | null;
  onDelete?: (quest: Quest) => Promise<void>;
  /**
   * Cómo se llama lo que se crea: cambia el eyebrow, el título, los botones y
   * la confirmación de borrado para que digan lo mismo que el botón que abrió
   * la hoja («Nuevo hábito» abre «NUEVO HÁBITO»). Por defecto, misión.
   */
  sustantivo?: 'misión' | 'hábito';
  /** Eyebrow propio; si no, sale de `sustantivo`. */
  eyebrow?: string;
  /** Título propio; si no, sale de `sustantivo`. */
  title?: string;
}

/** Los textos que cambian con el sustantivo (raiz:questForm.mision.* y .habito.*), al pintar. */
function textosDe(sustantivo: Props['sustantivo']) {
  const s = sustantivo === 'hábito' ? 'habito' : 'mision';
  return {
    nuevo: t(`raiz:questForm.${s}.nuevo`),
    editar: t(`raiz:questForm.${s}.editar`),
    tituloNuevo: t(`raiz:questForm.${s}.tituloNuevo`),
    tituloEditar: t(`raiz:questForm.${s}.tituloEditar`),
    crear: t(`raiz:questForm.${s}.crear`),
    eliminar: t(`raiz:questForm.${s}.eliminar`),
    campo: t(`raiz:questForm.${s}.campo`),
    campoA11y: t(`raiz:questForm.${s}.campoA11y`),
  };
}

/**
 * El formulario de misión, en la hoja del kit (Sheet): la misma gramática que
 * la hoja de campañas para que crear una misión y abrir una campaña se sientan
 * el mismo gesto. El teclado lo gestiona la hoja; las acciones van en su pie.
 */
export function QuestForm({ visible, onClose, onSubmit, initial, onDelete, sustantivo, eyebrow, title: tituloHoja }: Props) {
  const tx = textosDe(sustantivo);
  const [title, setTitle] = useState('');
  const [stat, setStat] = useState<Stat>('FUE');
  const [difficulty, setDifficulty] = useState<Difficulty>('media');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [requiresEvidence, setRequiresEvidence] = useState(false);
  const [isBonus, setIsBonus] = useState(false);
  const [saving, setSaving] = useState(false);
  // Cerrojo síncrono: `saving` no se ve hasta el siguiente render, así que dos
  // toques seguidos en «Crear» entraban los dos y creaban dos misiones.
  const guardando = useRef(false);

  const editing = !!initial;

  useEffect(() => {
    if (!visible) return;
    if (initial) {
      setTitle(initial.title);
      setStat(initial.stat);
      setDifficulty(initial.difficulty);
      setDays(initial.days_of_week);
      setRequiresEvidence(initial.requires_evidence);
      setIsBonus(initial.is_bonus);
    } else {
      setTitle('');
      setStat('FUE');
      setDifficulty('media');
      setDays([1, 2, 3, 4, 5, 6, 7]);
      setRequiresEvidence(false);
      setIsBonus(false);
    }
  }, [visible, initial]);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const submit = async () => {
    if (!title.trim() || days.length === 0 || guardando.current) return;
    guardando.current = true;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        stat,
        difficulty,
        days_of_week: days,
        requires_evidence: requiresEvidence,
        is_bonus: isBonus,
      });
      onClose();
    } catch (e) {
      avisar(t('comun:sistemaNoResponde'), mensajeSistema(e));
    } finally {
      guardando.current = false;
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!initial || !onDelete) return;
    const ok = await confirmar({
      titulo: tx.eliminar,
      mensaje: t('raiz:questForm.eliminarMensaje', { titulo: initial.title }),
      confirmar: t('comun:eliminar'),
      destructivo: true,
    });
    if (!ok) return;
    try {
      // La hoja solo se cierra si se ha borrado de verdad, y la háptica de
      // borrado solo suena entonces: si falla, no ha habido nada destructivo.
      await onDelete(initial);
      vibrar('destructiva');
      onClose();
    } catch (e) {
      avisar(t('comun:sistemaNoResponde'), mensajeSistema(e));
    }
  };

  const pago = isBonus
    ? t('raiz:questForm.pagoBonus', { pb: BONUS_BY_DIFFICULTY[difficulty] })
    : t('raiz:questForm.pagoXp', { xp: XP_BY_DIFFICULTY[difficulty] });

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={eyebrow ?? (editing ? tx.editar : tx.nuevo)}
      title={tituloHoja ?? (editing ? tx.tituloEditar : tx.tituloNuevo)}
      footer={
        <>
          <Button
            title={editing ? t('comun:guardarCambios') : tx.crear}
            size="lg"
            onPress={submit}
            loading={saving}
            disabled={!title.trim() || days.length === 0}
          />
          {editing && onDelete ? (
            <Button title={tx.eliminar} variant="danger" icon="trash-outline" onPress={confirmDelete} />
          ) : null}
          <Button title={t('comun:cancelar')} variant="ghost" onPress={onClose} />
        </>
      }
    >
      <Campo
        etiqueta={tx.campo}
        value={title}
        onChangeText={setTitle}
        placeholder={t('raiz:questForm.placeholder')}
        autoFocus={!editing}
        accessibilityLabel={tx.campoA11y}
        estiloBloque={styles.campo}
      />

      <Text style={styles.label}>{t('raiz:questForm.queEntrena')}</Text>
      <ChipWrap>
        {STATS.map((s) => (
          <Chip key={s} label={s} selected={stat === s} onPress={() => setStat(s)} accessibilityLabel={STAT_LABEL[s]} />
        ))}
      </ChipWrap>
      <Text style={styles.hint}>{STAT_LABEL[stat]}</Text>

      <Text style={styles.label}>{t('raiz:questForm.dificultad')}</Text>
      <ChipWrap>
        {DIFFICULTIES.map((d) => (
          <Chip
            key={d}
            label={DIFFICULTY_LABEL[d]}
            selected={difficulty === d}
            onPress={() => setDifficulty(d)}
            accessibilityLabel={t('raiz:questForm.dificultadA11y', { nivel: DIFFICULTY_LABEL[d] })}
          />
        ))}
      </ChipWrap>
      <Text style={styles.hint}>{pago}</Text>

      <Text style={styles.label}>{t('raiz:questForm.dias')}</Text>
      <View style={styles.days}>
        {SEMANA.map((i) => {
          const d = i + 1;
          const on = days.includes(d);
          return (
            <Pressable
              key={d}
              onPress={() => toggleDay(d)}
              style={({ pressed }) => [styles.day, on && styles.dayOn, pressed && styles.pressed]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={capital(nombreDia(i))}
            >
              <Text style={[styles.dayText, on && styles.dayTextOn]} maxFontSizeMultiplier={1.35}>{nombreDia(i, 'letra')}</Text>
            </Pressable>
          );
        })}
      </View>
      <ChipWrap style={{ marginTop: 10 }}>
        <Chip
          small
          label={t('raiz:questForm.diaria')}
          selected={mismosDias(days, DIARIA)}
          onPress={() => setDays(DIARIA)}
          accessibilityLabel={t('raiz:questForm.diariaA11y')}
        />
        <Chip
          small
          label={t('raiz:questForm.entreSemana')}
          selected={mismosDias(days, LABORABLES)}
          onPress={() => setDays(LABORABLES)}
          accessibilityLabel={t('raiz:questForm.entreSemanaA11y')}
        />
        <Chip
          small
          label={t('raiz:questForm.finde')}
          selected={mismosDias(days, FINDE)}
          onPress={() => setDays(FINDE)}
          accessibilityLabel={t('raiz:questForm.findeA11y')}
        />
      </ChipWrap>
      {days.length === 0 ? <Text style={[styles.hint, styles.hintAviso]}>{t('raiz:questForm.eligeDia')}</Text> : null}

      <Text style={styles.label}>{t('raiz:questForm.evidencia')}</Text>
      <ChipWrap>
        <Chip
          label={t('raiz:questForm.sinFoto')}
          selected={!requiresEvidence}
          onPress={() => setRequiresEvidence(false)}
          accessibilityLabel={t('raiz:questForm.sinFotoA11y')}
        />
        <Chip
          label={t('raiz:questForm.fotoObligatoria')}
          icon="camera-outline"
          selected={requiresEvidence}
          onPress={() => setRequiresEvidence(true)}
          accessibilityLabel={t('raiz:questForm.fotoObligatoriaA11y')}
        />
      </ChipWrap>
      <Text style={styles.hint}>{requiresEvidence ? t('raiz:questForm.fotoObligatoriaAyuda') : t('raiz:questForm.fotoOpcionalAyuda')}</Text>

      <Text style={styles.label}>{t('raiz:questForm.quePaga')}</Text>
      <ChipWrap>
        {/* i18n-ok: unidad */}
        <Chip label="XP" selected={!isBonus} onPress={() => setIsBonus(false)} accessibilityLabel={t('raiz:questForm.xpA11y')} />
        <Chip
          label={t('raiz:questForm.puntosBonus')}
          selected={isBonus}
          onPress={() => setIsBonus(true)}
          accessibilityLabel={t('raiz:questForm.puntosBonusA11y')}
        />
      </ChipWrap>
      <Text style={styles.hint}>
        {isBonus
          ? t('raiz:questForm.extraAyuda')
          : t('raiz:questForm.normalAyuda')}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    color: ink.ink6,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  campo: { marginTop: 4 },
  hint: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8, marginTop: 8 },
  hintAviso: { fontFamily: 'Outfit_600SemiBold', color: ink.ink9 },
  days: { flexDirection: 'row', gap: 6 },
  day: {
    flex: 1,
    // 44: la zona táctil mínima; con 7 en fila no hay hitSlop lateral posible.
    height: 44,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Elegido = marco de 2 ink10 sobre ink1, como el Chip: la inversión es «Crear».
  dayOn: { backgroundColor: ink.ink1, borderColor: ink.ink10, borderWidth: stroke.rule },
  dayText: { fontFamily: 'Outfit_700Bold', fontSize: 14, color: ink.ink8 },
  dayTextOn: { color: ink.ink10 },
  pressed: { opacity: 0.7 },
});
