// NIVL · Mundo IRON: el catálogo (efectos). La búsqueda y los grupos son los
// del catálogo de IRON (iron/catalogo, puro). Con `dia` (el id de un día de la
// rutina) «+ Añadir a {día}» crea el ejercicio al final de ese día con
// `createGymExercise` (lib/body, el mismo de la hoja de Gimnasio: 3 × 10, sin
// carga, que luego se edita). No paga XP.

import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { volver } from '@/components/ui/Screen';
import { useAuth } from '@/lib/auth';
import { createGymExercise, fetchGymDays, fetchGymExercises } from '@/lib/body';
import { buscarIron, entradasIron } from '@/iron/catalogo';
import { ejercicioPorId } from '@/iron/ejercicios';
import type { GrupoMuscular } from '@/iron/tipos';
import { mensajeSistema } from '@/lib/validation';
import type { CatalogoIronVistaProps } from './CatalogoIronVista';

/** Los grupos del catálogo, en el orden de la lámina; el resto detrás. */
const ORDEN: readonly GrupoMuscular[] = ['pierna', 'pecho', 'espalda', 'hombro', 'brazo', 'core', 'cardio', 'movilidad'];
/** Filas de «Más de…» y de la búsqueda. */
const TOPE = 40;

export function useCatalogoIron(diaId: string | null): CatalogoIronVistaProps {
  const { session } = useAuth();
  const userId = session?.user.id;
  const todas = entradasIron();
  const grupos = useMemo(() => {
    const hay = new Set(todas.map((e) => e.grupo));
    return ORDEN.filter((g) => hay.has(g));
  }, [todas]);
  const [grupo, setGrupo] = useState<GrupoMuscular>(grupos[0] ?? 'pierna');
  const [consulta, setConsulta] = useState('');
  const [elegidoId, setElegidoId] = useState<string | null>(null);
  const [diaNombre, setDiaNombre] = useState<string | null>(null);
  const [anadiendo, setAnadiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cerrojo = useRef(false);

  useEffect(() => {
    if (!diaId) return;
    let vivo = true;
    fetchGymDays()
      .then((dias) => {
        if (vivo) setDiaNombre(dias.find((d) => d.id === diaId)?.name ?? null);
      })
      // Sin el día, el catálogo solo se mira (sin «Añadir»).
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [diaId]);

  const delGrupo = todas.filter((e) => e.grupo === grupo);
  const elegido = (elegidoId ? ejercicioPorId(elegidoId) : undefined) ?? delGrupo[0]?.ejercicio ?? todas[0]!.ejercicio;
  const buscando = consulta.trim().length > 0;
  const lista = (buscando ? buscarIron(consulta) : delGrupo).filter((e) => e.id !== elegido.id).slice(0, TOPE);

  const anadir = async () => {
    if (!userId || !diaId || cerrojo.current) return;
    cerrojo.current = true;
    setAnadiendo(true);
    setError(null);
    try {
      const ejercicios = await fetchGymExercises();
      const delDia = ejercicios.filter((e) => e.gym_day_id === diaId);
      const position = delDia.reduce((m, e) => Math.max(m, e.position + 1), 0);
      const nombre = todas.find((e) => e.id === elegido.id)?.nombre ?? elegido.id;
      await createGymExercise(userId, diaId, { name: nombre, sets: 3, reps: 10, weight: null, position });
      volver(router);
    } catch (e) {
      setError(mensajeSistema(e));
    } finally {
      cerrojo.current = false;
      setAnadiendo(false);
    }
  };

  return {
    diaNombre: diaId ? diaNombre : null,
    consulta,
    onConsulta: setConsulta,
    grupos,
    grupo,
    onGrupo: (g) => {
      setGrupo(g);
      setConsulta('');
      setElegidoId(null);
    },
    elegido,
    lista,
    onElegir: setElegidoId,
    onAnadir: diaId ? anadir : undefined,
    anadiendo,
    error,
    onTecnica: () => router.push({ pathname: '/iron/[id]', params: { id: elegido.id } }),
    onVolver: () => volver(router),
  };
}
