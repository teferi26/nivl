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
  | {
      tipo: 'nivel';
      nivel: number;
      rango?: string;
      /** Nombre del rango («Campeón»). */
      nombreRango?: string;
      /** Progreso dentro del nivel, 0–1 (xpEnNivel / xpSiguiente del Chat 5). */
      progreso?: number;
      rachaDias?: number;
    }
  | { tipo: 'rango'; rango: string; titulo?: string; rachaDias?: number }
  | {
      tipo: 'racha';
      dias: number;
      /** Los últimos 30 días, del más antiguo al de hoy (true = cumplido). */
      ultimos30?: readonly boolean[];
    }
  | {
      tipo: 'antesDespues';
      antes: Foto;
      despues: Foto;
      /** Peso en kg en cada foto, si existe. Dato de salud: solo con `mostrarPeso`. */
      pesoAntesKg?: number | null;
      pesoDespuesKg?: number | null;
    }
  | {
      /** El parte de la semana (lo que pintaba ShareCardSemana). */
      tipo: 'semana';
      xpSemana: number;
      nivel: number;
      /** null = no tenía misiones programadas: se enseñan los días activos. */
      cumplimientoPct: number | null;
      diasActivos: number;
      rachaDias: number;
      /** «2.º de 5», o null si aún no hay amigos. */
      posicion: string | null;
    }
  | {
      /** Una diapositiva de Recuerdos (resumen.tsx). */
      tipo: 'recuerdo';
      /** La etiqueta de la diapositiva («Evidencia», «Cierre»…). */
      etiqueta: string;
      /** La cifra destacada, si la hay. */
      dato?: string | null;
      titulo: string;
      /** El texto que escribe el coach: solo con `mostrarTextoCoach`. */
      texto?: string | null;
      /** Foto de evidencia: puede ser corporal, así que se trata como las de progreso. */
      foto?: Foto | null;
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
  /** Añadir el enlace de invitación con el código de amigo (nivl.app/c/CODIGO). */
  incluirInvitacion: boolean;
  /** Recuerdo: incluir el texto que escribió el coach (Chat 3: notas del coach, opt-in). */
  mostrarTextoCoach: boolean;
}

