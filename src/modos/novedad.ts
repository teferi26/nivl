// NIVL · Modos: «Novedad: elige tus modos» para quien ya tenía la app (pura).
//
// Se enseña UNA vez, al entrar en Hoy, a quien cumple todo esto:
//   · el interruptor `modos_activos` está encendido;
//   · ya hizo el onboarding (el onboarding tiene su propio paso de modos);
//   · los modos de la cuenta se han leído bien y no tiene ninguno activado
//     (sin red o sin tabla no se sabe: no se pregunta);
//   · en este teléfono no la ha cerrado nunca (ni con «Guardar» ni con
//     «Ahora no»), y ya se ha podido leer esa marca;
//   · no hay otra cosa encima (ceremonia, otra hoja).
//
// Sin imports de Supabase ni de React Native: lo usan los tests.

import type { ModoEtiqueta } from './tipos';

export interface EstadoNovedadModos {
  /** El interruptor `modos_activos`. */
  activo: boolean;
  /** `profiles.onboarding_done` (false mientras no se ha leído el perfil). */
  onboardingHecho: boolean;
  /** Ya se han intentado leer los modos de la cuenta. */
  cargado: boolean;
  /** Y la lectura salió bien. */
  leidos: boolean;
  activados: readonly ModoEtiqueta[];
  /** La marca del teléfono: true ya vista, false nunca vista, null aún sin leer. */
  vista: boolean | null;
  /** Hay otra cosa encima: se espera. */
  enPausa?: boolean;
}

export function tocaNovedadModos(e: EstadoNovedadModos): boolean {
  if (!e.activo || !e.onboardingHecho) return false;
  if (!e.cargado || !e.leidos) return false;
  if (e.activados.length > 0) return false;
  if (e.vista !== false) return false;
  return !e.enPausa;
}
