// NIVL · Modo GENERAL · Avance: los datos (efectos). Solo lee lo que ya existe
// y lo pasa por derivarAvance (puro):
//   · el perfil (XP, racha, piedras, XP por atributo) con ensureProfile;
//   · las misiones y los cumplimientos de 8 semanas;
//   · los logros y el rango registrado (fetchUnlocked);
//   · los días activos reales y el rango merecido (sync_rank, como Hoy y Perfil:
//     si el servidor registra un rango nuevo aquí, se celebra por la cola);
//   · las campañas (el botín de las despejadas).
// Ninguna escritura de economía: la XP solo se mueve por RPC en otras pantallas.

import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useCelebracion } from '@/components/celebracion/contexto';
import { derivarInforme } from '@/components/informe/derivarInforme';
import { ACHIEVEMENT_BY_CODE, ACHIEVEMENTS_VISIBLES, fetchUnlocked, sincronizarRangoDetalle } from '@/lib/achievements';
import { useAuth } from '@/lib/auth';
import { ensureProfile, fetchCompletionsSince, fetchQuests } from '@/lib/data';
import { addDays, dateKey } from '@/lib/dates';
import { fetchDungeons } from '@/lib/dungeons';
import { DUNGEON_CLEAR_XP } from '@/lib/game';
import { estadoDe, type EstadoProgreso, type LogroInfo } from '@/lib/progression';
import type { Dungeon, Profile } from '@/lib/types';
import { mensajeSistema } from '@/lib/validation';
import { DIAS_CARGA, derivarAvance, type DatosAvance } from './derivarAvance';

export interface LogroAvance {
  code: string;
  nombre: string;
  desc: string;
  titulo?: string;
  ganado: boolean;
}

export interface BotinCampana {
  id: string;
  titulo: string;
  rango: Dungeon['rank'];
  xp: number;
  fecha: string | null;
}

export interface DatosProgresion {
  estado: EstadoProgreso;
  diasActivos: number | null;
  logros: LogroAvance[];
  botin: BotinCampana[];
  botinTotal: number;
  abiertas: number;
}

export interface UseAvanceGeneral {
  cargado: boolean;
  error: string | null;
  refrescando: boolean;
  avance: DatosAvance | null;
  informe: string | null;
  progresion: DatosProgresion | null;
  onRefrescar: () => void;
  onReintentar: () => void;
}

const logroInfo = (codigo: string): LogroInfo => {
  const def = ACHIEVEMENT_BY_CODE[codigo];
  return def ? { codigo: def.code, nombre: def.name, desc: def.desc, titulo: def.title } : { codigo, nombre: codigo, desc: '' };
};

export function useAvanceGeneral(): UseAvanceGeneral {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { celebrar } = useCelebracion();
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [avance, setAvance] = useState<DatosAvance | null>(null);
  const [informe, setInforme] = useState<string | null>(null);
  const [progresion, setProgresion] = useState<DatosProgresion | null>(null);
  const enVuelo = useRef(false);

  const load = useCallback(async () => {
    if (!userId || enVuelo.current) return;
    enVuelo.current = true;
    const today = dateKey();
    try {
      const [profile, quests, completions, logros, dungeons] = await Promise.all([
        ensureProfile(userId) as Promise<Profile>,
        fetchQuests(),
        fetchCompletionsSince(addDays(today, -(DIAS_CARGA - 1))),
        fetchUnlocked(),
        fetchDungeons().catch(() => [] as Dungeon[]),
      ]);
      const { nuevos, diasActivos } = await sincronizarRangoDetalle().catch(() => ({ nuevos: [] as string[], diasActivos: null }));
      if (nuevos.length > 0) {
        for (const c of nuevos) logros.add(c);
        celebrar({ accion: `avance:rango:${Date.now()}`, logrosNuevos: nuevos.map(logroInfo), diasActivos, final: true });
      }
      setAvance(
        derivarAvance({
          completions,
          quests,
          today,
          rachaActual: profile.streak_days,
          xpStats: { FUE: profile.xp_fue, VIT: profile.xp_vit, INT: profile.xp_int, AGI: profile.xp_agi, PER: profile.xp_per },
        }),
      );
      setInforme(derivarInforme(completions, quests, today).narrative);
      const despejadas = dungeons
        .filter((d) => d.status === 'cleared')
        .sort((a, b) => (b.cleared_at ?? '').localeCompare(a.cleared_at ?? ''));
      const botin = despejadas.map((d) => ({ id: d.id, titulo: d.title, rango: d.rank, xp: DUNGEON_CLEAR_XP[d.rank], fecha: d.cleared_at }));
      setProgresion({
        estado: estadoDe(profile, logros, diasActivos ?? undefined),
        diasActivos,
        logros: ACHIEVEMENTS_VISIBLES().map((a) => ({ code: a.code, nombre: a.name, desc: a.desc, titulo: a.title, ganado: logros.has(a.code) })),
        botin,
        botinTotal: botin.reduce((s, b) => s + b.xp, 0),
        abiertas: dungeons.filter((d) => d.status === 'active').length,
      });
      setError(null);
    } catch (e) {
      setError(mensajeSistema(e));
    } finally {
      enVuelo.current = false;
      setCargado(true);
      setRefrescando(false);
    }
  }, [userId, celebrar]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return {
    cargado,
    error,
    refrescando,
    avance,
    informe,
    progresion,
    onRefrescar: () => {
      setRefrescando(true);
      void load();
    },
    onReintentar: () => void load(),
  };
}
