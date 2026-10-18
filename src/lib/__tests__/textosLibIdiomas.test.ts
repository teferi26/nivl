// NIVL · QA F1 (M3, M4): con la interfaz en otro idioma, las tablas de
// game.ts, kinds.ts, compromiso.ts y proplans.ts hablan ese idioma, y lo que
// depende del texto (el enlace de las misiones, reconocer un compromiso,
// poner primero el beneficio del motivo) sigue funcionando.
import { __fijarIdiomaParaTest } from '@/i18n';
import { HORIZONTES, esCompromiso, textoCompromiso } from '../compromiso';
import { DIFFICULTY_LABEL, STAT_ABBR, STAT_LABEL } from '../game';
import { KINDS, MODULES } from '../kinds';
import { PRO_BENEFITS, beneficiosPorMotivo, copyUpsell, TIERS } from '../proplans';

const entrada = (h = HORIZONTES[1]!) => ({
  name: 'Teferi',
  goal: 'Run a marathon',
  target: '42 km',
  horizonte: h,
  firmadoEl: 'Sunday, October 18, 2026',
  seAbreEl: 'Wednesday, October 17, 2029',
});

afterEach(() => __fijarIdiomaParaTest('es'));

describe('en otro idioma', () => {
  it('juego: dificultades, atributos y abreviaturas', () => {
    __fijarIdiomaParaTest('en');
    expect(DIFFICULTY_LABEL.media).toBe('Medium');
    expect(STAT_LABEL.AGI).toBe('Agility');
    expect(STAT_ABBR.FUE).toBe('STR');
    expect({ ...STAT_ABBR }).toEqual({ FUE: 'STR', VIT: 'VIT', INT: 'INT', AGI: 'AGI', PER: 'PER' });
    __fijarIdiomaParaTest('de');
    expect(STAT_LABEL.FUE).toBe('Stärke');
    __fijarIdiomaParaTest('es');
    expect(STAT_ABBR.FUE).toBe('FUE');
  });

  it('perfiles de uso, módulos y misiones propuestas', () => {
    __fijarIdiomaParaTest('en');
    expect(KINDS.deportista.label).toBe('Athlete');
    expect(KINDS.deportista.enFrase).toBe('athlete');
    expect(KINDS.general.title).toBe('GLADIATOR');
    expect(MODULES.find((m) => m.id === 'economia')?.label).toBe('Finances');
    expect(KINDS.deportista.starterQuests.map((q) => q.title)).toContain('Weigh in');
    // El coach sigue leyendo su instrucción en español (no se pinta).
    expect(KINDS.deportista.coachHint).toMatch(/^Es deportista/);
  });

  it('el enlace de las misiones va explícito solo fuera del español', () => {
    const entrenar = KINDS.deportista.starterQuests[0]!;
    const leer = KINDS.estudiante.starterQuests.find((q) => q.stat === 'INT' && q.difficulty === 'facil')!;
    expect(entrenar.link).toBeUndefined();
    __fijarIdiomaParaTest('fr');
    expect(entrenar.title).toBe("S'entraîner");
    expect(entrenar.link).toBe('gym');
    expect(KINDS.deportista.starterQuests.map((q) => q.link)).toEqual(['gym', 'nutricion', undefined, undefined, 'peso', 'diario']);
    expect(leer.link).toBeUndefined();
    // Lo que se manda a la base: sin `link` en es, con él fuera.
    const { link, ...fila } = { ...entrenar };
    expect(link).toBe('gym');
    expect(fila).toMatchObject({ title: entrenar.title, stat: 'FUE', health_data: true });
  });

  it('el compromiso se escribe en el idioma de la interfaz y se reconoce en todos', () => {
    __fijarIdiomaParaTest('en');
    expect(HORIZONTES.map((h) => h.label)).toEqual(['1 year', '3 years', '5 years']);
    const en = textoCompromiso(entrada());
    expect(en.split('\n\n')[0]).toBe('COMMITMENT FOR 3 YEARS');
    expect(en).toContain('I, Teferi, sign this commitment with myself on Sunday, October 18, 2026');
    expect(en).toContain('Run a marathon. Figure: 42 km.');
    expect(en).not.toMatch(/compromiso|Firmado|Cifra/);
    __fijarIdiomaParaTest('de');
    const de = textoCompromiso(entrada(HORIZONTES[0]!));
    expect(de.startsWith('VERPFLICHTUNG FÜR 1 JAHR')).toBe(true);
    __fijarIdiomaParaTest('es');
    expect(esCompromiso(en)).toBe(true);
    expect(esCompromiso(de)).toBe(true);
    expect(esCompromiso(textoCompromiso(entrada()))).toBe(true);
    expect(esCompromiso('Querido yo del futuro')).toBe(false);
  });

  it('lo que escribe el gladiador no se interpreta como plantilla', () => {
    const raro = textoCompromiso({ ...entrada(), name: '{{plazo}}', goal: '$t(comun:cancelar) y {{nombre}}' });
    expect(raro).toContain('Yo, {{plazo}}, firmo');
    expect(raro).toContain('Estoy aquí para esto: $t(comun:cancelar) y {{nombre}}.');
  });

  it('la oferta del paso del coach: potencia, beneficios y la línea de la firma', () => {
    __fijarIdiomaParaTest('it');
    expect(TIERS[1]!.power).toBe('Il coach alla massima potenza, con la modalità profonda.');
    expect(copyUpsell('firma', 'pro').enlace).toBe('Vedi NIVL Pro');
    expect(copyUpsell('firma', 'pro').beneficio).toBe('Brief cada mañana');
    // El beneficio del motivo va primero también traducido (casa por id).
    expect(beneficiosPorMotivo(PRO_BENEFITS, 'primer_dia', 'pro')[0]!.title).toBe('Piano del giorno, blocco per blocco');
  });
});
