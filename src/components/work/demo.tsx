// NIVL · WORK: galería de Hoy y del bloque con datos de mentira (/kit/work,
// SOLO DESARROLLO). Sin sesión ni Supabase: pasa por los mismos constructores
// puros que la app (vistaWorkHoy, vistaBloque). Hoy es el 21 de octubre de
// 2026, las 10:20.

import type { ReactElement } from 'react';
import { CabeceraMundo } from '@/components/modos/mundo/CabeceraMundo';
import { OrdenDelDia } from '@/components/OrdenDelDia';
import type { DayBlock } from '@/lib/plan';
import { nivelesDeModos } from '@/modos/niveles';
import { avanzar, nuevoBloque, terminar, type EstadoBloque } from '@/work/bloque';
import type { ResultadoBloque } from '@/work/cierreBloque';
import { DATOS_VACIOS, type DatosWork, type Entrega, type EventoTrabajo, type SesionTrabajo } from '@/work/tipos';
import { vistaBloque, vistaWorkHoy, type EntradaVistaWork, type MisionEntrada } from '@/work/vistaHoy';
import { BloqueVista } from './BloqueVista';
import { LineaEconomia } from './LineaEconomia';
import { WorkHoyVista, type WorkHoyVistaProps } from './WorkHoyVista';

const nada = () => {};
const HOY = '2026-10-21';
const AHORA_MIN = 10 * 60 + 20;
const AHORA_MS = Date.UTC(2026, 9, 21, 8, 20);

const mision = (id: string, titulo: string, rango: number, extra: Partial<MisionEntrada> = {}): MisionEntrada => ({
  id,
  titulo,
  hecha: false,
  penalizacion: false,
  xp: 50,
  diaPrioridad: HOY,
  rango,
  creadaEn: `${HOY}T08:0${rango}:00`,
  ...extra,
});

const MISIONES: MisionEntrada[] = [
  mision('m1', 'Cerrar la propuesta de la reforma', 1, { hecha: true }),
  mision('m2', 'Revisar el contrato con el proveedor', 2),
  mision('m3', 'Preparar la demo del jueves', 3),
];

const EVENTOS: EventoTrabajo[] = [
  { id: 'e1', titulo: 'Seguimiento semanal', fecha: HOY, inicio: 12 * 60, fin: 12 * 60 + 45, origen: 'dispositivo' },
  { id: 'e2', titulo: 'Llamada con el cliente', fecha: HOY, inicio: 16 * 60, fin: 16 * 60 + 30, origen: 'manual' },
];

const ENTREGAS: Entrega[] = [{ id: 'd1', proyectoId: 'p1', titulo: 'Presupuesto final', fecha: '2026-10-23', hecha: false, hechaEl: null, posicion: 0 }];

const sesion = (id: string, fecha: string, minutos: number, inicioMin: number): SesionTrabajo => ({
  id,
  clientId: id,
  proyectoId: 'p1',
  entregaId: null,
  questId: null,
  tipo: 'bloque',
  fecha,
  inicioMin,
  minutos,
  facturable: true,
  facturadaEl: null,
  nota: null,
});

const DATOS: DatosWork = {
  ...DATOS_VACIOS,
  proyectos: [{ id: 'p1', nombre: 'Reforma', cliente: null, tarifaHora: 45, estado: 'activo', posicion: 0 }],
  entregas: ENTREGAS,
  sesiones: [sesion('s1', '2026-10-20', 50, 9 * 60), sesion('s2', '2026-10-19', 90, 15 * 60)],
  eventos: EVENTOS,
};

const bloquePlan = (id: string, start_min: number, end_min: number, title: string, done = false): DayBlock => ({
  id,
  plan_id: 'demo',
  start_min,
  end_min,
  title,
  kind: 'deep_work',
  detail: null,
  quest_id: null,
  notify: false,
  done,
  position: start_min,
});
const ORDEN = [bloquePlan('b1', 9 * 60, 10 * 60, 'Propuesta', true), bloquePlan('b2', 15 * 60, 16 * 60, 'Demo del jueves')];

const cabecera = () => <CabeceraMundo modo="work" nivel={nivelesDeModos(['work'], { iron: 0, focus: 0, work: 1250, founder: 0 })[0] ?? null} conNivel={false} />;

const acciones: WorkHoyVistaProps['acciones'] = {
  onCoach: nada,
  onEmpezarAhora: nada,
  onSeguirBloque: nada,
  onMinutos: nada,
  onEmpezarFila: nada,
  onCompletar: nada,
  onSoltar: nada,
  onPlanificar: async () => false,
  onIr: nada,
  onReintentar: nada,
};

function entrada(cambios: Partial<EntradaVistaWork>): EntradaVistaWork {
  return {
    fecha: HOY,
    ahoraMin: AHORA_MIN,
    ahoraMs: AHORA_MS,
    misiones: MISIONES,
    plan: [],
    eventos: EVENTOS,
    entregas: ENTREGAS,
    sesiones: DATOS.sesiones,
    bloque: null,
    disponible: true,
    ...cambios,
  };
}

function Hoy({ e, resto }: { e: EntradaVistaWork; resto?: Partial<WorkHoyVistaProps> }) {
  const vista = vistaWorkHoy(e);
  return <WorkHoyVista cabecera={cabecera()} semana={43} nivelTexto="NV 6" estado="listo" error={null} cierre={null} vista={vista} ocupada={null} minutos={vista.duracionPropuesta} acciones={acciones} {...resto} />;
}

