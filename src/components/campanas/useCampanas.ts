// NIVL · Campañas: datos y efectos de la lista (L-RADICAL §C). Cortado de
// src/app/(tabs)/mazmorras.tsx sin reescribir: la carga (campañas, tareas y
// perfil a la vez), el cerrojo de «Abrir campaña» y la recarga al volver.
// Devuelve la vista (CampanasVista, pura) y el estado de la hoja de crear,
// que se queda en la ruta.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { avisar, useAlVolver } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { ensureProfile } from '@/lib/data';
import { createDungeon, fetchDungeons } from '@/lib/dungeons';
import { kindMeta } from '@/lib/kinds';
import { supabase } from '@/lib/supabase';
import type { DungeonRank, Stat } from '@/lib/types';
import { mensajeSistema } from '@/lib/validation';
import type { CampanaResumen, CampanasVistaProps } from './CampanasVista';

export interface HojaNuevaCampana {
  visible: boolean;
  onClose: () => void;
  title: string;
  setTitle: (t: string) => void;
  rank: DungeonRank;
  setRank: (r: DungeonRank) => void;
  stat: Stat;
  setStat: (s: Stat) => void;
  saving: boolean;
  onCreate: () => void;
}

export function useCampanas(): { vista: CampanasVistaProps; hojas: { nueva: HojaNuevaCampana } } {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [dungeons, setDungeons] = useState<CampanaResumen[]>([]);
  const [kind, setKind] = useState<unknown>('general');
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [rank, setRank] = useState<DungeonRank>('D');
  const [stat, setStat] = useState<Stat>('INT');
  const [saving, setSaving] = useState(false);
  // Cerrojo síncrono: `saving` llega un render tarde y dos toques seguidos en
  // «Abrir campaña» abrían dos campañas.
  const creando = useRef(false);
  // Hasta la primera carga se pintan huecos: nunca "Ninguna campaña abierta"
  // antes de saberlo (salía un instante al entrar).
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Las tres consultas no dependen entre sí: van a la vez.
      const [all, { data: tasks, error: tasksError }, p] = await Promise.all([
        fetchDungeons(),
        supabase.from('dungeon_tasks').select('dungeon_id, done'),
        userId ? ensureProfile(userId).catch(() => null) : Promise.resolve(null),
      ]);
      if (tasksError) throw tasksError;
      const rows = (tasks ?? []) as { dungeon_id: string; done: boolean }[];
      setDungeons(
        all.map((d) => ({
          ...d,
          total: rows.filter((t) => t.dungeon_id === d.id).length,
          doneCount: rows.filter((t) => t.dungeon_id === d.id && t.done).length,
        })),
      );
      if (p) setKind(p.profile_kind);
      setLoadError(null);
    } catch (e) {
      setLoadError(mensajeSistema(e));
    } finally {
      setLoaded(true);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useAlVolver(load);

  const onCreate = async () => {
    if (!userId || !title.trim() || creando.current) return;
    creando.current = true;
    setSaving(true);
    try {
      const d = await createDungeon(userId, { title: title.trim(), rank, stat });
      setFormOpen(false);
      setTitle('');
      router.push({ pathname: '/dungeon/[id]', params: { id: d.id } });
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      creando.current = false;
      setSaving(false);
    }
  };

  const meta = kindMeta(kind);

  return {
    vista: {
      cargado: loaded,
      error: loadError,
      titulo: meta.campaignsLabel,
      subtitulo: meta.campaignsHint,
      campanas: dungeons,
      onNueva: () => setFormOpen(true),
      onAbrir: (id: string) => router.push({ pathname: '/dungeon/[id]', params: { id } }),
      onReintentar: load,
    },
    hojas: {
      nueva: {
        visible: formOpen,
        onClose: () => setFormOpen(false),
        title,
        setTitle,
        rank,
        setRank,
        stat,
        setStat,
        saving,
        onCreate,
      },
    },
  };
}
