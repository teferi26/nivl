import { describe, expect, test } from '@jest/globals';
import { DIA, HORA, decidirOferta, type ContextoOferta, type DecisionOferta } from '@/lib/paywallmoment';
import { pasoOferta } from '../onboarding/pasoOferta';

const AHORA = 1_800_000_000_000;

const d = (p: Partial<DecisionOferta>): DecisionOferta => ({
  mostrar: true,
  forma: 'hoja',
  tier: 'pro',
  prueba: false,
  copyKey: 'firma.pro',
  razon: 'test',
  ...p,
});

// Lo mismo que arma `ofrecerSi('firma', estado, { celebrando: false })` para
// una cuenta gratuita recién llegada; `tiendaAbierta` es `purchasesAvailable()`.
const ctx = (p: Partial<ContextoOferta>): ContextoOferta => ({
  tier: 'free',
  entitled: false,
  trial: false,
  trialAvailable: true,
  tiendaAbierta: true,
  celebrando: false,
  ahora: AHORA,
  historial: [],
  ...p,
});

describe('pasoOferta', () => {
  test('sin decisión se espera (se está leyendo el estado)', () => {
    expect(pasoOferta(null, false)).toBe('esperar');
    expect(pasoOferta(null, true)).toBe('esperar');
  });

  test('si no se ofrece, se salta: nunca una oferta a ciegas', () => {
    expect(pasoOferta(d({ mostrar: false, razon: 'sin_estado' }), false)).toBe('saltar');
    expect(pasoOferta(d({ mostrar: false, forma: 'linea' }), true)).toBe('saltar');
  });

  test('la hoja no se abre encima de una celebración', () => {
    expect(pasoOferta(d({ forma: 'hoja' }), false)).toBe('hoja');
    expect(pasoOferta(d({ forma: 'hoja' }), true)).toBe('esperar');
  });

  test('la línea no tapa nada: se enseña también con celebración', () => {
    expect(pasoOferta(d({ forma: 'linea' }), false)).toBe('linea');
    expect(pasoOferta(d({ forma: 'linea' }), true)).toBe('linea');
  });
});

describe('el último paso del onboarding según la decisión real', () => {
  test('tienda ABIERTA (1.0.8), primera firma: la hoja entera, con la prueba si nunca la tuvo', () => {
    const dec = decidirOferta('firma', ctx({ tiendaAbierta: true }));
    expect(pasoOferta(dec, false)).toBe('hoja');
    expect(dec.tier).toBe('pro');
    expect(dec.prueba).toBe(true);
  });

  test('tienda ABIERTA, sin prueba disponible: hoja sin prueba', () => {
    const dec = decidirOferta('firma', ctx({ tiendaAbierta: true, trialAvailable: false }));
    expect(pasoOferta(dec, false)).toBe('hoja');
    expect(dec.prueba).toBe(false);
  });

  test('tienda ABIERTA, hoja cerrada hace poco (rehace el onboarding): baja a línea', () => {
    const historial = [{ momento: 'firma' as const, at: AHORA - 2 * HORA, respuesta: 'cerrada' as const, forma: 'hoja' as const }];
    const dec = decidirOferta('firma', ctx({ tiendaAbierta: true, historial }));
    expect(pasoOferta(dec, false)).toBe('linea');
  });

  test('tienda ABIERTA, firma ya vista hace días sin bloqueo: vuelve la hoja', () => {
    const historial = [{ momento: 'firma' as const, at: AHORA - 5 * DIA, respuesta: 'cerrada' as const, forma: 'hoja' as const }];
    const dec = decidirOferta('firma', ctx({ tiendaAbierta: true, historial }));
    expect(pasoOferta(dec, false)).toBe('hoja');
  });

  test('tienda CERRADA: siempre línea (cambio visible respecto a la hoja con «Avísame»)', () => {
    const dec = decidirOferta('firma', ctx({ tiendaAbierta: false }));
    expect(pasoOferta(dec, false)).toBe('linea');
  });

  test('cuenta en prueba: línea, nunca hoja', () => {
    const dec = decidirOferta('firma', ctx({ tier: 'pro', entitled: true, trial: true, trialAvailable: false }));
    expect(pasoOferta(dec, false)).toBe('linea');
  });

  test('cuenta Élite: no se ofrece nada y se entra', () => {
    const dec = decidirOferta('firma', ctx({ tier: 'elite', entitled: true, trialAvailable: false }));
    expect(pasoOferta(dec, false)).toBe('saltar');
  });
});
