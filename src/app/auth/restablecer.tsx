// NIVL · nivl://auth/restablecer: el enlace del correo de «olvidé mi
// contraseña».
//
// Ruta PÚBLICA: el enlace abre una sesión de recuperación (authFlow) y aquí se
// elige la contraseña nueva. El formulario sale SOLO si en esta ejecución de
// la app el enlace se ha canjeado como recuperación (estado en memoria de
// useEnlaceCorreo; si se llegó desde /auth/confirmar, reutiliza ese canje).
// Una sesión normal no basta (Chat 3): con el móvil desbloqueado unos segundos
// cualquiera podría cambiar la contraseña y quedarse la cuenta.
//
// Lo que se ve está en RestablecerVista (src/components/acceso/EnlaceCuenta).

import { router } from 'expo-router';
import { useState } from 'react';
import { RestablecerVista, type FaseRestablecer } from '@/components/acceso/EnlaceCuenta';
import { useEnlaceCorreo } from '@/components/useEnlaceCorreo';
import { vibrar } from '@/design/haptics';
import { useAuth } from '@/lib/auth';
import { cambiarContrasena } from '@/lib/authFlow';
import { checkPassword, mensajeSistema } from '@/lib/validation';

export default function Restablecer() {
  const estado = useEnlaceCorreo();
  const { session } = useAuth();
  const [nueva, setNueva] = useState('');
  const [repite, setRepite] = useState('');
  const [ver, setVer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);

  const correo = session?.user.email ?? undefined;
  const pw = checkPassword(nueva, correo);
  const coinciden = nueva === repite;
  const puede = pw.ok && coinciden && !busy;

  const listo = estado.fase === 'listo' && estado.destino === 'recuperacion';
  const fallo =
    estado.fase === 'error'
      ? estado.mensaje
      : estado.fase === 'sin_enlace' || (estado.fase === 'listo' && estado.destino !== 'recuperacion')
        ? 'Este enlace no es válido o ha caducado. Pide uno nuevo desde «¿Olvidaste tu contraseña?».'
        : null;

  const guardar = async () => {
    if (!puede) return;
    setBusy(true);
    setError(null);
    try {
      await cambiarContrasena(nueva);
      setHecho(true);
    } catch (e) {
      vibrar('penalizacion');
      setError(mensajeSistema(e));
    } finally {
      setBusy(false);
    }
  };

  // El mismo orden que antes: hecho gana a todo, luego el fallo, luego la espera.
  const fase: FaseRestablecer = hecho ? 'hecho' : fallo ? 'invalido' : !listo ? 'comprobando' : 'formulario';

  return (
    <RestablecerVista
      fase={fase}
      fallo={fallo}
      correo={correo}
      nueva={nueva}
      repite={repite}
      ver={ver}
      error={error}
      enviando={busy}
      onNueva={setNueva}
      onRepite={setRepite}
      onVer={() => setVer((v) => !v)}
      onGuardar={guardar}
      onContinuar={() => router.replace('/')}
      onIrAEntrar={() => router.replace('/login')}
    />
  );
}
