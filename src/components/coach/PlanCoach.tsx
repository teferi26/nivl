// NIVL · El plan del día junto al chat del coach, en el segundo panel (iPad,
// Mac, Vision Pro, iPhone Duo abierto: PantallaCoach con MaestroDetalle). El
// coach escribe el plan con sus herramientas; aquí se ve a la vez que se
// habla con él y se marcan los bloques como en Hoy (optimista, con la misma
// vuelta atrás si la red falla). En el iPhone no existe: el plan está en Hoy.
//
// Se relee al terminar cada turno del coach (`ocupado` pasa a false): es
// cuando puede haber cambiado.

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { OrdenDelDia } from '@/components/OrdenDelDia';
import { Screen, SkeletonRows } from '@/components/ui';
import { space } from '@/design/tokens';
import { t } from '@/i18n';
import { fetchPlan, setBlockDone, type DayBlock, type PlanConBloques } from '@/lib/dayplan';
import { dateKey } from '@/lib/dates';

export function PlanCoach({ ocupado }: { ocupado: boolean }) {
  const [plan, setPlan] = useState<PlanConBloques | null>(null);
  const [cargado, setCargado] = useState(false);
  const vivo = useRef(true);

  const cargar = useCallback(async () => {
    try {
      const p = await fetchPlan(dateKey());
      if (vivo.current) setPlan(p);
    } catch {
      // Sin red el panel se queda con lo último: el chat ya avisa del fallo.
    } finally {
      if (vivo.current) setCargado(true);
    }
  }, []);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  // Al acabar un turno, el coach puede haber escrito o rehecho el plan.
  const antes = useRef(ocupado);
  useEffect(() => {
    if (antes.current && !ocupado) cargar();
    antes.current = ocupado;
  }, [ocupado, cargar]);

  const alternar = async (b: DayBlock) => {
    setPlan((p) => (p ? { ...p, bloques: p.bloques.map((x) => (x.id === b.id ? { ...x, done: !b.done } : x)) } : p));
    try {
      await setBlockDone(b.id, !b.done);
    } catch {
      setPlan((p) => (p ? { ...p, bloques: p.bloques.map((x) => (x.id === b.id ? { ...x, done: b.done } : x)) } : p));
    }
  };

  return (
    <Screen>
      {cargado ? (
        <OrdenDelDia plan={plan?.plan ?? null} bloques={plan?.bloques ?? []} onToggle={alternar} pro />
      ) : (
        <View style={styles.hueco} accessibilityRole="progressbar" accessibilityLabel={t('hoy:panel.cargandoA11y')}>
          <SkeletonRows rows={5} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hueco: { paddingTop: space.s6 },
});
