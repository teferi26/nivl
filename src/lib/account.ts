import { setApiKey } from './oracle';
import { supabase } from './supabase';

// Borrado total de la cuenta (derecho de supresión RGPD). La RPC delete_own_account
// (migración 0004) borra los objetos de Storage del usuario y su fila en auth.users,
// que en cascada elimina profiles y todo lo demás. Después limpiamos el dispositivo.
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
  await setApiKey('');
  await supabase.auth.signOut();
}
