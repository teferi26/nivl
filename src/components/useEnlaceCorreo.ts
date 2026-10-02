// NIVL · Canjear el enlace del correo (confirmar cuenta o restablecer
// contraseña) al abrir la app con él.
//
// La lógica y la seguridad son de authFlow.completarEnlace (Chat 3: solo
// PKCE, solo las dos rutas propias). Aquí solo se decide CUÁNDO llamarla: una
// vez por URL. El código del enlace es de un solo uso; canjearlo dos veces
// (re-render, volver a la pantalla) daría «enlace caducado» a un enlace bueno.

import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { completarEnlace } from '@/lib/authFlow';
import { mensajeSistema } from '@/lib/validation';

// Una promesa por URL: el segundo efecto (StrictMode, re-montaje) espera la
// misma en vez de volver a canjear o quedarse colgado.
const canjes = new Map<string, Promise<'confirmado' | 'recuperacion'>>();

export type EstadoEnlace =
  | { fase: 'esperando' }
  | { fase: 'canjeando' }
  | { fase: 'listo'; destino: 'confirmado' | 'recuperacion' }
  | { fase: 'error'; mensaje: string }
  | { fase: 'sin_enlace' };

export function useEnlaceCorreo(): EstadoEnlace {
  const url = Linking.useURL();
  const [estado, setEstado] = useState<EstadoEnlace>({ fase: 'esperando' });

  useEffect(() => {
    // Sin código en la URL (se llegó navegando, o el enlace ya se canjeó).
    if (!url || !/[?&#]code=/.test(url)) {
      const t = setTimeout(() => setEstado((e) => (e.fase === 'esperando' ? { fase: 'sin_enlace' } : e)), 1500);
      return () => clearTimeout(t);
    }
    let canje = canjes.get(url);
    if (!canje) {
      canje = completarEnlace(url);
      canjes.set(url, canje);
    }
    let vivo = true;
    setEstado({ fase: 'canjeando' });
    canje
      .then((destino) => {
        if (vivo) setEstado({ fase: 'listo', destino });
      })
      .catch((e) => {
        if (vivo) setEstado({ fase: 'error', mensaje: mensajeSistema(e) });
      });
    return () => {
      vivo = false;
    };
  }, [url]);

  return estado;
}
