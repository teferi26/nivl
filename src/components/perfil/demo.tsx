// Demo de la galería /kit/pantallas (solo desarrollo). Lo rellena el encargo
// de esta pantalla del rediseño L-RADICAL (docs/design-v2/L-RADICAL.md §C).
//
// Perfil sin sesión ni Supabase: PerfilVista con un perfil de mentira y la
// vitrina escrita a mano (ACHIEVEMENTS vive junto a supabase). Los estados de
// rango van sin ajustes; los de «ajustes» y las hojas (FASE3 Lote B2) los
// pintan con PerfilAjustes sin la sección de salud (consulta a Supabase).
import type { ReactNode } from 'react';
import { HOY_DEMO, perfilDemo, YO_DEMO } from '@/components/arena/demoDatos';
import type { DemoPantalla } from '@/components/arena/galeria';
import { Screen } from '@/components/ui';
import type { EstadoAvisos } from '@/lib/notifications';
import { estadoDe, type RangoId } from '@/lib/progression';
import type { Profile } from '@/lib/types';
import { HojaBorrar, HojaCodigo, HojaPausa } from './HojasPerfil';
import { PerfilAjustes, type PerfilAjustesProps } from './PerfilAjustes';
import { PerfilVista, type LogroVitrina, type PerfilAcciones, type PerfilDatos } from './PerfilVista';

const nada = () => {};
const ACCIONES: PerfilAcciones = {
  onNombre: nada,
  onGuardarNombre: nada,
  onAvatar: nada,
  onCompartir: nada,
  onCodigo: nada,
  onLogro: nada,
  onReintentar: nada,
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
  rachaCerrada?: boolean;
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
    racha: profile.streak_days + (p.rachaCerrada ? 1 : 0),
    rachaCerrada: !!p.rachaCerrada,
  };
}

function Pantalla({
  datos,
  error = null,
  ajustes = null,
  hoja = null,
}: {
  datos: PerfilDatos | null;
  error?: string | null;
  ajustes?: ReactNode;
  hoja?: ReactNode;
}) {
  return (
    <Screen>
      <PerfilVista
        datos={datos}
        error={error}
        desde={null}
        nombre={datos?.profile.name ?? ''}
        subiendoFoto={false}
        acciones={ACCIONES}
        ajustes={ajustes}
      />
      {hoja}
    </Screen>
  );
}

/** El perfil de «Yo» (rango A) para los estados de ajustes y hojas. */
const datosYo = () =>
  datosDemo({
    perfil: {},
    rango: YO_DEMO.rango,
    ganados: 7,
    titulo: YO_DEMO.titulo,
    diasActivos: 312,
    stats: { total: 418, withEvidence: 151 },
    rachaFrase: '12 días seguidos. La arena ya sabe tu nombre.',
  });

const AVISOS_ACTIVOS: EstadoAvisos = { permitido: true, puedePreguntar: false, programados: 6, error: null };
const AVISOS_SIN_PERMISO: EstadoAvisos = { permitido: false, puedePreguntar: true, programados: 0, error: null };

function ajustesDemo(datos: PerfilDatos, p: Partial<PerfilAjustesProps> = {}): ReactNode {
  return (
    <PerfilAjustes
      profile={datos.profile}
      busy={false}
      frozen={false}
      onPerfilDeUso={nada}
      onPausar={nada}
      onReanudar={nada}
      vibraciones
      onVibraciones={nada}
      avisos={AVISOS_ACTIVOS}
      onActivarAvisos={nada}
      premium={false}
      subscription={null}
      onCheckout={nada}
      consent={null}
      onConsentimiento={nada}
      onExportar={nada}
      onCerrarSesion={nada}
      onBorrar={nada}
      sinSalud
      {...p}
    />
  );
}

/** Perfil de «Yo» con una hoja abierta encima. */
function ConHoja({ hoja }: { hoja: ReactNode }) {
  const datos = datosYo();
  return <Pantalla datos={datos} hoja={hoja} />;
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
            // «Yo» tal cual (YO_DEMO): nivel 23, racha 12 y 2 piedras, como en Hoy y Amigos.
            perfil: {},
            rango: YO_DEMO.rango,
            ganados: 7,
            // Sin título equipado: lleva el del rango, el mismo que enseña Hoy.
            titulo: YO_DEMO.titulo,
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
      id: 'ajustes',
      titulo: 'Ajustes',
      render: () => {
        const datos = datosYo();
        return <Pantalla datos={datos} ajustes={ajustesDemo(datos)} />;
      },
    },
    {
      id: 'ajustes-sin-avisos',
      titulo: 'Ajustes sin permiso de avisos',
      render: () => {
        const datos = datosYo();
        return <Pantalla datos={datos} ajustes={ajustesDemo(datos, { avisos: AVISOS_SIN_PERMISO })} />;
      },
    },
    {
      id: 'hoja-borrar',
      titulo: 'Hoja: borrar la cuenta',
      render: () => (
        <ConHoja
          hoja={<HojaBorrar abierta cerrar={nada} aviso={null} esCreador={false} borrando={false} confirmar={nada} />}
        />
      ),
    },
    {
      id: 'hoja-borrar-lista',
      titulo: 'Hoja: borrar, creador y ELIMINAR escrito',
      render: () => (
        <ConHoja
          hoja={
            <HojaBorrar
              abierta
              cerrar={nada}
              aviso={null}
              esCreador
              borrando={false}
              confirmar={nada}
              escritoInicial="ELIMINAR"
            />
          }
        />
      ),
    },
    {
      id: 'hoja-pausa',
      titulo: 'Hoja: pausar el sistema',
      render: () => (
        <ConHoja
          hoja={
            <HojaPausa
              abierta
              cerrar={nada}
              motivo="Exámenes"
              setMotivo={nada}
              dias={7}
              setDias={nada}
              activar={nada}
              today={HOY_DEMO}
              motivos={['Exámenes', 'Enfermedad', 'Vacaciones']}
              duraciones={[1, 3, 7, 14]}
            />
          }
        />
      ),
    },
    {
      id: 'hoja-codigo',
      titulo: 'Hoja: código de creador con error',
      render: () => (
        <ConHoja
          hoja={
            <HojaCodigo
              abierta
              cerrar={nada}
              valor="LUCIAFIT"
              cambiar={nada}
              aviso="Ese código no existe. Revisa que esté bien escrito."
              ocupado={false}
              enviar={nada}
              autoFocus={false}
            />
          }
        />
      ),
    },
    {
      id: 'cargando',
      titulo: 'Cargando',
      render: () => <Pantalla datos={null} />,
    },
    {
      id: 'error',
      titulo: 'Error de carga',
      render: () => <Pantalla datos={null} error="Sin conexión. Revisa la red y vuelve a intentarlo." />,
    },
  ],
};
