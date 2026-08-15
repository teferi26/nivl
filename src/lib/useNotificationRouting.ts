// NIVL · Qué pasa cuando tocas una notificación.
//
// Dos caminos, y el segundo es el que se suele olvidar:
//   · La app está viva → llega por el listener y se aplica al momento.
//   · La app estaba cerrada → el sistema operativo guarda la respuesta y
//     expo-notifications la entrega en el siguiente arranque. Sin leerla, un
//     "Hecho" pulsado con la app cerrada se perdía sin dejar rastro.
//
// La acción HECHO marca el bloque del plan, no completa la misión: el XP
// exige pasar por el motor, y hacerlo a ciegas desde una notificación abriría
// la puerta a otorgar puntos sin evidencia ni comprobaciones.

import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { setBlockDone } from './dayplan';
import { avisarEn } from './notifications';

interface Datos {
  ruta?: string;
  blockId?: string;
  fecha?: string;
}

async function aplicar(respuesta: Notifications.NotificationResponse, ir: (r: string) => void) {
  const datos = (respuesta.notification.request.content.data ?? {}) as Datos;
  const accion = respuesta.actionIdentifier;

  if (accion === 'HECHO' && datos.blockId) {
    await setBlockDone(datos.blockId, true).catch(() => {});
    return;
  }

  if (accion === 'POSPONER' && datos.blockId) {
    const contenido = respuesta.notification.request.content;
    await avisarEn(
      `nivl.posponer.${datos.blockId}`,
      new Date(Date.now() + 10 * 60 * 1000),
      contenido.title ?? 'El sistema insiste',
      contenido.body ?? 'Sigue pendiente.',
      datos.ruta,
    );
    return;
  }

  if (datos.ruta) ir(datos.ruta);
}

export function useNotificationRouting(listo: boolean) {
  const router = useRouter();
  const yaTratada = useRef<string | null>(null);

  useEffect(() => {
    if (!listo) return;
    const ir = (r: string) => router.push(r as never);

    // Arranque en frío: la respuesta pendiente desde que la app estaba cerrada.
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (!r) return;
        const id = r.notification.request.identifier + r.actionIdentifier;
        if (yaTratada.current === id) return;
        yaTratada.current = id;
        return aplicar(r, ir);
      })
      .catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const id = r.notification.request.identifier + r.actionIdentifier;
      if (yaTratada.current === id) return;
      yaTratada.current = id;
      aplicar(r, ir).catch(() => {});
    });
    return () => sub.remove();
  }, [listo, router]);
}
