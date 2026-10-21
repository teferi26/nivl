// NIVL · Idioma y modo del turno del coach (Modos, fase 1).
//
// Módulo PURO (sin Deno ni red). Dos cabeceras OPCIONALES de la app nueva:
//   · x-nivl-locale: el idioma de la app (BCP-47 corto: en, fr, pt-BR…) → «responde siempre en …».
//   · x-nivl-modo:   el modo activo (iron, focus, work, founder) → el «sombrero» del coach.
// Sin cabeceras (la 1.0.9, los rituales del cron), con español o con General, no se añade NADA:
// el prompt sale idéntico byte a byte al de antes (test con hash en modos_prompt_test.ts).
//
// El bloque va en la parte DINÁMICA del sistema, detrás del punto de caché fijo: la parte fija sigue
// siendo la misma para todos los usuarios, idiomas y modos (ia2_cache_test.ts).
//
// Sin guiones largos: el filtro del servidor (singuiones.ts) sanea la salida del modelo sea cual sea el
// idioma; aquí además se repite la regla en el bloque, porque el modelo imita lo que lee.

export const MODOS_COACH = ['iron', 'focus', 'work', 'founder'] as const;
export type ModoCoach = (typeof MODOS_COACH)[number];

/** El modo de la cabecera. General, vacío o desconocido → null (el coach de siempre). */
export function modoDeCabeceraNivl(valor: string | null | undefined): ModoCoach | null {
  const v = (valor ?? '').trim().toLowerCase();
  return (MODOS_COACH as readonly string[]).includes(v) ? (v as ModoCoach) : null;
}

const ETIQUETA_IDIOMA = /^([A-Za-z]{2,3})(?:[-_]([A-Za-z0-9]{1,8}))*$/;

/**
 * El idioma de la cabecera o del perfil, normalizado ('pt_br' → 'pt-BR'). Español (es, es-ES, es-419…),
 * vacío o algo que no parece un idioma → null: es lo que ya hace el prompt, no se añade nada.
 */
export function idiomaDeCabecera(valor: string | null | undefined): string | null {
  const v = (valor ?? '').trim();
  if (!v || v.length > 35 || !ETIQUETA_IDIOMA.test(v)) return null;
  const partes = v.split(/[-_]/);
  const base = partes[0].toLowerCase();
  if (base === 'es' || base === 'spa') return null;
  const resto = partes.slice(1).map((p) => (p.length === 2 ? p.toUpperCase() : p.length === 4 ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p.toLowerCase()));
  return [base, ...resto].join('-');
}

// Los de la fase 1 escritos a mano (deterministas). El resto, con Intl y, si no, el código.
const NOMBRES: Record<string, string> = {
  en: 'inglés', fr: 'francés', pt: 'portugués', de: 'alemán', it: 'italiano', ca: 'catalán',
  eu: 'euskera', gl: 'gallego', nl: 'neerlandés', ar: 'árabe', zh: 'chino', ja: 'japonés',
};

/** Nombre del idioma en español, para la instrucción. */
export function nombreIdioma(etiqueta: string): string {
  const base = etiqueta.split('-')[0];
  if (NOMBRES[base]) return NOMBRES[base];
  try {
    const n = new Intl.DisplayNames(['es'], { type: 'language' }).of(base);
    if (n && n.toLowerCase() !== base) return n;
  } catch { /* sin ICU: el código */ }
  return `el idioma de código ${base}`;
}

