import { correoDenuncia, extractoDenuncia, faltaLaRpc, MAX_EXTRACTO, MOTIVOS_IA } from '../denunciaIA';

describe('denuncia de respuestas de IA', () => {
  it('los motivos son exactamente los del contrato con el servidor', () => {
    expect(MOTIVOS_IA.map((m) => m.value)).toEqual(['danino', 'salud', 'dinero', 'incorrecto', 'ofensivo', 'otro']);
  });

  it('el extracto se compacta y no pasa del tope', () => {
    expect(extractoDenuncia('  hola\n\n  gladiador  ')).toBe('hola gladiador');
    expect(extractoDenuncia('x'.repeat(MAX_EXTRACTO + 50))).toHaveLength(MAX_EXTRACTO);
  });

  it('reconoce que la RPC aún no existe', () => {
    expect(faltaLaRpc({ code: 'PGRST202' })).toBe(true);
    expect(faltaLaRpc({ code: '42883' })).toBe(true);
    expect(faltaLaRpc({ message: 'Could not find the function public.report_ai_message' })).toBe(true);
    expect(faltaLaRpc({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(faltaLaRpc(null)).toBe(false);
  });

  it('el correo de respaldo lleva id y motivo pero nunca el contenido', () => {
    const url = correoDenuncia('coach', 'salud', 'abc-123');
    expect(url.startsWith('mailto:')).toBe(true);
    const cuerpo = decodeURIComponent(url.split('body=')[1]);
    expect(cuerpo).toContain('abc-123');
    expect(cuerpo).toContain('Consejo de salud peligroso');
    expect(correoDenuncia('oraculo', 'otro', null)).toContain(encodeURIComponent('sin identificador'));
  });
});
