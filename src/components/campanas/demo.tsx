// Demo de la galería /kit/pantallas (solo desarrollo). Lo rellena el encargo
// de esta pantalla del rediseño L-RADICAL (docs/design-v2/L-RADICAL.md §C).
//
// CampanasVista y CampanaVista con datos de mentira: sin sesión ni Supabase.
// Las acciones no hacen nada. Los plazos se cuentan desde hoy (el plazo de la
// vista mira el reloj), así «vencida» sigue vencida el día que se mire.
import type { DemoPantalla } from '@/components/arena/galeria';
import type { Dungeon, DungeonTask } from '@/lib/types';
import { CampanaVista, type CampanaVistaProps } from './CampanaVista';
import { CampanasVista, type CampanaResumen, type CampanasVistaProps } from './CampanasVista';

const nada = () => {};

/** Fecha local a `dias` de hoy, como la guarda la base («2026-10-14»). */
function aDias(dias: number): string {
  const f = new Date();
  f.setDate(f.getDate() + dias);
  const mm = String(f.getMonth() + 1).padStart(2, '0');
  const dd = String(f.getDate()).padStart(2, '0');
  return `${f.getFullYear()}-${mm}-${dd}`;
}

function campana(p: Partial<Dungeon> & { id: string; title: string }): Dungeon {
  return {
    user_id: 'demo-usuario',
    rank: 'C',
    description: null,
    stat: 'INT',
    deadline: null,
    status: 'active',
    created_at: '2026-09-01T09:00:00Z',
    cleared_at: null,
    ...p,
  };
}

const resumen = (d: Dungeon, total: number, doneCount: number): CampanaResumen => ({ ...d, total, doneCount });

const LISTA: CampanaResumen[] = [
  resumen(campana({ id: 'c1', title: 'Lanzar la web de NIVL', rank: 'B', stat: 'INT', deadline: aDias(2) }), 9, 4),
  resumen(campana({ id: 'c2', title: 'Media maratón de Valencia', rank: 'A', stat: 'AGI', deadline: aDias(45) }), 14, 3),
  resumen(campana({ id: 'c3', title: 'Aprobar Cálculo II', rank: 'D', stat: 'INT', deadline: aDias(-3) }), 6, 5),
  resumen(campana({ id: 'c4', title: 'Ordenar la casa', rank: 'E', stat: 'VIT' }), 0, 0),
  resumen(
    campana({ id: 'c5', title: 'Primer cliente de pago', rank: 'C', stat: 'PER', status: 'cleared', cleared_at: '2026-09-21T18:00:00Z' }),
    7,
    7,
  ),
  resumen(
    campana({ id: 'c6', title: 'Cien días sin azúcar', rank: 'S', stat: 'VIT', status: 'cleared', cleared_at: '2026-08-30T21:00:00Z' }),
    10,
    10,
  ),
];

function lista(cambios: Partial<CampanasVistaProps> = {}): CampanasVistaProps {
  return {
    cargado: true,
    error: null,
    titulo: 'Proyectos',
    subtitulo: 'Un proyecto es una campaña: tareas, un jefe final y una fecha. Al despejarlo hay botín.',
    campanas: LISTA,
    onNueva: nada,
    onAbrir: nada,
    onReintentar: nada,
    ...cambios,
  };
}

let siguiente = 0;
function tarea(p: Partial<DungeonTask> & { title: string }): DungeonTask {
  siguiente += 1;
  return {
    id: `demo-tarea-${siguiente}`,
    dungeon_id: 'c1',
    user_id: 'demo-usuario',
    is_boss: false,
    difficulty: 'media',
    done: false,
    done_at: null,
    due_date: null,
    position: siguiente,
    ...p,
  };
}

const TAREAS: DungeonTask[] = [
  tarea({ title: 'Dominio y correo', difficulty: 'facil', done: true }),
  tarea({ title: 'Textos de la portada', done: true }),
  tarea({ title: 'Capturas de la app a 1440', done: true }),
  tarea({ title: 'Formulario de la lista de espera', difficulty: 'dificil', done: true }),
  tarea({ title: 'Política de privacidad revisada', difficulty: 'dificil' }),
  tarea({ title: 'Página de precios' }),
  tarea({ title: 'Prueba en móvil y en tableta', difficulty: 'facil' }),
  tarea({ title: 'Analítica sin cookies', difficulty: 'facil' }),
  tarea({ title: 'Publicar y anunciarlo', difficulty: 'epica', is_boss: true }),
];

function detalle(cambios: Partial<CampanaVistaProps> = {}): CampanaVistaProps {
  return {
    cargado: true,
    error: null,
    campana: campana({ id: 'c1', title: 'Lanzar la web', rank: 'B', stat: 'INT', deadline: aDias(12) }),
    tareas: TAREAS,
    marcando: null,
    ocupada: false,
    onVolver: nada,
    onReintentar: nada,
    onNuevaTarea: nada,
    onTarea: nada,
    onBorrarTarea: nada,
    onReclamar: nada,
    onBorrarCampana: nada,
    ...cambios,
  };
}

export const DEMO: DemoPantalla | null = {
  id: 'campanas',
  titulo: 'Campañas',
  estados: [
    { id: 'abiertas', titulo: 'Abiertas', render: () => <CampanasVista {...lista()} /> },
    { id: 'vacio', titulo: 'Vacío', render: () => <CampanasVista {...lista({ campanas: [] })} /> },
    { id: 'detalle-con-jefe', titulo: 'Detalle con jefe', render: () => <CampanaVista {...detalle()} /> },
    {
      id: 'detalle-vencida',
      titulo: 'Detalle vencida',
      render: () => (
        <CampanaVista
          {...detalle({
            campana: campana({
              id: 'c3',
              title: 'Aprobar Cálculo II con nota en la convocatoria de enero',
              rank: 'D',
              stat: 'INT',
              deadline: aDias(-3),
            }),
            tareas: TAREAS.slice(0, 6).map((t, i) => ({ ...t, done: i < 5 })),
          })}
        />
      ),
    },
    {
      id: 'detalle-botin',
      titulo: 'Detalle con botín',
      render: () => (
        <CampanaVista
          {...detalle({
            campana: campana({ id: 'c5', title: 'Primer cliente', rank: 'C', stat: 'PER', deadline: aDias(4) }),
            tareas: TAREAS.slice(0, 7).map((t) => ({ ...t, done: true })),
          })}
        />
      ),
    },
  ],
};