/** El sombrero de cada modo: de qué habla y qué prioriza. Sin cifras inventadas: las da el estado. */
export const SOMBRERO: Record<ModoCoach, string> = {
  iron: 'IRON (gimnasio y dieta). Hablas de cargas, series, repeticiones, progresión, descanso y comida. Programa sobre el estudio de entreno y la nutrición del estado; las misiones de IRON van primero.',
  focus: 'FOCUS (estudio). Hablas de exámenes, temario, plan de estudio hasta cada fecha, sesiones de foco y repaso. No estudias por él: le organizas y le exiges rendimiento; las misiones de FOCUS van primero.',
  work: 'WORK (trabajo). Hablas de un máximo de tres prioridades al día, bloques de trabajo profundo, reuniones, energía y fin de jornada. Vigila el desgaste; las misiones de WORK van primero.',
  founder: 'FOUNDER (emprendimiento). Hablas de lo que mueve la aguja frente al relleno: hitos, métricas del proyecto, ventas, contenido publicado y la revisión de qué matar y qué duplicar. Las misiones de FOUNDER van primero.',
};

/**
 * El bloque de idioma y modo. Cadena vacía si no hay ninguno de los dos (entonces buildSystem no añade
 * ningún bloque y el prompt es el de siempre).
 */
export function bloqueIdiomaModo(idioma: string | null | undefined, modo: ModoCoach | null | undefined): string {
  const lng = idiomaDeCabecera(idioma ?? null);
  const m = modo && (MODOS_COACH as readonly string[]).includes(modo) ? modo : null;
  if (!lng && !m) return '';
  const lineas = ['# Idioma y modo de este turno'];
  if (lng) {
    lineas.push(
      `Idioma: responde SIEMPRE en ${nombreIdioma(lng)} (${lng}), aunque tus instrucciones, tu memoria, el estado y las herramientas estén en español. ` +
        'Mantén la voz del sistema y su vocabulario traducido con naturalidad (misiones, gladiador, racha, cierre). ' +
        'Los nombres de las herramientas y los ids no se traducen. La regla de los guiones vale en todos los idiomas: ni guion largo ni semiguion, usa comas, dos puntos o punto.',
    );
  }
  if (m) {
    lineas.push(
      `Modo: el gladiador está ahora en el modo ${SOMBRERO[m]} En el estado, las misiones de este modo llevan «modos: ${m.toUpperCase()}». ` +
        'Todo lo demás sigue existiendo y cuenta en General: si pregunta por otra cosa, respóndele.',
    );
  }
  return lineas.join('\n');
}

/** « · modos: IRON, FOCUS» para la línea de una misión del estado; vacío si no tiene modos (la 1.0.9). */
export function etiquetaModos(modes: unknown): string {
  if (!Array.isArray(modes)) return '';
  const validos = [...new Set(modes.filter((x): x is string => typeof x === 'string' && (MODOS_COACH as readonly string[]).includes(x)))];
  return validos.length ? ` · modos: ${validos.map((x) => x.toUpperCase()).join(', ')}` : '';
}

/**
 * Las etiquetas de modo que pide el coach (parámetro `modos` de crear_mision), limpias: solo valores
 * válidos, sin repetir y en el orden de MODOS_COACH. Sin parámetro (modelo viejo) o con basura, ninguna:
 * la misión queda solo en General, como en la 1.0.9.
 */
export function modosDeEntrada(v: unknown): ModoCoach[] {
  if (!Array.isArray(v)) return [];
  const crudo = v.map((x) => (typeof x === 'string' ? x.trim().toLowerCase() : ''));
  return MODOS_COACH.filter((m) => crudo.includes(m));
}

/**
 * Lo que la app necesita para avisar en el chat de una misión que el coach ha dejado en un modo
 * («Ir a FOCUS»): su título y sus modos. Solo crear_mision con algún modo; lo demás, null (el evento
 * `tool` sale como siempre). Viaja en el evento SSE `tool` como `mision`, y solo si la herramienta fue bien.
 */
export function misionConModos(nombre: string, input: Record<string, unknown>): { titulo: string; modos: ModoCoach[] } | null {
  if (nombre !== 'crear_mision') return null;
  const modos = modosDeEntrada(input.modos);
  if (!modos.length) return null;
  const titulo = typeof input.titulo === 'string' ? input.titulo.trim().slice(0, 200) : '';
  return titulo ? { titulo, modos } : null;
}
