// NIVL · QA F1 (M4): los textos de game.ts, kinds.ts, compromiso.ts y
// proplans.ts que pasaron a catálogos dicen en español EXACTAMENTE lo de la
// 1.0.9. La foto (`fijos/textos-lib-es.json`) se sacó del código de antes de
// extraerlos; si cambia a propósito, se regenera con NIVL_FOTO=1.
import fs from 'fs';
import path from 'path';
import { HORIZONTES, textoCompromiso } from '../compromiso';
import { DIFFICULTY_LABEL, STAT_LABEL } from '../game';
import { KINDS, MODULES, PROFILE_KINDS } from '../kinds';
import { COPY_UPSELL, ELITE_BENEFITS, PRO_BENEFITS, TIERS } from '../proplans';
import { preciosFin } from '../pruebaAutomath';

const FOTO = path.join(__dirname, 'fijos', 'textos-lib-es.json');

function foto() {
  return {
    dificultad: { ...DIFFICULTY_LABEL },
    atributo: { ...STAT_LABEL },
    modulos: MODULES.map((m) => [m.id, m.label]),
    perfiles: PROFILE_KINDS.map((k) => {
      const m = KINDS[k];
      return {
        id: m.id,
        label: m.label,
        title: m.title,
        tagline: m.tagline,
        description: m.description,
        campaignsLabel: m.campaignsLabel,
        campaignsHint: m.campaignsHint,
        goalExample: m.goalExample,
        enFrase: m.label.toLowerCase(),
        misiones: m.starterQuests.map((q) => q.title),
        coachHint: m.coachHint,
      };
    }),
    horizontes: HORIZONTES.map((h) => h.label),
    compromiso: HORIZONTES.map((h) =>
      textoCompromiso({
        name: 'Teferi',
        goal: 'Bajar a 78 kg sin perder fuerza.',
        target: '78 kg',
        deadline: 'junio de 2027',
        horizonte: h,
        firmadoEl: 'domingo, 18 de octubre de 2026',
        seAbreEl: 'lunes, 17 de octubre de 2029',
      }),
    ),
    compromisoSinExtras: textoCompromiso({
      name: 'Ana',
      goal: 'Aprobar',
      horizonte: HORIZONTES[0]!,
      firmadoEl: 'a',
      seAbreEl: 'b',
    }),
    niveles: TIERS.map((x) => [x.id, x.name, x.label, x.power]),
    beneficiosPro: PRO_BENEFITS.map((b) => [b.icon, b.title, b.detail]),
    beneficiosElite: ELITE_BENEFITS.map((b) => [b.icon, b.title, b.detail]),
    upsellFirma: [COPY_UPSELL['firma.pro'], COPY_UPSELL['firma.elite']].map((c) => ({ ...c })),
    preciosReserva: preciosFin(null),
  };
}

it('en español, los textos extraídos de las librerías son los de la 1.0.9', () => {
  const ahora = JSON.parse(JSON.stringify(foto()));
  if (process.env.NIVL_FOTO === '1') {
    fs.mkdirSync(path.dirname(FOTO), { recursive: true });
    fs.writeFileSync(FOTO, JSON.stringify(ahora, null, 2) + '\n');
  }
  expect(ahora).toEqual(JSON.parse(fs.readFileSync(FOTO, 'utf8')));
});
