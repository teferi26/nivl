// NIVL · La prueba automática de Élite (plan `prueba_auto`, migración 0069):
// qué pantalla toca y cuándo (puro, con test).
//
// Decisión del dueño (18/10): la prueba es Élite completo durante
// `prueba_auto_dias` (2), con el coach en el modelo económico y un tope
// diario de mensajes. Al empezar, una bienvenida (una vez); a 24 h del
// final, un aviso suave dentro de la app (una vez); al terminar sin compra,
// la pantalla de fin con las dos salidas, que vuelve como mucho una vez cada
// 7 días si se elige el plan gratis. Una compra cambia `subscriptions.plan`
// y todo esto desaparece.
//
// Todo detrás de `prueba_auto_activa`: apagado, ninguna pantalla.
// Los efectos (lectura de `subscriptions`, marcas en el teléfono) están en
// pruebaAuto.ts.

import { PRO_PLANS } from './proplans';

export const HORA_MS = 3_600_000;
export const DIA_MS = 24 * HORA_MS;
/** El aviso suave sale cuando queda esto o menos. */
export const AVISO_ANTES_MS = DIA_MS;
/** Tras «Quedarme en el plan gratis», no se vuelve a insistir antes de esto. */
export const INSISTIR_CADA_MS = 7 * DIA_MS;

/** La fila de `subscriptions` que importa (lo que la RLS deja leer al dueño). */
export interface SuscripcionPrueba {
  plan: string | null;
  status: string | null;
  current_period_end: string | null;
}

export type EstadoPrueba =
  | { tipo: 'ninguna' }
  | { tipo: 'activa'; fin: string }
  | { tipo: 'vencida'; fin: string };

/**
 * ¿En qué punto está la prueba automática? Solo cuenta la fila con
 * `plan = 'prueba_auto'`: una compra (RevenueCat o Stripe) la sustituye y ya
 * no hay prueba de la que hablar.
 */
export function estadoPrueba(sub: SuscripcionPrueba | null | undefined, ahora: number): EstadoPrueba {
  if (!sub || sub.plan !== 'prueba_auto' || !sub.current_period_end) return { tipo: 'ninguna' };
  const fin = Date.parse(sub.current_period_end);
  if (!Number.isFinite(fin)) return { tipo: 'ninguna' };
  if (fin > ahora && sub.status === 'trialing') return { tipo: 'activa', fin: sub.current_period_end };
  if (fin <= ahora) return { tipo: 'vencida', fin: sub.current_period_end };
  // Cancelada antes de tiempo (status distinto con fin futuro): nada que decir.
  return { tipo: 'ninguna' };
}

/** Lo que ya se ha enseñado en este teléfono, por cuenta y por prueba (su fin). */
export interface MarcasPrueba {
  /** Fin de la prueba cuya bienvenida ya se vio. */
  bienvenida: string | null;
  /** Fin de la prueba cuyo aviso de 24 h ya se dio. */
  aviso: string | null;
  /** Cuándo eligió «Quedarme en el plan gratis» por última vez (ms). */
  gratisEn: number | null;
}

export const MARCAS_VACIAS: MarcasPrueba = { bienvenida: null, aviso: null, gratisEn: null };

export type PantallaPrueba = 'bienvenida' | 'aviso' | 'fin' | null;

export function pantallaPrueba(entrada: {
  activa: boolean;
  estado: EstadoPrueba;
  marcas: MarcasPrueba;
  ahora: number;
}): PantallaPrueba {
  const { activa, estado, marcas, ahora } = entrada;
  if (!activa) return null;
  if (estado.tipo === 'activa') {
    if (marcas.bienvenida !== estado.fin) return 'bienvenida';
    const queda = Date.parse(estado.fin) - ahora;
    if (queda <= AVISO_ANTES_MS && marcas.aviso !== estado.fin) return 'aviso';
    return null;
  }
  if (estado.tipo === 'vencida') {
    if (marcas.gratisEn !== null && ahora - marcas.gratisEn < INSISTIR_CADA_MS) return null;
    return 'fin';
  }
  return null;
}

/** «sábado, 20 de octubre» y «21:30», en la zona horaria del teléfono. */
export function fechaHoraLocal(iso: string): { fecha: string; hora: string } {
  const d = new Date(iso);
  const fecha = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { fecha, hora };
}

/**
 * Las marcas tras cerrar la bienvenida. Si ya queda un día o menos, el aviso
 * de 24 h también se da por dado: la bienvenida ya dice cuándo termina.
 */
export function trasBienvenida(marcas: MarcasPrueba, estado: EstadoPrueba, ahora: number): MarcasPrueba {
  if (estado.tipo !== 'activa') return marcas;
  const corta = Date.parse(estado.fin) - ahora <= AVISO_ANTES_MS;
  return { ...marcas, bienvenida: estado.fin, aviso: corta ? estado.fin : marcas.aviso };
}

/** De lo guardado en el teléfono a marcas válidas (basura → vacías). */
export function marcasDe(raw: unknown): MarcasPrueba {
  if (!raw || typeof raw !== 'object') return { ...MARCAS_VACIAS };
  const r = raw as Record<string, unknown>;
  return {
    bienvenida: typeof r.bienvenida === 'string' ? r.bienvenida : null,
    aviso: typeof r.aviso === 'string' ? r.aviso : null,
    gratisEn: typeof r.gratisEn === 'number' && Number.isFinite(r.gratisEn) ? r.gratisEn : null,
  };
}

/** Lo que da la tienda para la pantalla de fin (pro.ts → ofertaFinPrueba). */
export interface OfertaTiendaFin {
  eliteMes: string | null;
  eliteAnio: string | null;
  proMes: string | null;
  introGratis: string | null;
  introCondicional: boolean;
}

/**
 * Los precios que se enseñan junto a «Seguir con Élite»: los de la tienda
 * (los que se cobran) y, si no los da (sin tienda o sin red), los de la
 * tabla de PRECIOS.md. La oferta introductoria solo se dice si la declara
 * la tienda con su precio: con el de la tabla no se promete.
 */
export function preciosFin(oferta: OfertaTiendaFin | null | undefined): {
  eliteMes: string;
  eliteAnio: string;
  proMes: string;
  introGratis: string | null;
  introCondicional: boolean;
} {
  const tabla = (id: string) => PRO_PLANS.find((p) => p.id === id)!.price;
  return {
    eliteMes: oferta?.eliteMes ?? tabla('nivl_elite_mensual'),
    eliteAnio: oferta?.eliteAnio ?? tabla('nivl_elite_anual'),
    proMes: oferta?.proMes ?? tabla('nivl_pro_mensual'),
    introGratis: oferta?.eliteMes && oferta.introGratis ? oferta.introGratis : null,
    introCondicional: !!oferta?.introCondicional,
  };
}
