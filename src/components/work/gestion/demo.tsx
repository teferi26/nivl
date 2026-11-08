// NIVL · WORK · Gestión: estados con datos de mentira para /kit/work (solo desarrollo).
// Sin sesión ni Supabase; las acciones no hacen nada. Hoy es el 21 de octubre de 2026.

import type { ReactElement } from 'react';
import { DATOS_VACIOS, type DatosWork, type SesionTrabajo } from '@/work/tipos';
import type { MisionSemana } from '@/work/semana';
import { HojaApuntar, HorasVista, type HorasVistaProps } from './HorasVista';
import { HojasProyectos, type HojaProyecto, type HojasProyectosProps } from './HojasProyectos';
import type { EstadoPantalla } from './Piezas';
import { ProyectosVista, type ProyectosVistaProps } from './ProyectosVista';
import { CargaVista, RevisionVista, type RevisionVistaProps } from './RevisionVista';
import { detalleProyecto, tresIniciales, vistaCarga, vistaHoras, vistaProyectos, vistaRevision, type PasoRevision } from './vistas';

const nada = () => {};
const HOY = '2026-10-21';

const sesion = (id: string, proyectoId: string | null, fecha: string, minutos: number, o: Partial<SesionTrabajo> = {}): SesionTrabajo => ({
  id,
  clientId: id,
  proyectoId,
  entregaId: null,
  questId: null,
  tipo: 'bloque',
  fecha,
  inicioMin: 600,
  minutos,
  facturable: true,
  facturadaEl: null,
  nota: null,
  ...o,
});

const DATOS: DatosWork = {
  ...DATOS_VACIOS,
  proyectos: [
    { id: 'p1', nombre: 'Web de la tienda', cliente: 'Cliente A', tarifaHora: 45, estado: 'activo', posicion: 0 },
    { id: 'p2', nombre: 'Informe trimestral', cliente: null, tarifaHora: null, estado: 'activo', posicion: 1 },
    { id: 'p3', nombre: 'Rediseño del catálogo', cliente: 'Cliente B', tarifaHora: 60, estado: 'pausado', posicion: 2 },
  ],
  entregas: [
    { id: 'e1', proyectoId: 'p1', titulo: 'Propuesta de portada', fecha: HOY, hecha: false, hechaEl: null, posicion: 0 },
    { id: 'e2', proyectoId: 'p1', titulo: 'Maqueta de la ficha', fecha: '2026-10-28', hecha: false, hechaEl: null, posicion: 1 },
    { id: 'e3', proyectoId: 'p2', titulo: 'Borrador de cifras', fecha: '2026-11-12', hecha: false, hechaEl: null, posicion: 0 },
    { id: 'e4', proyectoId: 'p1', titulo: 'Reunión de arranque', fecha: '2026-10-14', hecha: true, hechaEl: '2026-10-14', posicion: 2 },
    { id: 'e5', proyectoId: null, titulo: 'Renovar el contrato de la oficina', fecha: '2026-10-19', hecha: false, hechaEl: null, posicion: 0 },
  ],
  sesiones: [
    sesion('s1', 'p1', HOY, 50),
    sesion('s2', 'p1', HOY, 25, { inicioMin: 720 }),
    sesion('s3', 'p2', '2026-10-20', 90, { facturable: false }),
    sesion('s4', 'p1', '2026-10-19', 120, { tipo: 'manual', inicioMin: null }),
    sesion('s5', 'p1', '2026-10-14', 100),
    sesion('s6', null, '2026-10-13', 60, { facturable: false, tipo: 'manual', inicioMin: null }),
  ],
  eventos: [
    { id: 'v1', titulo: 'Reunión de equipo', fecha: HOY, inicio: 540, fin: 600, origen: 'manual' },
    { id: 'v2', titulo: 'Revisión con cliente', fecha: '2026-10-20', inicio: 660, fin: 780, origen: 'dispositivo' },
  ],
};

const MISIONES: MisionSemana[] = [
  { id: 'm1', titulo: 'Cerrar el presupuesto', fecha: '2026-10-13', hecha: true, prioridad: true },
  { id: 'm2', titulo: 'Llamar a proveedores', fecha: '2026-10-14', hecha: false, prioridad: true },
  { id: 'm3', titulo: 'Ordenar la bandeja', fecha: '2026-10-16', hecha: false, prioridad: true },
];

const base: EstadoPantalla = { estado: 'listo', error: null, disponible: true, onVolver: nada, onReintentar: nada };

// ── Proyectos ───────────────────────────────────────────────────────────

const proyectos = (o: Partial<ProyectosVistaProps> = {}, d: DatosWork = DATOS): ProyectosVistaProps => ({
  ...base,
  vista: vistaProyectos(d, HOY),
  acciones: { onNuevoProyecto: nada, onNuevaEntrega: nada, onAbrir: nada, onMarcar: nada, onEntrega: nada },
  ...o,
});

const hojas = (hoja: HojaProyecto): HojasProyectosProps => ({
  hoja,
  hoy: HOY,
  detalle: hoja.tipo === 'detalle' ? detalleProyecto(hoja.proyectoId, DATOS, HOY) : null,
  guardando: false,
  onCerrar: nada,
  onGuardarProyecto: nada,
  onGuardarEntrega: nada,
  onNuevaEntrega: nada,
  onEditarProyecto: nada,
  onEstadoProyecto: nada,
  onBorrarProyecto: nada,
  onBorrarEntrega: nada,
  onMarcar: nada,
  onEntrega: nada,
});

