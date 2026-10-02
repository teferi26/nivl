// La voz del coach (L7): texto para voz (puro), hablar (TTS) y dictar (STT).
// Carpeta `coachvoz/` y no `voice/`: `src/lib/voice.ts` (banco de mensajes
// del sistema) ya existe y `@/lib/voice` resolvería a ese archivo.

export {
  MAX_TROZO,
  fechaEnPalabras,
  horaEnPalabras,
  paraVoz,
  prepararVoz,
  trocear,
  type OpcionesVoz,
} from './texto';
export {
  IDIOMA_VOZ,
  RITMO_VOZ,
  TONO_VOZ,
  disponible,
  elegirVoz,
  estaHablando,
  hablar,
  parar,
  pararAlSegundoPlano,
  suscribirHablando,
  type OpcionesHablar,
} from './hablar';
export {
  IDIOMA_DICTADO,
  cancelarDictado,
  detenerDictado,
  dictadoLocalDisponible,
  dictando,
  dictar,
  disponibleDictado,
  errorDictado,
  traducirError,
  type CodigoErrorDictado,
  type ErrorDictado,
  type OpcionesDictado,
  type ResultadoDictado,
} from './dictar';
