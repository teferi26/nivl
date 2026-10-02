// NIVL · Tarjetas para compartir: la parte pura.
//
// Aquí se decide QUÉ se pinta y CÓMO se reparte el lienzo; el componente de
// `src/components/share/` solo dibuja lo que esto devuelve y `share.ts` lo
// captura y lo saca por la hoja del sistema. Sin imports de Supabase ni de
// React Native: así se prueba con Jest sin arrancar nada.
//
// Dos formatos fijos, medidos en píxeles del archivo final:
//   - stories 1080×1920 (9:16): Instagram tapa unos 250 px arriba (perfil y
//     barra de progreso) y otros tantos abajo (respuesta), así que el
//     contenido importante vive dentro de la zona segura.
//   - post 1080×1350 (4:5): el máximo vertical del feed.
// Todo se expresa en `u` (1/100 del ancho): la vista previa del móvil y el
// PNG/JPG final son la misma pieza a distinta escala.
//
// Privacidad (requisitos del Chat 3, docs/ia-v2/requisitos-seguridad.md §3):
// una tarjeta sale del móvil y la puede ver cualquiera. Lleva solo una lista
// cerrada: nivel, rango, título, racha, logro y, si se permite, el ALIAS
// público (nunca el nombre real). Por defecto NO lleva datos de salud (peso,
// fotos corporales); cada cosa se activa a propósito en la hoja de compartir
// (`OpcionesTarjeta`), que abre siempre con todo apagado. Una tarjeta
// antes/después sin permiso para las fotos no se puede generar.

import { DOMINIO_NIVL, URL_NIVL } from './socialmath';

export type FormatoTarjeta = 'stories' | 'post';

export const DIMENSIONES: Record<FormatoTarjeta, { ancho: number; alto: number }> = {
  stories: { ancho: 1080, alto: 1920 },
  post: { ancho: 1080, alto: 1350 },
};

/** Margen que Instagram tapa en Stories (px del archivo final, 1080 de ancho). */
export const ZONA_TAPADA_STORIES = 250;
/** Margen lateral común a los dos formatos (px del archivo final). */
export const MARGEN_LATERAL = 80;

export interface Foto {
  /** URI local (ya descargada a caché): nunca una URL firmada que caduque. */
  uri: string;
  /** ISO yyyy-mm-dd del día de la foto. */
  fecha: string;
}

export type Tarjeta =
  | { tipo: 'logro'; titulo: string; descripcion?: string }
  | { tipo: 'nivel'; nivel: number; rango?: string }
  | { tipo: 'rango'; rango: string; titulo?: string }
  | { tipo: 'racha'; dias: number }
  | {
      tipo: 'antesDespues';
      antes: Foto;
      despues: Foto;
      /** Peso en kg en cada foto, si existe. Dato de salud: solo con `mostrarPeso`. */
      pesoAntesKg?: number | null;
      pesoDespuesKg?: number | null;
    };

export type TipoTarjeta = Tarjeta['tipo'];

/** Lo que el usuario decide en la hoja de compartir. Todo en false por defecto. */
export interface OpcionesTarjeta {
  /** Firma con el alias público aprobado (nunca el nombre real). */
  mostrarNombre: boolean;
  /** Fotos de cuerpo o de gimnasio: dato de salud. Obligatorio para antes/después. */
  mostrarFotos: boolean;
  /** Peso (y su diferencia): dato de salud. */
  mostrarPeso: boolean;
}

export const OPCIONES_POR_DEFECTO: OpcionesTarjeta = Object.freeze({
  mostrarNombre: false,
  mostrarFotos: false,
  mostrarPeso: false,
});

export interface Lienzo {
  formato: FormatoTarjeta;
  /** Tamaño en el que se pinta (puntos de la vista). */
  ancho: number;
  alto: number;
  /** 1/100 del ancho: la unidad de todas las medidas. */
  u: number;
  /** Factor entre el lienzo pintado y el archivo final (ancho final / ancho). */
  escalaArchivo: number;
  /** Zona donde va el contenido importante. */
  seguro: { arriba: number; abajo: number; lados: number };
}

