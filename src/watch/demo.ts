// NIVL · Apple Watch: un estado de ejemplo (el mismo que pinta el reloj con
// el interruptor de demo, targets/watch/Demo.swift). Sirve para los tests del
// contrato y para enseñar el reloj sin servidor.

import { VERSION_CONTRATO, type EstadoReloj } from './contrato';

export const ESTADO_DEMO: EstadoReloj = {
  v: VERSION_CONTRATO,
  generadoEn: 0,
  fecha: '2026-11-07',
  sesion: true,
  misiones: [
    { id: 'demo-1', titulo: 'Entrenar pierna', dificultad: 'dificil', premio: 110, unidad: 'XP', enlace: 'gym', hecha: false, penalizacion: false, extra: false, requiereFoto: false, bloqueada: false },
    { id: 'demo-2', titulo: 'Leer 20 páginas', dificultad: 'media', premio: 55, unidad: 'XP', enlace: null, hecha: false, penalizacion: false, extra: false, requiereFoto: false, bloqueada: false },
    { id: 'demo-3', titulo: 'Foto de la comida', dificultad: 'facil', premio: 28, unidad: 'XP', enlace: 'nutricion', hecha: false, penalizacion: false, extra: false, requiereFoto: true, bloqueada: false },
    { id: 'demo-4', titulo: 'Meditar 10 minutos', dificultad: 'facil', premio: 3, unidad: 'PB', enlace: null, hecha: false, penalizacion: false, extra: true, requiereFoto: false, bloqueada: false },
    { id: 'demo-5', titulo: 'Despertar a las 6:30', dificultad: 'media', premio: 55, unidad: 'XP', enlace: null, hecha: true, penalizacion: false, extra: false, requiereFoto: false, bloqueada: false },
  ],
  racha: 23,
  rachaCerrada: false,
  nivel: 14,
  xpEnNivel: 3120,
  xpSiguiente: 5238,
  rango: 'D',
  titulo: 'Gladiador de bronce',
  piedras: 2,
  piedrasMax: 3,
  focus: { fase: 'foco', situacion: 'en_marcha', finEn: null, restanteMs: 14 * 60_000 + 32_000, totalMs: 25 * 60_000, bloque: 2, cadaLargo: 4 },
  iron: { ejercicio: 'Sentadilla', serie: 3, series: 4, reps: '5', carga: 100, descansoS: 180, siguiente: 'Sentadilla' },
  saludAceptada: null,
  dueno: null,
};
