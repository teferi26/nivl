import { setApiKey } from './oracle';
import { supabase } from './supabase';
import { ErrorVisible } from './validation';

// Perfil already asks for irreversible confirmation. The endpoint only deletes
// NIVL, keeps Auth until the Storage API has removed every file, and can resume.
export async function deleteAccount(): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('account-erasure', {
      body: { confirm: 'BORRAR_CUENTA_NIVL' },
    });
    if (error || data?.ok !== true) throw new Error('incomplete');
  } catch {
    // Never discard the session while files or the account still need erasing.
    throw new ErrorVisible('El borrado no ha terminado. Reintenta desde Eliminar cuenta para completarlo.');
  }
  // Auth has already been deleted. A failed legacy-key cleanup must not keep
  // the app signed in to an account that no longer exists.
  await setApiKey('').catch(() => undefined);
  await supabase.auth.signOut({ scope: 'local' });
}
