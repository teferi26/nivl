import { desplazamientoDeTecla, esArrastre, espacioActiva, UMBRAL_ARRASTRE } from '../entradaWeb';

const base = { etiqueta: 'DIV', rol: null, tabIndex: -1, cursor: 'auto', desactivado: false };

describe('espacioActiva', () => {
  it('activa pestañas, casillas y radios', () => {
    for (const rol of ['tab', 'checkbox', 'radio', 'switch']) expect(espacioActiva({ ...base, rol, tabIndex: 0 })).toBe(true);
  });

  it('deja el botón a react-native-web y los enlaces a su Enter', () => {
    expect(espacioActiva({ ...base, rol: 'button', tabIndex: 0 })).toBe(false);
    expect(espacioActiva({ ...base, rol: 'link', tabIndex: 0 })).toBe(false);
  });

  it('activa un pulsable sin rol, pero no un div cualquiera', () => {
    expect(espacioActiva({ ...base, tabIndex: 0, cursor: 'pointer' })).toBe(true);
    expect(espacioActiva({ ...base, tabIndex: 0, cursor: 'auto' })).toBe(false);
    expect(espacioActiva({ ...base, tabIndex: -1, cursor: 'pointer' })).toBe(false);
  });

  it('respeta lo nativo y lo desactivado', () => {
    expect(espacioActiva({ ...base, etiqueta: 'INPUT', rol: 'checkbox', tabIndex: 0 })).toBe(false);
    expect(espacioActiva({ ...base, etiqueta: 'TEXTAREA', tabIndex: 0, cursor: 'pointer' })).toBe(false);
    expect(espacioActiva({ ...base, rol: 'tab', tabIndex: 0, desactivado: true })).toBe(false);
  });
});

describe('desplazamientoDeTecla', () => {
  it('una flecha es un paso fijo', () => {
    expect(desplazamientoDeTecla('ArrowDown', false, 800)).toEqual({ por: 48 });
    expect(desplazamientoDeTecla('ArrowUp', false, 800)).toEqual({ por: -48 });
  });

  it('una página deja un poco de la anterior', () => {
    expect(desplazamientoDeTecla('PageDown', false, 800)).toEqual({ por: 720 });
    expect(desplazamientoDeTecla('PageUp', false, 800)).toEqual({ por: -720 });
  });

  it('Espacio baja y con Mayús sube', () => {
    expect(desplazamientoDeTecla(' ', false, 100)).toEqual({ por: 90 });
    expect(desplazamientoDeTecla(' ', true, 100)).toEqual({ por: -90 });
  });

  it('Inicio y Fin van a los extremos, y el resto de teclas no mueve nada', () => {
    expect(desplazamientoDeTecla('Home', false, 800)).toEqual({ hasta: 'inicio' });
    expect(desplazamientoDeTecla('End', false, 800)).toEqual({ hasta: 'fin' });
    expect(desplazamientoDeTecla('a', false, 800)).toBeNull();
    expect(desplazamientoDeTecla('Enter', false, 800)).toBeNull();
  });
});

describe('esArrastre', () => {
  it('un temblor sigue siendo clic', () => {
    expect(esArrastre(UMBRAL_ARRASTRE - 1)).toBe(false);
    expect(esArrastre(-(UMBRAL_ARRASTRE - 1))).toBe(false);
  });

  it('a partir del umbral, en cualquier sentido, es arrastre', () => {
    expect(esArrastre(UMBRAL_ARRASTRE)).toBe(true);
    expect(esArrastre(-40)).toBe(true);
  });
});
