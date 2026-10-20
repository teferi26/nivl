// NIVL · El coach: la pantalla entera, la de la pestaña de NIVL y la de cada
// mundo (IRON, FOCUS, WORK, FOUNDER). Es el mismo chat; el modo viaja como
// contexto en `x-nivl-modo` (ModoProvider → modos/coach.ts → lib/coach.ts) y
// dentro de un mundo el modo activo es siempre el suyo (LayoutMundo).
// Los datos y los efectos viven en useCoach; lo que se
// ve, en CoachVista (pura, también en /kit/pantallas). Aquí quedan la guarda
// de salud y las hojas: consentimiento, privacidad del dictado y denuncia.
import { CoachVista } from './CoachVista';
import { HojaPrivacidadDictado } from './HojaPrivacidadDictado';
import { useCoach } from './useCoach';
import { HealthConsentGuard } from '@/components/ConsentimientoSalud';
import { DenunciarIA } from '@/components/DenunciarIA';

export function PantallaCoach() {
  return <HealthConsentGuard routeName="coach"><CoachContent /></HealthConsentGuard>;
}

function CoachContent() {
  const { vista, hojas } = useCoach();
  return (
    <>
      <CoachVista {...vista} />
      {hojas.consentimiento}
      <HojaPrivacidadDictado visible={hojas.dictado.visible} onAceptar={hojas.dictado.onAceptar} onClose={hojas.dictado.onClose} />
      <DenunciarIA respuesta={hojas.denuncia.respuesta} onClose={hojas.denuncia.onClose} />
    </>
  );
}
