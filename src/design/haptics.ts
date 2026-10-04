// NIVL · Vibraciones (SISTEMA.md §9). Una sola función: `vibrar(evento)`.
//
// - No lanza nunca: una vibración que falla no puede romper un gesto.
// - En web no hace nada.
// - Respeta el ajuste de Perfil (`setVibracionesActivas`), guardado en
//   AsyncStorage con la clave 'nivl:vibraciones'. Activado por defecto; se lee
//   una sola vez y queda en caché en memoria.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { VIBRACIONES, type EventoVibracion, type Paso } from './hapticsMap';

export type { EventoVibracion } from './hapticsMap';

const CLAVE = 'nivl:vibraciones';

let activas = true;
let cargado = false;
let carga: Promise<void> | null = null;
const oyentes = new Set<(v: boolean) => void>();

function cargar(): Promise<void> {
  if (carga) return carga;
  carga = AsyncStorage.getItem(CLAVE)
    .then((v) => {
      // Si el usuario cambió el ajuste mientras se leía, manda lo suyo.
      if (cargado) return;
      cargado = true;
      if (v === '0') avisar(false);
    })
    .catch(() => {
      cargado = true;
    });
  return carga;
}

function avisar(v: boolean) {
  activas = v;
  oyentes.forEach((f) => f(v));
}

function ejecutar(paso: Paso): void {
  let p: Promise<void>;
  switch (paso.tipo) {
    case 'seleccion':
      p = Haptics.selectionAsync();
      break;
    case 'success':
      p = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case 'warning':
      p = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      break;
    case 'light':
      p = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case 'medium':
      p = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      break;
    case 'heavy':
      p = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      break;
    case 'rigid':
      p = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      break;
  }
  p.catch(() => {});
}

/** Vibra según el mapa único. No lanza nunca; en web no hace nada. */
export function vibrar(evento: EventoVibracion): void {
  try {
    if (Platform.OS === 'web') return;
    const lanzar = () => {
      if (!activas) return;
      for (const paso of VIBRACIONES[evento] ?? []) {
        if (paso.tras <= 0) {
          try {
            ejecutar(paso);
          } catch {
            // nada
          }
        } else {
          setTimeout(() => {
            try {
              if (activas) ejecutar(paso);
            } catch {
              // nada
            }
          }, paso.tras);
        }
      }
    };
    if (cargado) lanzar();
    else void cargar().then(lanzar);
  } catch {
    // Una vibración nunca rompe un gesto.
  }
}

/** Ajuste de Perfil. Se aplica al instante y se guarda en segundo plano. */
export function setVibracionesActivas(v: boolean): void {
  cargado = true;
  avisar(v);
  AsyncStorage.setItem(CLAVE, v ? '1' : '0').catch(() => {});
}

/** Valor en memoria (true hasta que se lea lo contrario del almacén). */
export function vibracionesActivas(): boolean {
  return activas;
}

/** Estado del ajuste para el interruptor de Perfil. */
export function useVibraciones(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(activas);
  useEffect(() => {
    oyentes.add(setV);
    setV(activas);
    void cargar().then(() => setV(activas));
    return () => {
      oyentes.delete(setV);
    };
  }, []);
  return [v, setVibracionesActivas];
}
