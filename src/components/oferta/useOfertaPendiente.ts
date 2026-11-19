// NIVL · Segunda oportunidad de la oferta del cuestionario, en «Hoy».
//
// Si el paso 6 no pudo enseñar la oferta (sin red o lectura lenta, ver
// `lib/ofertapendiente.ts`), la primera vez que «Hoy» está en calma y el
// estado de la cuenta se lee, se abre `/pro?motivo=firma` UNA vez. La decisión
// es la de siempre (`ofrecerSi('firma', …)`): a quien ya paga, ya vio la firma
// o tiene la tienda cerrada sin prueba, nada. Sin estado, el apunte se queda
// para la próxima apertura (caduca a los 7 días).

import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { conTiempoLimite, LECTURA_MAX_MS } from '@/components/onboarding/pasoOferta';
import { hayOfertaPendiente, olvidarOfertaPendiente } from '@/lib/ofertapendiente';
import { rutaOferta } from '@/lib/paywallmoment';
import { fetchAiStatus, ofrecerSi } from '@/lib/pro';

/** Un respiro tras llegar a «Hoy»: la oferta no tapa la pantalla al pintarse. */
export const ESPERA_REOFERTA_MS = 1500;

export function useOfertaPendiente({ enPausa, onboardingHecho }: { enPausa: boolean; onboardingHecho: boolean }) {
  const hecho = useRef(false);
  useEffect(() => {
    if (enPausa || !onboardingHecho || hecho.current) return;
    let vivo = true;
    const t = setTimeout(() => {
      void (async () => {
        if (!vivo || hecho.current || !(await hayOfertaPendiente())) return;
        hecho.current = true;
        const s = await conTiempoLimite(fetchAiStatus(), LECTURA_MAX_MS, null);
        // Sin estado no se ofrece a ciegas: el apunte sigue para la próxima apertura.
        if (!s) return;
        await olvidarOfertaPendiente();
        const d = await ofrecerSi('firma', s, { celebrando: false });
        if (vivo && d.mostrar && d.forma === 'hoja') router.push(rutaOferta('firma', d.tier));
      })().catch(() => {
        /* nunca rompe «Hoy» */
      });
    }, ESPERA_REOFERTA_MS);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [enPausa, onboardingHecho]);
}
