import { readFileSync } from 'fs';
import { join } from 'path';
import {
  AI_CONSENT_VERSION,
  consentimientoVigente,
  DATOS_IA,
  EDAD_MINIMA,
  fechaCorta,
  leerConsentimiento,
  lineaPerfil,
  PROVEEDORES_IA,
  situacion,
} from '../consentmath';

const aceptado = { current_version: AI_CONSENT_VERSION, granted: true, action: 'accept', version: AI_CONSENT_VERSION, at: '2026-09-27T10:00:00Z' };

describe('consentimiento IA · versión', () => {
  test('la versión de la app casa con ai_consent_version() de la 0028', () => {
    const sql = readFileSync(join(__dirname, '../../../supabase/migrations/0028_consentimiento_ia.sql'), 'utf8');
    const m = /ai_consent_version\(\)[\s\S]*?select '([^']+)'::text/.exec(sql);
    expect(m?.[1]).toBe(AI_CONSENT_VERSION);
  });

  test('la edad mínima es la de los Términos', () => {
    expect(EDAD_MINIMA).toBe(16);
  });
});

describe('consentimiento IA · lo que dice la hoja', () => {
  test('nombra salud, diario, finanzas y fotos', () => {
    const t = DATOS_IA.map((d) => d.titulo.toLowerCase()).join(' ');
    for (const w of ['salud', 'diario', 'finanzas', 'fotos']) expect(t).toContain(w);
  });

  test('nombra a Anthropic en EE. UU. y a DeepSeek en China', () => {
    expect(PROVEEDORES_IA.find((p) => p.nombre.startsWith('Anthropic'))?.donde).toBe('Estados Unidos');
    expect(PROVEEDORES_IA.find((p) => p.nombre === 'DeepSeek')?.donde).toContain('China');
  });
});

describe('consentimiento IA · estado', () => {
  test('lee la RPC y tolera basura', () => {
    expect(leerConsentimiento(aceptado)).toEqual({
      versionServidor: AI_CONSENT_VERSION,
      concedido: true,
      accion: 'accept',
      version: AI_CONSENT_VERSION,
      fecha: '2026-09-27T10:00:00Z',
    });
    const vacio = leerConsentimiento(null);
    expect(vacio.concedido).toBe(false);
    expect(vacio.accion).toBeNull();
    expect(leerConsentimiento({ action: 'otra', granted: 'true' }).concedido).toBe(false);
  });

  test('vigente solo si el servidor lo concede y la versión es la de la app', () => {
    expect(consentimientoVigente(leerConsentimiento(aceptado))).toBe(true);
    expect(consentimientoVigente(null)).toBe(false);
    expect(consentimientoVigente(leerConsentimiento({ ...aceptado, granted: false }))).toBe(false);
    expect(consentimientoVigente(leerConsentimiento({ ...aceptado, current_version: '2099-01-01' }))).toBe(false);
  });

  test('situación: pendiente, retirado, texto nuevo y app antigua', () => {
    expect(situacion(leerConsentimiento({ current_version: AI_CONSENT_VERSION, granted: false }))).toBe('pendiente');
    expect(situacion(leerConsentimiento({ ...aceptado, granted: false, action: 'withdraw' }))).toBe('retirado');
    expect(situacion(leerConsentimiento({ ...aceptado, granted: false, version: '2026-01-01' }))).toBe('version_nueva');
    expect(situacion(leerConsentimiento({ ...aceptado, current_version: '2099-01-01' }))).toBe('app_antigua');
    expect(situacion(leerConsentimiento(aceptado))).toBe('vigente');
  });

  test('la línea de Perfil lleva la fecha y cómo retirarlo', () => {
    expect(lineaPerfil(leerConsentimiento(aceptado))).toBe('Aceptado el 27/09/2026. Toca para retirarlo.');
    expect(lineaPerfil(leerConsentimiento({ ...aceptado, granted: false, action: 'withdraw' }))).toContain('Retirado el 27/09/2026');
    expect(lineaPerfil(leerConsentimiento({ current_version: AI_CONSENT_VERSION }))).toContain('Sin aceptar');
  });

  test('fechaCorta', () => {
    expect(fechaCorta('2026-09-27T23:59:00+00:00')).toBe('27/09/2026');
    expect(fechaCorta(null)).toBeNull();
    expect(fechaCorta('basura')).toBeNull();
  });
});
