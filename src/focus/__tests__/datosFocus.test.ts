// NIVL · FOCUS: escrituras con la 0112 ausente y lo que entra en la cuenta de misiones.
import { FocusNoDisponible, asegurarMisionFocus, crearExamen, empezarVuelta, leerMinutosDelDia } from '@/focus/datos';

type Respuesta = { data?: unknown; error?: { code?: string; message?: string } | null };

const mockLlamadas: { tabla: string; op: string; args: unknown }[] = [];
let mockResponder: (tabla: string, op: string, args: unknown) => Respuesta = () => ({ data: null, error: null });

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabla: string) => {
      let ultima: { op: string; args: unknown } = { op: '', args: null };
      const q: Record<string, unknown> = {
        then: (ok: (r: Respuesta) => unknown) => {
          mockLlamadas.push({ tabla, ...ultima });
          return Promise.resolve(mockResponder(tabla, ultima.op, ultima.args)).then(ok);
        },
      };
      for (const m of ['eq', 'neq', 'order', 'contains', 'limit', 'gte', 'single', 'maybeSingle']) q[m] = () => q;
      for (const op of ['insert', 'update', 'upsert', 'select']) {
        q[op] = (args: unknown) => {
          if (!(op === 'select' && ultima.op)) ultima = { op, args };
          return q;
        };
      }
      return q;
    },
  },
}));

beforeEach(() => {
  mockLlamadas.length = 0;
  mockResponder = () => ({ data: null, error: null });
});

const SIN_COLUMNA = { error: { code: '42703', message: 'column "kind" does not exist' } };
const nuevo = { asignaturaId: 'a', titulo: 'X', peso: null, temas: [] };

describe('sin la 0112', () => {
  it('una entrega no se guarda como examen', async () => {
    mockResponder = () => SIN_COLUMNA;
    await expect(crearExamen({ ...nuevo, fecha: '2026-12-01', tipo: 'entrega' }, 0)).rejects.toBeInstanceOf(FocusNoDisponible);
    expect(mockLlamadas).toHaveLength(1);
  });

  it('un examen sin fecha avisa en vez de romper', async () => {
    mockResponder = () => SIN_COLUMNA;
    await expect(crearExamen({ ...nuevo, fecha: null }, 0)).rejects.toBeInstanceOf(FocusNoDisponible);
  });

  it('un examen con fecha se guarda con lo de antes', async () => {
    let n = 0;
    mockResponder = () => (n++ === 0 ? SIN_COLUMNA : { data: { id: 'x' }, error: null });
    await crearExamen({ ...nuevo, fecha: '2026-12-01' }, 0);
    expect(mockLlamadas[1]?.args).toEqual({ subject_id: 'a', title: 'X', exam_date: '2026-12-01', weight: null });
  });

  it('empezar otra vuelta no toca el temario si no puede subir la vuelta', async () => {
    mockResponder = () => SIN_COLUMNA;
    await expect(empezarVuelta('a', 1)).rejects.toBeInstanceOf(FocusNoDisponible);
    expect(mockLlamadas.every((l) => l.tabla === 'focus_subjects')).toBe(true);
  });
});

describe('misión del arranque', () => {
  it('va enlazada, fácil y de lunes a viernes', async () => {
    mockResponder = (_t, op) => (op === 'select' ? { data: [], error: null } : { error: null });
    await asegurarMisionFocus('u', 'Study 50 min');
    expect(mockLlamadas.find((l) => l.op === 'insert')?.args).toMatchObject({ link: 'estudio', difficulty: 'facil', days_of_week: [1, 2, 3, 4, 5], modes: ['focus'] });
  });

  it('sin la 0113 se crea sin enlace', async () => {
    let inserciones = 0;
    mockResponder = (_t, op) => (op === 'select' ? { data: [], error: null } : inserciones++ === 0 ? { error: { code: '23514' } } : { error: null });
    await asegurarMisionFocus('u', 'Estudiar 50 min');
    expect(mockLlamadas.filter((l) => l.op === 'insert')).toHaveLength(2);
    expect(mockLlamadas.filter((l) => l.op === 'insert')[1]?.args).not.toHaveProperty('link');
  });
});

describe('minutos que miden misiones', () => {
  it('lo dictado al coach no cuenta', async () => {
    mockResponder = () => ({
      data: [
        { subject_id: 'a', minutes: 120, client_id: 'coach-2026-11-09-libre-120-1' },
        { subject_id: 'a', minutes: 25, client_id: 'foco-1-99' },
      ],
      error: null,
    });
    expect(await leerMinutosDelDia('2026-11-09')).toEqual([{ asignaturaId: 'a', minutos: 25 }]);
  });
});
