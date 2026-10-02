import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SystemButton } from '@/components/SystemButton';
import { useAuth } from '@/lib/auth';
import { reintentarCodigoPendiente } from '@/lib/creators';
import { ensureProfile } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
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
      <View
        style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}
      >
        <Text style={{ fontFamily: fonts.heading, fontSize: 22, color: colors.text, textAlign: 'center' }}>
          El sistema no responde
        </Text>
        <Text
          accessibilityRole="alert"
          style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.textDim, textAlign: 'center', marginTop: 10 }}
        >
          {error}
        </Text>
        <SystemButton
          title="Reintentar"
          variant="outline"
          onPress={() => setIntento((n) => n + 1)}
          style={{ marginTop: 20, alignSelf: 'stretch' }}
        />
        {/* Salida si la cuenta no carga nunca: sin esto no había forma de cambiar de cuenta. */}
        <SystemButton
          title="Cerrar sesión"
          variant="ghost"
          onPress={() => {
            supabase.auth.signOut().catch(() => {});
          }}
          style={{ marginTop: 6, alignSelf: 'stretch' }}
        />
      </View>
    );
  }

  if (loading || (session && onboarded === null)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Cargando" />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;
  return <Redirect href={onboarded ? '/(tabs)' : '/onboarding'} />;
}
