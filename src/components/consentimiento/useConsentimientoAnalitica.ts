// NIVL · Estado del consentimiento de la medición de uso para la interfaz.
// La lógica y el almacenamiento viven en `@/lib/analitica` (puerta) y
// `consentimientoAnaliticamath.ts` (vigencia). Aquí solo se lee, se escucha
// y se decide si hay que preguntar: solo con el flag `analitica_activa`
// encendido (con él apagado no se mide nada y no tiene sentido preguntar).

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  aceptarAnalitica,
  alCambiarConsentimiento,
  estadoConsentimiento,
  FLAG_ANALITICA,
  rechazarAnalitica,
  revocarAnalitica,
} from '@/lib/analitica';
import type { Decision } from '@/lib/consentimientoAnaliticamath';
import { flagActivo } from '@/lib/flagsServidor';

export interface ConsentimientoAnalitica {
  /** true hasta leer decisión y flag. */
  cargando: boolean;
  /** La decisión vigente (null: no hay, caducó o cambió el texto). */
  decision: Decision | null;
  /** Flag del servidor. */
  activa: boolean;
  /** Hay que preguntar: flag encendido y sin decisión vigente. */
  preguntar: boolean;
  ocupado: boolean;
  aceptar: () => void;
  rechazar: () => void;
  revocar: () => void;
}

export function useConsentimientoAnalitica(): ConsentimientoAnalitica {
  const [cargando, setCargando] = useState(true);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [activa, setActiva] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const cerrojo = useRef(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([estadoConsentimiento(), flagActivo(FLAG_ANALITICA)])
      .then(([d, f]) => {
        if (!vivo) return;
        setDecision(d);
        setActiva(f);
      })
      .catch(() => undefined)
      .finally(() => {
        if (vivo) setCargando(false);
      });
    const soltar = alCambiarConsentimiento((d) => {
      if (vivo) setDecision(d);
    });
    return () => {
      vivo = false;
      soltar();
    };
  }, []);

  const con = useCallback((fn: () => Promise<void>) => {
    if (cerrojo.current) return;
    cerrojo.current = true;
    setOcupado(true);
    void fn().finally(() => {
      cerrojo.current = false;
      setOcupado(false);
    });
  }, []);

  return {
    cargando,
    decision,
    activa,
    preguntar: !cargando && activa && decision === null,
    ocupado,
    aceptar: () => con(() => aceptarAnalitica()),
    rechazar: () => con(() => rechazarAnalitica()),
    revocar: () => con(() => revocarAnalitica()),
  };
}
