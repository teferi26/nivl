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
import { CelebracionProvider } from '@/components/celebracion/CelebracionProvider';
import { TopeAncho } from '@/design/useSizeClass';
import { AuthProvider, useAuth } from '@/lib/auth';
import { identificarEnTienda } from '@/lib/pro';
import { registrarDispositivo } from '@/lib/push';
import { destinoPortal, SITIO_CREADORES } from '@/lib/sitio';
import { colors } from '@/lib/theme';
import { useNotificationRouting } from '@/lib/useNotificationRouting';

SplashScreen.preventAutoHideAsync().catch(() => {});

// En la web la app es una columna de móvil centrada: a 1440 px las filas, los
// chips y la barra de pestañas se estiraban de lado a lado. Solo en web; en
// nativo no se añade ninguna vista. Los `Modal` de react-native-web son
// portales a `body` y quedan fuera de esta columna (a ancho completo).
// Las pestañas no se acotan: allí el raíl, la barra lateral y `Screen` ya
// colocan el contenido según la clase de tamaño. El tope llega a
// `useSizeClass` por `TopeAncho` para que lo de dentro se mida a 560. El árbol
// es siempre el mismo (solo cambian el estilo y el valor): si cambiara al
// entrar o salir de las pestañas, el Stack se volvería a montar y se perdería
// el historial.
//
// La galería del kit (/kit, solo en desarrollo) tampoco se acota: tiene que
// poder verse a 744, 1024 y 1440 para verificar el sistema.
function ColumnaWeb({ children }: { children: ReactNode }) {
  const seg = useSegments();
  const anchoLibre = seg[0] === '(tabs)' || (__DEV__ && seg[0] === 'kit');
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={webStyles.fuera}>
      <View style={[webStyles.dentro, anchoLibre && webStyles.ancho]}>
        <TopeAncho.Provider value={anchoLibre ? null : ANCHO_COLUMNA_WEB}>{children}</TopeAncho.Provider>
      </View>
    </View>
  );
}

const ANCHO_COLUMNA_WEB = 560;

const webStyles = StyleSheet.create({
  fuera: { flex: 1, alignItems: 'center', backgroundColor: colors.bg },
  dentro: { flex: 1, width: '100%', maxWidth: ANCHO_COLUMNA_WEB },
  ancho: { maxWidth: '100%' },
  vacio: { flex: 1, backgroundColor: colors.bg },
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
    // `auth` (nivl://auth/confirmar y /restablecer) llega sin sesión: es el
    // enlace del correo el que la abre.
    const inPublicArea = inAuthArea || segments[0] === 'c' || segments[0] === 'auth' || (__DEV__ && segments[0] === 'kit');
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

// Portal de creadores (EXPO_PUBLIC_SITIO=creadores, `src/lib/sitio.ts`): solo
// el login y /creador. Sin sesión todo va al login; con sesión, a /creador. Es
// un árbol aparte a propósito: aquí no se monta nada de la app (avisos,
// dispositivo, tienda, consentimiento de salud con su realtime, celebraciones,
// confirmación de edad) y ninguna otra pantalla llega a montarse: el
// `screenLayout` las deja en blanco mientras la puerta redirige.
function PortalStack() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const destino = destinoPortal(segments[0], !!session);
    if (destino) router.replace(destino);
  }, [session, loading, segments, router]);

  return (
    <ColumnaWeb>
      <Stack
        // Se pinta solo la pantalla en la que la puerta deja quedarse: ni
        // /creador sin sesión (llamaría a las RPC sin token) ni el resto de
        // la app con ella.
        screenLayout={({ children, route }) =>
          !loading && destinoPortal(route.name, !!session) === null ? children : <View style={webStyles.vacio} />
        }
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

  // El portal no se indexa. Con `web.output: single` no hay +html.tsx que
  // valga: la meta se pone al arrancar. La garantía es la cabecera
  // X-Robots-Tag del despliegue (R4); esto es para quien ejecute el JS.
  useEffect(() => {
    if (!SITIO_CREADORES || typeof document === 'undefined') return;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    document.title = 'NIVL · Creadores';
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
        {SITIO_CREADORES ? (
          <PortalStack />
        ) : (
          // Por fuera de ColumnaWeb: en web la ceremonia y el toast cubren toda la ventana.
          <CelebracionProvider>
            <EdadMinimaProvider>
              <HealthConsentProvider><ProtectedStack /></HealthConsentProvider>
            </EdadMinimaProvider>
          </CelebracionProvider>
        )}
      </AuthProvider>
    </ErrorBoundary>
  );
}