const PRIMERA_VEZ = entrada({ misiones: [], eventos: [], entregas: [], sesiones: [] });

const bloqueDemo = (objetivoMin: number, titulo = 'Revisar el contrato con el proveedor'): EstadoBloque =>
  nuevoBloque({ clientId: 'demo', ahora: AHORA_MS, fecha: HOY, inicioMin: AHORA_MIN, objetivoMin, titulo, questId: 'm2' });

const accionesBloque = { onPausar: nada, onSeguir: nada, onTerminar: nada, onMinimizar: nada, onCerrar: nada };

const enMarcha = bloqueDemo(50);
const terminado = avanzar(bloqueDemo(50), AHORA_MS + 50 * 60_000);
const corto = terminar(bloqueDemo(50), AHORA_MS + 12 * 60_000);

const RESULTADO: ResultadoBloque = {
  minutos: 50,
  guardado: true,
  cuenta: true,
  xp: 50,
  marcadas: ['Revisar el contrato con el proveedor'],
  reintentar: false,
  antes: null,
  despues: null,
};

export interface EstadoWorkHoyDemo {
  id: string;
  titulo: string;
  /** Pestaña de la barra de la captura. */
  pestana: 'hoy';
  sinBarra?: boolean;
  render: () => ReactElement;
}

const titulos = {
  primera: 'Hoy: primera vez',
  lleno: 'Hoy: con el día planificado',
  marcha: 'Bloque en marcha',
  pausa: 'Bloque en pausa',
  terminado: 'Bloque terminado (pagado)',
  corto: 'Bloque parado antes',
  sin: 'Hoy: sin la migración',
  cargando: 'Hoy: cargando',
  hoyBloque: 'Hoy: con un bloque en marcha',
  carga: 'Hoy: carga alta y qué soltar',
};

export const ESTADOS_WORK_HOY: EstadoWorkHoyDemo[] = [
  { id: 'primera-vez', titulo: titulos.primera, pestana: 'hoy', render: () => <Hoy e={PRIMERA_VEZ} /> },
  {
    id: 'lleno',
    titulo: titulos.lleno,
    pestana: 'hoy',
    render: () => (
      <Hoy
        e={entrada({})}
        resto={{
          orden: <OrdenDelDia plan={null} bloques={ORDEN} pro onToggle={nada} ahora={AHORA_MIN} />,
          economia: <LineaEconomia linea={{ tipo: 'por_facturar', importe: 112.5 }} onPress={nada} />,
        }}
      />
    ),
  },
  { id: 'hoy-con-bloque', titulo: titulos.hoyBloque, pestana: 'hoy', render: () => <Hoy e={entrada({ bloque: enMarcha, ahoraMs: AHORA_MS + 11 * 60_000 })} /> },
  {
    id: 'carga-alta',
    titulo: titulos.carga,
    pestana: 'hoy',
    render: () => (
      <Hoy
        e={entrada({
          ahoraMin: 17 * 60 + 40,
          eventos: [
            { id: 'c1', titulo: 'Comité', fecha: HOY, inicio: 9 * 60, fin: 13 * 60, origen: 'manual' },
            { id: 'c2', titulo: 'Reunión de equipo', fecha: HOY, inicio: 15 * 60, fin: 17 * 60 + 30, origen: 'manual' },
          ],
        })}
      />
    ),
  },
  {
    id: 'bloque-en-marcha',
    titulo: titulos.marcha,
    pestana: 'hoy',
    sinBarra: true,
    render: () => <BloqueVista vista={vistaBloque(enMarcha, AHORA_MS + 17 * 60_000)} resultado={null} cerrando={false} acciones={accionesBloque} />,
  },
  {
    id: 'bloque-en-pausa',
    titulo: titulos.pausa,
    pestana: 'hoy',
    sinBarra: true,
    render: () => <BloqueVista vista={vistaBloque({ ...enMarcha, fase: 'pausado', acumuladoMs: 17 * 60_000, tramoDesde: null }, AHORA_MS + 20 * 60_000)} resultado={null} cerrando={false} acciones={accionesBloque} />,
  },
  {
    id: 'bloque-terminado',
    titulo: titulos.terminado,
    pestana: 'hoy',
    sinBarra: true,
    render: () => <BloqueVista vista={vistaBloque(terminado, AHORA_MS + 50 * 60_000)} resultado={RESULTADO} cerrando={false} acciones={accionesBloque} />,
  },
  {
    id: 'bloque-corto',
    titulo: titulos.corto,
    pestana: 'hoy',
    sinBarra: true,
    render: () => (
      <BloqueVista
        vista={vistaBloque(corto, AHORA_MS + 12 * 60_000)}
        resultado={{ ...RESULTADO, minutos: 12, cuenta: false, xp: 0, marcadas: [] }}
        cerrando={false}
        acciones={accionesBloque}
      />
    ),
  },
  { id: 'sin-migracion', titulo: titulos.sin, pestana: 'hoy', render: () => <Hoy e={{ ...PRIMERA_VEZ, disponible: false }} /> },
  { id: 'cargando', titulo: titulos.cargando, pestana: 'hoy', render: () => <Hoy e={PRIMERA_VEZ} resto={{ estado: 'cargando' }} /> },
];
