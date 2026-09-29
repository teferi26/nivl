// NIVL · El consentimiento para la IA: texto, versión y estado (puro).
//
// Sin imports de Supabase: los efectos viven en `consent.ts`. La versión tiene
// que casar con la última `ai_consent_version()` de las migraciones (un test
// lo comprueba). Si el texto cambia de forma material, se sube en los dos
// sitios y todo el mundo vuelve a aceptar.
//
// Lo que dice esta hoja tiene que decir lo mismo que la política publicada
// (https://nivl-web.vercel.app/privacidad). Se distinguen almacenamiento y
// procesamiento del proveedor. Aceptar esta hoja no sustituye las obligaciones
// del responsable sobre transferencias internacionales y datos de salud.

export const AI_CONSENT_VERSION = '2026-09-29';

/** Edad mínima para usar NIVL (Términos de uso y política de privacidad). */
export const EDAD_MINIMA = 16;

export interface DatoIa {
  titulo: string;
  detalle: string;
}

/** Qué sale hacia el proveedor de IA en cada turno. */
export const DATOS_IA: readonly DatoIa[] = [
  { titulo: 'Salud y entreno', detalle: 'Peso, ficha física (altura, edad, lesiones, notas de salud), gimnasio, cardio y nutrición.' },
  { titulo: 'Tu diario', detalle: 'Lo que escribes, tu ánimo y tu energía.' },
  { titulo: 'Tus finanzas', detalle: 'Cuentas, movimientos y presupuestos que registres en Economía.' },
  { titulo: 'Tu día', detalle: 'Misiones, campañas, agenda, reglas y lo que hablas con el coach.' },
  { titulo: 'Tus fotos', detalle: 'Solo las que adjuntes al chat, y solo en ese turno.' },
];

export interface ProveedorIa {
  nombre: string;
  donde: string;
  cuando: string;
}

/** A quién va, y cuándo. */
export const PROVEEDORES_IA: readonly ProveedorIa[] = [
  { nombre: 'Anthropic (Claude)', donde: 'Almacenamiento en EE. UU.; procesamiento por defecto en EE. UU., Europa, Asia y Australia.', cuando: 'NIVL Élite y otras solicitudes que utilicen Claude.' },
  { nombre: 'DeepSeek', donde: 'República Popular China', cuando: 'NIVL Pro y la prueba de 7 días.' },
];

export const TEXTO_CONSENTIMIENTO = {
  eyebrow: 'ANTES DEL COACH',
  titulo: 'Tus datos y la IA',
  intro:
    'El coach funciona con modelos de IA de otras empresas. Para responderte y planificar tu día, NIVL les envía en cada turno:',
  aQuien: 'A quién se envía',
  fueraEee:
    'China está fuera del Espacio Económico Europeo y la Comisión Europea no ha declarado que proteja los datos como la UE: allí tus datos podrían quedar menos protegidos.',
  paraQue: 'NIVL envía estos datos para que el coach te responda. NIVL no los utiliza para publicidad.',
  consentimiento:
    'Al aceptar das tu consentimiento explícito para que se traten estos datos, incluidos los de salud, y para enviarlos a esos proveedores, también fuera del EEE. Puedes retirarlo cuando quieras en Perfil: se detienen las nuevas solicitudes de IA. Los datos de una solicitud ya enviada no se pueden recuperar.',
  sinAceptar: 'Si no aceptas, el resto de NIVL sigue entero y gratis, sin el coach.',
  aceptar: 'Acepto y activo el coach',
  rechazar: 'Ahora no',
} as const;

/** El descargo de salud (Guideline 1.4.1). Una línea, en la voz del sistema. */
export const DESCARGO_SALUD =
  'NIVL no es un servicio médico, nutricional ni psicológico. Ante dolor, lesión o un problema de salud, consulta a un profesional.';

/** La salida de emergencia, siempre con los números escritos. */
export const LINEA_CRISIS = 'Si lo estás pasando mal de verdad, llama al 024 (gratis, 24 horas). Si hay peligro inmediato, al 112.';

export interface EstadoConsentimiento {
  /** La versión que exige hoy el servidor. */
  versionServidor: string;
  /** El servidor la da por vigente (última fila 'accept' con la versión actual). */
  concedido: boolean;
  /** La última acción registrada, si hay alguna. */
  accion: 'accept' | 'withdraw' | null;
  version: string | null;
  /** ISO de la última acción. */
  fecha: string | null;
}

