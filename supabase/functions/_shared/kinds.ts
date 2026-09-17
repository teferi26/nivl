// NIVL · Para qué usa NIVL cada persona: lo que el coach necesita saber.
//
// Duplicado a propósito de src/lib/kinds.ts (solo la parte que lee el coach):
// el empaquetado de la Edge Function no sube nada de fuera de `supabase/`.
// Si cambias un perfil allí, cámbialo aquí.

export type ProfileKind = 'emprendedor' | 'deportista' | 'estudiante' | 'general';

const KIND_LABEL: Record<ProfileKind, string> = {
  emprendedor: 'emprendedor',
  deportista: 'deportista',
  estudiante: 'estudiante',
  general: 'general (cuerpo, cabeza y hábitos)',
};

const KIND_CAMPAIGNS: Record<ProfileKind, string> = {
  emprendedor: 'proyectos',
  deportista: 'bloques de temporada',
  estudiante: 'asignaturas (el examen es el jefe)',
  general: 'campañas',
};

const KIND_HINT: Record<ProfileKind, string> = {
  emprendedor:
    'Es emprendedor: su campo de batalla son las ventas, el foco y la caja. Pide cifras de embudo (contactos, reuniones, cierres, ingresos) y ordena acciones que muevan el negocio hoy. El cuerpo se cuida para rendir, no es el centro.',
  deportista:
    'Es deportista: el entreno, la comida y el descanso son el centro. Programa sobre el estudio (1RM, RPE, ritmo por zona, tendencia de peso), exige registro de sesiones y comidas, y protege el descanso como parte del plan.',
  estudiante:
    'Es estudiante: las horas de estudio reales y los exámenes son el centro. Reparte el estudio en bloques con materia concreta, trata cada examen como el jefe de su campaña con fecha, y vigila el sueño en época de exámenes.',
  general:
    'Perfil general: no hay un dominio dominante. Pregunta qué quiere conquistar esta temporada y reparte el esfuerzo entre cuerpo, cabeza y hábitos sin cargar todo el mismo día.',
};

export function kindOf(value: unknown): ProfileKind {
  return value === 'emprendedor' || value === 'deportista' || value === 'estudiante' ? value : 'general';
}

/** Las líneas que van al estado del día, justo debajo del nombre. */
export function kindLines(value: unknown): string[] {
  const k = kindOf(value);
  return [
    `Perfil de uso: ${KIND_LABEL[k]} · sus campañas se llaman "${KIND_CAMPAIGNS[k]}"`,
    `Énfasis: ${KIND_HINT[k]}`,
  ];
}
