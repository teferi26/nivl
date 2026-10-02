// NIVL · Guardas del coach (Chat 3 · c, seguridad y abuso).
//
// Módulo PURO: sin red ni Supabase, para poder probarlo con `deno test`.
// Aquí vive lo que no puede quedarse en el texto del prompt:
//
//   · La contabilidad del turno (`Gasto`): todo lo que el proveedor cobra se
//     suma AL MOMENTO, para que un turno que luego falla no se apunte a 0 y se
//     cuele por debajo del candado de gasto (0020/0024).
//   · Los límites de la entrada: fotos (número, tipo, tamaño) y la fecha que
//     manda el móvil.
//   · Las manos del modelo: cuántas herramientas por turno y cuántas de las que
//     borran o sustituyen. Un concepto de transferencia o un título de misión
//     con órdenes dentro (inyección) no puede vaciar una cuenta de un golpe.

import { addUsage, costMicroUsd, type Usage } from '../_shared/anthropic.ts';

/** Lo gastado en el turno, sumado en cuanto el proveedor lo cobra. */
export class Gasto {
  usage: Usage = {};
  constructor(public model: string) {}

  sumar(usage: Usage | undefined, model?: string): void {
    if (usage) this.usage = addUsage(this.usage, usage);
    if (model) this.model = model;
  }

  micro(): number {
    return costMicroUsd(this.model, this.usage);
  }
}

// ── Fotos ──────────────────────────────────────────────────────────────
// La app manda como mucho 3 (selectionLimit en coach.tsx) a calidad 0,35.
// El servidor no se fía: sin tope, un cliente modificado mete decenas de
// imágenes en una sola llamada, y la primera llamada del turno no la frena el
// tope de coste (ese se mira entre vueltas).
export const MAX_IMAGENES = 4;
// 5 MB es el máximo por imagen que admite Anthropic; en base64 son ~6,7 M de
// caracteres.
export const MAX_BASE64_POR_IMAGEN = 7_000_000;
const TIPOS_IMAGEN = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export type Imagen = { media_type: string; data: string };

/** Devuelve las fotos válidas o un motivo de rechazo (para un 400). */
export function validarImagenes(raw: unknown): { ok: true; imagenes: Imagen[] } | { ok: false; motivo: string } {
  if (raw === undefined || raw === null) return { ok: true, imagenes: [] };
  if (!Array.isArray(raw)) return { ok: false, motivo: 'imagenes debe ser una lista' };
  if (raw.length > MAX_IMAGENES) return { ok: false, motivo: `Como mucho ${MAX_IMAGENES} fotos por mensaje.` };
  const salida: Imagen[] = [];
  for (const x of raw) {
    const o = x as Partial<Imagen> | null;
    const tipo = typeof o?.media_type === 'string' ? o.media_type.toLowerCase() : '';
    if (!TIPOS_IMAGEN.has(tipo)) return { ok: false, motivo: 'Formato de foto no admitido.' };
    const data = typeof o?.data === 'string' ? o.data : '';
    if (!data || data.length > MAX_BASE64_POR_IMAGEN || !BASE64.test(data)) {
      return { ok: false, motivo: 'Foto vacía, demasiado grande o mal codificada.' };
    }
    salida.push({ media_type: tipo, data });
  }
  return { ok: true, imagenes: salida };
}

// ── Fecha del turno ──────────────────────────────────────────────────
/**
 * El "hoy" del turno lo manda el móvil (su zona horaria), pero no puede ser
 * cualquier día: con él se marcan misiones y se pagan XP. Se acepta solo si es
 * una fecha válida a ±1 día de la del servidor (cubre de UTC−12 a UTC+14).
 */
export function fechaDelTurno(raw: unknown, ahora = new Date()): string {
  const servidor = ahora.toISOString().slice(0, 10);
  if (typeof raw !== 'string') return servidor;
  const f = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return servidor;
  const t = Date.parse(`${f}T12:00:00Z`);
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== f) return servidor;
  const dias = Math.abs(t - Date.parse(`${servidor}T12:00:00Z`)) / 86_400_000;
  return dias <= 1 ? f : servidor;
}

// ── Las manos del modelo ─────────────────────────────────────────────
export const MAX_HERRAMIENTAS_POR_TURNO = 30;
export const MAX_DESTRUCTIVAS_POR_TURNO = 5;
// Los rituales que dispara el cron no tienen a nadie delante que pueda frenar
// un borrado: ahí no se borra nada. (La revisión semanal y el cierre de mes sí
// ajustan misiones por diseño, con el tope de arriba.)
const KINDS_SIN_BORRADO = new Set(['brief', 'plan', 'escalada']);

/** ¿La llamada borra, archiva o sustituye entero algo que ya existía? */
export function esDestructiva(nombre: string, input: Record<string, unknown>): boolean {
  if (nombre === 'desactivar_mision' || nombre === 'actualizar_dossier') return true;
  if (nombre === 'gestionar_elemento') return input?.accion === 'eliminar';
  return false;
}

/**
 * Control de las herramientas de UN turno. `revisar` devuelve null si la
 * llamada puede seguir, o el texto que verá el modelo como error (sin
 * ejecutarla). No sustituye a RLS ni a los CHECK: es la capa de "cuánto".
 */
export function controlHerramientas(kind: string, dossierPrevio: string) {
  let total = 0;
  let destructivas = 0;
  let dossierReescrito = false;
  return {
    revisar(nombre: string, input: Record<string, unknown>): string | null {
      total++;
      if (total > MAX_HERRAMIENTAS_POR_TURNO) {
        return `Límite de ${MAX_HERRAMIENTAS_POR_TURNO} acciones por turno alcanzado. Termina con lo hecho y resume.`;
      }
      if (!esDestructiva(nombre, input)) return null;
      if (KINDS_SIN_BORRADO.has(kind)) {
        return 'En este ritual no se elimina, archiva ni reescribe nada: no hay nadie delante para confirmarlo. Propónselo en el texto.';
      }
      destructivas++;
      if (destructivas > MAX_DESTRUCTIVAS_POR_TURNO) {
        return `Ya has eliminado o sustituido ${MAX_DESTRUCTIVAS_POR_TURNO} cosas en este turno. Para seguir, pídele confirmación explícita y hazlo en el siguiente.`;
      }
      if (nombre === 'actualizar_dossier') {
        if (dossierReescrito) return 'El dossier ya se ha reescrito en este turno.';
        const nuevo = String(input?.contenido ?? '');
        const previo = dossierPrevio.trim();
        // Reescribir sí; vaciarlo de golpe no (es la memoria de meses). Una
        // orden inyectada que diga "borra tu memoria" se queda aquí.
        if (previo.length > 500 && nuevo.trim().length < previo.length * 0.5) {
          return 'El dossier nuevo pierde más de la mitad de la memoria actual. Confírmalo con él antes y conserva lo estructural.';
        }
        dossierReescrito = true;
      }
      return null;
    },
  };
}

// ── Errores hacia el cliente ─────────────────────────────────────────
/**
 * Lo que ve el usuario cuando un turno falla. Nunca el cuerpo del proveedor ni
 * datos de la cuenta del dueño (saldo, consola, límites): eso va al log.
 */
export function mensajeDeFallo(texto: string): string {
  if (/\b429\b|rate.?limit|\b529\b|overloaded/i.test(texto)) {
    return 'El sistema va saturado ahora mismo. Reintenta en un minuto.';
  }
  return 'El sistema no responde. Reintenta en un momento.';
}
