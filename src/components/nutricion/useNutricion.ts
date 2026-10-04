// NIVL · Nutrición: datos, efectos y cerrojos (L-RADICAL §C, FASE3 Oleada 2,
// lote E2). Cortado y pegado de la ruta sin reescribir la lógica: el bloque
// del XP (bloque B: el día en la zona del perfil, el recibo buscado por la
// fecha del evento, se anuncia lo PAGADO y solo vibra si entró algo) es el
// mismo de antes, línea a línea. Devuelve las props de NutricionVista (pura).
//
// Únicos añadidos, fuera del cobro:
//   · Un fallo de carga se guarda en `errorCarga` (antes era un aviso) y la
//     vista enseña ErrorSistema en lugar del parte: así nadie registra encima
//     de un día que no se ha podido leer (guardar pisaba con null la
//     estimación del coach, `kcal_est`/`protein_est`).
//   · Marcar calorías o proteína vibra `seleccion` y un fallo al registrar,
//     `penalizacion` (tabla de vibraciones de FASE3).

import { vibrar } from '@/design/haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { avisar, volver } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  fetchNutritionLog,
  fetchNutritionLogs,
  fetchNutritionTarget,
  saveNutritionLog,
  type NutritionLog,
  type NutritionTarget,
} from '@/lib/bodywork';
import { ensureProfile } from '@/lib/data';
import { addDays, dateKey, dateKeyEnZona } from '@/lib/dates';
import { awardXp } from '@/lib/engine';
import { propagarActo } from '@/lib/links';
import { mensajeSistema } from '@/lib/validation';
import { anuncioActo, xpPagado } from '@/lib/pagoActo';
import { NUTRITION_DAY_XP } from '@/lib/game';
import { supabase } from '@/lib/supabase';
import type { NutricionVistaProps } from './NutricionVista';

export function useNutricion(): NutricionVistaProps {
  const { session } = useAuth();
  const userId = session?.user.id;
  // «Hoy» es el día en la zona del perfil, la misma con la que el coach
  // registra el parte y cobra el recibo: con la del dispositivo, un viaje o
  // una zona distinta partían el mismo día en dos.
  const [hoy, setHoy] = useState(() => dateKeyEnZona(null));

  const [objetivo, setObjetivo] = useState<NutritionTarget | null>(null);
  const [hoyLog, setHoyLog] = useState<NutritionLog | null>(null);
  const [historial, setHistorial] = useState<NutritionLog[]>([]);
  const [kcal, setKcal] = useState(false);
  const [prote, setProte] = useState(false);
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const perfil = userId ? await ensureProfile(userId).catch(() => null) : null;
      const dia = dateKeyEnZona(perfil?.timezone);
      setHoy(dia);
      const [obj, log, hist] = await Promise.all([
        fetchNutritionTarget(),
        fetchNutritionLog(dia),
        fetchNutritionLogs(addDays(dia, -28)),
      ]);
      setObjetivo(obj);
      setHoyLog(log);
      setHistorial(hist);
      if (log) {
        setKcal(log.hit_kcal);
        setProte(log.hit_protein);
        setNotas(log.notes ?? '');
      }
      setErrorCarga(null);
    } catch (e) {
      setErrorCarga(mensajeSistema(e));
    } finally {
      setLoaded(true);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const guardar = async () => {
    if (!userId || guardando) return;
    setGuardando(true);
    try {
      // El XP solo se paga la primera vez que se cierra el día cumpliendo
      // ambas cosas: corregir el parte después no vuelve a premiar.
      //
      // El recibo es el evento del día, no el parte guardado: mirando el parte,
      // desmarcar-guardar-marcar-guardar pagaba 10 XP en cada vuelta, sin fin.
      // Se busca por la fecha del payload (la del perfil), igual que el coach
      // (_shared/tools.ts): así la pantalla y el chat no cobran el mismo día
      // dos veces por mirar medianoches de zonas distintas.
      const { count: recibos } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'nutrition_day')
        .eq('payload->>date', hoy);
      const merece = kcal && prote && !recibos;

      await saveNutritionLog(userId, {
        date: hoy,
        hit_kcal: kcal,
        hit_protein: prote,
        // Si el coach estimó el día desde el chat, guardar aquí no lo borra.
        kcal_est: hoyLog?.kcal_est ?? null,
        protein_est: hoyLog?.protein_est ?? null,
        notes: notas.trim() || null,
      });

      let pagadoDia = 0;
      if (merece) {
        const perfil = await ensureProfile(userId);
        const res = await awardXp(perfil, NUTRITION_DAY_XP, 'VIT', 'nutrition_day', { kcal, prote, date: hoy });
        pagadoDia = xpPagado(NUTRITION_DAY_XP, perfil.xp_total, res.profile.xp_total);
      }

      // Un solo gesto: el parte marca solo la misión de registrar comidas. Los
      // 10 XP de arriba son por CUMPLIR los dos objetivos, no por registrar,
      // así que aquí no hay doble pago que evitar.
      // Las misiones viven en el día del dispositivo (Hoy, completeQuest): la
      // propagación va con ese día, no con el del parte.
      const eco = await propagarActo(await ensureProfile(userId), 'nutricion', dateKey());
      // Vibra solo lo que entró de verdad: el día cumplido y la misión enlazada.
      if (eco.xp + pagadoDia > 0) vibrar('mision');

      await cargar();
      // Las dos partes pueden pagar a la vez: callar la misión infravaloraba el
      // aviso. Y se dice lo PAGADO, no lo calculado (el servidor recorta).
      const desglose = anuncioActo({
        xpMision: eco.xp,
        marcadas: eco.marcadas,
        xpModulo: pagadoDia,
        deModulo: 'a VIT por cumplir kcal y proteína',
      });
      avisar('Parte registrado', desglose ? `El sistema toma nota. ${desglose}` : 'El sistema toma nota.');
    } catch (e) {
      vibrar('penalizacion');
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      setGuardando(false);
    }
  };

  return {
    cargado: loaded,
    errorCarga,
    objetivo,
    hoyLog,
    historial,
    kcal,
    prote,
    notas,
    guardando,
    xpDia: NUTRITION_DAY_XP,
    acciones: {
      onVolver: () => volver(router),
      onKcal: () => {
        vibrar('seleccion');
        setKcal((v) => !v);
      },
      onProte: () => {
        vibrar('seleccion');
        setProte((v) => !v);
      },
      onNotas: setNotas,
      onGuardar: guardar,
      onCoach: () => router.push('/(tabs)/coach'),
      onReintentar: () => {
        cargar();
      },
    },
  };
}