export const OPCIONES_POR_DEFECTO: OpcionesTarjeta = Object.freeze({
  mostrarNombre: false,
  mostrarFotos: false,
  mostrarPeso: false,
  incluirInvitacion: false,
  mostrarTextoCoach: false,
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
  /** Firma completa (alias · dominio) para el texto que acompaña a la imagen. */
  firma: string;
  /** Pie de la tarjeta: alias a la izquierda (solo si se permite) y dominio a la derecha. */
  alias: string | null;
  dominio: string;
  /** «Día N de racha» en nivel y rango, o null. */
  racha: string | null;
  /** Antes/después: la fecha de cada foto («2 jul 2026»). */
  fechas: [string, string] | null;
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

/** «13 semanas» entre dos fechas ISO; «1 semana»; días si es menos de una semana. */
function semanasEntre(desdeIso: string, hastaIso: string): string | null {
  const a = Date.parse(desdeIso.slice(0, 10));
  const b = Date.parse(hastaIso.slice(0, 10));
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  const d = Math.round((b - a) / 86_400_000);
  if (d < 7) return dias(d);
  const w = Math.round(d / 7);
  return w === 1 ? '1 semana' : `${w} semanas`;
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
  const conRacha = (n?: number) => (n && n > 0 ? `Día ${Math.floor(n)} de racha` : null);
  const pie = { firma, alias: quien, dominio: DOMINIO_NIVL, racha: null, fechas: null } as const;
  switch (t.tipo) {
    case 'logro':
      return {
        antetitulo: 'LOGRO DESBLOQUEADO',
        titular: recortar(t.titulo, MAX_TITULAR),
        detalle: t.descripcion ? recortar(t.descripcion, MAX_DETALLE) : null,
        ...pie,
      };
    case 'nivel': {
      const nivel = Math.max(1, Math.floor(t.nivel));
      return {
        antetitulo: 'NUEVO NIVEL',
        titular: `NIVEL ${nivel}`,
        detalle: t.rango ? (t.nombreRango ? `Rango ${t.rango} · ${t.nombreRango}` : `Rango ${t.rango}`) : null,
        ...pie,
        racha: conRacha(t.rachaDias),
      };
    }
    case 'rango':
      return {
        antetitulo: 'NUEVO RANGO',
        titular: `RANGO ${t.rango}`,
        detalle: t.titulo ? recortar(t.titulo, MAX_DETALLE).toUpperCase() : null,
        ...pie,
        racha: conRacha(t.rachaDias),
      };
    case 'racha': {
      const n = Math.max(0, Math.floor(t.dias));
      return {
        antetitulo: 'RACHA',
        titular: dias(n).toUpperCase(),
        detalle: n === 0 ? 'Hoy empieza la cuenta.' : `${dias(n)} seguidos cumpliendo.`,
        ...pie,
      };
    }
    case 'antesDespues': {
      const desde = fechaCorta(t.antes.fecha);
      const hasta = fechaCorta(t.despues.fecha);
      const periodo = semanasEntre(t.antes.fecha, t.despues.fecha);
      const pesos =
        opciones.mostrarPeso && typeof t.pesoAntesKg === 'number' && typeof t.pesoDespuesKg === 'number'
          ? `${kg(t.pesoAntesKg)} → ${kg(t.pesoDespuesKg)}`
          : null;
      return {
        antetitulo: 'ANTES / DESPUÉS',
        titular: 'ANTES Y DESPUÉS',
        detalle: [periodo, pesos].filter(Boolean).join(' · ') || null,
        ...pie,
        fechas: [desde, hasta],
      };
    }
    case 'semana': {
      const xp = Math.max(0, Math.floor(t.xpSemana));
      return {
        antetitulo: 'PARTE DE LA SEMANA',
        titular: xp > 0 ? `+${xp.toLocaleString('es-ES')} XP` : `NIVEL ${Math.max(1, Math.floor(t.nivel))}`,
        detalle: xp > 0 ? 'Ganados en los últimos 7 días.' : null,
        ...pie,
      };
    }
    case 'recuerdo':
      return {
        antetitulo: recortar(t.etiqueta, 24).toUpperCase(),
        titular: recortar(t.titulo, 60),
        detalle: opciones.mostrarTextoCoach && t.texto ? recortar(t.texto, 140) : null,
        ...pie,
      };
  }
}

export interface Cifra {
  valor: string;
  rotulo: string;
}

/** Las tres cifras del parte de la semana: cumplimiento, racha y puesto (si lo hay). */
export function cifrasSemana(t: Extract<Tarjeta, { tipo: 'semana' }>): Cifra[] {
  const c: Cifra[] = [
    t.cumplimientoPct === null
      ? { valor: `${Math.max(0, Math.min(7, Math.floor(t.diasActivos)))}/7`, rotulo: 'DÍAS ACTIVOS' }
      : { valor: `${Math.max(0, Math.min(100, Math.round(t.cumplimientoPct)))} %`, rotulo: 'CUMPLIMIENTO' },
    { valor: String(Math.max(0, Math.floor(t.rachaDias))), rotulo: t.rachaDias === 1 ? 'DÍA DE RACHA' : 'DÍAS DE RACHA' },
  ];
  const m = t.posicion ? /^(\S+)\s+(.+)$/.exec(t.posicion.trim()) : null;
  if (m) c.push({ valor: m[1], rotulo: `PUESTO ${m[2].toUpperCase()}` });
  return c;
}

/** El código de amigo que se pinta en la tarjeta: solo si se ha elegido invitar. */
export function codigoVisible(opciones: OpcionesTarjeta, codigoAmigo?: string | null): string | null {
  const codigo = (codigoAmigo ?? '').trim().toUpperCase();
  return opciones.incluirInvitacion && /^[A-Z0-9]{4,12}$/.test(codigo) ? codigo : null;
}

/** Lo que la tarjeta necesita saber de quien comparte (no lo elige el usuario). */
export interface ContextoTarjeta {
  /**
   * Las fotos corporales solo se comparten con 18+ verificados Y consentimiento
   * de salud vigente (decisión del coordinador, 02/10). Quien llama pasa
   * `permisosFotos(...).compartir` de la lógica de fotos del Chat 5.
   */
  puedeCompartirFotos: boolean;
}

/**
 * La retícula de 30 días de la tarjeta de racha (del más antiguo a hoy). Si
 * no llega el detalle día a día, se marcan como hechos los últimos
 * min(días, 30): es lo que una racha de N días garantiza.
 */
export function reticulaRacha(t: Extract<Tarjeta, { tipo: 'racha' }>): boolean[] {
  if (t.ultimos30 && t.ultimos30.length === 30) return [...t.ultimos30];
  const hechos = Math.min(30, Math.max(0, Math.floor(t.dias)));
  return Array.from({ length: 30 }, (_, i) => i >= 30 - hechos);
}

/** Por qué una tarjeta no se puede generar con estas opciones, o null si se puede. */
export function bloqueo(t: Tarjeta, opciones: OpcionesTarjeta, contexto: ContextoTarjeta = { puedeCompartirFotos: false }): string | null {
  if (t.tipo === 'antesDespues') {
    if (!contexto.puedeCompartirFotos) return 'Compartir fotos de progreso pide ser mayor de 18 y tener activados los datos de salud.';
    if (!opciones.mostrarFotos) return 'Para compartir el antes y después tienes que permitir las fotos.';
    if (!t.antes.uri || !t.despues.uri) return 'Faltan fotos para comparar.';
    if (t.antes.fecha > t.despues.fecha) return 'La foto de antes es posterior a la de después.';
  }
  if (t.tipo === 'logro' && !t.titulo.trim()) return 'El logro no tiene nombre.';
  if (t.tipo === 'recuerdo' && !t.titulo.trim()) return 'El recuerdo no tiene título.';
  return null;
}

/**
 * Plataformas donde se ha COMPROBADO que la foto sale en B/N en el archivo
 * capturado. Donde no lo está, la foto sale tal cual y la hoja avisa: nunca se
 * promete un B/N que no se ha visto. Se activa plataforma a plataforma tras la
 * prueba física (Chat 5). Web: verificado en Expo web el 02/10/2026.
 */
export const BN_VERIFICADO: Readonly<Record<'ios' | 'android' | 'web', boolean>> = Object.freeze({
  ios: false,
  android: false,
  web: true,
});

/** ¿Se pasan las fotos a B/N en esta plataforma? */
export function fotosEnBN(plataforma: string): boolean {
  return plataforma === 'ios' || plataforma === 'android' || plataforma === 'web' ? BN_VERIFICADO[plataforma] : false;
}

/** Aviso para la hoja cuando la tarjeta lleva fotos que saldrán en color, o null. */
export function avisoColor(t: Tarjeta, opciones: OpcionesTarjeta, contexto: ContextoTarjeta, plataforma: string): string | null {
  return fotosVisibles(t, opciones, contexto).length > 0 && !fotosEnBN(plataforma) ? 'Las fotos se compartirán en color.' : null;
}

/** Fotos que la tarjeta puede pintar (vacío si no hay permiso o si no es mayor de edad). */
export function fotosVisibles(t: Tarjeta, opciones: OpcionesTarjeta, contexto: ContextoTarjeta = { puedeCompartirFotos: false }): Foto[] {
  if (!opciones.mostrarFotos || !contexto.puedeCompartirFotos) return [];
  if (t.tipo === 'antesDespues') return [t.antes, t.despues];
  if (t.tipo === 'recuerdo' && t.foto?.uri) return [t.foto];
  return [];
}

/**
 * Formato del archivo: con foto, JPG (una foto en PNG a 1080×1920 pasa
 * fácilmente de 4 MB); sin foto, PNG (texto nítido y fondo plano).
 */
export function formatoArchivo(
  t: Tarjeta,
  opciones: OpcionesTarjeta,
  contexto: ContextoTarjeta = { puedeCompartirFotos: false },
): { formato: 'png' | 'jpg'; calidad: number } {
  return fotosVisibles(t, opciones, contexto).length > 0 ? { formato: 'jpg', calidad: 0.9 } : { formato: 'png', calidad: 1 };
}

/** "nivl-logro-2026-10-02-stories.png": legible en la galería, sin datos personales. */
export function nombreArchivo(t: Tarjeta, formato: FormatoTarjeta, extension: 'png' | 'jpg', hoyIso: string): string {
  const fecha = /^\d{4}-\d{2}-\d{2}/.test(hoyIso) ? hoyIso.slice(0, 10) : 'hoy';
  const tipo = t.tipo === 'antesDespues' ? 'progreso' : t.tipo;
  return `nivl-${tipo}-${fecha}-${formato}.${extension}`;
}

/**
 * Enlace que acompaña a la tarjeta. Solo lleva a la invitación (con el código
 * de amigo) si el usuario lo ha elegido; si no, la web a secas.
 */
export function enlace(codigoAmigo?: string | null, incluirInvitacion = false): string {
  const codigo = (codigoAmigo ?? '').trim().toUpperCase();
  return incluirInvitacion && /^[A-Z0-9]{4,12}$/.test(codigo) ? `${URL_NIVL}/c/${codigo}` : URL_NIVL;
}

/** Texto que viaja con la imagen en la hoja del sistema (y solo él si no hay imagen). */
export function mensaje(t: Tarjeta, opciones: OpcionesTarjeta = OPCIONES_POR_DEFECTO, codigoAmigo?: string | null): string {
  const x = textos(t, opciones);
  const titular = x.titular.charAt(0) + x.titular.slice(1).toLowerCase();
  const cuerpo = t.tipo === 'logro' ? `${x.antetitulo.charAt(0)}${x.antetitulo.slice(1).toLowerCase()}: ${x.titular}` : titular;
  return `${cuerpo} en NIVL. ${enlace(codigoAmigo, opciones.incluirInvitacion)}`;
}

// ── Celebraciones del juego (contrato del Chat 5: docs/game-v2/CONTRATO-PROGRESION.md §3) ──
//
// Se tipa por estructura, no se importa `progression.ts`: así este módulo no
// depende de la rama del juego y la integración solo tiene que encajar formas.

export type CelebracionCompartible =
  | { tipo: 'nivel'; clave: string; nivel: number }
  | { tipo: 'rango'; clave: string; rango: string; nombre?: string; titulo?: string | null }
  | { tipo: 'logro'; clave: string; codigo: string; nombre: string; desc?: string; titulo: string | null }
  | { tipo: 'racha'; clave: string; dias: number }
  | { tipo: string; clave: string };

/** Hitos de racha que merecen tarjeta (sugerencia del Chat 5: ≥ 30). */
export const RACHA_MINIMA_COMPARTIR = 30;

/**
 * La tarjeta que corresponde a una celebración, o null si no se comparte:
 * grados, insignias, recuperaciones, piedras, logros sin título y rachas
 * cortas se celebran dentro de la app pero no ofrecen tarjeta.
 */
export function tarjetaDeCelebracion(c: CelebracionCompartible): Tarjeta | null {
  switch (c.tipo) {
    case 'nivel': {
      const x = c as Extract<CelebracionCompartible, { tipo: 'nivel' }>;
      return Number.isFinite(x.nivel) ? { tipo: 'nivel', nivel: x.nivel } : null;
    }
    case 'rango': {
      const x = c as Extract<CelebracionCompartible, { tipo: 'rango' }>;
      return x.rango ? { tipo: 'rango', rango: x.rango, titulo: x.titulo ?? x.nombre } : null;
    }
    case 'logro': {
      const x = c as Extract<CelebracionCompartible, { tipo: 'logro' }>;
      return x.titulo && x.nombre ? { tipo: 'logro', titulo: x.nombre, descripcion: x.desc } : null;
    }
    case 'racha': {
      const x = c as Extract<CelebracionCompartible, { tipo: 'racha' }>;
      return x.dias >= RACHA_MINIMA_COMPARTIR ? { tipo: 'racha', dias: x.dias } : null;
    }
    default:
      return null;
  }
}
