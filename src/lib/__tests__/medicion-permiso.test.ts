// Decisión del 09/11/2026: nadie vuelve a aceptar el permiso de salud al
// actualizar, y ese permiso antiguo no enciende HealthKit, GPS ni reloj.
import { HEALTH_CONSENT_VERSION, readHealthConsent } from '../healthmath';

const V1 = '2026-09-27-salud-v1';
const servidor = (extra: object) => ({ current_version: V1, version: V1, revision: 3, ...extra });

describe('permiso de salud y medición', () => {
  it('la versión sigue siendo la que aceptaron los usuarios de la 1.0.11', () => {
    expect(HEALTH_CONSENT_VERSION).toBe(V1);
  });

  it('usuario antiguo: al actualizar conserva el acceso, sin pantalla, y la medición sigue apagada', () => {
    const c = readHealthConsent(servidor({ accepted: true, medicion_activa: false }));
    expect(c.accepted).toBe(true);
    expect(c.medicionActiva).toBe(false);
  });

  it('usuario antiguo con un servidor aún sin la 0111: tampoco se le enciende', () => {
    const c = readHealthConsent(servidor({ accepted: true }));
    expect(c.accepted).toBe(true);
    expect(c.medicionActiva).toBe(false);
  });

  it('usuario antiguo que activa HealthKit: queda activa y el permiso no cambia', () => {
    const c = readHealthConsent(servidor({ accepted: true, medicion_activa: true }));
    expect(c).toMatchObject({ accepted: true, medicionActiva: true, revision: 3 });
  });

  it('usuario nuevo: sin aceptar no tiene nada; al aceptar, la medición sigue apagada hasta activarla', () => {
    expect(readHealthConsent({ accepted: false, current_version: V1, version: null, revision: 0, medicion_activa: false }))
      .toMatchObject({ accepted: false, medicionActiva: false });
    expect(readHealthConsent(servidor({ accepted: true, revision: 1, medicion_activa: false })))
      .toMatchObject({ accepted: true, medicionActiva: false });
  });
});
