// NIVL · WORK: la línea de economía en Hoy. `textoLineaEconomia` pone la frase a
// lo que decide src/work/economiaHoy.ts; `useLineaEconomia` trae los datos sin
// bloquear ni romper Hoy (ante cualquier fallo, sin línea).

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { euros } from '@/components/economia/work/cifras';
import { useAlVolver } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { dateKey } from '@/lib/dates';
import { cargarWork, type DatosWork } from '@/lib/moneydatos';
import { lineaEconomiaHoy, type LineaEconomia as Linea } from '@/work/economiaHoy';

export function textoLineaEconomia(l: Linea): string {
  if (l.tipo === 'por_facturar') return t('trabajoagenda:economia.porFacturar', { importe: euros(l.importe) });
  if (l.tipo === 'mes') return t('trabajoagenda:economia.lineaMes', { entra: euros(l.entra), sale: euros(l.sale) });
  const datos = { nombre: l.nombre, importe: euros(l.importe) };
  if (l.dias === 0) return t('trabajoagenda:economia.fijoHoy', datos);
  if (l.dias === 1) return t('trabajoagenda:economia.fijoManana', datos);
  return t('trabajoagenda:economia.fijoDias', { ...datos, dias: l.dias });
}

/** `porFacturar`: `totalHoras(...).porFacturarImporte` de lo que Hoy ya tiene leído. */
export function useLineaEconomia(porFacturar: number): Linea | null {
  const [dinero, setDinero] = useState<DatosWork | null>(null);
  const hoy = dateKey();
  const leer = () => {
    cargarWork(hoy, 2)
      .then((c) => setDinero(c.disponible ? c : null))
      .catch(() => setDinero(null));
  };
  useEffect(leer, [hoy]);
  useAlVolver(leer);
  return lineaEconomiaHoy({ hoy, porFacturar, movs: dinero?.movs ?? [], fijos: dinero?.fijos ?? [] });
}

export function LineaEconomia({ linea, onPress }: { linea: Linea; onPress: () => void }) {
  const texto = textoLineaEconomia(linea);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={texto} style={styles.fila}>
      <Text style={styles.texto} numberOfLines={1} maxFontSizeMultiplier={1.35}>
        {texto}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fila: { minHeight: 44, justifyContent: 'center', paddingVertical: space.s2 },
  texto: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8 },
});
