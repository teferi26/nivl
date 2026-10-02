// La pestaña del coach. Los datos y los efectos viven en useCoach; lo que se
// ve, en CoachVista (pura, también en /kit/pantallas). Aquí quedan la guarda
// de salud y las hojas: consentimiento, privacidad del dictado y denuncia.
import { CoachVista } from '@/components/coach/CoachVista';
import { HojaPrivacidadDictado } from '@/components/coach/HojaPrivacidadDictado';
import { useCoach } from '@/components/coach/useCoach';
import { HealthConsentGuard } from '@/components/ConsentimientoSalud';
import { DenunciarIA } from '@/components/DenunciarIA';

export default function CoachScreen() {
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
