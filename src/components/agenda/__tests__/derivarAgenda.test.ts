import {
  contenidoDe,
  diaCorto,
  itemsConHora,
  moverAgenda,
  rangoAgenda,
  rejillaMes,
  semanaIso,
  subtituloDia,
  tituloAgenda,
} from '../derivarAgenda';
import type { CalendarEvent, Quest } from '@/lib/types';

const evento = (id: string, date: string, time: string | null): CalendarEvent => ({
  id,
  user_id: 'u',
  title: `Evento ${id}`,
  date,
  time,
  notes: null,
  created_at: '2026-10-01T00:00:00Z',
});

const mision = (p: Partial<Quest>): Quest => ({
  id: 'q',
  user_id: 'u',
  title: 'Leer',
  stat: 'INT',
  difficulty: 'media',
  days_of_week: [1, 2, 3, 4, 5, 6, 7],
  requires_evidence: false,
  active: true,
  is_penalty: false,
  penalty_date: null,
  penalty_xp: null,
  is_bonus: false,
  acquired_at: null,
  acquired_streak: null,
  link: null,
  created_at: '2026-09-01T00:00:00Z',
  ...p,
});

describe('semanaIso', () => {
  it('cuenta la semana del jueves', () => {
    expect(semanaIso('2026-10-07')).toBe(41);
    expect(semanaIso('2026-01-01')).toBe(1);
    // El 1 de enero de 2027 es viernes: pertenece a la semana 53 de 2026.
    expect(semanaIso('2027-01-01')).toBe(53);
    expect(semanaIso('2024-12-30')).toBe(1);
  });
});

describe('títulos y rangos', () => {
  it('título por vista', () => {
    expect(tituloAgenda('dia', '2026-10-07')).toBe('Miércoles 7');
    expect(tituloAgenda('semana', '2026-10-07')).toBe('Semana 41');
    expect(tituloAgenda('mes', '2026-10-07')).toBe('Octubre');
    expect(diaCorto('2026-10-04')).toBe('Domingo 4');
  });

  it('rango sin guiones', () => {
    expect(rangoAgenda('semana', '2026-10-07')).toBe('5 A 11 OCT');
    expect(rangoAgenda('semana', '2026-10-01')).toBe('28 SEP A 4 OCT');
    expect(rangoAgenda('mes', '2026-10-07')).toBe('OCTUBRE 2026');
    expect(rangoAgenda('dia', '2026-10-07')).toBe('7 OCT 2026');
    for (const m of ['dia', 'semana', 'mes'] as const) {
      expect(rangoAgenda(m, '2026-12-30')).not.toMatch(/[–—-]/);
    }
  });

  it('mueve por día, semana y mes', () => {
    expect(moverAgenda('dia', '2026-10-31', 1)).toBe('2026-11-01');
    expect(moverAgenda('semana', '2026-10-07', -1)).toBe('2026-09-30');
    expect(moverAgenda('mes', '2026-12-15', 1)).toBe('2027-01-01');
  });
});

describe('rejillaMes', () => {
  it('siempre 6 × 7, con el día 1 en su columna', () => {
    const r = rejillaMes('2026-10-15');
    expect(r).toHaveLength(42);
    // Octubre de 2026 empieza en jueves: tres huecos delante.
    expect(r.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(r.filter(Boolean)).toHaveLength(31);
  });
});

describe('contenido del día', () => {
  it('solo enseña la penalización hoy y ordena el eje', () => {
    const datos = {
      quests: [mision({ id: 'a' }), mision({ id: 'p', is_penalty: true, penalty_date: '2026-10-07' })],
      events: [evento('1', '2026-10-07', '18:00'), evento('2', '2026-10-07', null), evento('3', '2026-10-08', '09:00')],
      dueTasks: [],
    };
    const hoy = contenidoDe(datos, '2026-10-07', '2026-10-07');
    expect(hoy.misiones.map((q) => q.id)).toEqual(['a', 'p']);
    expect(hoy.eventos).toHaveLength(2);
    const otro = contenidoDe(datos, '2026-10-07', '2026-10-06');
    expect(otro.misiones.map((q) => q.id)).toEqual(['a']);
    const items = itemsConHora(null, hoy.eventos);
    expect(items).toEqual([expect.objectContaining({ id: 'e-1', inicio: 1080, fin: 1125, tipo: 'evento' })]);
  });

  it('subtítulo vacío según futuro o pasado', () => {
    const vacio = { misiones: [], eventos: [], plazos: [] };
    expect(subtituloDia(vacio, 0, '2026-10-09', '2026-10-07')).toBe('Dentro de 2 días. Nada programado todavía.');
    expect(subtituloDia(vacio, 0, '2026-10-06', '2026-10-07')).toBe('Ayer. Ese día no quedó nada registrado.');
  });
});