/**
 * Reparte el lienzo para un formato y el ancho disponible en pantalla. Con
 * `anchoVista` = 1080 devuelve el archivo final 1:1.
 */
export function lienzo(formato: FormatoTarjeta, anchoVista: number = DIMENSIONES[formato].ancho): Lienzo {
  const { ancho: anchoFinal, alto: altoFinal } = DIMENSIONES[formato];
  const ancho = anchoVista > 0 && Number.isFinite(anchoVista) ? anchoVista : anchoFinal;
  const k = ancho / anchoFinal;
  const vertical = formato === 'stories' ? ZONA_TAPADA_STORIES : MARGEN_LATERAL;
  return {
    formato,
    ancho,
    alto: altoFinal * k,
    u: ancho / 100,
    escalaArchivo: anchoFinal / ancho,
    seguro: { arriba: vertical * k, abajo: vertical * k, lados: MARGEN_LATERAL * k },
  };
}

/** Corta por palabra y añade «…» si pasa de `max` caracteres. */
export function recortar(texto: string, max: number): string {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  if (max <= 1) return limpio.slice(0, Math.max(0, max));
  if ([...limpio].length <= max) return limpio;
  const corte = [...limpio].slice(0, max - 1).join('');
  const espacio = corte.lastIndexOf(' ');
  const base = espacio >= max * 0.6 ? corte.slice(0, espacio) : corte;
  return `${base.replace(/[\s.,;:·-]+$/, '')}…`;
}

export const MAX_TITULAR = 28;
export const MAX_DETALLE = 90;
export const MAX_NOMBRE = 22;

export interface TextosTarjeta {
  /** Línea pequeña de arriba: qué es ("LOGRO DESBLOQUEADO"). */
  antetitulo: string;
  /** Lo grande. */
  titular: string;
  /** Una frase de apoyo, o null. */
  detalle: string | null;
  /** Firma de abajo: nombre (si se permite) y dominio. */
  firma: string;
}

function dias(n: number): string {
  return n === 1 ? '1 día' : `${n} días`;
}

function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '';
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const mes = meses[Number(m[2]) - 1];
  return mes ? `${Number(m[3])} ${mes} ${m[1]}` : '';
}

function kg(n: number): string {
  return `${(Math.round(n * 10) / 10).toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg`;
}

/**
 * El copy de la tarjeta, en la voz del sistema: constata, sin exclamaciones ni
 * emojis. Respeta las opciones de privacidad: lo que no se permite no aparece
 * ni en el texto.
 */
export function textos(t: Tarjeta, opciones: OpcionesTarjeta = OPCIONES_POR_DEFECTO, alias?: string | null): TextosTarjeta {
  const quien = opciones.mostrarNombre && alias && alias.trim() ? recortar(alias, MAX_NOMBRE) : null;
  const firma = quien ? `${quien} · ${DOMINIO_NIVL}` : DOMINIO_NIVL;
  switch (t.tipo) {
    case 'logro':
      return {
        antetitulo: 'LOGRO DESBLOQUEADO',
        titular: recortar(t.titulo, MAX_TITULAR),
        detalle: t.descripcion ? recortar(t.descripcion, MAX_DETALLE) : null,
        firma,
      };
    case 'nivel': {
      const nivel = Math.max(1, Math.floor(t.nivel));
      return {
        antetitulo: 'SUBIDA DE NIVEL',
        titular: `NIVEL ${nivel}`,
        detalle: t.rango ? `Gladiador de rango ${t.rango}.` : 'El sistema registra el avance.',
        firma,
      };
    }
    case 'rango':
      return {
        antetitulo: 'NUEVO RANGO',
        titular: `RANGO ${t.rango}`,
        detalle: t.titulo ? recortar(t.titulo, MAX_DETALLE) : 'La arena reconoce el ascenso.',
        firma,
      };
    case 'racha': {
      const n = Math.max(0, Math.floor(t.dias));
      return {
        antetitulo: 'RACHA',
        titular: dias(n).toUpperCase(),
        detalle: n === 0 ? 'Hoy empieza la cuenta.' : `${dias(n)} seguidos cumpliendo.`,
        firma,
      };
    }
    case 'antesDespues': {
      const desde = fechaCorta(t.antes.fecha);
      const hasta = fechaCorta(t.despues.fecha);
      const periodo = desde && hasta ? `${desde} → ${hasta}` : null;
      const pesos =
        opciones.mostrarPeso && typeof t.pesoAntesKg === 'number' && typeof t.pesoDespuesKg === 'number'
          ? `${kg(t.pesoAntesKg)} → ${kg(t.pesoDespuesKg)}`
          : null;
      return {
        antetitulo: 'PROGRESO',
        titular: 'ANTES Y DESPUÉS',
        detalle: [periodo, pesos].filter(Boolean).join(' · ') || null,
        firma,
      };
    }
  }
}

