import { debeRecargar } from '@/components/ui/useAlVolver';

describe('debeRecargar', () => {
  it('recarga al volver de segundo plano o de inactiva', () => {
    expect(debeRecargar('background', 'active', '2026-10-02', '2026-10-02')).toBe(true);
    expect(debeRecargar('inactive', 'active', '2026-10-02', '2026-10-02')).toBe(true);
  });

  it('no recarga al irse ni si sigue activa el mismo día', () => {
    expect(debeRecargar('active', 'background', '2026-10-02', '2026-10-03')).toBe(false);
    expect(debeRecargar('active', 'inactive', '2026-10-02', '2026-10-02')).toBe(false);
    expect(debeRecargar('active', 'active', '2026-10-02', '2026-10-02')).toBe(false);
  });

  it('recarga si ha cambiado el día aunque no saliera de la app', () => {
    expect(debeRecargar('active', 'active', '2026-10-02', '2026-10-03')).toBe(true);
    expect(debeRecargar('unknown', 'active', '2026-10-02', '2026-10-03')).toBe(true);
  });
});
