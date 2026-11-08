import { accionesDe, buscarElemento, fraseRechazo, leerBandeja, notaValida, respuestaAccion, totalAbierto } from '../moderacionmath';

const CRUDO = {
  recuento: { denuncias_perfil: 1, denuncias_ia: 1, perfiles: 1, suspendidos: 1 },
  denuncias_perfil: [
    { id: 'a', motivo: 'avatar', motivo_texto: 'Foto inapropiada', creada_en: '2026-11-08T10:00:00Z', denunciante: { id: null, nombre: null }, denunciado: { id: 'u', nombre: 'X', foto: 'u/a.jpg' }, mostrado: { foto: 'u/a.jpg' } },
  ],
  denuncias_ia: [{ id: 'b', motivo: 'salud', motivo_texto: 'Consejo', texto: 'hola', origen_texto: 'Coach', creada_en: '2026-11-08T10:00:00Z', denunciante: {} }],
  perfiles: [{ user_id: 'c', nombre: 'N', version: 'v', estado: 'approved' }],
  suspendidos: [{ user_id: 'd', nombre: 'S', version: 'v', estado: 'suspended' }],
};

describe('moderación (pura)', () => {
  it('lee la bandeja y sus claves', () => {
    const b = leerBandeja(CRUDO);
    expect(totalAbierto(b)).toBe(3);
    expect(buscarElemento(b, 'dp_a')?.clase).toBe('denuncia_perfil');
    expect(buscarElemento(b, 'ia_b')?.clase).toBe('denuncia_ia');
    expect(buscarElemento(b, 'pf_c')?.clase).toBe('perfil');
    expect(buscarElemento(b, 'su_d')?.clase).toBe('suspendido');
    expect(buscarElemento(b, 'dp_zz')).toBeNull();
  });
  it('aguanta una respuesta vacía o rara', () => {
    for (const r of [null, undefined, 'x', { denuncias_perfil: 'no', recuento: 3 }]) {
      const b = leerBandeja(r);
      expect(totalAbierto(b)).toBe(0);
      expect(b.denunciasPerfil).toEqual([]);
    }
  });
  it('cada elemento ofrece solo sus acciones', () => {
    const b = leerBandeja(CRUDO);
    expect(accionesDe(b.denunciasPerfil[0])).toEqual(['resolver', 'descartar', 'suspender']);
    expect(accionesDe(b.denunciasIA[0])).toEqual(['resolver', 'descartar']);
    expect(accionesDe(b.perfiles[0])).toEqual(['revisar', 'suspender']);
    expect(accionesDe(b.suspendidos[0])).toEqual(['levantar']);
  });
  it('suspender y levantar exigen motivo; lo demás no', () => {
    expect(notaValida('suspender', '  ')).toBe(false);
    expect(notaValida('levantar', 'ok')).toBe(false);
    expect(notaValida('suspender', 'Foto')).toBe(true);
    expect(notaValida('descartar', '')).toBe(true);
  });
  it('solo ok=true cuenta como hecho, y el rechazo se explica', () => {
    expect(respuestaAccion({ ok: true }).ok).toBe(true);
    expect(respuestaAccion({ ok: 'true' }).ok).toBe(false);
    expect(respuestaAccion(null).ok).toBe(false);
    expect(fraseRechazo('perfil_cambio')).toContain('cambiado');
    expect(fraseRechazo(undefined)).toContain('disponible');
  });
});
