// NIVL · Cardio: la hoja «Nueva sesión» (FASE3 Lote E1). Pura: el formulario,
// la validación y el pago viven en useCardio.
//
// Chips radio de tipo (con icono) y de zona, y Campo de duración, distancia
// (solo si el tipo la mide), RPE, pulso y notas. Los fallos van en línea: el
// del dato en su Campo y el del servidor en ErrorSistema compacto. Pie:
// primary «Registrar sesión» + ghost «Cancelar».

import { StyleSheet, Text, View } from 'react-native';
import { Campo, ErrorSistema } from '@/components/arena';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import type { CardioKind, CardioZone } from '@/lib/bodywork';
import { t } from '@/i18n';
import { decimal } from '@/i18n/formato';
import { ICONO, PIDE_DISTANCIA, TIPOS, ZONAS, etiquetaCardio, zonaCardio } from './tipos';

export interface ErroresCardio {
  duracion: string | null;
  distancia: string | null;
  rpe: string | null;
  /** Lo que ha contestado el sistema al guardar, ya escrito para el usuario. */
  servidor: string | null;
}

export interface HojaCardioProps {
  visible: boolean;
  kind: CardioKind;
  zone: CardioZone;
  duracion: string;
  distancia: string;
  rpe: string;
  pulso: string;
  notas: string;
  guardando: boolean;
  errores: ErroresCardio;
  onKind: (k: CardioKind) => void;
  onZone: (z: CardioZone) => void;
  onDuracion: (v: string) => void;
  onDistancia: (v: string) => void;
  onRpe: (v: string) => void;
  onPulso: (v: string) => void;
  onNotas: (v: string) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaCardio({
  visible,
  kind,
  zone,
  duracion,
  distancia,
  rpe,
  pulso,
  notas,
  guardando,
  errores,
  onKind,
  onZone,
  onDuracion,
  onDistancia,
  onRpe,
  onPulso,
  onNotas,
  onGuardar,
  onCerrar,
}: HojaCardioProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow={t('cardio:hoja.eyebrow')}
      title={t('cardio:hoja.titulo')}
      footer={
        <>
          <Button title={t('cardio:vista.registrar')} onPress={onGuardar} loading={guardando} />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            {t('cardio:hoja.tipo')}
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('cardio:hoja.tipoA11y')}>
            <ChipWrap>
              {TIPOS.map((k) => (
                <Chip
                  key={k}
                  label={etiquetaCardio(k)}
                  icon={ICONO[k]}
                  selected={kind === k}
                  onPress={() => onKind(k)}
                  accessibilityLabel={etiquetaCardio(k)}
                />
              ))}
            </ChipWrap>
          </View>
        </View>

        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            {t('cardio:hoja.zona')}
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('cardio:hoja.zonaA11y')}>
            <ChipWrap>
              {ZONAS.map((z) => (
                <Chip
                  key={z}
                  label={zonaCardio(z)}
                  selected={zone === z}
                  onPress={() => onZone(z)}
                  accessibilityLabel={t('cardio:hoja.zonaChipA11y', { zona: zonaCardio(z) })}
                />
              ))}
            </ChipWrap>
          </View>
          <Text style={styles.ayuda} maxFontSizeMultiplier={1.6}>
            {t('cardio:hoja.zonaAyuda')}
          </Text>
        </View>

        <View style={styles.dos}>
          <Campo
            etiqueta={t('cardio:hoja.duracion')}
            value={duracion}
            onChangeText={onDuracion}
            keyboardType="decimal-pad"
            placeholder="30"
            accessibilityLabel={t('cardio:hoja.duracionA11y')}
            error={errores.duracion}
            estiloBloque={styles.columna}
          />
          {PIDE_DISTANCIA[kind] ? (
            <Campo
              etiqueta={t('cardio:hoja.distancia')}
              value={distancia}
              onChangeText={onDistancia}
              keyboardType="decimal-pad"
              placeholder={decimal(5.2, 1)}
              accessibilityLabel={t('cardio:hoja.distanciaA11y')}
              error={errores.distancia}
              estiloBloque={styles.columna}
            />
          ) : (
            <View style={styles.columna} />
          )}
        </View>

        <View style={styles.dos}>
          <Campo
            etiqueta={t('cardio:hoja.esfuerzo')}
            value={rpe}
            onChangeText={onRpe}
            keyboardType="decimal-pad"
            placeholder="6"
            accessibilityLabel={t('cardio:hoja.esfuerzoA11y')}
            error={errores.rpe}
            estiloBloque={styles.columna}
          />
          <Campo
            etiqueta={t('cardio:hoja.pulso')}
            value={pulso}
            onChangeText={onPulso}
            keyboardType="number-pad"
            placeholder="142"
            accessibilityLabel={t('cardio:hoja.pulsoA11y')}
            estiloBloque={styles.columna}
          />
        </View>

        <Campo
          etiqueta={t('cardio:hoja.notas')}
          value={notas}
          onChangeText={onNotas}
          multiline
          placeholder={t('cardio:hoja.notasPlaceholder')}
          accessibilityLabel={t('cardio:hoja.notasA11y')}
        />

        {errores.servidor ? <ErrorSistema compacto mensaje={errores.servidor} /> : null}
      </View>
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
  ayuda: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
  },
  dos: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3 },
  columna: { flex: 1, minWidth: 0 },
});
