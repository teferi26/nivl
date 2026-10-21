// La pestaña de campañas de General (la ruta conserva su nombre interno). Los
// datos y los efectos viven en useCampanas; lo que se ve, en
// CampanasGeneralVista (la piel de NIVL, lámina 4; también en /kit/general).
// Aquí queda la hoja de abrir una campaña, con la piel de NIVL (oro).
import { StyleSheet, Text, View } from 'react-native';
import { Campo } from '@/components/arena';
import { CampanasGeneralVista } from '@/components/general/CampanasGeneralVista';
import { PielGeneral } from '@/components/general/piel';
import { useCampanas } from '@/components/campanas/useCampanas';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { DUNGEON_CLEAR_XP, DUNGEON_RANKS, STATS } from '@/lib/game';

export default function Campañas() {
  const { vista, hojas } = useCampanas();
  const h = hojas.nueva;
  return (
    <PielGeneral>
      <CampanasGeneralVista {...vista} />
      <Sheet
        visible={h.visible}
        onClose={h.onClose}
        eyebrow={t('campanas:hojas.nuevaCampana')}
        title={t('campanas:hojas.queConquistar')}
        footer={
          <>
            <Button
              title={t('campanas:hojas.abrirCampana')}
              size="lg"
              onPress={h.onCreate}
              loading={h.saving}
              disabled={!h.title.trim()}
            />
            <Button title={t('comun:cancelar')} variant="ghost" onPress={h.onClose} />
          </>
        }
      >
        <View style={styles.pila}>
          <Campo
            etiqueta={t('comun:nombre')}
            value={h.title}
            onChangeText={h.setTitle}
            placeholder={t('campanas:hojas.placeholderCampana')}
            autoFocus
            accessibilityLabel={t('campanas:hojas.nombreCampanaA11y')}
          />
          <View style={styles.grupo}>
            <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
              {t('campanas:hojas.envergadura')}
            </Text>
            <ChipWrap>
              {DUNGEON_RANKS.map((r) => (
                <Chip
                  key={r}
                  label={r}
                  selected={h.rank === r}
                  onPress={() => h.setRank(r)}
                  accessibilityLabel={t('campanas:comun.rangoA11y', { rango: r })}
                />
              ))}
            </ChipWrap>
            <Text style={styles.ayuda}>{t('campanas:hojas.ayudaRango', { xp: DUNGEON_CLEAR_XP[h.rank] })}</Text>
          </View>
          <View style={styles.grupo}>
            <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
              {t('campanas:hojas.queEntrena')}
            </Text>
            <ChipWrap>
              {STATS.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  selected={h.stat === s}
                  onPress={() => h.setStat(s)}
                  accessibilityLabel={t('campanas:hojas.estadisticaA11y', { stat: s })}
                />
              ))}
            </ChipWrap>
          </View>
        </View>
      </Sheet>
    </PielGeneral>
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
});
