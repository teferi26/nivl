// NIVL · FOCUS: galería con datos de mentira (/kit/focus, SOLO DESARROLLO).
//
// /kit/focus?pantalla=<hoy|temario|examenes|hojas>&estado=<id>&quieto=1&solo=1
//
// Los datos imitan la lámina 3 de la P01: Cálculo II en 12 días (64 % del
// temario), Estructuras de datos en 26 días (38 %), el tema 4 «Árboles
// binarios», Green a medio repasar. Sin sesión ni Supabase: todo pasa por los
// mismos constructores puros que la app (vistaHoy, resumen.ts).

import type { ReactElement } from 'react';
import { CabeceraMundo } from '@/components/modos/mundo/CabeceraMundo';
import { CONFIG_POR_DEFECTO, ESTADO_INICIAL, arrancar, type EstadoPomodoro } from '@/focus/pomodoro';
import type { DatosFocus, Tema } from '@/focus/tipos';
import { DATOS_VACIOS } from '@/focus/tipos';
import { nivelesDeModos } from '@/modos/niveles';
import { FocusHoyVista, type FocusHoyVistaProps } from './FocusHoyVista';
import { vistaHoy, type MisionEnlazable } from './vistaHoy';
import { ExamenesVista, type ExamenesVistaProps } from './ExamenesVista';
import { HojaAjustes, HojaDetalleExamen, HojaExamen, HojaMetodo, HojaMision, HojaNoMolestar, HojaRepaso } from './HojasFocus';
import { TemarioVista, type TemarioVistaProps } from './TemarioVista';
import { vistaExamenes, vistaTemario } from './vistas';
import { metodoPorId } from '@/focus/metodos';
import { planDeExamen } from '@/focus/resumen';

export const HOY_FOCUS = '2026-10-21';
/** 15:40 del día de la demo. */
export const AHORA_MIN = 15 * 60 + 40;
const AHORA_MS = Date.UTC(2026, 9, 21, 13, 40);

const tema = (id: string, asignaturaId: string, nombre: string, estado: Tema['estado'], posicion: number, repasoEl: string | null = null): Tema => ({
  id,
  asignaturaId,
  examenId: null,
  nombre,
  estado,
  posicion,
  etapa: 0,
  repasoEl,
});

