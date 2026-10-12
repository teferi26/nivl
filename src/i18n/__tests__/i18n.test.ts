// NIVL · Idiomas: el init síncrono, t(), los plurales, la preferencia y la
// regla de arranque (docs/i18n/PLAN-1010.md).
import {
  __fijarIdiomaParaTest,
  __olvidarPreferenciaParaTest,
  alCambiar,
  decidirPreferenciaInicial,
  existe,
  fijarPreferencia,
  idiomaCoach,
  idiomaInterfaz,
  preferenciaIdioma,
  resolverIdiomaCoach,
  t,
} from '@/i18n';
import { idiomaBase, normalizarBcp47 } from '@/i18n/dispositivo';
import { pseudoTexto } from '@/i18n/pseudo';
import { completarPlurales, NAMESPACES } from '@/i18n/recursos';
import { partirNegritas, sinMarcas } from '@/i18n/TextoRico';

afterEach(() => {
  __fijarIdiomaParaTest('es');
  __olvidarPreferenciaParaTest();
});

describe('init', () => {
  it('t() vale desde el primer import, sin esperar a nada', () => {
    expect(t('comun:cancelar')).toBe('Cancelar');
    expect(t('cancelar')).toBe('Cancelar');
    expect(t('comun:sistemaNoResponde')).toBe('El sistema no responde');
    expect(t('comun:sinConexion')).toBe('Sin conexión');
  });

  it('la interfaz es español en 1.0.10', () => {
    expect(idiomaInterfaz()).toBe('es');
  });

  it('todos los namespaces de las tandas 1 a 8 están registrados', () => {
    for (const ns of ['comun', 'raiz', 'ui', 'arena', 'hoy', 'perfil', 'coach', 'gym', 'diario', 'amigos', 'voz', 'avisos']) {
      expect(NAMESPACES).toContain(ns);
    }
  });

  it('sin escapar: las comillas y las <b> llegan tal cual', () => {
    const tLibre = t as unknown as (clave: string, opciones: Record<string, unknown>) => string;
    expect(tLibre('comun:noExiste', { defaultValue: 'Di {{x}}', x: '<b>«sí» & "no"</b>' })).toBe('Di <b>«sí» & "no"</b>');
  });

  it('una clave que no existe no rompe: devuelve la clave', () => {
    expect(existe('comun:noExiste')).toBe(false);
    expect(t('comun:noExiste' as 'comun:cancelar')).toBe('noExiste');
  });
});

describe('plurales', () => {
  it('misión, día y XP en singular y plural', () => {
    expect(t('comun:mision', { count: 1 })).toBe('1 misión');
    expect(t('comun:mision', { count: 3 })).toBe('3 misiones');
    expect(t('comun:dia', { count: 1 })).toBe('1 día');
    expect(t('comun:dia', { count: 0 })).toBe('0 días');
    expect(t('comun:dia', { count: 14 })).toBe('14 días');
  });

  it('XP agrupa los miles como el resto de la app', () => {
    expect(t('comun:xp', { count: 1840 })).toBe('1.840 XP');
    expect(t('comun:xp', { count: 1 })).toBe('1 XP');
  });

  it('«many» (un millón en es) cae en _other en vez de enseñar la clave', () => {
    expect(t('comun:dia', { count: 1000000 })).toBe('1000000 días');
    expect(t('comun:xp', { count: 1000000 })).toBe('1.000.000 XP');
  });

  it('completarPlurales copia _other en _many donde falta', () => {
    expect(completarPlurales({ a_one: 'x', a_other: 'y', b_many: 'm', b_other: 'o', c: { d_other: 'z' } })).toEqual({
      a_one: 'x',
      a_other: 'y',
      a_many: 'y',
      b_many: 'm',
      b_other: 'o',
      c: { d_other: 'z', d_many: 'z' },
    });
  });
});

describe('otros idiomas de interfaz (pruebas)', () => {
  it('un idioma sin catálogo cae en español', () => {
    __fijarIdiomaParaTest('en');
    expect(idiomaInterfaz()).toBe('en');
    expect(t('comun:guardar')).toBe('Guardar');
  });

  it('el pseudoidioma rodea cada texto con ⟦ ⟧ y respeta las variables', () => {
    __fijarIdiomaParaTest('xx');
    const s = t('comun:dia', { count: 2 });
    expect(s.startsWith('⟦')).toBe(true);
    expect(s.endsWith('⟧')).toBe(true);
    expect(s).toContain('2');
    expect(pseudoTexto('Hola {{nombre}} <b>ya</b>')).toMatch(/^⟦Hôlá \{\{nombre\}\} <b>yá<\/b>·+⟧$/);
  });
});

