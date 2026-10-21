// Galería (solo desarrollo): las piezas del marco del mundo IRON para montar
// las pantallas como en la app: la ranura del emblema de la cabecera y lo que
// va en el centro de la barra. En la app las pone LayoutMundo con EmblemaMundo
// (encargo de la rueda); aquí, sin sesión ni ModoProvider, van vacías y la
// cabecera y la barra pintan su forma sin emblema conectado.
import type { ReactNode } from 'react';

/** El emblema de la cabecera (CabeceraMundo, ranura `emblema`). */
export const EMBLEMA_DEMO: ReactNode = undefined;

/** Lo que va en el centro de la barra (TabBar, `centro`), si la barra lo admite. */
export const CENTRO_BARRA_DEMO: ReactNode = null;