// ── Horas ───────────────────────────────────────────────────────────────

const horas = (o: Partial<HorasVistaProps> = {}, d: DatosWork = DATOS): HorasVistaProps => ({
  ...base,
  vista: vistaHoras(d, HOY),
  hoy: HOY,
  acciones: { onApuntar: nada, onMarcarFacturado: nada, onBorrar: nada },
  ...o,
});

// ── Revisión ────────────────────────────────────────────────────────────

const revision = (paso: PasoRevision, o: Partial<RevisionVistaProps> = {}, d: DatosWork = DATOS, m: MisionSemana[] = MISIONES): RevisionVistaProps => {
  const v = vistaRevision(d, m, HOY);
  return {
    ...base,
    vista: v,
    carga: vistaCarga(d, HOY),
    paso,
    razones: {},
    tres: tresIniciales(v, {}),
    guardando: false,
    terminada: null,
    yaHecha: false,
    acciones: { onSiguiente: nada, onAtras: nada, onRazon: nada, onTres: nada, onCerrar: nada, onRepasar: nada },
    ...o,
  };
};

const DIAS_DE_MAS: SesionTrabajo[] = ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'].map((f, i) => sesion(`t${i}`, 'p1', f, 120, { inicioMin: 1200 }));

export interface EstadoGestionDemo {
  id: string;
  titulo: string;
  render: () => ReactElement;
}

export const ESTADOS_GESTION: EstadoGestionDemo[] = [
  { id: 'proyectos', titulo: 'Proyectos: lleno', render: () => <ProyectosVista {...proyectos()} /> },
  { id: 'proyectos-vacio', titulo: 'Proyectos: vacío', render: () => <ProyectosVista {...proyectos({}, DATOS_VACIOS)} /> },
  { id: 'proyectos-cargando', titulo: 'Proyectos: cargando', render: () => <ProyectosVista {...proyectos({ estado: 'cargando' })} /> },
  { id: 'proyectos-error', titulo: 'Proyectos: error', render: () => <ProyectosVista {...proyectos({ estado: 'error', error: 'Sin conexión.' })} /> },
  { id: 'proyectos-sin-migracion', titulo: 'Proyectos: sin migración', render: () => <ProyectosVista {...proyectos({ disponible: false }, DATOS_VACIOS)} /> },
  { id: 'hoja-proyecto', titulo: 'Hoja: nuevo proyecto', render: () => <HojasProyectos {...hojas({ tipo: 'proyecto', proyecto: null })} /> },
  { id: 'hoja-detalle', titulo: 'Hoja: detalle de proyecto', render: () => <HojasProyectos {...hojas({ tipo: 'detalle', proyectoId: 'p1' })} /> },
  { id: 'hoja-entrega', titulo: 'Hoja: nueva entrega', render: () => <HojasProyectos {...hojas({ tipo: 'entrega', entrega: null, proyectoId: 'p1' })} /> },
  { id: 'horas', titulo: 'Horas: lleno', render: () => <HorasVista {...horas()} /> },
  { id: 'horas-vacio', titulo: 'Horas: vacío', render: () => <HorasVista {...horas({}, DATOS_VACIOS)} /> },
  { id: 'horas-cargando', titulo: 'Horas: cargando', render: () => <HorasVista {...horas({ estado: 'cargando' })} /> },
  { id: 'horas-sin-migracion', titulo: 'Horas: sin migración', render: () => <HorasVista {...horas({ disponible: false }, DATOS_VACIOS)} /> },
  {
    id: 'hoja-apuntar',
    titulo: 'Hoja: apuntar horas',
    render: () => <HojaApuntar visible hoy={HOY} proyectos={DATOS.proyectos} guardando={false} onCerrar={nada} onGuardar={nada} />,
  },
  { id: 'revision-1', titulo: 'Revisión: lo cerrado', render: () => <RevisionVista {...revision(1)} /> },
  { id: 'revision-2', titulo: 'Revisión: lo que se quedó', render: () => <RevisionVista {...revision(2, { razones: { 'llamar a proveedores': 'esperando' } })} /> },
  { id: 'revision-3', titulo: 'Revisión: las tres', render: () => <RevisionVista {...revision(3)} /> },
  { id: 'revision-hecha', titulo: 'Revisión: terminada', render: () => <RevisionVista {...revision(3, { terminada: { creadas: 3 } })} /> },
  { id: 'revision-vacia', titulo: 'Revisión: semana vacía', render: () => <RevisionVista {...revision(1, {}, DATOS_VACIOS, [])} /> },
  { id: 'revision-cargando', titulo: 'Revisión: cargando', render: () => <RevisionVista {...revision(1, { estado: 'cargando' })} /> },
  { id: 'carga-normal', titulo: 'Carga: normal', render: () => <CargaVista {...base} carga={vistaCarga(DATOS, HOY)} /> },
  { id: 'carga-alta', titulo: 'Carga: alta, con qué soltar', render: () => <CargaVista {...base} carga={vistaCarga({ eventos: DATOS.eventos, sesiones: [...DATOS.sesiones, ...DIAS_DE_MAS] }, HOY)} /> },
  { id: 'carga-sin-datos', titulo: 'Carga: sin datos', render: () => <CargaVista {...base} carga={vistaCarga(DATOS_VACIOS, HOY)} /> },
];
