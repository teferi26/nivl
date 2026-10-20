// NIVL · Modos: los efectos comunes de un mundo (la cabecera y la salida).
//
// · El nivel del modo sale de `mode_xp` por el mismo hook que Perfil
//   (useNivelesModo, se relee al volver a la pantalla).
// · `irA(modo)`: cambia de mundo con irAlMundo (rutasModo.ts). `onBase` es
//   irA('general'): volver a NIVL.

import { useCallback } from 'react';
import { useModo } from '@/modos/ModoProvider';
import { nivelesDeModos, type NivelModo } from '@/modos/niveles';
import { irAlMundo } from '@/modos/rutasModo';
import type { ModoEtiqueta, ModoId } from '@/modos/tipos';
import { useNivelesModo } from '../useNivelesModo';

const CERO: Record<ModoEtiqueta, number> = { iron: 0, focus: 0, work: 0, founder: 0 };

export interface UseMundo {
  /** El nivel del modo; null mientras se lee. */
  nivel: NivelModo | null;
  irA: (modo: ModoId) => void;
  onBase: () => void;
}

export function useMundo(modo: ModoEtiqueta): UseMundo {
  const { cambiar } = useModo();
  const { cargando, niveles } = useNivelesModo();
  // Un modo sin XP todavía (o desactivado en otro teléfono) empieza en su nivel de 0 XP.
  const nivel = cargando ? null : (niveles.find((n) => n.modo === modo) ?? nivelesDeModos([modo], CERO)[0] ?? null);
  const irA = useCallback((m: ModoId) => irAlMundo(m, cambiar), [cambiar]);
  const onBase = useCallback(() => irA('general'), [irA]);
  return { nivel, irA, onBase };
}
