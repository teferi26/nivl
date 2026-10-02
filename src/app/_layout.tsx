import { Cinzel_600SemiBold, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { EdadMinimaGuard, EdadMinimaProvider, useEdadMinima } from '@/components/EdadMinima';
import { HealthConsentGuard, HealthConsentProvider } from '@/components/ConsentimientoSalud';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider, useAuth } from '@/lib/auth';
import { identificarEnTienda } from '@/lib/pro';
import { registrarDispositivo } from '@/lib/push';
import { colors } from '@/lib/theme';
import { useNotificationRouting } from '@/lib/useNotificationRouting';

SplashScreen.preventAutoHideAsync().catch(() => {});

// En la web la app es una columna de móvil centrada: a 1440 px las filas, los
// chips y la barra de pestañas se estiraban de lado a lado. Solo en web; en
// nativo no se añade ninguna vista. Los `Modal` de react-native-web son
// portales a `body` y quedan fuera de esta columna (a ancho completo).
function ColumnaWeb({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={webStyles.fuera}>
      <View style={webStyles.dentro}>{children}</View>
    </View>
  );
}

const webStyles = StyleSheet.create({
  fuera: { flex: 1, alignItems: 'center', backgroundColor: colors.bg },
  dentro: { flex: 1, width: '100%', maxWidth: 560 },
});

// Puerta de sesión única para TODA la app: cubre deep links a pantallas
// protegidas sin sesión y la expiración/cierre de sesión en caliente, no solo
// el arranque en '/'. Antes cada pantalla dependía de su propio userId.
function ProtectedStack() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { estado: estadoEdad } = useEdadMinima();
  const edadConfirmada = estadoEdad === 'confirmada';

  // Solo con sesión: un deep link desde una notificación no debe saltarse la
  // puerta de autenticación.
  useNotificationRouting(!loading && !!session && edadConfirmada);

  // Con sesión iniciada, se registra el dispositivo para que el coach pueda
  // alcanzarte sin que abras la app. Silencioso: en emulador o sin permiso
  // simplemente no hay token que guardar.
  useEffect(() => {
    if (!loading && session && edadConfirmada) registrarDispositivo();
  }, [loading, session, edadConfirmada]);

  // La tienda (RevenueCat) va a nombre del uuid de Supabase: con él escribe el
  // webhook. Se ata al entrar y se suelta al salir, sea cual sea el camino
  // (Perfil, borrar la cuenta, sesión caducada). Sin tienda en esta build, no
  // hace nada.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!loading) identificarEnTienda(userId);
  }, [loading, userId]);

  useEffect(() => {
    if (loading) return;
    const inAuthArea = segments[0] === 'login';
    // `c` (nivl://c/CODIGO) también es pública: guarda el código de creador y
    // salta sola a '/'. Sin esto el guard iba a /login antes de guardarlo.
    const inPublicArea = inAuthArea || segments[0] === 'c';
    if (!session && !inPublicArea) {
      router.replace('/login');
    } else if (session && inAuthArea) {
      // A la raíz, no a las pestañas: `index.tsx` es quien mira
      // `onboarding_done` y decide entre el onboarding y Hoy. Ir directo a
      // '/(tabs)' dejaba a toda cuenta nueva sin onboarding ni firma. No hay
      // bucle: en '/' ya no se está en el área de acceso, así que esta rama no
      // vuelve a dispararse.
      router.replace('/');
    }
  }, [session, loading, segments, router]);

  return (
    <ColumnaWeb>
      <Stack
        screenLayout={({ children, route }) => <EdadMinimaGuard routeName={route.name}><HealthConsentGuard routeName={route.name}>{children}</HealthConsentGuard></EdadMinimaGuard>}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </ColumnaWeb>
  );
}

export default function RootLayout() {
  // Cinzel para la piedra (marca y cifras), Outfit para todo lo que habla:
  // la misma familia que Franky en web y app.
  const [loaded, error] = useFonts({
    Cinzel_600SemiBold,
    Cinzel_700Bold,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  // El HTML de `web.output: single` sale sin idioma: lectores de pantalla y
  // traductores lo leían como inglés.
  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = 'es';
  }, []);

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
        <EdadMinimaProvider>
          <HealthConsentProvider><ProtectedStack /></HealthConsentProvider>
        </EdadMinimaProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
