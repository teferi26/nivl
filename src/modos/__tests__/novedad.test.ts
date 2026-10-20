// Modos · «Novedad: elige tus modos»: cuándo toca enseñar la hoja.
import { tocaNovedadModos, type EstadoNovedadModos } from '../novedad';

const base: EstadoNovedadModos = {
  activo: true,
  onboardingHecho: true,
  cargado: true,
  leidos: true,
  activados: [],
  vista: false,
  enPausa: false,
};

describe('tocaNovedadModos', () => {
  it('toca a quien ya existía, sin modos y sin haberla visto', () => {
    expect(tocaNovedadModos(base)).toBe(true);
  });

  it('con el interruptor apagado, nunca', () => {
    expect(tocaNovedadModos({ ...base, activo: false })).toBe(false);
  });

  it('durante el onboarding (o sin perfil leído), nunca', () => {
    expect(tocaNovedadModos({ ...base, onboardingHecho: false })).toBe(false);
  });

  it('a quien ya tiene modos, nunca', () => {
    expect(tocaNovedadModos({ ...base, activados: ['iron'] })).toBe(false);
    expect(tocaNovedadModos({ ...base, activados: ['focus', 'founder'] })).toBe(false);
  });

  it('una sola vez: con la marca del teléfono puesta, no vuelve', () => {
    expect(tocaNovedadModos({ ...base, vista: true })).toBe(false);
  });

  it('espera a leer la marca del teléfono', () => {
    expect(tocaNovedadModos({ ...base, vista: null })).toBe(false);
  });

  it('espera a leer los modos y no pregunta si la lectura falló', () => {
    expect(tocaNovedadModos({ ...base, cargado: false })).toBe(false);
    expect(tocaNovedadModos({ ...base, leidos: false })).toBe(false);
  });

  it('no sale encima de otra cosa', () => {
    expect(tocaNovedadModos({ ...base, enPausa: true })).toBe(false);
  });
});
