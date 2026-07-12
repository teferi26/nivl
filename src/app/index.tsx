import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { ensureProfile } from '@/lib/data';
import { colors } from '@/lib/theme';

export default function Index() {
  const { session, loading } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    if (!session) {
      setOnboarded(null);
      return;
    }
    ensureProfile(session.user.id)
      .then((p) => {
        if (alive) setOnboarded(p.onboarding_done);
      })
      .catch(() => {
        // Si la lectura falla, no bloqueamos la entrada: mejor dentro que colgado.
        if (alive) setOnboarded(true);
      });
    return () => {
      alive = false;
    };
  }, [session]);

  if (loading || (session && onboarded === null)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;
  return <Redirect href={onboarded ? '/(tabs)' : '/onboarding'} />;
}
