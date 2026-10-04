import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ArranqueCargando, ArranqueError } from '@/components/acceso/Arranque';
import { useAuth } from '@/lib/auth';
import { cerrarSesion } from '@/lib/authFlow';
import { reintentarCodigoPendiente } from '@/lib/creators';
import { ensureProfile } from '@/lib/data';
import { mensajeSistema } from '@/lib/validation';

export default function Index() {
  const { session, loading } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cada "Reintentar" sube el contador y vuelve a lanzar la lectura.
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!session) {
      setOnboarded(null);
      setError(null);
      return;
    }
    setError(null);
    ensureProfile(session.user.id)
      .then((p) => {
        if (alive) setOnboarded(p.onboarding_done);
        // Un código de creador pendiente (del enlace, o de un onboarding sin
        // red) se reintenta aquí, en silencio. Antes del onboarding no: allí
        // se precarga en "¿Quién te trajo?" y lo manda el propio paso.
        if (p.onboarding_done) reintentarCodigoPendiente();
      })
      .catch((e) => {
        // Sin leer onboarding_done no se decide nada: entrar a ciegas en las
        // pestañas saltaba el onboarding a quien aún no lo había hecho.
        if (alive) setError(mensajeSistema(e));
      });
    return () => {
      alive = false;
    };
  }, [session, intento]);

  if (session && onboarded === null && error) {
    return (
      <ArranqueError
        mensaje={error}
        onReintentar={() => setIntento((n) => n + 1)}
        onCerrarSesion={() => {
          cerrarSesion().catch(() => {});
        }}
      />
    );
  }

  if (loading || (session && onboarded === null)) {
    return <ArranqueCargando />;
  }

  if (!session) return <Redirect href="/login" />;
  return <Redirect href={onboarded ? '/(tabs)' : '/onboarding'} />;
}
