// NIVL · Idiomas (Modos F1): la interfaz en otros idiomas detrás del flag,
// la cabecera del coach, la dirección de escritura y el formato con Intl.
import {
  __fijarIdiomaParaTest,
  __olvidarPreferenciaParaTest,
  activarIdiomasInterfaz,
  fijarPreferencia,
  IDIOMAS,
  idiomaInterfaz,
  idiomasInterfazActivos,
  t,
} from '@/i18n';
import { aplicarDireccion, esRTL, IDIOMAS_RTL } from '@/i18n/direccion';
import { fechaLarga, localeIntl, miles, moneda, nombreMes } from '@/i18n/formato';
import { cabeceraIdioma } from '@/lib/coach';
import { __fijarFlagsParaPruebas } from '@/lib/flags';

// jest.mock se sube solo por encima de los import (babel-jest).
const mockRpc = jest.fn();
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('@/lib/health', () => ({ requireHealthConsent: jest.fn(async () => undefined) }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    auth: { getSession: jest.fn(async () => ({ data: { session: { access_token: 't' } } })) },
  },
}));

afterEach(() => {
  __olvidarPreferenciaParaTest();
  __fijarIdiomaParaTest('es');
  __fijarFlagsParaPruebas(null);
});

describe('interfaz detrás del flag idiomas_activos', () => {
  it('con el flag apagado, elegir otro idioma deja la interfaz en español (1.0.10 tal cual)', async () => {
    await fijarPreferencia('fr');
    expect(idiomasInterfazActivos()).toBe(false);
    expect(idiomaInterfaz()).toBe('es');
    expect(t('comun:cancelar')).toBe('Cancelar');
    expect(t('comun:sistemaNoResponde')).toBe('El sistema no responde');
  });

  it('con el flag encendido, la interfaz sigue a la preferencia', async () => {
    activarIdiomasInterfaz(true);
    expect(idiomaInterfaz()).toBe('es'); // sin preferencia conocida, es
    await fijarPreferencia('en');
    expect(idiomaInterfaz()).toBe('en');
    expect(t('comun:cancelar')).toBe('Cancel');
    await fijarPreferencia('de');
    expect(idiomaInterfaz()).toBe('de');
    expect(t('comun:mision', { count: 1 })).toMatch(/^1 /);
  });

  it('al apagar el flag vuelve al español', async () => {
    activarIdiomasInterfaz(true);
    await fijarPreferencia('it');
    expect(idiomaInterfaz()).toBe('it');
    activarIdiomasInterfaz(false);
    expect(idiomaInterfaz()).toBe('es');
    expect(t('comun:guardar')).toBe('Guardar');
  });

  it('cada idioma traducido tiene sus plurales de i18next', async () => {
    activarIdiomasInterfaz(true);
    for (const lng of ['en', 'fr', 'pt', 'de', 'it'] as const) {
      await fijarPreferencia(lng);
      const uno = t('comun:dia', { count: 1 });
      const dos = t('comun:dia', { count: 2 });
      expect(uno).toContain('1');
      expect(dos).toContain('2');
      expect(uno.replace('1', '')).not.toBe(dos.replace('2', ''));
    }
  });
});

describe('cabecera x-nivl-locale del coach', () => {
  it('sin el flag, no se manda (prompt del servidor idéntico al de hoy)', async () => {
    await fijarPreferencia('fr');
    expect(cabeceraIdioma()).toEqual({});
  });

  it('con el flag, manda el idioma del coach', async () => {
    __fijarFlagsParaPruebas({ idiomas_activos: true });
    await fijarPreferencia('fr');
    expect(cabeceraIdioma()).toEqual({ 'x-nivl-locale': 'fr' });
  });
});

describe('dirección de escritura (RTL preparado, sin activar)', () => {
  it('reconoce los idiomas RTL', () => {
    expect(esRTL('ar')).toBe(true);
    expect(esRTL('he-IL')).toBe(true);
    expect(esRTL('fa')).toBe(true);
    expect(esRTL('es')).toBe(false);
    expect(esRTL(null)).toBe(false);
  });

  it('ningún idioma de hoy es RTL y aplicarlo no cambia nada', () => {
    for (const lng of IDIOMAS) {
      expect(esRTL(lng)).toBe(false);
      expect(aplicarDireccion(lng)).toBe(false);
    }
    expect(IDIOMAS.some((l) => (IDIOMAS_RTL as readonly string[]).includes(l))).toBe(false);
  });
});

describe('formato con Intl en el idioma activo', () => {
  it('portugués europeo y el resto tal cual; es y xx como es-ES', () => {
    expect(localeIntl('pt')).toBe('pt-PT');
    expect(localeIntl('en')).toBe('en');
    expect(localeIntl('es')).toBe('es-ES');
    expect(localeIntl('xx')).toBe('es-ES');
  });

  it('fechaLarga en es es exactamente el toLocaleDateString de antes', () => {
    const d = new Date(2026, 7, 16);
    expect(fechaLarga(d, false, 'es')).toBe(d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
    expect(fechaLarga(d, true, 'es')).toBe(
      d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    );
  });

  it('en otros idiomas usa Intl en ese idioma', () => {
    const d = new Date(2026, 7, 16);
    expect(fechaLarga(d, false, 'en')).toBe(d.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' }));
    expect(nombreMes(0, 'de')).toBe(new Intl.DateTimeFormat('de', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1))));
    expect(miles(1840, 'en')).toBe('1,840');
    expect(moneda(12, 0, 'de')).toBe(new Intl.NumberFormat('de', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(12));
  });
});
