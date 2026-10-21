// NIVL · FOCUS: los métodos de estudio (puro). Los textos van en i18n
// (`focus:metodos.<id>.*`); aquí, el orden, el icono, cuántos pasos tiene cada
// uno y a dónde lleva su acción.
//
// Fuentes de la doctrina (resumida en los textos): práctica de recuperación
// (Roediger y Karpicke, 2006), efecto de espaciado (Cepeda y otros, 2006),
// técnica Feynman, sistema Leitner para tarjetas, mapas mentales (Buzan) y
// práctica con exámenes anteriores. Nada promete resultados.

export type IdMetodo = 'recuerdo' | 'espaciada' | 'feynman' | 'flashcards' | 'mapas' | 'anteriores' | 'pomodoro';

/** Lo que hace el botón de cada método. */
export type AccionMetodo = 'bloque' | 'repasos' | 'flashcards' | 'examenes';

export interface Metodo {
  id: IdMetodo;
  /** Nombre de Ionicons. */
  icono: string;
  pasos: number;
  accion: AccionMetodo;
}

export const METODOS: readonly Metodo[] = [
  { id: 'recuerdo', icono: 'bulb-outline', pasos: 4, accion: 'bloque' },
  { id: 'espaciada', icono: 'calendar-outline', pasos: 4, accion: 'repasos' },
  { id: 'feynman', icono: 'chatbox-ellipses-outline', pasos: 4, accion: 'bloque' },
  { id: 'flashcards', icono: 'albums-outline', pasos: 4, accion: 'flashcards' },
  { id: 'mapas', icono: 'git-network-outline', pasos: 4, accion: 'bloque' },
  { id: 'anteriores', icono: 'document-text-outline', pasos: 4, accion: 'examenes' },
  { id: 'pomodoro', icono: 'timer-outline', pasos: 3, accion: 'bloque' },
];

export function metodoPorId(id: unknown): Metodo | null {
  return METODOS.find((m) => m.id === id) ?? null;
}