export const DATOS_DEMO: DatosFocus = {
  asignaturas: [
    { id: 'calc', nombre: 'Cálculo II', posicion: 0 },
    { id: 'edd', nombre: 'Estructuras de datos', posicion: 1 },
    { id: 'fis', nombre: 'Física', posicion: 2 },
  ],
  examenes: [
    { id: 'x-calc', asignaturaId: 'calc', titulo: 'Parcial 2', fecha: '2026-11-02', peso: 40 },
    { id: 'x-edd', asignaturaId: 'edd', titulo: 'Final', fecha: '2026-11-16', peso: 60 },
  ],
  temas: [
    tema('c1', 'calc', 'Límites en varias variables', 'dominado', 0),
    tema('c2', 'calc', 'Derivadas parciales', 'dominado', 1),
    tema('c3', 'calc', 'Extremos condicionados', 'dominado', 2),
    tema('c4', 'calc', 'Integrales dobles', 'dominado', 3),
    tema('c5', 'calc', 'Integrales de línea', 'repasando', 4, '2026-10-21'),
    tema('c6', 'calc', 'Teorema de Green', 'pendiente', 5),
    tema('c7', 'calc', 'Integrales de superficie', 'pendiente', 6),
    tema('e1', 'edd', 'Listas enlazadas', 'dominado', 0),
    tema('e2', 'edd', 'Pilas y colas', 'dominado', 1),
    tema('e3', 'edd', 'Tablas hash', 'repasando', 2, '2026-10-22'),
    tema('e4', 'edd', 'Árboles binarios', 'repasando', 3),
    tema('e5', 'edd', 'Montículos', 'pendiente', 4),
    tema('e6', 'edd', 'Grafos', 'pendiente', 5),
    tema('e7', 'edd', 'Ordenación', 'pendiente', 6),
    tema('e8', 'edd', 'Complejidad', 'pendiente', 7),
  ],
  sesiones: [
    { id: 's1', asignaturaId: 'calc', temaId: 'c5', fecha: '2026-10-19', minutos: 50, metodo: 'pomodoro' },
    { id: 's2', asignaturaId: 'edd', temaId: 'e4', fecha: '2026-10-20', minutos: 75, metodo: 'pomodoro' },
    { id: 's3', asignaturaId: 'calc', temaId: 'c5', fecha: '2026-10-21', minutos: 50, metodo: 'recuerdo' },
    { id: 's4', asignaturaId: 'fis', temaId: null, fecha: '2026-10-20', minutos: 25, metodo: 'pomodoro' },
  ],
  clases: [
    { id: 'k1', asignaturaId: 'calc', dia: 3, inicio: 9 * 60, fin: 11 * 60, aula: 'Aula 2.04' },
    { id: 'k2', asignaturaId: 'edd', dia: 3, inicio: 11 * 60 + 30, fin: 13 * 60 + 30, aula: 'Lab 1' },
    { id: 'k3', asignaturaId: 'fis', dia: 1, inicio: 9 * 60, fin: 11 * 60, aula: 'Aula 1.10' },
    { id: 'k4', asignaturaId: 'calc', dia: 1, inicio: 12 * 60, fin: 14 * 60, aula: 'Aula 2.04' },
    { id: 'k5', asignaturaId: 'edd', dia: 4, inicio: 9 * 60, fin: 11 * 60, aula: 'Lab 1' },
  ],
  notas: [
    { id: 'n1', asignaturaId: 'calc', titulo: 'Parcial 1', nota: 6.5, sobre: 10, peso: 40, fecha: '2026-10-08' },
    { id: 'n2', asignaturaId: 'calc', titulo: 'Entregas', nota: 9, sobre: 10, peso: 20, fecha: '2026-10-15' },
    { id: 'n3', asignaturaId: 'edd', titulo: 'Práctica 1', nota: 8.2, sobre: 10, peso: null, fecha: '2026-10-10' },
    { id: 'n4', asignaturaId: 'fis', titulo: 'Test tema 1', nota: 14, sobre: 20, peso: null, fecha: '2026-10-12' },
  ],
  mazos: [
    { id: 'm1', asignaturaId: 'calc', nombre: 'Fórmulas de Cálculo' },
    { id: 'm2', asignaturaId: 'edd', nombre: 'Complejidades' },
  ],
  tarjetas: [
    { id: 't1', mazoId: 'm1', anverso: 'Teorema de Green', reverso: 'La circulación por la frontera es la integral doble del rotacional escalar.', etapa: 1, vence: '2026-10-21' },
    { id: 't2', mazoId: 'm1', anverso: 'Jacobiano en polares', reverso: 'r', etapa: 2, vence: '2026-10-20' },
    { id: 't3', mazoId: 'm2', anverso: 'Búsqueda en un árbol equilibrado', reverso: 'O(log n)', etapa: 0, vence: '2026-10-25' },
  ],
};

export const MISIONES_DEMO: MisionEnlazable[] = [
  { id: 'q1', titulo: 'Estudiar Tema 4 de Estructuras', hecha: false, xp: 50, penalizacion: false },
  { id: 'q2', titulo: 'Repasar Cálculo II', hecha: true, xp: 25, penalizacion: false },
  { id: 'q3', titulo: 'Leer 20 páginas', hecha: false, xp: 25, penalizacion: false },
];

const nada = () => {};

export const ACCIONES_HOY_DEMO: FocusHoyVistaProps['acciones'] = {
  onEmpezar: nada,
  onPausar: nada,
  onSaltar: nada,
  onParar: nada,
  onAjustes: nada,
  onElegirMision: nada,
  onNoMolestar: nada,
  onExamenes: nada,
  onExamen: nada,
  onTemario: nada,
  onAlternarTema: nada,
  onBloque: nada,
  onCompletarMision: nada,
  onCoach: nada,
  onAnadirAsignatura: nada,
  onAnadirExamen: nada,
  onReintentar: nada,
};

const NIVEL = nivelesDeModos(['focus'], { iron: 0, focus: 9556, work: 0, founder: 0 })[0] ?? null;

export function cabeceraDemo() {
  return <CabeceraMundo modo="focus" nivel={NIVEL} />;
}

/** El bloque 3 de 4 de Estructuras de datos, tema 4 (la lámina). */
const POMODORO_LAMINA: EstadoPomodoro = {
  ...ESTADO_INICIAL,
  bloque: 3,
  objetivo: { asignaturaId: 'edd', temaId: 'e4', misionId: 'q1' },
};

