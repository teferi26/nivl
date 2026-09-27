import { clavePropiaPermitida, esTienda, stripePermitido } from '../storepolicy';

describe('build de tienda · Guideline 3.1.1', () => {
  test('iOS y Android son tienda; la web no', () => {
    expect(esTienda('ios')).toBe(true);
    expect(esTienda('android')).toBe(true);
    expect(esTienda('web')).toBe(false);
  });

  test('Stripe nunca en la app de tienda, aunque el interruptor esté puesto', () => {
    expect(stripePermitido('ios', 'on')).toBe(false);
    expect(stripePermitido('android', 'on')).toBe(false);
    expect(stripePermitido('web', 'on')).toBe(true);
    expect(stripePermitido('web', undefined)).toBe(false);
  });

  test('la clave de API propia: solo fuera de la tienda o en desarrollo', () => {
    expect(clavePropiaPermitida('ios', false)).toBe(false);
    expect(clavePropiaPermitida('android', false)).toBe(false);
    expect(clavePropiaPermitida('ios', true)).toBe(true);
    expect(clavePropiaPermitida('web', false)).toBe(true);
  });
});