/** Por qué una tarjeta no se puede generar con estas opciones, o null si se puede. */
export function bloqueo(t: Tarjeta, opciones: OpcionesTarjeta): string | null {
  if (t.tipo === 'antesDespues') {
    if (!opciones.mostrarFotos) return 'Para compartir el antes y después tienes que permitir las fotos.';
    if (!t.antes.uri || !t.despues.uri) return 'Faltan fotos para comparar.';
    if (t.antes.fecha > t.despues.fecha) return 'La foto de antes es posterior a la de después.';
  }
  if (t.tipo === 'logro' && !t.titulo.trim()) return 'El logro no tiene nombre.';
  return null;
}

/** Fotos que la tarjeta puede pintar (vacío si no hay permiso). */
export function fotosVisibles(t: Tarjeta, opciones: OpcionesTarjeta): Foto[] {
  if (t.tipo !== 'antesDespues' || !opciones.mostrarFotos) return [];
  return [t.antes, t.despues];
}

/**
 * Formato del archivo: con foto, JPG (una foto en PNG a 1080×1920 pasa
 * fácilmente de 4 MB); sin foto, PNG (texto nítido y fondo plano).
 */
export function formatoArchivo(t: Tarjeta, opciones: OpcionesTarjeta): { formato: 'png' | 'jpg'; calidad: number } {
  return fotosVisibles(t, opciones).length > 0 ? { formato: 'jpg', calidad: 0.9 } : { formato: 'png', calidad: 1 };
}

/** "nivl-logro-2026-10-02-stories.png": legible en la galería, sin datos personales. */
export function nombreArchivo(t: Tarjeta, formato: FormatoTarjeta, extension: 'png' | 'jpg', hoyIso: string): string {
  const fecha = /^\d{4}-\d{2}-\d{2}/.test(hoyIso) ? hoyIso.slice(0, 10) : 'hoy';
  const tipo = t.tipo === 'antesDespues' ? 'progreso' : t.tipo;
  return `nivl-${tipo}-${fecha}-${formato}.${extension}`;
}

/** Enlace que acompaña a la tarjeta: con código de amigo lleva a la invitación. */
export function enlace(codigoAmigo?: string | null): string {
  const codigo = (codigoAmigo ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(codigo) ? `${URL_NIVL}/c/${codigo}` : URL_NIVL;
}

/** Texto que viaja con la imagen en la hoja del sistema (y solo él si no hay imagen). */
export function mensaje(t: Tarjeta, opciones: OpcionesTarjeta = OPCIONES_POR_DEFECTO, codigoAmigo?: string | null): string {
  const x = textos(t, opciones);
  const titular = x.titular.charAt(0) + x.titular.slice(1).toLowerCase();
  const cuerpo = t.tipo === 'logro' ? `${x.antetitulo.charAt(0)}${x.antetitulo.slice(1).toLowerCase()}: ${x.titular}` : titular;
  return `${cuerpo} en NIVL. ${enlace(codigoAmigo)}`;
}
