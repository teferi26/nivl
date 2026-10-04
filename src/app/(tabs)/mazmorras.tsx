// La pestaña de campañas (la ruta conserva su nombre interno). Los datos y
// los efectos viven en useCampanas; lo que se ve, en CampanasVista (pura,
// también en /kit/pantallas). Aquí queda la hoja de abrir una campaña (con
// Campo y rótulos de la arena, FASE3 Lote B2).
import { StyleSheet, Text, View } from 'react-native';
import { Campo } from '@/components/arena';
import { CampanasVista } from '@/components/campanas/CampanasVista';
import { useCampanas } from '@/components/campanas/useCampanas';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { DUNGEON_CLEAR_XP, DUNGEON_RANKS, STATS } from '@/lib/game';

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
        <View style={styles.pila}>
          <Campo
            etiqueta="Nombre"
            value={h.title}
            onChangeText={h.setTitle}
            placeholder="Ej. Lanzar la web · Aprobar Cálculo · Media maratón"
            autoFocus
            accessibilityLabel="Nombre de la campaña"
          />
          <View style={styles.grupo}>
            <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
              Envergadura
            </Text>
            <ChipWrap>
              {DUNGEON_RANKS.map((r) => (
                <Chip key={r} label={r} selected={h.rank === r} onPress={() => h.setRank(r)} accessibilityLabel={`Rango ${r}`} />
              ))}
            </ChipWrap>
            <Text style={styles.ayuda}>De E (una semana) a S (una temporada entera). Botín al despejar: {DUNGEON_CLEAR_XP[h.rank]} XP.</Text>
          </View>
          <View style={styles.grupo}>
            <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
              Qué entrena
            </Text>
            <ChipWrap>
              {STATS.map((s) => (
                <Chip key={s} label={s} selected={h.stat === s} onPress={() => h.setStat(s)} accessibilityLabel={`Estadística ${s}`} />
              ))}
            </ChipWrap>
          </View>
        </View>
      </Sheet>
    </>
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
