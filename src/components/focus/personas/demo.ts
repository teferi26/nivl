// NIVL · FOCUS: los tres perfiles de la galería (/kit/focus, SOLO DESARROLLO).
//
// Personas inventadas, fechas alrededor del miércoles 21/10/2026 (HOY_FOCUS):
// una opositora con 70 temas y fecha estimada, un universitario en plena
// semana de exámenes con entregas y una alumna de 2.º de Bachillerato.

import type { Asignatura, DatosFocus, Examen, PrefsFocus, Sesion, Tema } from '@/focus/tipos';

const asig = (id: string, nombre: string, posicion: number, notaObjetivo: number | null = null): Asignatura => ({
  id,
  nombre,
  posicion,
  notaObjetivo,
  vuelta: 1,
});

const tema = (
  id: string,
  asignaturaId: string,
  nombre: string,
  estado: Tema['estado'],
  posicion: number,
  seccion: string | null = null,
  repasoEl: string | null = null,
): Tema => ({ id, asignaturaId, examenId: null, nombre, estado, posicion, etapa: estado === 'pendiente' ? 0 : 1, repasoEl, seccion, repasadoEl: null });

const examen = (id: string, asignaturaId: string, titulo: string, fecha: string | null, peso: number | null, resto: Partial<Examen> = {}): Examen => ({
  id,
  asignaturaId,
  titulo,
  fecha,
  peso,
  hora: null,
  tipo: 'examen',
  estimada: false,
  hechaEl: null,
  ...resto,
});

const sesion = (id: string, asignaturaId: string, fecha: string, minutos: number, temaId: string | null = null): Sesion => ({
  id,
  asignaturaId,
  temaId,
  fecha,
  minutos,
  metodo: 'pomodoro',
  salidas: 0,
});

const prefs = (perfil: PrefsFocus['perfil'], minutosDia: number): PrefsFocus => ({ perfil, minutosDia, sinClasesHasta: null, arranqueHecho: true });

const BLOQUES_OPOSICION = ['Organización del Estado', 'Derecho administrativo', 'Gestión de personal', 'Gestión financiera'];

/** Opositora: 70 temas en 4 bloques, fecha estimada, 5 h al día y tres días sin estudiar. */
export const DEMO_OPOSITORA: DatosFocus = {
  asignaturas: [asig('temario', 'Administrativo del Estado', 0)],
  examenes: [examen('o-x', 'temario', 'Primer ejercicio', '2027-06-16', 100, { estimada: true, tipo: 'prueba' })],
  temas: Array.from({ length: 70 }, (_, i) => {
    const n = i + 1;
    const estado: Tema['estado'] = n <= 12 ? 'dominado' : n <= 18 ? 'repasando' : 'pendiente';
    const seccion = BLOQUES_OPOSICION[Math.min(3, Math.floor(i / 18))] ?? null;
    return tema(`o${n}`, 'temario', `Tema ${n}`, estado, i, seccion, estado === 'pendiente' ? null : n % 4 === 0 ? '2026-10-19' : '2026-10-27');
  }),
  sesiones: [
    sesion('o-s1', 'temario', '2026-10-17', 150, 'o17'),
    sesion('o-s2', 'temario', '2026-10-18', 200, 'o18'),
  ],
  clases: [],
  notas: [
    { id: 'o-n1', asignaturaId: 'temario', titulo: 'Test · Simulacro 3', nota: 6.4, sobre: 10, peso: null, fecha: '2026-10-11' },
    { id: 'o-n2', asignaturaId: 'temario', titulo: 'Test · Simulacro 4', nota: 7.1, sobre: 10, peso: null, fecha: '2026-10-18' },
  ],
  mazos: [{ id: 'o-m1', asignaturaId: 'temario', nombre: 'Artículos de la Constitución' }],
  tarjetas: [
    { id: 'o-t1', mazoId: 'o-m1', anverso: 'Artículo 1.3', reverso: 'La forma política del Estado español es la Monarquía parlamentaria.', etapa: 1, vence: '2026-10-21' },
    { id: 'o-t2', mazoId: 'o-m1', anverso: 'Artículo 14', reverso: 'Igualdad ante la ley.', etapa: 2, vence: '2026-10-20' },
  ],
  prefs: prefs('oposicion', 300),
};

const temasDe = (a: string, nombres: readonly string[], visto = 0): Tema[] =>
  nombres.map((n, i) => tema(`${a}${i + 1}`, a, n, i < visto ? 'repasando' : 'pendiente', i, null, i < visto ? '2026-10-23' : null));

