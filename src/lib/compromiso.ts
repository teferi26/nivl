// NIVL · El compromiso que se firma al entrar.
//
// El onboarding acaba con una firma, no con un "Continuar": el usuario elige un
// horizonte (1, 3 o 5 años), lee un texto construido con su nombre y con el
// objetivo que acaba de escribir, y lo firma con un gesto deliberado. El texto
// se sella con el mismo mecanismo que la carta al yo del futuro
// (`contract.ts → sealLetter`), así que aparece en Contrato y se abre el día
// que vence el horizonte. Por eso está escrito como una carta: quien lo lea
// dentro de tres años tiene que entenderlo sin contexto.
//
// Módulo PURO: sin imports de Supabase, para que los tests arranquen.
//
// QA F1 (M3): el texto se escribe y se sella en el idioma de la interfaz, con
// la fecha en ese idioma (catálogo `onboarding:compromiso`). En español es
// letra por letra el de siempre. Contrato lo reconoce por su cabecera en
// cualquiera de los idiomas (`esCompromiso`), y el evento `commitment_signed`
// guarda en qué idioma se firmó cuando no fue en español (onboarding.tsx).

import { t } from '@/i18n';
import { mayus } from '@/i18n/formato';
import { RECURSOS_ES } from '@/i18n/recursos';
import { RECURSOS_LOCALES } from '@/i18n/traducidos';

export interface Horizonte {
  years: 1 | 3 | 5;
  /** «3 años», en el idioma de la interfaz (se lee del catálogo al usarlo). */
  readonly label: string;
  /** Días hasta la apertura. Mismo cálculo que las cartas de Contrato (365 por año). */
  days: number;
  recomendado: boolean;
}

// Tres años es el recomendado: uno se queda corto para cambiar una vida y
// cinco es una fecha que nadie se cree el primer día.
function horizonte(years: 1 | 3 | 5, recomendado: boolean): Horizonte {
  return {
    years,
    days: 365 * years,
    recomendado,
    get label() {
      return t('onboarding:compromiso.plazo', { count: years });
    },
  };
}

export const HORIZONTES: readonly Horizonte[] = [horizonte(1, false), horizonte(3, true), horizonte(5, false)];

export const HORIZONTE_POR_DEFECTO: Horizonte = HORIZONTES[1]!;

export const GOAL_MAX_LENGTH = 140;
export const GOAL_DETAIL_MAX_LENGTH = 40;

export interface CompromisoInput {
  name: string;
  goal: string;
  /** Cifra opcional: "78 kg", "5.000 € al mes". */
  target?: string;
  /** Fecha opcional, en palabras del usuario: "junio de 2027". */
  deadline?: string;
  horizonte: Horizonte;
  /** Fecha de la firma ya legible: "sábado, 19 de septiembre de 2026". */
  firmadoEl: string;
  /** Fecha de apertura ya legible. */
  seAbreEl: string;
}

/** Quita espacios sobrantes y el punto final: la frase se incrusta en otra. */
export function limpiarFrase(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
}

/** El objetivo en una línea, con su cifra y su fecha si las hay. */
export function lineaObjetivo(input: Pick<CompromisoInput, 'goal' | 'target' | 'deadline'>): string {
  const goal = limpiarFrase(input.goal);
  const target = limpiarFrase(input.target ?? '');
  const deadline = limpiarFrase(input.deadline ?? '');
  const extras = [
    target ? t('onboarding:compromiso.cifra', { cifra: target }) : '',
    deadline ? t('onboarding:compromiso.fecha', { fecha: deadline }) : '',
  ].filter(Boolean);
  return extras.length ? `${goal}. ${extras.join('. ')}.` : `${goal}.`;
}

/**
 * El texto que se firma y se sella. Texto plano con saltos de línea: así lo
 * pinta Contrato al abrir la carta (un <Text> sin formato).
 */
export function textoCompromiso(input: CompromisoInput): string {
  const name = limpiarFrase(input.name);
  const plazo = input.horizonte.label;
  return [
    t('onboarding:compromiso.cabecera', { plazo: mayus(plazo) }),
    t('onboarding:compromiso.firma', { nombre: name, firmadoEl: input.firmadoEl }),
    t('onboarding:compromiso.objetivo', { objetivo: lineaObjetivo(input) }),
    t('onboarding:compromiso.promesa'),
    t('onboarding:compromiso.unoPorCiento', { plazo }),
    t('onboarding:compromiso.fallo'),
    t('onboarding:compromiso.apertura', { seAbreEl: input.seAbreEl }),
    t('onboarding:compromiso.firmado', { nombre: name }),
  ].join('\n\n');
}

/** La firma vale si lo tecleado es el nombre, sin mirar mayúsculas ni acentos. */
/**
 * Un compromiso firmado no es una carta secreta: es un contrato, y un contrato
 * que no se puede releer no obliga a nada. Contrato lo enseña desde el primer
 * día; las cartas al yo del futuro siguen selladas hasta su fecha.
 */
export function esCompromiso(body: string): boolean {
  return cabeceras().some((c) => body.startsWith(c));
}

/**
 * Lo fijo de la cabecera en cada idioma («COMPROMISO A », «COMMITMENT FOR »):
 * un compromiso firmado en inglés se sigue reconociendo con la app en
 * español. El español va primero (y es el de siempre).
 */
let cabecerasCache: readonly string[] | null = null;
function cabeceras(): readonly string[] {
  cabecerasCache ??= [RECURSOS_ES, ...Object.values(RECURSOS_LOCALES)]
    .map((r) => String((r as { onboarding?: { compromiso?: { cabecera?: unknown } } }).onboarding?.compromiso?.cabecera ?? ''))
    .map((c) => c.split('{{')[0] ?? '')
    .filter((c) => c.trim().length >= 4);
  return cabecerasCache;
}

export function firmaValida(tecleado: string, name: string): boolean {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  const n = norm(name);
  return n.length > 0 && norm(tecleado) === n;
}
