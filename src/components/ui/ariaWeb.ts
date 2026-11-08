// NIVL · El estado accesible en la web.
//
// react-native-web 0.21 ignora `accessibilityState`: una pestaña activa o una
// casilla marcada no decían nada al lector de pantalla. Se reparte junto a
// `accessibilityState` en lo que tenga estado (pestaña, casilla, radio):
//   <Pressable accessibilityState={estado} {...ariaWeb(estado)} />
// En nativo no añade nada: allí manda `accessibilityState`.

import { Platform } from 'react-native';

interface Estado {
  selected?: boolean;
  checked?: boolean;
  disabled?: boolean;
  busy?: boolean;
}

/** Las props `aria-*` que dicen en la web lo mismo que `accessibilityState`. */
export function ariaWeb(estado: Estado | undefined): object {
  if (Platform?.OS !== 'web' || !estado) return {};
  const { selected, checked, disabled, busy } = estado;
  return {
    ...(selected !== undefined ? { 'aria-selected': selected } : null),
    ...(checked !== undefined ? { 'aria-checked': checked } : null),
    ...(disabled !== undefined ? { 'aria-disabled': disabled } : null),
    ...(busy !== undefined ? { 'aria-busy': busy } : null),
  };
}

/** Para un rol botón con estado (un chip que se elige): `aria-selected` no vale ahí. */
export function pulsadoWeb(pulsado: boolean): object {
  return Platform?.OS === 'web' ? { 'aria-pressed': pulsado } : {};
}

/**
 * El fondo de una hoja o una ceremonia, el Pressable que cubre todo para cerrar
 * al tocar fuera. En la web no es parada de tabulador ni se ilumina al pasar el
 * ratón (cerrar con teclado es Escape o la X); en nativo es el botón de siempre,
 * el que encuentra el lector de pantalla.
 */
export function fondoModal(etiqueta: string): object {
  // `?.`: las pruebas de las puertas simulan react-native sin Platform.
  if (Platform?.OS === 'web') return { tabIndex: -1 };
  return { accessibilityRole: 'button', accessibilityLabel: etiqueta };
}
