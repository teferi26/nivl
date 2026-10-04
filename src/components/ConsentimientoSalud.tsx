import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useAuth } from '@/lib/auth';
import { acceptHealthConsent, fetchHealthConsent, withdrawAndEraseHealth, HEALTH_COPY as T, HEALTH_ROUTES, type HealthConsent } from '@/lib/health';
import { clearEvidenceSignatures } from '@/lib/data';
import { cancelarAvisosSalud } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { mensajeSistema } from '@/lib/validation';
import { AvisoSaludVista, SaludAjustesVista } from './puertas/SaludPerfilVista';
import { HojaSaludVista, PuertaSaludVista } from './puertas/SaludVista';
import { confirmar } from './ui/confirmar';

// La vibración de la casilla se carga al tocarla: así la puerta no arrastra el
// módulo nativo de vibraciones a sus tests ni a su primer pintado.
const vibrarSeleccion = () => {
  import('@/design/haptics').then((m) => m.vibrar('seleccion')).catch(() => {});
};
// Igual para el borrado confirmado (tabla de vibraciones de FASE3).
const vibrarDestructiva = () => {
  import('@/design/haptics').then((m) => m.vibrar('destructiva')).catch(() => {});
};

interface State extends HealthConsent { loading: boolean; error: string | null; epoch: number; }
interface Context extends State { refresh: () => Promise<void>; ask: () => void; }
const EMPTY: State = { accepted: false, revision: 0, erasurePending: false, loading: true, error: null, epoch: 0 };
const HealthContext = createContext<Context | null>(null);

export function HealthConsentProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const [record, setRecord] = useState<{ uid: string | null; value: State }>({ uid: null, value: EMPTY });
  const [open, setOpen] = useState(false);
  const serial = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++serial.current;
    if (!uid) { setRecord({ uid, value: EMPTY }); return; }
    try {
      const value = await fetchHealthConsent();
      if (request !== serial.current) return;
      if (!value.accepted) {
        clearEvidenceSignatures();
        void cancelarAvisosSalud();
        void Promise.allSettled([Image.clearMemoryCache(), Image.clearDiskCache()]);
      }
      setRecord(previous => ({ uid, value: { ...value, loading: false, error: null,
        epoch: previous.value.epoch + (previous.uid !== uid || previous.value.accepted !== value.accepted || previous.value.revision !== value.revision ? 1 : 0) } }));
    } catch (e) {
      if (request !== serial.current) return;
      clearEvidenceSignatures();
      void cancelarAvisosSalud();
      setRecord(previous => ({ uid, value: { ...EMPTY, loading: false, error: mensajeSistema(e), epoch: previous.value.epoch + 1 } }));
    }
  }, [uid]);
  useEffect(() => {
    setOpen(false);
    void refresh();
    const counter = serial;
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    const channel = uid ? supabase.channel(`health:${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'health_state', filter: `user_id=eq.${uid}` }, () => { void refresh(); })
      .subscribe() : null;
    return () => { counter.current++; listener.remove(); if (channel) void supabase.removeChannel(channel); };
  }, [uid, refresh]);
  const own = record.uid === uid ? record.value : EMPTY;
  return <HealthContext.Provider value={{ ...own, refresh, ask: () => setOpen(true) }}>
    {children}
    <HealthConsentSheet key={uid ?? 'signed-out'} visible={open} close={() => setOpen(false)} accepted={async () => { await refresh(); setOpen(false); }} />
  </HealthContext.Provider>;
}

export function useHealthConsent() {
  const value = useContext(HealthContext);
  if (!value) throw new Error('Falta HealthConsentProvider');
  return value;
}

export function HealthConsentGuard({ children, routeName }: PropsWithChildren<{ routeName: string }>) {
  const health = useHealthConsent();
  if (!HEALTH_ROUTES.has(routeName) || health.accepted) return <View key={routeName === 'onboarding' ? 'setup' : health.epoch} style={styles.flex}>{children}</View>;
  return <PuertaSaludVista
    cargando={health.loading}
    error={health.error}
    borradoPendiente={health.erasurePending}
    onVolver={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
    onRevisar={health.ask}
    onReintentar={() => void health.refresh()}
    onPerfil={() => router.push('/(tabs)/perfil')}
  />;
}

export function HealthConsentNotice() {
  const health = useHealthConsent();
  if (health.accepted) return null;
  return <AvisoSaludVista
    cargando={health.loading}
    error={health.error}
    borradoPendiente={health.erasurePending}
    onReintentar={() => void health.refresh()}
    onRevisar={health.ask}
  />;
}

export function HealthConsentSheet({ visible, close, accepted }: { visible: boolean; close: () => void; accepted: () => Promise<void> }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (!visible) { setChecked(false); setError(null); } }, [visible]);
  const accept = async () => {
    if (!checked || lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await acceptHealthConsent(); if (alive.current) await accepted(); }
    catch (e) { if (alive.current) setError(mensajeSistema(e)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const cancel = () => { if (!lock.current) close(); };
  return <HojaSaludVista
    visible={visible}
    marcada={checked}
    ocupada={busy}
    error={error}
    onMarcar={() => { vibrarSeleccion(); setChecked(value => !value); }}
    onAceptar={() => void accept()}
    onCancelar={cancel}
    onErrorEnlace={setError}
  />;
}

export function HealthPrivacySection() {
  const health = useHealthConsent();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const erase = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await withdrawAndEraseHealth(); }
    catch (e) { if (alive.current) setError(mensajeSistema(e)); }
    finally { await health.refresh(); lock.current = false; if (alive.current) setBusy(false); }
  };
  return <SaludAjustesVista
    cargando={health.loading}
    errorComprobar={health.error}
    error={error}
    borradoPendiente={health.erasurePending}
    aceptado={health.accepted}
    ocupada={busy}
    onReintentar={() => void health.refresh()}
    onRevisar={health.ask}
    onRetirar={async () => {
      // Solo con un "Retirar y borrar" explícito. `confirmar` también pinta en
      // la web; el estado lo decide después `health.refresh()`, no la UI.
      if (await confirmar({ titulo: 'Retirar permiso y borrar', mensaje: T.erase, confirmar: 'Retirar y borrar', destructivo: true })) {
        vibrarDestructiva();
        await erase();
      }
    }}
  />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
