// NIVL · El consentimiento para la IA: texto, versión y estado (puro).
//
// Sin imports de Supabase: los efectos viven en `consent.ts`. La versión tiene
// que casar con la última `ai_consent_version()` de las migraciones (un test
// lo comprueba). Si el texto cambia de forma material, se sube en los dos
// sitios y todo el mundo vuelve a aceptar. Solo cuando la hoja declara MÁS
// (un proveedor, un país o un dato nuevo): si declara menos, la versión se
// queda. Así el 12/10/2026 salió DeepSeek (China) sin tocar '2026-09-29':
// quien aceptó aquel texto ya consintió el envío a Anthropic con las mismas
// ubicaciones, y obligarle a aceptar de nuevo solo le cortaría el coach.
//
// Lo que dice esta hoja tiene que decir lo mismo que la política publicada
// (https://nivl.app/privacidad). Se distinguen almacenamiento y
// procesamiento del proveedor. Aceptar esta hoja no sustituye las obligaciones
// del responsable sobre transferencias internacionales y datos de salud.

import { t } from '@/i18n';
import { idiomaDispositivo } from '@/i18n/dispositivo';
import { lineasDe } from './crisis';
import { conTextos, registroVivo } from './textosVivos';

export const AI_CONSENT_VERSION = '2026-09-29';

/** Edad mínima para usar NIVL (Términos de uso y política de privacidad). */
export const EDAD_MINIMA = 16;

export interface DatoIa {
  titulo: string;
  detalle: string;
}

const CLAVES_DATOS = ['salud', 'medicion', 'diario', 'finanzas', 'dia', 'calendario', 'fotos'] as const;

/**
 * Qué sale hacia el proveedor de IA en cada turno. La ruta GPS y la serie de
 * pulso no salen (`consultar_historial` y `estudioResistencia` no las piden).
 */
export const DATOS_IA: readonly DatoIa[] = CLAVES_DATOS.map((c) =>
  conTextos(
    {},
    {
      titulo: () => t(`legal:ia.datos.${c}.titulo` as 'legal:ia.datos.salud.titulo'),
      detalle: () => t(`legal:ia.datos.${c}.detalle` as 'legal:ia.datos.salud.detalle'),
    },
  ),
);

export interface ProveedorIa {
  nombre: string;
  donde: string;
  cuando: string;
}

/** A quién va, y cuándo. */
export const PROVEEDORES_IA: readonly ProveedorIa[] = [
  conTextos(
    { nombre: 'Anthropic (Claude)' },
    { donde: () => t('legal:ia.anthropic.donde'), cuando: () => t('legal:ia.anthropic.cuando') },
  ),
];

const CLAVES_IA = ['eyebrow', 'titulo', 'intro', 'aQuien', 'fueraEee', 'paraQue', 'consentimiento', 'sinAceptar', 'aceptar', 'rechazar'] as const;

export const TEXTO_CONSENTIMIENTO = registroVivo(CLAVES_IA, (c) => t(`legal:ia.${c}`));

/** El descargo de salud (Guideline 1.4.1). Una línea, en la voz del sistema. */
export function descargoSalud(): string {
  return t('legal:descargo');
}

/** La región del teléfono («ES» de «es-ES»), o null si no se conoce. */
export function regionDispositivo(): string | null {
  return idiomaDispositivo()?.split('-')[1] ?? null;
}

/** La salida de emergencia, con los números escritos del país del teléfono. */
export function lineaCrisis(region: string | null = regionDispositivo()): string {
  const { crisis, emergencias } = lineasDe(region);
  if (crisis && emergencias) return t('legal:crisis.completa', { crisis, emergencias });
  if (crisis) return t('legal:crisis.sinEmergencias', { crisis });
  if (emergencias) return t('legal:crisis.soloEmergencias', { emergencias });
  return t('legal:crisis.generica');
}

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
