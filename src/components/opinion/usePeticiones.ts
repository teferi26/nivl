// NIVL · Tras un momento bueno (misión completada o subida de nivel): la
// valoración de la tienda o la opinión interna, si toca (`peticiones.ts`), y
// nunca encima de una celebración. La decisión no mira la opinión: la
// valoración no se filtra (sin «review gating»). docs/modos/F1-analitica.md.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCelebracion } from '@/components/celebracion/contexto';
import { vibrar } from '@/design/haptics';
import { t } from '@/i18n';
import { alMomentoPositivo, enviarOpinion, pedirValoracion } from '@/lib/peticiones';
import { limpiarOpinion, type MomentoPositivo, type Peticion } from '@/lib/peticionesmath';
import { mensajeSistema } from '@/lib/validation';
import type { HojaOpinionProps } from './HojaOpinion';

export function usePeticiones(): { alMomentoPositivo: (m: MomentoPositivo) => void; hoja: HojaOpinionProps } {
  const { celebrando } = useCelebracion();
  const [pendiente, setPendiente] = useState<Peticion | null>(null);
  const [visible, setVisible] = useState(false);
  const [gusta, setGusta] = useState('');
  const [cambiaria, setCambiaria] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cerrojo = useRef(false);

  const alMomento = useCallback((m: MomentoPositivo) => {
    void alMomentoPositivo(m).then((p) => {
      if (p) setPendiente(p);
    });
  }, []);

  // Se espera a que no haya ceremonia ni toast en pantalla.
  useEffect(() => {
    if (!pendiente || celebrando) return;
    if (pendiente === 'valoracion') void pedirValoracion();
    else setVisible(true);
    setPendiente(null);
  }, [pendiente, celebrando]);

  const onEnviar = useCallback(async () => {
    if (cerrojo.current) return;
    if (!limpiarOpinion(gusta, cambiaria)) {
      setError(t('hoy:opinion.vacia'));
      return;
    }
    cerrojo.current = true;
    setEnviando(true);
    setError(null);
    try {
      await enviarOpinion(gusta, cambiaria);
      setEnviada(true);
    } catch (e) {
      vibrar('penalizacion');
      setError(mensajeSistema(e));
    } finally {
      cerrojo.current = false;
      setEnviando(false);
    }
  }, [gusta, cambiaria]);

  const onCerrar = useCallback(() => {
    if (cerrojo.current) return;
    setVisible(false);
    setError(null);
  }, []);

  return {
    alMomentoPositivo: alMomento,
    hoja: {
      visible,
      gusta,
      cambiaria,
      enviando,
      enviada,
      error,
      onGusta: setGusta,
      onCambiaria: setCambiaria,
      onEnviar: () => void onEnviar(),
      onCerrar,
    },
  };
}
