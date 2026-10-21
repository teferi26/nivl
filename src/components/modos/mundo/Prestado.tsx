// NIVL · Modos: una pantalla de un mundo PRESTADA a General («todo desde
// General»: quien no usa modos entra en el foco, los exámenes o la economía
// desde el Hoy de NIVL sin cambiar de modo).
//
// La pantalla es la misma del mundo (la misma lógica, los mismos datos); lo que
// cambia al ir prestada:
//   · la cabecera del mundo (CabeceraMundo, TituloFocus) pone «volver» en la
//     ranura del emblema, porque se llega apilada sobre NIVL;
//   · los saltos internos (Exámenes, Temario, el coach) van a las rutas
//     prestadas y no a las del grupo del mundo, cuya puerta devolvería a NIVL.
// El estado vive en el módulo (y no solo en el contexto) porque `pedirEstudio`
// navega fuera de React.

import { router } from 'expo-router';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { volver } from '@/components/ui/Screen';
import { entrarPrestado, salirPrestado } from './prestadoRutas';

export { enPrestado, rutaFocus, type DestinoFocus } from './prestadoRutas';

const PrestadoCtx = createContext<{ volver: () => void } | null>(null);

/** El «volver» de la pantalla prestada; null dentro de su mundo. */
export function usePrestado(): { volver: () => void } | null {
  return useContext(PrestadoCtx);
}

export function PantallaPrestada({ children }: { children: ReactNode }) {
  useEffect(() => {
    entrarPrestado();
    return salirPrestado;
  }, []);
  return <PrestadoCtx.Provider value={{ volver: () => volver(router) }}>{children}</PrestadoCtx.Provider>;
}
