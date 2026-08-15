// NIVL · Registro del dispositivo para que el coach pueda alcanzarte.
//
// Sin esto el coach solo existe cuando abres la app. Con esto puede empujarte
// el brief a las 5:30 aunque el móvil esté en el bolsillo.

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Obtiene el token de Expo y lo guarda. Silencioso a propósito: si el usuario
 * no ha dado permiso o estamos en un emulador, no hay nada que registrar y
 * tampoco hay nada que reprocharle.
 */
export async function registrarDispositivo(): Promise<string | null> {
  try {
    // En emulador no hay token real: pedirlo lanza y ensucia los registros.
    if (!Device.isDevice) return null;

    const permiso = await Notifications.getPermissionsAsync();
    if (!permiso.granted) return null;

    // El projectId es obligatorio desde SDK 49 para resolver el token.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return null;

    const { data: sesion } = await supabase.auth.getSession();
    const userId = sesion.session?.user.id;
    if (!userId) return null;

    await supabase.from('push_tokens').upsert(
      {
        token,
        user_id: userId,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );
    return token;
  } catch {
    // Un fallo aquí no debe romper el arranque de la app.
    return null;
  }
}

export async function olvidarDispositivo(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (token) await supabase.from('push_tokens').delete().eq('token', token);
  } catch {
    /* nada que borrar */
  }
}
