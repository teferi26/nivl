// Demo de la galería /kit/pantallas (solo desarrollo). Lo rellena el encargo
// de esta pantalla del rediseño L-RADICAL (docs/design-v2/L-RADICAL.md §C).
//
// Perfil sin sesión ni Supabase: PerfilVista con un perfil de mentira y la
// vitrina escrita a mano (ACHIEVEMENTS vive junto a supabase). Ajustes = null.
import { perfilDemo } from '@/components/arena/demoDatos';
import type { DemoPantalla } from '@/components/arena/galeria';
import { Screen } from '@/components/ui';
import { estadoDe, type RangoId } from '@/lib/progression';
import type { Profile } from '@/lib/types';
import { PerfilVista, type LogroVitrina, type PerfilAcciones, type PerfilDatos } from './PerfilVista';

const nada = () => {};
const ACCIONES: PerfilAcciones = {
  onNombre: nada,
  onGuardarNombre: nada,
  onAvatar: nada,
  onCompartir: nada,
  onCodigo: nada,
  onLogro: nada,
};

const ORDEN: RangoId[] = ['E', 'D', 'C', 'B', 'A', 'S'];

/** Los códigos `rango_X` que registra sync_rank hasta `rango` (E no se registra). */
function codigosHasta(rango: RangoId): string[] {
  return ORDEN.slice(1, ORDEN.indexOf(rango) + 1).map((r) => `rango_${r}`);
}

const VITRINA: Omit<LogroVitrina, 'unlocked' | 'equipado'>[] = [
  { code: 'first_quest', name: 'Primer paso' },
  { code: 'first_day', name: 'Primer día en la arena' },
  { code: 'quests_10', name: 'Gladiador novato' },
  { code: 'quests_50', name: 'Gladiador veterano', title: 'El Persistente' },
  { code: 'streak_7', name: 'Una semana imparable' },
  { code: 'streak_30', name: 'Mes de hierro', title: 'El Constante' },
  { code: 'level_10', name: 'Doble dígito', title: 'Forjado' },
  { code: 'level_25', name: 'Sangre de arena', title: 'Sangre de arena' },
  { code: 'streak_100', name: 'Voluntad de acero', title: 'Inquebrantable' },
  { code: 'level_50', name: 'Señor de la arena', title: 'Señor de la arena' },
  { code: 'first_dungeon', name: 'Primera campaña' },
  { code: 'journal_30', name: 'Cronista', title: 'El Cronista' },
];

function datosDemo(p: {
  perfil: Partial<Profile>;
  rango: RangoId;
  ganados: number;
  titulo: string;
  equipado?: string;
  elite?: boolean;
  frozen?: boolean;
  diasActivos: number;
  stats: { total: number; withEvidence: number };
  rachaFrase: string;
}): PerfilDatos {
  const profile = perfilDemo({ ...p.perfil, equipped_title: p.equipado ?? null });
  const logros = VITRINA.map((a, i) => ({
    ...a,
    unlocked: i < p.ganados,
    equipado: !!a.title && a.title === p.equipado,
  }));
  return {
    profile,
    estado: estadoDe(profile, codigosHasta(p.rango), p.diasActivos),
    titulo: p.titulo,
    elite: !!p.elite,
    frozen: !!p.frozen,
    tieneCoach: !!p.elite,
    codigoCreador: p.rango === 'E',
    esCreador: !!p.elite,
    logros,
    stats: p.stats,
    rachaFrase: p.rachaFrase,
  };
}

function Pantalla({ datos }: { datos: PerfilDatos | null }) {
  return (
    <Screen>
      <PerfilVista
        datos={datos}
        nombre={datos?.profile.name ?? ''}
        subiendoFoto={false}
        acciones={ACCIONES}
        ajustes={null}
      />
    </Screen>
  );
}

export const DEMO: DemoPantalla | null = {
  id: 'perfil',
  titulo: 'Perfil',
  estados: [
    {
      id: 'rango-E',
      titulo: 'Rango E (recién llegado, en pausa)',
      render: () => (
        <Pantalla
          datos={datosDemo({
            perfil: {
              name: 'Lucía',
              xp_total: 180,
              xp_fue: 40,
              xp_vit: 60,
              xp_int: 50,
              xp_agi: 20,
              xp_per: 10,
              streak_days: 1,
              protection_stones: 0,
              profile_kind: 'estudiante',
              freeze_reason: 'Exámenes',
              freeze_until: '2026-10-06',
            },
            rango: 'E',
            ganados: 1,
            titulo: 'Tiro',
            frozen: true,
            diasActivos: 1,
            stats: { total: 0, withEvidence: 0 },
            rachaFrase: 'Primer día en la arena. Mañana cuenta doble.',
          })}
        />
      ),
    },
    {
      id: 'rango-A',
      titulo: 'Rango A',
      render: () => (
        <Pantalla
          datos={datosDemo({
            perfil: { xp_total: 100000, xp_fue: 25800, xp_vit: 19200, xp_int: 23300, xp_agi: 13500, xp_per: 18200 },
            rango: 'A',
            ganados: 7,
            titulo: 'El Constante',
            equipado: 'El Constante',
            diasActivos: 312,
            stats: { total: 418, withEvidence: 151 },
            rachaFrase: '12 días seguidos. La arena ya sabe tu nombre.',
          })}
        />
      ),
    },
    {
      id: 'rango-S-elite',
      titulo: 'Rango S con Élite',
      render: () => (
        <Pantalla
          datos={datosDemo({
            perfil: {
              name: 'Maximiliano',
              xp_total: 245000,
              xp_fue: 66000,
              xp_vit: 48000,
              xp_int: 59000,
              xp_agi: 36000,
              xp_per: 36000,
              streak_days: 214,
              protection_stones: 3,
              profile_kind: 'deportista',
            },
            rango: 'S',
            ganados: 12,
            titulo: 'Leyenda',
            elite: true,
            diasActivos: 640,
            stats: { total: 1873, withEvidence: 1204 },
            rachaFrase: '214 días. Ya no compites con nadie más que contigo.',
          })}
        />
      ),
    },
    {
      id: 'cargando',
      titulo: 'Cargando',
      render: () => <Pantalla datos={null} />,
    },
  ],
};
