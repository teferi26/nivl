// NIVL · Avances: las dos hojas (FASE3 Lote F). Puras: el formulario, la
// validación y el guardado viven en useAvances. Antes eran `Modal` sueltos
// con su KeyboardAvoidingView; ahora son `Sheet` (un solo mecanismo de
// teclado, centradas a 560 en tableta y web).
//
//   · «Nueva meta»: Campo título, chips radio de la métrica (sin salud
//     aceptada, solo «Libre»), ejercicio si toca, inicial y objetivo, la
//     línea del premio y el fallo en línea. Pie: primary «Fijar la meta» +
//     ghost «Cancelar».
//   · «Progreso manual»: el valor actual de una meta libre.

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { Campo } from '@/components/arena';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { GOAL_ACHIEVED_XP } from '@/lib/game';
import type { Goal, GoalMetric } from '@/lib/types';

/** Las métricas en el orden de los chips; el nombre sale de avances:hojaMeta.metrica. */
const METRIC_OPTIONS: GoalMetric[] = ['peso_corporal', 'ejercicio', 'libre'];

export interface HojaMetaProps {
  visible: boolean;
  saludAceptada: boolean;
  titulo: string;
  metrica: GoalMetric;
  ejercicio: string;
  inicio: string;
  objetivo: string;
  guardando: boolean;
  /** El fallo del dato o del servidor, ya escrito para el usuario. */
  error: string | null;
  onTitulo: (v: string) => void;
  onMetrica: (m: GoalMetric) => void;
  onEjercicio: (v: string) => void;
  onInicio: (v: string) => void;
  onObjetivo: (v: string) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaMeta(p: HojaMetaProps) {
  return (
    <Sheet
      visible={p.visible}
      onClose={p.onCerrar}
      eyebrow={t('avances:vista.nuevaMeta')}
      title={t('avances:hojaMeta.titulo')}
      footer={
        <>
          <Button
            title={t('avances:hojaMeta.fijar')}
            onPress={p.onGuardar}
            loading={p.guardando}
            disabled={!p.titulo.trim()}
          />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={p.onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Campo
          etiqueta={t('avances:hojaMeta.campoTitulo')}
          value={p.titulo}
          onChangeText={p.onTitulo}
          placeholder={p.saludAceptada ? t('avances:hojaMeta.tituloEjemploSalud') : t('avances:hojaMeta.tituloEjemplo')}
          accessibilityLabel={t('avances:hojaMeta.campoTituloA11y')}
          autoFocus
        />

        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            {t('avances:hojaMeta.seMide')}
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('avances:hojaMeta.seMideA11y')}>
            <ChipWrap>
              {METRIC_OPTIONS.filter((m) => p.saludAceptada || m === 'libre').map((m) => (
                <Chip
                  key={m}
                  label={t(`avances:hojaMeta.metrica.${m}`)}
                  selected={p.metrica === m}
                  onPress={() => p.onMetrica(m)}
                  accessibilityLabel={t('avances:hojaMeta.medirConA11y', { metrica: t(`avances:hojaMeta.metrica.${m}`) })}
                />
              ))}
            </ChipWrap>
          </View>
        </View>

        {p.metrica === 'ejercicio' ? (
          <Campo
            etiqueta={t('avances:hojaMeta.ejercicio')}
            value={p.ejercicio}
            onChangeText={p.onEjercicio}
            placeholder={t('avances:hojaMeta.ejercicioEjemplo')}
            accessibilityLabel={t('avances:hojaMeta.ejercicioA11y')}
          />
        ) : null}

        <View style={styles.dos}>
          <Campo
            etiqueta={t('avances:hojaMeta.inicial')}
            value={p.inicio}
            onChangeText={p.onInicio}
            keyboardType="decimal-pad"
            placeholder="85"
            accessibilityLabel={t('avances:hojaMeta.inicial')}
            estiloBloque={styles.columna}
          />
          <Campo
            etiqueta={t('avances:hojaMeta.objetivo')}
            value={p.objetivo}
            onChangeText={p.onObjetivo}
            keyboardType="decimal-pad"
            placeholder="78"
            accessibilityLabel={t('avances:hojaMeta.objetivoA11y')}
            estiloBloque={styles.columna}
          />
        </View>

        <Text style={styles.ayuda} maxFontSizeMultiplier={1.6}>
          {t('avances:hojaMeta.premio', { xp: GOAL_ACHIEVED_XP })}
        </Text>

        {p.error ? (
          <View style={styles.fallo} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={16} color={ink.ink9} style={styles.falloIcono} />
            <Text style={styles.falloTexto} maxFontSizeMultiplier={1.6}>
              {p.error}
            </Text>
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

export interface HojaValorProps {
  /** La meta libre que se actualiza; null = hoja cerrada. */
  meta: Goal | null;
  valor: string;
  error: string | null;
  /** Guardando: el botón muestra la carga y no admite un segundo toque. */
  guardando?: boolean;
  onValor: (v: string) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaValor({ meta, valor, error, guardando = false, onValor, onGuardar, onCerrar }: HojaValorProps) {
  return (
    <Sheet
      visible={meta !== null}
      onClose={onCerrar}
      eyebrow={t('avances:hojaValor.eyebrow')}
      title={meta?.title}
      footer={
        <>
          <Button title={t('comun:guardar')} onPress={onGuardar} loading={guardando} />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={onCerrar} disabled={guardando} />
        </>
      }
    >
      <Campo
        etiqueta={t('avances:hojaValor.campo', { unidad: meta?.unit ?? '' })}
        value={valor}
        onChangeText={onValor}
        keyboardType="decimal-pad"
        accessibilityLabel={t('avances:hojaValor.campoA11y')}
        error={error}
        autoFocus
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s5 },
  grupo: { gap: space.s2 },
  etiqueta: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  ayuda: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink6 },
  dos: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3 },
  columna: { flex: 1, minWidth: 0 },
  fallo: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s2 },
  falloIcono: { marginTop: 2 },
  falloTexto: {
    flex: 1,
    minWidth: 0,
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
});
