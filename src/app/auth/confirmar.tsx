// NIVL · nivl://auth/confirmar: el enlace del correo de alta.
//
// Ruta PÚBLICA (fuera de la puerta de sesión de _layout): llega sin sesión y
// es justo esto lo que la abre. Si el enlace resulta ser de recuperación, se
// pasa a restablecer; si todo va bien, a '/', que decide onboarding o Hoy.
// Lo que se ve está en ConfirmarVista (src/components/acceso/EnlaceCuenta).

import { router } from 'expo-router';
import { useEffect } from 'react';
import { ConfirmarVista } from '@/components/acceso/EnlaceCuenta';
import { useEnlaceCorreo } from '@/components/useEnlaceCorreo';

export default function Confirmar() {
  const estado = useEnlaceCorreo();

  useEffect(() => {
    if (estado.fase !== 'listo') return;
    router.replace(estado.destino === 'recuperacion' ? '/auth/restablecer' : '/');
  }, [estado]);

  const error = estado.fase === 'error' ? estado.mensaje : estado.fase === 'sin_enlace' ? 'Este enlace no trae nada que confirmar. Abre el último correo que te enviamos o entra con tu contraseña.' : null;

  return <ConfirmarVista error={error} onIrAEntrar={() => router.replace('/login')} />;
}
