// NIVL · Resistencia: «Cómo estás hoy»: sueño, fatiga y dolor. Pura.
//
// El dolor no se interpreta: quien lo marca lee que pare y consulte a un
// profesional sanitario, y Resistencia deja de proponerle cuándo salir.

import { StyleSheet, Text, View } from 'react-native';
import { Campo, ErrorSistema } from '@/components/arena';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { Interruptor } from '@/components/ui/Interruptor';
import { useAnunciar } from '@/components/ui/useAnunciar';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';

const NIVELES_FATIGA = [1, 2, 3, 4, 5] as const;

export interface HojaBienestarProps {
  visible: boolean;
  sueno: string;
  fatiga: number | null;
  dolor: boolean;
  zona: string;
  guardando: boolean;
  errores: { sueno: string | null; servidor: string | null };
  onSueno: (v: string) => void;
  onFatiga: (v: number | null) => void;
  onDolor: (v: boolean) => void;
  onZona: (v: string) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaBienestar(p: HojaBienestarProps) {
  // VoiceOver no habla con role="alert": la advertencia se anuncia a mano.
  useAnunciar(p.visible && p.dolor ? `${t('resistencia:derivacion.titulo')}. ${t('resistencia:derivacion.cuerpo')}` : null);
  return (
    <Sheet
      visible={p.visible}
      onClose={p.onCerrar}
      eyebrow={t('resistencia:bienestar.eyebrow')}
      title={t('resistencia:bienestar.titulo')}
      footer={
        <>
          <Button title={t('comun:guardar')} onPress={p.onGuardar} loading={p.guardando} />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={p.onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Campo
          etiqueta={t('resistencia:bienestar.sueno')}
          value={p.sueno}
          onChangeText={p.onSueno}
          keyboardType="decimal-pad"
          error={p.errores.sueno}
        />

        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            {t('resistencia:bienestar.fatiga')}
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('resistencia:bienestar.fatiga')}>
            <ChipWrap>
              {NIVELES_FATIGA.map((n) => (
                <Chip
                  key={n}
                  label={String(n)}
                  selected={p.fatiga === n}
                  onPress={() => p.onFatiga(p.fatiga === n ? null : n)}
                  accessibilityLabel={t('resistencia:bienestar.fatigaA11y', { n })}
                />
              ))}
            </ChipWrap>
          </View>
          <Text style={styles.ayuda} maxFontSizeMultiplier={1.6}>
            {t('resistencia:bienestar.fatigaAyuda')}
          </Text>
        </View>

        <View style={styles.fila}>
          <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
            {t('resistencia:bienestar.dolor')}
          </Text>
          <Interruptor value={p.dolor} onValueChange={p.onDolor} accessibilityLabel={t('resistencia:bienestar.dolor')} />
        </View>

        {p.dolor ? (
          <>
            <Campo etiqueta={t('resistencia:bienestar.zona')} value={p.zona} onChangeText={p.onZona} maxLength={120} />
            <View style={styles.derivacion} accessible accessibilityRole="alert">
              <Text style={styles.derivacionTitulo} maxFontSizeMultiplier={1.35}>
                {t('resistencia:derivacion.titulo')}
              </Text>
              <Text style={styles.texto} maxFontSizeMultiplier={1.6}>
                {t('resistencia:derivacion.cuerpo')}
              </Text>
            </View>
          </>
        ) : null}

        {p.errores.servidor ? <ErrorSistema compacto mensaje={p.errores.servidor} /> : null}
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
  ayuda: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink6 },
  texto: { flex: 1, fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink9 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: 44 },
  derivacion: { gap: space.s2, padding: space.s4, borderWidth: 2, borderColor: ink.ink10 },
  derivacionTitulo: {
    fontFamily: tipo.headline.family,
    fontSize: tipo.headline.size,
    lineHeight: tipo.headline.lineHeight,
    color: ink.ink10,
  },
});
