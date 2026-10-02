// NIVL · Packs FIJOS de herramientas por ruta (coach v2, L3).
//
// Módulo PURO (sin red ni Supabase). Una ruta estrecha no le enseña al modelo
// las 26 herramientas: solo las que su encargo necesita. Dos razones:
//   · Coste: las definiciones viajan en cada llamada (~8 k fichas las 26).
//   · Criterio: lo que no se ofrece no se puede llamar. Con todas a mano, un
//     «te he subido el gym» acabó en prescribir_entreno (medido tras L1).
//
// Cada pack es FIJO (no depende del mensaje ni del usuario): así el prefijo
// herramientas + sistema de la ruta es idéntico entre turnos y se puede cachear.
// El chat completo conserva TOOL_DEFS enteras: cambiar el conjunto por
// intención dentro de la ruta completa rompería su caché.

import { TOOL_DEFS } from './tools.ts';

/**
 * Ruta «registro»: leer lo que consta y apuntar lo que él cuenta.
 *   · consultar_dia / consultar_historial: solo leen.
 *   · registrar_dato: peso, comidas, misión hecha, regla cumplida (marca
 *     misiones y reglas de hoy; es el «marcar hecha» del coach).
 *   · registrar_hecho: la memoria del coach.
 * Fuera a propósito: prescribir_entreno, planificar_dia, crear_*,
 * gestionar_elemento, desactivar_mision, actualizar_dossier, escribir_diario…
 */
export const PACK_REGISTRO: readonly string[] = Object.freeze([
  'consultar_dia',
  'consultar_historial',
  'registrar_dato',
  'registrar_hecho',
]);

/**
 * Las que planifican, crean, cambian, borran o escriben en otros módulos
 * (dinero, diario, ficha): nunca en una ruta de registro. Junto con
 * PACK_REGISTRO clasifican TODAS las de TOOL_DEFS; una herramienta nueva sin
 * clasificar hace fallar ia2_ruta_registro_test.ts.
 */
export const ESCRITURA_DE_PLANIFICACION: readonly string[] = Object.freeze([
  'crear_mision', 'editar_mision', 'desactivar_mision', 'planificar_dia', 'programar_evento', 'fijar_horarios',
  'actualizar_dossier', 'crear_mazmorra', 'crear_tarea', 'registrar_regla', 'ajustar_meta', 'prescribir_entreno',
  'fijar_nutricion', 'planificar_comidas', 'configurar_rutina', 'fijar_plan_economico', 'fijar_presupuesto',
  'regla_categoria', 'registrar_movimiento', 'gestionar_elemento', 'escribir_diario', 'fijar_ficha',
]);

type ToolDef = (typeof TOOL_DEFS)[number];

/**
 * Las definiciones de un pack, filtradas de TOOL_DEFS y en SU orden (no en el
 * del pack): así el prefijo es estable aunque alguien reordene la lista de
 * arriba. Un nombre que no exista en TOOL_DEFS hace fallar al cargar: mejor
 * romper el despliegue que ofrecer un pack cojo sin que nadie lo vea.
 */
export function definicionesDelPack(pack: readonly string[], defs: readonly ToolDef[] = TOOL_DEFS): ToolDef[] {
  const nombres = new Set(defs.map((d) => d.name));
  const faltan = pack.filter((n) => !nombres.has(n));
  if (faltan.length) throw new Error(`Pack con herramientas inexistentes: ${faltan.join(', ')}`);
  const dentro = new Set(pack);
  return defs.filter((d) => dentro.has(d.name));
}

export const TOOL_DEFS_REGISTRO: readonly ToolDef[] = Object.freeze(definicionesDelPack(PACK_REGISTRO));

/**
 * ¿Puede el ejecutor correr esta llamada en esta ruta? null si sí; si no, el
 * error que verá el modelo. Es la segunda llave: aunque un proveedor devuelva
 * una herramienta que no se le ofreció, aquí se queda.
 */
export function fueraDelPack(nombre: string, pack: readonly string[]): string | null {
  return pack.includes(nombre)
    ? null
    : `La herramienta ${nombre} no está disponible en este turno de registro. Si pide algo más que apuntar o comprobar, dile en una línea que lo veis en el siguiente mensaje.`;
}