/** Normaliza lo que devuelve la RPC `my_ai_consent` (0028). */
export function leerConsentimiento(raw: unknown): EstadoConsentimiento {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const accion = o.action === 'accept' || o.action === 'withdraw' ? o.action : null;
  return {
    versionServidor: typeof o.current_version === 'string' ? o.current_version : AI_CONSENT_VERSION,
    concedido: o.granted === true,
    accion,
    version: typeof o.version === 'string' ? o.version : null,
    fecha: typeof o.at === 'string' ? o.at : null,
  };
}

/**
 * ¿Puede la app llamar al coach sin enseñar la hoja? Solo si el servidor lo da
 * por vigente Y la versión es la que esta app sabe enseñar.
 */
export function consentimientoVigente(e: EstadoConsentimiento | null, versionApp = AI_CONSENT_VERSION): boolean {
  return !!e && e.concedido && e.versionServidor === versionApp;
}

export type SituacionConsentimiento = 'vigente' | 'pendiente' | 'retirado' | 'version_nueva' | 'app_antigua';

export function situacion(e: EstadoConsentimiento, versionApp = AI_CONSENT_VERSION): SituacionConsentimiento {
  if (e.versionServidor !== versionApp) return 'app_antigua';
  if (e.concedido) return 'vigente';
  if (e.accion === 'withdraw') return 'retirado';
  if (e.accion === 'accept') return 'version_nueva';
  return 'pendiente';
}

/** "27/09/2026" a partir de un ISO, sin depender del locale del dispositivo. */
export function fechaCorta(iso: string | null): string | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

/** La línea de Perfil que dice en qué punto está. */
export function lineaPerfil(e: EstadoConsentimiento, versionApp = AI_CONSENT_VERSION): string {
  const f = fechaCorta(e.fecha);
  switch (situacion(e, versionApp)) {
    case 'vigente':
      return f ? `Aceptado el ${f}. Toca para retirarlo.` : 'Aceptado. Toca para retirarlo.';
    case 'retirado':
      return f ? `Retirado el ${f}. El coach no recibe nada.` : 'Retirado. El coach no recibe nada.';
    case 'version_nueva':
      return 'El texto ha cambiado. Revísalo para volver a usar el coach.';
    case 'app_antigua':
      return 'Actualiza NIVL para revisar el texto nuevo.';
    case 'pendiente':
      return 'Sin aceptar. El coach no recibe nada.';
  }
}

/** Lo que la hoja hace alrededor de guardar la aceptación. */
export interface AccionesAceptacion {
  /** Guarda la aceptación en el servidor (accept_ai_consent). */
  guardar: () => Promise<void>;
  /** Empieza a guardar: botón cargando, aviso limpio. */
  alEmpezar: () => void;
  /** Termina de guardar, haya ido bien o mal. */
  alTerminar: () => void;
  /** El servidor la ha guardado: la acción pendiente puede seguir. */
  alAceptar: () => void;
  alFallar: (e: unknown) => void;
}

/**
 * El cerrojo de la hoja de consentimiento, sin React: una sola aceptación en
 * vuelo, la acción solo sigue cuando el servidor la ha guardado, y cerrar la
 * hoja mientras se guarda no hace nada (si no, la acción pendiente se
 * cancelaría con la aceptación ya en camino). Las acciones se leen en cada
 * llamada (`acciones()`), así siempre son las del último render.
 */
export function crearCerrojoAceptacion(acciones: () => AccionesAceptacion) {
  let guardando = false;
  return {
    get guardando() {
      return guardando;
    },
    async aceptar(): Promise<void> {
      if (guardando) return;
      guardando = true;
      acciones().alEmpezar();
      try {
        await acciones().guardar();
      } catch (e) {
        guardando = false;
        acciones().alTerminar();
        acciones().alFallar(e);
        return;
      }
      guardando = false;
      acciones().alTerminar();
      acciones().alAceptar();
    },
    /** Devuelve si se ha cerrado. */
    cerrar(alCerrar: () => void): boolean {
      if (guardando) return false;
      alCerrar();
      return true;
    },
  };
}
