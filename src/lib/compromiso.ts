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

export interface Horizonte {
  years: 1 | 3 | 5;
  label: string;
  /** Días hasta la apertura. Mismo cálculo que las cartas de Contrato (365 por año). */
  days: number;
  recomendado: boolean;
}

// Tres años es el recomendado: uno se queda corto para cambiar una vida y
// cinco es una fecha que nadie se cree el primer día.
export const HORIZONTES: readonly Horizonte[] = [
  { years: 1, label: '1 año', days: 365, recomendado: false },
  { years: 3, label: '3 años', days: 365 * 3, recomendado: true },
  { years: 5, label: '5 años', days: 365 * 5, recomendado: false },
];

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
  const extras = [target ? `Cifra: ${target}` : '', deadline ? `Fecha: ${deadline}` : ''].filter(Boolean);
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
    `COMPROMISO A ${plazo.toUpperCase()}`,
    `Yo, ${name}, firmo este compromiso conmigo el ${input.firmadoEl}, el día que entré en NIVL.`,
    `Estoy aquí para esto: ${lineaObjetivo(input)}`,
    'No prometo días perfectos. Prometo ser un 1 % mejor cada día: una misión cumplida cuando no apetece, una norma respetada cuando nadie mira, un registro honesto cuando el día ha ido mal.',
    `Un 1 % no se nota en una semana. En ${plazo} es otra vida.`,
    'Cuando falle, no negociaré con el sistema. Aceptaré la penalización, cumpliré la consecuencia y volveré al día siguiente.',
    `A quien abra esto el ${input.seAbreEl}: eres lo que hice con cada uno de estos días. Espero haber estado a tu altura.`,
    `Firmado: ${name}`,
  ].join('\n\n');
}

/** La firma vale si lo tecleado es el nombre, sin mirar mayúsculas ni acentos. */
/**
 * Un compromiso firmado no es una carta secreta: es un contrato, y un contrato
 * que no se puede releer no obliga a nada. Contrato lo enseña desde el primer
 * día; las cartas al yo del futuro siguen selladas hasta su fecha.
 */
export function esCompromiso(body: string): boolean {
  return body.startsWith('COMPROMISO A ');
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
