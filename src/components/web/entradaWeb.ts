// NIVL · Web: lo que el teclado y el ratón esperan y react-native-web no da.
//
// Va a nivel de documento, una sola vez (_layout.tsx), para que ninguna pantalla
// tenga que acordarse:
//   · Espacio activa también las pestañas, casillas y radios. RNW solo lo hace
//     con el rol `button`; con el resto, Espacio desplazaba la página.
//   · Con el foco en ninguna parte (al entrar en una pantalla), las flechas, Av
//     y Re Pág, Inicio, Fin y Espacio desplazan la pantalla: el documento no
//     tiene scroll propio (`body` va con overflow hidden) y sin esto no hacían nada.
//   · Una tira horizontal (chips) se arrastra con el ratón, como con el dedo: la
//     rueda vertical no la mueve y su barra va oculta.
//
// Las funciones de decisión son puras y llevan test; `instalarEntradaWeb` es el
// único efecto. Sin imports de React Native: en nativo no se llama nunca.

/** Roles que Espacio tiene que activar además de `button` (WAI-ARIA). */
const ROLES_ESPACIO: ReadonlySet<string> = new Set(['tab', 'checkbox', 'radio', 'switch', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option']);

/** Estos ya hacen lo suyo con Espacio. */
const ETIQUETAS_NATIVAS: ReadonlySet<string> = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'SUMMARY']);

export interface Pulsable {
  etiqueta: string;
  rol: string | null;
  tabIndex: number;
  /** El `cursor` calculado: un Pressable sin rol lo lleva a `pointer`. */
  cursor: string;
  desactivado: boolean;
}

/** ¿Espacio tiene que activar este elemento? */
export function espacioActiva({ etiqueta, rol, tabIndex, cursor, desactivado }: Pulsable): boolean {
  if (desactivado || ETIQUETAS_NATIVAS.has(etiqueta)) return false;
  if (rol) return ROLES_ESPACIO.has(rol);
  return tabIndex === 0 && cursor === 'pointer';
}

/** Lo que se mueve una flecha, en px. */
const PASO_FLECHA = 48;
/** Una página conserva este tanto para no perder el hilo de la lectura. */
const FRACCION_PAGINA = 0.9;

export type Desplazamiento = { por: number } | { hasta: 'inicio' | 'fin' };

/** Cuánto desplaza una tecla un scroller de `alto` px. Null si no es de desplazar. */
export function desplazamientoDeTecla(tecla: string, shift: boolean, alto: number): Desplazamiento | null {
  const pagina = Math.round(alto * FRACCION_PAGINA);
  switch (tecla) {
    case 'ArrowDown':
      return { por: PASO_FLECHA };
    case 'ArrowUp':
      return { por: -PASO_FLECHA };
    case 'PageDown':
      return { por: pagina };
    case 'PageUp':
      return { por: -pagina };
    case 'Home':
      return { hasta: 'inicio' };
    case 'End':
      return { hasta: 'fin' };
    case ' ':
    case 'Spacebar':
      return { por: shift ? -pagina : pagina };
    default:
      return null;
  }
}

/** Píxeles que hay que mover el ratón para que sea arrastre y no clic. */
export const UMBRAL_ARRASTRE = 6;

/** ¿Este movimiento ya es un arrastre? */
export function esArrastre(dx: number): boolean {
  return Math.abs(dx) >= UMBRAL_ARRASTRE;
}

const desplazable = (valor: string) => valor === 'auto' || valor === 'scroll';

function scrollerVertical(desde: Element | null): HTMLElement | null {
  for (let n = desde; n && n !== document.body; n = n.parentElement) {
    if (desplazable(getComputedStyle(n).overflowY) && n.scrollHeight - n.clientHeight > 1) return n as HTMLElement;
  }
  return null;
}

function scrollerHorizontal(desde: Element | null): HTMLElement | null {
  for (let n = desde; n && n !== document.body; n = n.parentElement) {
    if (desplazable(getComputedStyle(n).overflowX) && n.scrollWidth - n.clientWidth > 1) return n as HTMLElement;
  }
  return null;
}

/** Instala los oyentes en el documento. Devuelve cómo quitarlos. */
export function instalarEntradaWeb(): () => void {
  const alPulsarTecla = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const el = e.target as HTMLElement;
    const espacio = e.key === ' ' || e.key === 'Spacebar';
    if (espacio && el && el !== document.body) {
      const activa = espacioActiva({
        etiqueta: el.tagName,
        rol: el.getAttribute('role'),
        tabIndex: el.tabIndex,
        cursor: getComputedStyle(el).cursor,
        desactivado: el.getAttribute('aria-disabled') === 'true',
      });
      if (activa) {
        e.preventDefault();
        if (!e.repeat) el.click();
      }
      return;
    }
    if (el && el !== document.body && el !== document.documentElement) return;
    const scroller = scrollerVertical(document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2));
    if (!scroller) return;
    const paso = desplazamientoDeTecla(e.key, e.shiftKey, scroller.clientHeight);
    if (!paso) return;
    e.preventDefault();
    if ('por' in paso) scroller.scrollTop += paso.por;
    else scroller.scrollTop = paso.hasta === 'inicio' ? 0 : scroller.scrollHeight;
  };

  let arrastre: { scroller: HTMLElement; x: number; izquierda: number; movido: boolean } | null = null;

  const soltarSeleccion = () => {
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  const alBajarRaton = (e: MouseEvent) => {
    if (e.button !== 0) return;
    const el = e.target as Element | null;
    if (!el || el.closest('input, textarea, select')) return;
    const scroller = scrollerHorizontal(el);
    if (scroller) arrastre = { scroller, x: e.clientX, izquierda: scroller.scrollLeft, movido: false };
  };

  const alMoverRaton = (e: MouseEvent) => {
    if (!arrastre) return;
    if (e.buttons === 0) {
      arrastre = null;
      soltarSeleccion();
      return;
    }
    const dx = e.clientX - arrastre.x;
    if (!arrastre.movido && !esArrastre(dx)) return;
    if (!arrastre.movido) {
      arrastre.movido = true;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
    }
    arrastre.scroller.scrollLeft = arrastre.izquierda - dx;
  };

  const alSubirRaton = () => {
    if (arrastre?.movido) {
      // El clic que sigue al arrastre no es una pulsación del chip de debajo.
      const anular = (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener('click', anular, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', anular, { capture: true }), 0);
      soltarSeleccion();
    }
    arrastre = null;
  };

  document.addEventListener('keydown', alPulsarTecla);
  document.addEventListener('mousedown', alBajarRaton);
  document.addEventListener('mousemove', alMoverRaton);
  document.addEventListener('mouseup', alSubirRaton);
  return () => {
    document.removeEventListener('keydown', alPulsarTecla);
    document.removeEventListener('mousedown', alBajarRaton);
    document.removeEventListener('mousemove', alMoverRaton);
    document.removeEventListener('mouseup', alSubirRaton);
  };
}
