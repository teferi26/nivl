// NIVL · Mundo IRON: la pestaña Entreno (efectos). Sin lógica nueva:
//   · Rutinas: useGym (Gimnasio): rutina, prescripción, sesión, sus hojas,
//     sus cerrojos y su pago.
//   · Pesos: usePesos (iron/historialDatos + iron/pesos).
//   · Cardio: useCardio (Cardio): sesiones, la hoja de registrar, el pago y
//     el borrado. Las calorías se estiman con el último peso del usuario
//     (dato de salud: la pestaña va tras la guarda de salud `gym`).

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useHealthConsent } from '@/components/ConsentimientoSalud';
import { useCardio, type UseCardio } from '@/components/cardio/useCardio';
import { useGym, type UseGym } from '@/components/gym/useGym';
import { useMundo, type UseMundo } from '@/components/modos/mundo/useMundo';
import { GYM_SESSION_XP } from '@/lib/game';
import { fetchWeights } from '@/lib/progress';
import { VISTAS_ENTRENO, type EntrenoIronVistaProps, type VistaEntreno } from './EntrenoIronVista';
import { usePesos } from './usePesos';

export interface UseEntrenoIron {
  gym: UseGym;
  cardio: UseCardio;
  mundo: UseMundo;
  vista: Omit<EntrenoIronVistaProps, 'cabecera' | 'overlay'>;
}

/** El último peso registrado (para estimar calorías), con el consentimiento de salud. */
function useUltimoPeso(): number | null {
  const health = useHealthConsent();
  const [peso, setPeso] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!health.accepted) return;
      let vivo = true;
      fetchWeights(120)
        .then((ws) => {
          if (vivo) setPeso(ws.length > 0 ? Number(ws[ws.length - 1]!.weight_kg) : null);
        })
        // Accesorio: sin peso, la estimación usa el de referencia y lo dice.
        .catch(() => {});
      return () => {
        vivo = false;
      };
    }, [health.accepted]),
  );
  return peso;
}

export function useEntrenoIron(): UseEntrenoIron {
  const params = useLocalSearchParams<{ vista?: string }>();
  const pedida = VISTAS_ENTRENO.find((v) => v === params.vista);
  const [elegida, setElegida] = useState<VistaEntreno | null>(null);
  const gym = useGym();
  const cardio = useCardio();
  const mundo = useMundo('iron');
  const pesos = usePesos();
  const pesoKg = useUltimoPeso();
  const v = gym.vista;
  const c = cardio.vista;

  return {
    gym,
    cardio,
    mundo,
    vista: {
      // «Ver todo» de Pesos llega con ?vista=pesos; luego manda lo que se toque.
      vista: elegida ?? pedida ?? 'rutinas',
      onVista: (nueva) => {
        setElegida(nueva);
        if (params.vista) router.setParams({ vista: undefined });
      },
      rutinas: {
        cargado: v.cargado,
        errorCarga: v.errorCarga,
        hoyDia: v.hoyDia,
        dias: v.dias,
        ejercicios: v.ejercicios,
        prescrito: v.prescrito,
        xpHecho: v.sesionHoy ? v.sesionHoy.xp_awarded + v.xpMisionHoy : null,
        xpSesion: GYM_SESSION_XP,
        tecnicaDe: v.tecnicaDe,
        acciones: {
          onEmpezar: v.acciones.onEntrenar,
          onReintentar: v.acciones.onReintentar,
          onNuevoDia: v.acciones.onNuevoDia,
          onNuevoEjercicio: v.acciones.onNuevoEjercicio,
          onEditarEjercicio: v.acciones.onEditarEjercicio,
          onBorrarDia: v.acciones.onBorrarDia,
          onBorrarEjercicio: v.acciones.onBorrarEjercicio,
          onCatalogo: (dia) => router.push({ pathname: '/iron/catalogo', params: { dia: dia.id } }),
        },
      },
      pesos,
      cardio: {
        cargado: c.cargado,
        errorCarga: c.errorCarga,
        hoy: c.hoy,
        sesiones: c.sesiones,
        anuncio: c.anuncio,
        pesoKg,
        acciones: {
          onRegistrar: c.acciones.onRegistrar,
          onBorrar: c.acciones.onBorrar,
          onReintentar: c.acciones.onReintentar,
          onCerrarAnuncio: c.acciones.onCerrarAnuncio,
        },
      },
    },
  };
}
