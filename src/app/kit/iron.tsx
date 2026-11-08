// NIVL · Galería: prototipo del motor de ejercicios de IRON. SOLO DESARROLLO.
//
// /kit/iron?ejercicio=<id>             la demostración (selector, Sustituir, músculos)
// /kit/iron?ejercicio=<id>&t=<ms>      quieta en ese instante del ciclo
// /kit/iron?ejercicio=<id>&solo=1&ancho=<px>[&t=<ms>]
//                                      solo el escenario (para grabar los vídeos:
//                                      scripts/iron/grabar.mjs)
// /kit/iron?ejercicio=<id>&ficha=1     la ficha a pantalla completa (mapa y músculos nombrados)
// En la web, con solo=1, window.__ironCuadro(ms) pinta ese instante (lo usa el grabador).
// En un build de release (__DEV__ false) redirige a la raíz.

import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { GALERIA } from '@/lib/galeria';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, useWindowDimensions } from 'react-native';
import { Screen } from '@/components/ui';
import { DemoIron, EscenarioIron } from '@/components/iron/DemoIron';
import { FichaIron } from '@/components/iron/FichaIron';
import { msQuieto } from '@/components/iron/Maniqui';
import { EJERCICIOS, ejercicioPorId } from '@/iron/ejercicios';

export default function KitIron() {
  const p = useLocalSearchParams<{ ejercicio?: string; t?: string; solo?: string; ancho?: string; ficha?: string }>();
  const { width } = useWindowDimensions();
  // En la web exportada los parámetros llegan después del primer render: el
  // ejercicio de la URL manda hasta que se elige otro en la galería.
  const [elegido, setId] = useState<string | undefined>(undefined);
  const id = elegido ?? (p.ejercicio && ejercicioPorId(p.ejercicio) ? p.ejercicio : EJERCICIOS[0].id);
  const [cuadro, setCuadro] = useState<number | undefined>(undefined);
  const ejercicio = ejercicioPorId(id) ?? EJERCICIOS[0];
  // Grabación (solo web y desarrollo): el grabador lee el ciclo y fija el instante cuadro a cuadro.
  useEffect(() => {
    if (!GALERIA || Platform.OS !== 'web' || p.solo !== '1' || !p.ejercicio) return;
    const g = globalThis as { __ironCuadro?: (ms: number) => void; __ironCiclo?: number; __ironQuieto?: number };
    g.__ironCuadro = setCuadro;
    g.__ironCiclo = ejercicio.cicloMs;
    g.__ironQuieto = msQuieto(ejercicio);
    return () => {
      delete g.__ironCuadro;
    };
  }, [p.solo, p.ejercicio, ejercicio]);
  if (!GALERIA) return <Redirect href="/" />;
  const ms = cuadro ?? (p.t !== undefined && Number.isFinite(Number(p.t)) ? Number(p.t) : undefined);

  if (p.ficha === '1') {
    return (
      <ScrollView style={{ flex: 1 }}>
        <FichaIron ejercicio={ejercicio} ancho={Math.min(width, 560)} />
      </ScrollView>
    );
  }
  if (p.solo === '1') return <EscenarioIron ejercicio={ejercicio} ancho={Number(p.ancho) || 720} ms={ms} />;

  return (
    <Screen>
      <DemoIron ejercicio={ejercicio} alElegir={setId} ms={ms} onVolver={() => (router.canGoBack() ? router.back() : router.replace('/kit'))} />
    </Screen>
  );
}
