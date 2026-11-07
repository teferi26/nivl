// NIVL · Campañas: datos y efectos de la lista (L-RADICAL §C). Cortado de
// src/app/(tabs)/mazmorras.tsx sin reescribir: la carga (campañas, tareas y
// perfil a la vez), el cerrojo de «Abrir campaña» y la recarga al volver.
// Devuelve la vista (CampanasVista, pura) y el estado de la hoja de crear,
// que se queda en la ruta.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { avisar, useAlVolver } from '@/components/ui';
import { t } from '@/i18n';
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

/**
 * `enPanel`: Campañas va en dos paneles (iPad, Mac, iPhone Duo abierto). Abrir
 * o crear una campaña la elige para el panel derecho en vez de navegar.
 */
export function useCampanas({ enPanel = false }: { enPanel?: boolean } = {}): {
  vista: CampanasVistaProps;
  hojas: { nueva: HojaNuevaCampana };
  elegida: string | null;
  elegir: (id: string | null) => void;
  recargar: () => void;
} {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [dungeons, setDungeons] = useState<CampanaResumen[]>([]);
  // null = aún no se sabe: el título va en hueco y no salta de CAMPAÑAS a
  // PROYECTOS al llegar el perfil.
  const [kind, setKind] = useState<unknown>(null);
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
  // La campaña abierta en el panel derecho (solo con dos paneles).
  const [elegida, setElegida] = useState<string | null>(null);
  const abrir = (id: string) => (enPanel ? setElegida(id) : router.push({ pathname: '/dungeon/[id]', params: { id } }));
  // Al plegar (iPhone Duo) o estrechar la ventana con una campaña abierta al
  // lado, no se pierde: se abre en su pantalla, como en el iPhone.
  const elegidaAntes = useRef<string | null>(null);
  useEffect(() => {
    if (enPanel) {
      elegidaAntes.current = elegida;
      return;
    }
    const abierta = elegidaAntes.current;
    elegidaAntes.current = null;
    if (abierta) router.push({ pathname: '/dungeon/[id]', params: { id: abierta } });
  }, [enPanel, elegida]);

  const load = useCallback(async () => {
    try {
      // Las tres consultas no dependen entre sí: van a la vez.
      const [all, { data: tasks, error: tasksError }, p] = await Promise.all([
        fetchDungeons(),
        supabase.from('dungeon_tasks').select('dungeon_id, done'), // i18n-ok: columnas, no es texto
        userId ? ensureProfile(userId).catch(() => null) : Promise.resolve(null),
      ]);
      if (tasksError) throw tasksError;
      const rows = (tasks ?? []) as { dungeon_id: string; done: boolean }[];
      setDungeons(
        all.map((d) => ({
          ...d,
          total: rows.filter((x) => x.dungeon_id === d.id).length,
          doneCount: rows.filter((x) => x.dungeon_id === d.id && x.done).length,
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
      if (enPanel) load();
      abrir(d.id);
    } catch (e) {
      avisar(t('comun:sistemaNoResponde'), mensajeSistema(e));
    } finally {
      creando.current = false;
      setSaving(false);
    }
  };

  const meta = kindMeta(kind);
  // Tras la primera carga, sin perfil (sin red), vale el de «general».
  const conocido = kind != null || loaded;

  return {
    vista: {
      cargado: loaded,
      error: loadError,
      titulo: conocido ? meta.campaignsLabel : null,
      subtitulo: meta.campaignsHint,
      campanas: dungeons,
      onNueva: () => setFormOpen(true),
      onAbrir: abrir,
      elegida: enPanel ? elegida : null,
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
    elegida: enPanel ? elegida : null,
    elegir: setElegida,
    recargar: load,
  };
}