describe('dispositivo', () => {
  it('normaliza a BCP 47 corto', () => {
    expect(normalizarBcp47('en_US')).toBe('en-US');
    expect(normalizarBcp47('es-ES')).toBe('es-ES');
    expect(normalizarBcp47('ES')).toBe('es');
    expect(normalizarBcp47('zh-Hans-CN')).toBe('zh-CN');
    expect(normalizarBcp47('sr_RS@latin')).toBe('sr-RS');
    expect(normalizarBcp47('es-419')).toBe('es-419');
    expect(normalizarBcp47('pt_BR.UTF-8')).toBe('pt-BR');
    expect(normalizarBcp47('')).toBeNull();
    expect(normalizarBcp47(null)).toBeNull();
    expect(normalizarBcp47(['en'])).toBeNull();
  });

  it('idiomaBase quita la región', () => {
    expect(idiomaBase('pt-BR')).toBe('pt');
    expect(idiomaBase(null)).toBeNull();
  });
});

describe('idioma del coach', () => {
  it('sin preferencia, español', () => {
    expect(resolverIdiomaCoach(null, 'en-US')).toBe('es');
  });

  it('automático sigue al teléfono si NIVL lo habla; si no, español', () => {
    expect(resolverIdiomaCoach('auto', 'en-US')).toBe('en');
    expect(resolverIdiomaCoach('auto', 'pt-BR')).toBe('pt');
    expect(resolverIdiomaCoach('auto', 'ja-JP')).toBe('es');
    expect(resolverIdiomaCoach('auto', null)).toBe('es');
  });

  it('un idioma fijo manda sobre el teléfono', () => {
    expect(resolverIdiomaCoach('fr', 'en-US')).toBe('fr');
  });

  it('fijarPreferencia cambia el coach, avisa y no toca la interfaz', async () => {
    const oido = jest.fn();
    const dejar = alCambiar(oido);
    expect(preferenciaIdioma()).toBeNull();
    expect(idiomaCoach()).toBe('es');
    await fijarPreferencia('de');
    expect(preferenciaIdioma()).toBe('de');
    expect(idiomaCoach()).toBe('de');
    expect(idiomaInterfaz()).toBe('es');
    expect(oido).toHaveBeenCalled();
    dejar();
  });
});

describe('regla de arranque (cuentas existentes → es; nuevas → automático)', () => {
  const base = { guardada: null, onboardingHecho: false, locale: undefined, dispositivo: 'en-US' } as const;

  it('lo guardado en el teléfono manda y no se vuelve a guardar', () => {
    expect(decidirPreferenciaInicial({ ...base, guardada: 'it', onboardingHecho: true })).toEqual({
      preferencia: 'it',
      guardar: false,
    });
  });

  it('una cuenta que ya existía (onboarding hecho, sin locale) fija es aunque el móvil esté en inglés', () => {
    expect(decidirPreferenciaInicial({ ...base, onboardingHecho: true, locale: null })).toEqual({ preferencia: 'es', guardar: true });
    // Sin la columna (migración aún sin aplicar), igual.
    expect(decidirPreferenciaInicial({ ...base, onboardingHecho: true })).toEqual({ preferencia: 'es', guardar: true });
  });

  it('otra cuenta en el mismo teléfono: manda el idioma de su perfil si lo tiene; si no, el del teléfono', () => {
    expect(decidirPreferenciaInicial({ ...base, guardada: 'it', onboardingHecho: true, locale: 'fr', otraCuenta: true })).toEqual({
      preferencia: 'fr',
      guardar: true,
    });
    // Sin la columna 0066 (locale undefined) o sin idioma en el perfil, sigue lo guardado.
    expect(decidirPreferenciaInicial({ ...base, guardada: 'it', onboardingHecho: true, otraCuenta: true })).toEqual({
      preferencia: 'it',
      guardar: false,
    });
    expect(decidirPreferenciaInicial({ ...base, guardada: 'it', onboardingHecho: true, locale: null, otraCuenta: true })).toEqual({
      preferencia: 'it',
      guardar: false,
    });
  });

  it('una cuenta nueva sigue al teléfono', () => {
    expect(decidirPreferenciaInicial({ ...base })).toEqual({ preferencia: 'auto', guardar: true });
  });

  it('con idioma en el perfil (otro teléfono), ese; automático si coincide con el teléfono', () => {
    expect(decidirPreferenciaInicial({ ...base, onboardingHecho: true, locale: 'en' })).toEqual({ preferencia: 'auto', guardar: true });
    expect(decidirPreferenciaInicial({ ...base, onboardingHecho: true, locale: 'fr' })).toEqual({ preferencia: 'fr', guardar: true });
    // Un valor raro en el perfil se ignora.
    expect(decidirPreferenciaInicial({ ...base, onboardingHecho: true, locale: 'xx' })).toEqual({ preferencia: 'es', guardar: true });
  });
});

describe('TextoRico', () => {
  it('parte las negritas', () => {
    expect(partirNegritas('Te quedan <b>3 días</b> de pausa.')).toEqual([
      { texto: 'Te quedan ', negrita: false },
      { texto: '3 días', negrita: true },
      { texto: ' de pausa.', negrita: false },
    ]);
    expect(partirNegritas('<b>todo</b>')).toEqual([{ texto: 'todo', negrita: true }]);
    expect(partirNegritas('sin cerrar <b>hasta el final')).toEqual([
      { texto: 'sin cerrar ', negrita: false },
      { texto: 'hasta el final', negrita: true },
    ]);
    expect(sinMarcas('a <b>b</b> c')).toBe('a b c');
  });
});