function Hoy({
  datos = DATOS_DEMO,
  pomodoro = POMODORO_LAMINA,
  ahora = AHORA_MS,
  estado = 'listo',
  disponible = true,
  misiones = MISIONES_DEMO,
}: {
  datos?: DatosFocus;
  pomodoro?: EstadoPomodoro;
  ahora?: number;
  estado?: FocusHoyVistaProps['estado'];
  disponible?: boolean;
  misiones?: MisionEnlazable[] | null;
}): ReactElement {
  const v = vistaHoy({ datos, hoy: HOY_FOCUS, ahoraMin: AHORA_MIN, ahora, config: CONFIG_POR_DEFECTO, pomodoro, misiones });
  return (
    <FocusHoyVista
      {...v}
      cabecera={cabeceraDemo()}
      estado={estado}
      error={estado === 'error' ? 'Sin conexión. Revisa la red y vuelve a intentarlo.' : null}
      disponible={disponible}
      acciones={ACCIONES_HOY_DEMO}
    />
  );
}

export interface EstadoGaleria {
  id: string;
  titulo: string;
  render: () => ReactElement;
}

const corriendo = arrancar({ ...POMODORO_LAMINA }, CONFIG_POR_DEFECTO, AHORA_MS - 9 * 60_000 - 12_000);

export const ESTADOS_HOY: EstadoGaleria[] = [
  { id: 'lamina', titulo: 'Como la lámina', render: () => <Hoy /> },
  { id: 'corriendo', titulo: 'Bloque en marcha', render: () => <Hoy pomodoro={corriendo} /> },
  {
    id: 'descanso',
    titulo: 'Descanso',
    render: () => <Hoy pomodoro={{ ...POMODORO_LAMINA, fase: 'descanso', finEn: AHORA_MS + 3 * 60_000, idFase: 'd' }} />,
  },
  { id: 'vacio', titulo: 'Sin asignaturas', render: () => <Hoy datos={DATOS_VACIOS} pomodoro={ESTADO_INICIAL} misiones={[]} /> },
  { id: 'sintablas', titulo: 'Sin la 0076', render: () => <Hoy datos={DATOS_VACIOS} pomodoro={ESTADO_INICIAL} disponible={false} misiones={[]} /> },
  { id: 'cargando', titulo: 'Cargando', render: () => <Hoy datos={DATOS_VACIOS} estado="cargando" misiones={null} /> },
  { id: 'error', titulo: 'Error', render: () => <Hoy datos={DATOS_VACIOS} estado="error" misiones={null} /> },
];

const ACCIONES_TEMARIO: TemarioVistaProps['acciones'] = {
  onElegir: nada,
  onArchivar: nada,
  onAnadirAsignatura: nada,
  onAnadirTemas: nada,
  onAlternarTema: nada,
  onBorrarTema: nada,
  onRepasar: nada,
  onNuevoMazo: nada,
  onNuevaTarjeta: nada,
  onDia: nada,
  onAnadirClase: nada,
  onBorrarClase: nada,
  onMetodo: nada,
  onReintentar: nada,
};

function Temario({ datos = DATOS_DEMO, estado = 'listo', disponible = true }: { datos?: DatosFocus; estado?: TemarioVistaProps['estado']; disponible?: boolean }) {
  return <TemarioVista {...vistaTemario(datos, HOY_FOCUS, null, 3)} estado={estado} error={null} disponible={disponible} acciones={ACCIONES_TEMARIO} />;
}

const ACCIONES_EXAMENES: ExamenesVistaProps['acciones'] = {
  onExamen: nada,
  onNuevoExamen: nada,
  onAnadirAsignatura: nada,
  onNotas: nada,
  onNuevaNota: nada,
  onMetodoAnteriores: nada,
  onReintentar: nada,
};

const CON_PASADO: DatosFocus = {
  ...DATOS_DEMO,
  examenes: [...DATOS_DEMO.examenes, { id: 'x-fis', asignaturaId: 'fis', titulo: 'Parcial 1', fecha: '2026-10-09', peso: 30 }],
};

function Examenes({ datos = CON_PASADO, estado = 'listo' }: { datos?: DatosFocus; estado?: ExamenesVistaProps['estado'] }) {
  return <ExamenesVista {...vistaExamenes(datos, HOY_FOCUS)} estado={estado} error={null} disponible acciones={ACCIONES_EXAMENES} />;
}