/** Universitario: cuatro exámenes en doce días, una entrega con hora y clases por la mañana. */
export const DEMO_UNIVERSITARIO: DatosFocus = {
  asignaturas: [asig('eda', 'Estructuras de datos', 0, 7), asig('bd', 'Bases de datos', 1), asig('red', 'Redes', 2), asig('cal', 'Cálculo', 3), asig('so', 'Sistemas operativos', 4)],
  examenes: [
    examen('u-1', 'eda', 'Parcial', '2026-10-24', 40, { hora: 9 * 60 }),
    examen('u-2', 'bd', 'Final', '2026-10-29', 60, { hora: 9 * 60 }),
    examen('u-3', 'red', 'Final', '2026-10-29', 10, { hora: 16 * 60 }),
    examen('u-4', 'cal', 'Final', '2026-11-01', 50),
    examen('u-5', 'so', 'Práctica 2', '2026-10-22', 20, { tipo: 'entrega', hora: 23 * 60 + 59 }),
  ],
  temas: [
    ...temasDe('eda', ['Listas', 'Pilas', 'Árboles', 'Montículos', 'Grafos', 'Hash'], 2),
    ...temasDe('bd', ['Modelo E/R', 'SQL', 'Normalización', 'Transacciones', 'Índices']),
    ...temasDe('red', ['Capa física', 'Enlace', 'IP', 'TCP']),
    ...temasDe('cal', ['Límites', 'Derivadas', 'Integrales', 'Series'], 1),
  ],
  sesiones: [sesion('u-s1', 'red', '2026-10-19', 300), sesion('u-s2', 'bd', '2026-10-20', 50), sesion('u-s3', 'eda', '2026-10-20', 75, 'eda2')],
  clases: [1, 2, 3, 4, 5].map((dia, i) => ({ id: `u-k${dia}`, asignaturaId: ['eda', 'bd', 'red', 'cal', 'so'][i]!, dia, inicio: 9 * 60, fin: 13 * 60, aula: null })),
  notas: [
    { id: 'u-n1', asignaturaId: 'eda', titulo: 'Parcial', nota: 6, sobre: 10, peso: 40, fecha: '2026-10-08' },
    { id: 'u-n2', asignaturaId: 'eda', titulo: 'Prácticas', nota: 7, sobre: 10, peso: 20, fecha: '2026-10-15' },
  ],
  mazos: [],
  tarjetas: [],
  prefs: prefs('universidad', 240),
};

const NOMBRES_BACH = ['Lengua', 'Historia de España', 'Inglés', 'Matemáticas II', 'Biología', 'Química', 'Física', 'Filosofía'];

/** Bachillerato: ocho asignaturas, horario fijo y deberes para mañana. */
export const DEMO_BACHILLERATO: DatosFocus = {
  asignaturas: NOMBRES_BACH.map((n, i) => asig(`b${i}`, n, i, n === 'Biología' ? 9 : null)),
  examenes: [
    examen('b-x1', 'b4', 'Control T3', '2026-10-27', 30),
    examen('b-x2', 'b1', 'La Generación del 27', '2026-11-04', 20),
    examen('b-d1', 'b3', 'Deberes pág. 45', '2026-10-22', null, { tipo: 'entrega' }),
    examen('b-d2', 'b2', 'Redacción', '2026-10-23', null, { tipo: 'entrega' }),
  ],
  temas: [
    ...temasDe('b4x', ['La célula', 'Mitosis', 'Meiosis', 'Genética'], 1).map((x) => ({ ...x, asignaturaId: 'b4' })),
    ...temasDe('b1x', ['El reinado de Alfonso XIII', 'La Segunda República', 'La Guerra Civil']).map((x) => ({ ...x, asignaturaId: 'b1' })),
  ],
  sesiones: [sesion('b-s1', 'b4', '2026-10-20', 25, 'b4x1')],
  clases: [1, 2, 3, 4, 5].flatMap((dia) =>
    [0, 1, 2, 3, 4, 5].map((h) => ({ id: `b-k${dia}${h}`, asignaturaId: `b${(dia + h) % 8}`, dia, inicio: 8 * 60 + h * 65, fin: 8 * 60 + h * 65 + 55, aula: null })),
  ),
  notas: [{ id: 'b-n1', asignaturaId: 'b4', titulo: 'Control T1', nota: 8.5, sobre: 10, peso: 30, fecha: '2026-10-05' }],
  mazos: [],
  tarjetas: [],
  prefs: prefs('instituto', 120),
};
