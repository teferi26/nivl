// NIVL · ¿Se ofrece «Escuchar» en un mensaje del coach? Puro.
//
// La voz (src/lib/coachvoz) lee en es-ES: en 1.0.10 todavía no sabe de
// idiomas. Si el coach habla en otro idioma, leerlo con voz española no
// sirve, así que «Escuchar» no se ofrece (PLAN-1010, §Lo que se pide a otros
// equipos, 5). Cuando coachvoz acepte un locale, esto se quita.

import type { Idioma } from '@/i18n';

/** El dispositivo puede hablar, el mensaje tiene texto y el coach habla en español. */
export function conEscuchar(puedeHablar: boolean, texto: string, idiomaCoach: Idioma): boolean {
  return puedeHablar && !!texto && idiomaCoach === 'es';
}
