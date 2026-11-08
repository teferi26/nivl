// Demo de la Agenda de WORK: estados con datos de mentira, sin sesión ni
// Supabase. Las acciones no hacen nada.
import type { ReactElement } from 'react';
import type { AgendaVistaProps } from '@/components/agenda/AgendaVista';
import type { CalendarEvent } from '@/lib/types';
import type { EstadoCalendario } from '@/work/calendario';
import { duracionesDe, type TipoRapido } from '@/work/agendaRapida';
import { HojaCalendario, HojaRapida, type HojaCalendarioProps, type HojaRapidaProps } from './HojasWorkAgenda';
import { WorkAgendaVista, type WorkAgendaVistaProps } from './WorkAgendaVista';

const nada = () => {};
const HOY = '2026-10-21';
const MANANA = '2026-10-22';

const evento = (id: string, title: string, time: string | null): CalendarEvent => ({
  id,
  user_id: 'demo-usuario',
  title,
  date: HOY,
  time,
  notes: null,
  created_at: '2026-10-01T09:00:00Z',
});

const AGENDA: AgendaVistaProps = {
  estado: 'listo',
  error: null,
  hoy: HOY,
  dia: HOY,
  modo: 'dia',
  quests: [],
  events: [evento('e1', 'Seguimiento con cliente', '10:00'), evento('e2', 'Revisión del equipo', '16:30')],
  dueTasks: [],
  hechas: new Set(),
  plan: null,
  esPro: false,
  ahoraMin: 11 * 60 + 20,
  acciones: { onModo: nada, onDia: nada, onElegirDia: nada, onNuevo: nada, onDetalle: nada, onReintentar: nada },
};

function vista(estadoCalendario: EstadoCalendario, agenda: Partial<AgendaVistaProps> = {}): WorkAgendaVistaProps {
  return {
    agenda: { ...AGENDA, ...agenda },
    barra: { estadoCalendario, onReunion: nada, onBloque: nada, onCalendario: nada },
  };
}

function rapida(tipo: TipoRapido, cambios: Partial<HojaRapidaProps> = {}): HojaRapidaProps {
  return {
    visible: true,
    tipo,
    hoy: HOY,
    manana: MANANA,
    dia: HOY,
    titulo: '',
    hora: '11:30',
    duracion: tipo === 'reunion' ? 30 : 50,
    duraciones: duracionesDe(tipo),
    guardando: false,
    errorHora: null,
    errorGuardar: null,
    onTitulo: nada,
    onDia: nada,
    onHora: nada,
    onDuracion: nada,
    onGuardar: nada,
    onCerrar: nada,
    ...cambios,
  };
}

function calendario(estado: EstadoCalendario, cambios: Partial<HojaCalendarioProps> = {}): HojaCalendarioProps {
  return {
    visible: true,
    estado,
    puedeDesconectar: estado === 'conectado',
    ocupado: false,
    error: null,
    onConectar: nada,
    onActualizar: nada,
    onDesconectar: nada,
    onAjustes: nada,
    onCerrar: nada,
    ...cambios,
  };
}

export interface EstadoAgendaWorkDemo {
  id: string;
  titulo: string;
  /** La barra de la galería marcaría otra pestaña. */
  sinBarra: true;
  render: () => ReactElement;
}

const ESTADOS: Omit<EstadoAgendaWorkDemo, 'sinBarra'>[] = [
  { id: 'agenda-ofrecer', titulo: 'Agenda · calendario sin conectar', render: () => <WorkAgendaVista {...vista('ofrecer')} /> },
  { id: 'agenda-conectado', titulo: 'Agenda · calendario conectado', render: () => <WorkAgendaVista {...vista('conectado')} /> },
  { id: 'agenda-denegado', titulo: 'Agenda · permiso denegado', render: () => <WorkAgendaVista {...vista('denegado')} /> },
  { id: 'agenda-sin-modulo', titulo: 'Agenda · binario sin el módulo', render: () => <WorkAgendaVista {...vista('oculto')} /> },
  { id: 'agenda-cargando', titulo: 'Agenda · cargando', render: () => <WorkAgendaVista {...vista('oculto', { estado: 'cargando' })} /> },
  {
    id: 'agenda-hoja-reunion',
    titulo: 'Hoja · reunión en dos toques',
    render: () => (
      <>
        <WorkAgendaVista {...vista('oculto')} />
        <HojaRapida {...rapida('reunion')} />
      </>
    ),
  },
  {
    id: 'agenda-hoja-bloque',
    titulo: 'Hoja · bloque en dos toques',
    render: () => (
      <>
        <WorkAgendaVista {...vista('oculto')} />
        <HojaRapida {...rapida('bloque')} />
      </>
    ),
  },
  {
    id: 'agenda-hoja-optin',
    titulo: 'Hoja · permiso del calendario',
    render: () => (
      <>
        <WorkAgendaVista {...vista('ofrecer')} />
        <HojaCalendario {...calendario('ofrecer')} />
      </>
    ),
  },
  {
    id: 'agenda-hoja-conectado',
    titulo: 'Hoja · calendario conectado',
    render: () => (
      <>
        <WorkAgendaVista {...vista('conectado')} />
        <HojaCalendario {...calendario('conectado')} />
      </>
    ),
  },
];

export const ESTADOS_AGENDA_WORK: EstadoAgendaWorkDemo[] = ESTADOS.map((e) => ({ ...e, sinBarra: true }));
