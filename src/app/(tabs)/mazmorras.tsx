// La pestaña de campañas (la ruta conserva su nombre interno). Los datos y
// los efectos viven en useCampanas; lo que se ve, en CampanasVista (pura,
// también en /kit/pantallas). Aquí queda la hoja de abrir una campaña.
import { StyleSheet, Text, TextInput } from 'react-native';
import { CampanasVista } from '@/components/campanas/CampanasVista';
import { useCampanas } from '@/components/campanas/useCampanas';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { DUNGEON_CLEAR_XP, DUNGEON_RANKS, STATS } from '@/lib/game';
import { colors, fonts } from '@/lib/theme';

export default function Campañas() {
  const { vista, hojas } = useCampanas();
  const h = hojas.nueva;
  return (
    <>
      <CampanasVista {...vista} />
      <Sheet
        visible={h.visible}
        onClose={h.onClose}
        eyebrow="Nueva campaña"
        title="¿Qué vas a conquistar?"
        footer={
          <>
            <Button title="Abrir campaña" size="lg" onPress={h.onCreate} loading={h.saving} disabled={!h.title.trim()} />
            <Button title="Cancelar" variant="ghost" onPress={h.onClose} />
          </>
        }
      >
        <Text style={[styles.label, styles.labelPrimero]}>Nombre</Text>
        <TextInput
          style={styles.input}
          value={h.title}
          onChangeText={h.setTitle}
          placeholder="Ej. Lanzar la web · Aprobar Cálculo · Media maratón"
          placeholderTextColor={colors.textFaint}
          autoFocus
          accessibilityLabel="Nombre de la campaña"
        />
        <Text style={styles.label}>Envergadura</Text>
        <ChipWrap>
          {DUNGEON_RANKS.map((r) => (
            <Chip key={r} label={r} selected={h.rank === r} onPress={() => h.setRank(r)} accessibilityLabel={`Rango ${r}`} />
          ))}
        </ChipWrap>
        <Text style={styles.hint}>De E (una semana) a S (una temporada entera). Botín al despejar: {DUNGEON_CLEAR_XP[h.rank]} XP.</Text>
        <Text style={styles.label}>Qué entrena</Text>
        <ChipWrap>
          {STATS.map((s) => (
            <Chip key={s} label={s} selected={h.stat === s} onPress={() => h.setStat(s)} accessibilityLabel={`Estadística ${s}`} />
          ))}
        </ChipWrap>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  labelPrimero: { marginTop: 4 },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 8, lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