function ConHoja({ children }: { children: ReactElement }) {
  return (
    <>
      <Hoy />
      {children}
    </>
  );
}

const temasCalc = DATOS_DEMO.temas.filter((x) => x.asignaturaId === 'calc');
const examenCalc = DATOS_DEMO.examenes[0]!;
const nombreTema = (id: string | null) => DATOS_DEMO.temas.find((x) => x.id === id)?.nombre ?? '';

export const ESTADOS_TEMARIO: EstadoGaleria[] = [
  { id: 'lleno', titulo: 'Lleno', render: () => <Temario /> },
  { id: 'vacio', titulo: 'Sin asignaturas', render: () => <Temario datos={DATOS_VACIOS} /> },
  { id: 'sintablas', titulo: 'Sin la 0076', render: () => <Temario datos={DATOS_VACIOS} disponible={false} /> },
  { id: 'cargando', titulo: 'Cargando', render: () => <Temario datos={DATOS_VACIOS} estado="cargando" /> },
];

export const ESTADOS_EXAMENES: EstadoGaleria[] = [
  { id: 'lleno', titulo: 'Lleno', render: () => <Examenes /> },
  { id: 'vacio', titulo: 'Sin exámenes', render: () => <Examenes datos={{ ...DATOS_DEMO, examenes: [], notas: [] }} /> },
  { id: 'cargando', titulo: 'Cargando', render: () => <Examenes datos={DATOS_VACIOS} estado="cargando" /> },
];

export const ESTADOS_HOJAS: EstadoGaleria[] = [
  {
    id: 'plan',
    titulo: 'Plan del examen',
    render: () => (
      <ConHoja>
        <HojaDetalleExamen
          visible
          examen={examenCalc}
          asignatura="Cálculo II"
          dias={12}
          plan={planDeExamen(DATOS_DEMO, examenCalc, HOY_FOCUS)}
          temas={temasCalc}
          nombreTema={nombreTema}
          onClose={nada}
          onAlternarTema={nada}
          onAnadirTemas={nada}
          onBorrar={nada}
          onEstudiar={nada}
        />
      </ConHoja>
    ),
  },
  { id: 'metodo', titulo: 'Método', render: () => <ConHoja><HojaMetodo visible metodo={metodoPorId('feynman')} onClose={nada} onAccion={nada} /></ConHoja> },
  {
    id: 'repaso',
    titulo: 'Repaso',
    render: () => (
      <ConHoja>
        <HojaRepaso
          visible
          items={[{ id: 't1', tipo: 'tarjeta', pregunta: 'Teorema de Green', respuesta: 'La circulación por la frontera es la integral doble del rotacional escalar.', contexto: 'Fórmulas de Cálculo' }]}
          onClose={nada}
          onResultado={nada}
        />
      </ConHoja>
    ),
  },
  { id: 'examen', titulo: 'Nuevo examen', render: () => <ConHoja><HojaExamen visible asignaturas={DATOS_DEMO.asignaturas} hoy={HOY_FOCUS} onClose={nada} onGuardar={nada} /></ConHoja> },
  { id: 'nomolestar', titulo: 'No molestar', render: () => <ConHoja><HojaNoMolestar visible onClose={nada} /></ConHoja> },
  { id: 'ajustes', titulo: 'Ajustes', render: () => <ConHoja><HojaAjustes visible config={CONFIG_POR_DEFECTO} onClose={nada} onGuardar={nada} /></ConHoja> },
  {
    id: 'mision',
    titulo: 'Misión',
    render: () => (
      <ConHoja>
        <HojaMision visible misiones={MISIONES_DEMO.filter((m) => !m.hecha)} elegida="q1" onClose={nada} onElegir={nada} />
      </ConHoja>
    ),
  },
];

export const GALERIA_FOCUS: { id: string; titulo: string; estados: EstadoGaleria[] }[] = [
  { id: 'hoy', titulo: 'Hoy', estados: ESTADOS_HOY },
  { id: 'temario', titulo: 'Temario', estados: ESTADOS_TEMARIO },
  { id: 'examenes', titulo: 'Exámenes', estados: ESTADOS_EXAMENES },
  { id: 'hojas', titulo: 'Hojas', estados: ESTADOS_HOJAS },
];
