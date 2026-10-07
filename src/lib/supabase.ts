import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !key) {
  throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY en .env');
}

// En el render web de Node (SSR de expo-router) no hay window ni AsyncStorage:
// sin esta guarda, abrir la versión web mata Metro entero.
const isServer = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient(url, key, {
  auth: {
    ...(isServer ? {} : { storage: AsyncStorage }),
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    // RN no tiene barra de direcciones: los enlaces de confirmar y recuperar
    // los canjea authFlow.completarEnlace a mano. PKCE: el enlace del correo
    // trae un `code` de un solo uso que solo vale con el verificador guardado
    // en ESTE dispositivo (AsyncStorage); un enlace interceptado no abre sesión.
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

if (!isServer) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
