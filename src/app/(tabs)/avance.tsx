// NIVL · General · Avance: métricas (gráficas, cumplimiento, racha,
// estadísticas, informe) y progresión (nivel, camino de rangos con días
// activos reales, logros, botín de campañas, niveles de modo). Los datos en
// useAvanceGeneral (solo lectura); lo que se pinta, en AvanceVista (pura,
// también en /kit/general). `?ver=progresion` abre la segunda (el héroe de Hoy).
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ArsenalConectado } from '@/components/general/Arsenal';
import { AvanceVista, type SegmentoAvance } from '@/components/general/AvanceVista';
import { useAvanceGeneral } from '@/components/general/useAvanceGeneral';

export default function Avance() {
  const { ver } = useLocalSearchParams<{ ver?: string }>();
  const [segmento, setSegmento] = useState<SegmentoAvance>(ver === 'progresion' ? 'progresion' : 'metricas');
  useEffect(() => {
    if (ver === 'progresion' || ver === 'metricas') setSegmento(ver);
  }, [ver]);
  const d = useAvanceGeneral();
  return (
    <AvanceVista
      segmento={segmento}
      onSegmento={setSegmento}
      cargado={d.cargado}
      error={d.error}
      refrescando={d.refrescando}
      avance={d.avance}
      informe={d.informe}
      progresion={d.progresion}
      arsenal={<ArsenalConectado />}
      acciones={{
        onRefrescar: d.onRefrescar,
        onReintentar: d.onReintentar,
        onInforme: () => router.push('/informe'),
        onCuerpo: () => router.push('/avances'),
        onCampanas: () => router.navigate('/(tabs)/mazmorras'),
      }}
    />
  );
}
