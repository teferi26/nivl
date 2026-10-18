// NIVL · Galería: prototipo del motor de ejercicios de IRON. SOLO DESARROLLO.
//
// /kit/iron?ejercicio=<id>             la demostración (selector, Sustituir, músculos)
// /kit/iron?ejercicio=<id>&t=<ms>      quieta en ese instante del ciclo
// /kit/iron?ejercicio=<id>&solo=1&ancho=<px>[&t=<ms>]
//                                      solo el escenario (para grabar los vídeos:
//                                      scripts/iron/grabar.mjs)
// En la web, con solo=1, window.__ironCuadro(ms) pinta ese instante (lo usa el grabador).
// En un build de release (__DEV__ false) redirige a la raíz.

import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Screen } from '@/components/ui';
import { DemoIron, EscenarioIron } from '@/components/iron/DemoIron';
import { EJERCICIOS, ejercicioPorId } from '@/iron/ejercicios';

export default function KitIron() {
  const p = useLocalSearchParams<{ ejercicio?: string; t?: string; solo?: string; ancho?: string }>();
  const [id, setId] = useState(p.ejercicio && ejercicioPorId(p.ejercicio) ? p.ejercicio : EJERCICIOS[0].id);
  const [cuadro, setCuadro] = useState<number | undefined>(undefined);
  // Grabación (solo web y desarrollo): el grabador fija el instante cuadro a cuadro.
  useEffect(() => {
    if (!__DEV__ || Platform.OS !== 'web' || p.solo !== '1') return;
    const g = globalThis as { __ironCuadro?: (ms: number) => void };
    g.__ironCuadro = setCuadro;
    return () => {
      delete g.__ironCuadro;
    };
  }, [p.solo]);
  if (!__DEV__) return <Redirect href="/" />;
  const ejercicio = ejercicioPorId(id) ?? EJERCICIOS[0];
  const ms = cuadro ?? (p.t !== undefined && Number.isFinite(Number(p.t)) ? Number(p.t) : undefined);

  if (p.solo === '1') return <EscenarioIron ejercicio={ejercicio} ancho={Number(p.ancho) || 720} ms={ms} />;

  return (
    <Screen>
      <DemoIron ejercicio={ejercicio} alElegir={setId} ms={ms} onVolver={() => (router.canGoBack() ? router.back() : router.replace('/kit'))} />
    </Screen>
  );
}
