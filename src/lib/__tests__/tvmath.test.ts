import { codigoTvValido, codigoTvVisible, normalizarCodigoTv } from '../tvmath';

describe('código de enlace de la TV', () => {
  it('limpia guiones, espacios y minúsculas', () => {
    expect(normalizarCodigoTv(' wph6-ruck ')).toBe('WPH6RUCK');
    expect(normalizarCodigoTv(['ab cd', 'zz'])).toBe('ABCD');
    expect(normalizarCodigoTv(undefined)).toBe('');
    expect(normalizarCodigoTv(null)).toBe('');
  });

  it('acepta solo el alfabeto y la longitud del servidor', () => {
    expect(codigoTvValido('WPH6RUCK')).toBe(true);
    expect(codigoTvValido('WPH6RUC')).toBe(false);
    expect(codigoTvValido('WPH6RUCKA')).toBe(false);
    expect(codigoTvValido('WPH0RUCK')).toBe(false);
    expect(codigoTvValido('WPH1RUCK')).toBe(false);
    expect(codigoTvValido('WPHIRUCK')).toBe(false);
    expect(codigoTvValido('WPHORUCK')).toBe(false);
  });

  it('pinta XXXX-XXXX también a medio escribir y corta lo que sobra', () => {
    expect(codigoTvVisible('wph')).toBe('WPH');
    expect(codigoTvVisible('wph6')).toBe('WPH6');
    expect(codigoTvVisible('wph6r')).toBe('WPH6-R');
    expect(codigoTvVisible('WPH6-RUCKZZ')).toBe('WPH6-RUCK');
  });
});
