import { Orbitron_700Bold, Orbitron_800ExtraBold } from '@expo-google-fonts/orbitron';
import { Rajdhani_500Medium, Rajdhani_600SemiBold, Rajdhani_700Bold } from '@expo-google-fonts/rajdhani';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider, useAuth } from '@/lib/auth';
import { registrarDispositivo } from '@/lib/push';
import { colors } from '@/lib/theme';
import { useNotificationRouting } from '@/lib/useNotificationRouting';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Puerta de sesión única para TODA la app: cubre deep links a pantallas
// protegidas sin sesión y la expiración/cierre de sesión en caliente, no solo
// el arranque en '/'. Antes cada pantalla dependía de su propio userId.
function ProtectedStack() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Solo con sesión: un deep link desde una notificación no debe saltarse la
  // puerta de autenticación.
  useNotificationRouting(!loading && !!session);

  // Con sesión iniciada, se registra el dispositivo para que el coach pueda
  // alcanzarte sin que abras la app. Silencioso: en emulador o sin permiso
  // simplemente no hay token que guardar.
  useEffect(() => {
    if (!loading && session) registrarDispositivo();
  }, [loading, session]);

  useEffect(() => {
    if (loading) return;
    const inAuthArea = segments[0] === 'login';
    if (!session && !inAuthArea) {
      router.replace('/login');
    } else if (session && inAuthArea) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Orbitron_700Bold,
    Orbitron_800ExtraBold,
    Rajdhani_500Medium,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
  });

  useEffect(() => {
    // También con error: si una fuente falla, ocultar el splash igualmente para
    // no quedar en pantalla negra permanente.
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <StatusBar style="light" />
        <ProtectedStack />
      </AuthProvider>
    </ErrorBoundary>
  );
}
