// NIVL · El coach: la pantalla entera, la de la pestaña de NIVL y la de cada
// mundo (IRON, FOCUS, WORK, FOUNDER). Es el mismo chat; el modo viaja como
// contexto en `x-nivl-modo` (ModoProvider → modos/coach.ts → lib/coach.ts) y
// dentro de un mundo el modo activo es siempre el suyo (LayoutMundo).
// Los datos y los efectos viven en useCoach; lo que se
// ve, en CoachVista (pura, también en /kit/pantallas). Aquí quedan la guarda
// de salud y las hojas: consentimiento, privacidad del dictado y denuncia.
//
// Con dos paneles (iPad, Mac, Vision Pro, iPhone Duo abierto) va a mitades:
// el chat a la izquierda y el plan del día a la derecha (PlanCoach), que se
// relee al terminar cada turno. En el iPhone, solo el chat, como siempre.
import { CoachVista } from './CoachVista';
import { PlanCoach } from './PlanCoach';
import { MaestroDetalle, useMaestroDetalle } from '@/components/ui/MaestroDetalle';
import { HojaPrivacidadDictado } from './HojaPrivacidadDictado';
import { useCoach } from './useCoach';
import { HealthConsentGuard } from '@/components/ConsentimientoSalud';
import { DenunciarIA } from '@/components/DenunciarIA';

export function PantallaCoach() {
  return <HealthConsentGuard routeName="coach"><CoachContent /></HealthConsentGuard>;
}

function CoachContent() {
  const { vista, hojas } = useCoach();
  const reparto = useMaestroDetalle('mitad');
  // Sin coach (bloqueado) no hay plan que mirar: la oferta va a todo el ancho.
  const conPlan = reparto != null && !vista.sinPro;
  return (
    <>
      <MaestroDetalle
        reparto={conPlan ? reparto : null}
        lista={<CoachVista {...vista} />}
        detalle={<PlanCoach ocupado={vista.enCurso != null} />}
      />
      {hojas.consentimiento}
      <HojaPrivacidadDictado visible={hojas.dictado.visible} onAceptar={hojas.dictado.onAceptar} onClose={hojas.dictado.onClose} />
      <DenunciarIA respuesta={hojas.denuncia.respuesta} onClose={hojas.denuncia.onClose} />
    </>
  );
}
