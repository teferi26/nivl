// NIVL · FOCUS: «estudiar esto ahora» desde otra pestaña (Temario, Exámenes).
// Deja el encargo aquí y va a Hoy; Hoy lo recoge y apunta el bloque a ese tema.

import { router } from 'expo-router';
import { rutaFocus } from '@/components/modos/mundo/prestadoRutas';

export interface Pedido {
  asignaturaId: string;
  temaId: string | null;
}

let pendiente: Pedido | null = null;
const oyentes = new Set<(p: Pedido) => void>();

export function pedirEstudio(p: Pedido): void {
  pendiente = p;
  for (const o of oyentes) o(p);
  router.navigate(rutaFocus('hoy'));
}

/** Hoy se suscribe; si había un encargo esperando, lo recibe al momento. */
export function escucharPedidos(o: (p: Pedido) => void): () => void {
  oyentes.add(o);
  if (pendiente) o(pendiente);
  return () => {
    oyentes.delete(o);
  };
}

export function pedidoAtendido(): void {
  pendiente = null;
}
