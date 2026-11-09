import fs from 'fs';
import path from 'path';
import { __fijarIdiomaParaTest } from '@/i18n';
import { DATOS_IA, TEXTO_CONSENTIMIENTO } from '../consentmath';
import { HEALTH_COPY } from '../healthmath';
import { REPORT_REASONS } from '../socialSafety';

const raiz = path.resolve(__dirname, '..', '..', '..');
const IDIOMAS = ['en', 'fr', 'de', 'it', 'pt'] as const;
const PULSO_Y_GPS: Record<(typeof IDIOMAS)[number] | 'es', RegExp[]> = {
  es: [/pulso/i, /GPS/, /t[ií]tulo/i],
  en: [/heart rate/i, /GPS/, /title/i],
  fr: [/fr[ée]quence cardiaque/i, /GPS/, /titre/i],
  de: [/puls/i, /GPS/, /titel/i],
  it: [/frequenza cardiaca/i, /GPS/, /titolo/i],
  pt: [/frequ[êe]ncia card[íi]aca/i, /GPS/, /t[íi]tulo/i],
};

afterEach(() => __fijarIdiomaParaTest('es'));

describe('permisos y denuncias en los seis idiomas', () => {
  test.each(['es', ...IDIOMAS] as const)('%s: la hoja de IA nombra pulso, GPS y títulos de calendario', (idioma) => {
    __fijarIdiomaParaTest(idioma);
    const hoja = JSON.stringify(DATOS_IA);
    for (const re of PULSO_Y_GPS[idioma]) expect(hoja).toMatch(re);
    expect(hoja).not.toMatch(/[–—]/);
  });

  test.each(IDIOMAS)('%s: consentimientos y motivos no se quedan en español', (idioma) => {
    __fijarIdiomaParaTest('es');
    const es = { ia: TEXTO_CONSENTIMIENTO.consentimiento, salud: HEALTH_COPY.checkbox, motivo: REPORT_REASONS[2]!.label };
    __fijarIdiomaParaTest(idioma);
    expect(TEXTO_CONSENTIMIENTO.consentimiento).not.toBe(es.ia);
    expect(HEALTH_COPY.checkbox).not.toBe(es.salud);
    expect(REPORT_REASONS[2]!.label).not.toBe(es.motivo);
  });

  test('el responsable va una sola vez, fuera de los catálogos', () => {
    expect(HEALTH_COPY.storage).toContain('soporte@nivl.app');
    expect(HEALTH_COPY.storage).not.toContain('{{');
    for (const i of ['es', ...IDIOMAS]) {
      expect(fs.readFileSync(path.join(raiz, `src/i18n/${i}/legal.json`), 'utf8')).toContain('{{responsable}}');
    }
  });
});

describe('permisos nativos de iOS por idioma', () => {
  const expo = JSON.parse(fs.readFileSync(path.join(raiz, 'app.json'), 'utf8')).expo;
  const declaradas = Object.keys(expo.ios.infoPlist).filter((k) => k.endsWith('UsageDescription'));
  const deLosPlugins = [
    'NSSpeechRecognitionUsageDescription',
    'NSCalendarsUsageDescription',
    'NSCalendarsFullAccessUsageDescription',
    'NSRemindersUsageDescription',
    'NSRemindersFullAccessUsageDescription',
  ];

  test.each(IDIOMAS)('%s: cada motivo de permiso está traducido', (idioma) => {
    const ruta = expo.locales[idioma] as string;
    const textos = JSON.parse(fs.readFileSync(path.join(raiz, ruta), 'utf8')).ios as Record<string, string>;
    for (const k of [...declaradas, ...deLosPlugins]) {
      expect(textos[k]?.length ?? 0).toBeGreaterThan(20);
      expect(textos[k]).not.toBe(expo.ios.infoPlist[k]);
      expect(textos[k]).not.toMatch(/[–—]/);
    }
  });
});

describe('la entrada no promete resultados', () => {
  test.each(['es', ...IDIOMAS])('%s', (idioma) => {
    const o = JSON.parse(fs.readFileSync(path.join(raiz, `src/i18n/${idioma}/onboarding.json`), 'utf8')).embudo;
    const textos = [o.crudo.cuerpo, o.veredicto.duro, o.veredicto.tacto, o.hitos.trabajador.dia90.detalle].join(' ');
    expect(textos).not.toMatch(/no seas la misma persona|llegas|basta\b|Resultados que/);
    expect(textos).not.toMatch(/won't be the same|you'll get there|will get/i);
  });
});
