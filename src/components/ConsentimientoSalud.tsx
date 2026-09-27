import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Alert, AppState, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useAuth } from '@/lib/auth';
import { acceptHealthConsent, fetchHealthConsent, withdrawAndEraseHealth, HEALTH_COPY as T, HEALTH_ROUTES, type HealthConsent } from '@/lib/health';
import { clearEvidenceSignatures } from '@/lib/data';
import { cancelarAvisosSalud } from '@/lib/notifications';
import { LEGAL_URLS } from '@/lib/proplans';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { mensajeSistema } from '@/lib/validation';
import { SystemButton } from './SystemButton';
import { Card, Check, Screen, ScreenHeader, Section, Skeleton } from './ui';

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
  return <Screen>
    <ScreenHeader eyebrow="Opcional" title="Tu salud, con permiso" onBack={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} />
    {health.loading ? <View accessibilityRole="progressbar" accessibilityLabel="Comprobando permiso de salud"><Skeleton height={110} /></View> : <>
      <Card><Text style={styles.body}>{health.erasurePending ? 'Tu permiso está retirado y hay un borrado pendiente. Puedes terminarlo en Perfil.' : 'Antes de abrir este registro, revisa qué datos de salud guarda NIVL y decide si quieres activarlo.'}</Text></Card>
      {health.error ? <Text style={styles.error} accessibilityRole="alert">{health.error}</Text> : null}
      <SystemButton title={health.error ? 'Volver a comprobar' : 'Revisar permiso'} onPress={health.error ? () => void health.refresh() : health.ask} disabled={health.erasurePending} />
      <SystemButton title="Ir a Perfil" variant="ghost" onPress={() => router.push('/(tabs)/perfil')} />
    </>}
  </Screen>;
}

export function HealthConsentNotice() {
  const health = useHealthConsent();
  if (health.accepted) return null;
  if (health.loading) return <View accessibilityRole="progressbar" accessibilityLabel="Comprobando permiso de salud"><Skeleton height={90} /></View>;
  if (health.error) return <Card><Text style={styles.body}>No se ha podido comprobar el permiso de salud. Tus metas generales siguen disponibles.</Text>
    <SystemButton title="Volver a comprobar" variant="outline" onPress={() => void health.refresh()} /></Card>;
  return <Card><Text style={styles.body}>Los registros de salud están desactivados. Las metas generales siguen disponibles.</Text>
    <SystemButton title="Revisar permiso de salud" variant="outline" onPress={health.ask} disabled={health.erasurePending} />
  </Card>;
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
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={cancel}>
    <View style={styles.backdrop}><View style={styles.sheet}>
      <ScrollView contentContainerStyle={styles.copy}>
        <Text style={styles.title}>{T.title}</Text>
        {[T.purpose, T.storage, T.choice, T.withdrawal].map(text => <Text key={text} style={styles.body}>{text}</Text>)}
        <Pressable accessibilityRole="link" accessibilityLabel="Leer la política de privacidad" onPress={() => Linking.openURL(LEGAL_URLS.privacidad).catch(() => setError('No se ha podido abrir la política.'))}>
          <Text style={styles.link}>Leer la política de privacidad</Text>
        </Pressable>
        <Pressable style={styles.check} accessibilityRole="checkbox" accessibilityLabel={T.checkbox} accessibilityState={{ checked, disabled: busy }} disabled={busy} onPress={() => setChecked(value => !value)}>
          <Check checked={checked} size={24} /><Text style={[styles.body, styles.flex]}>{T.checkbox}</Text>
        </Pressable>
      </ScrollView>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      <SystemButton title="Aceptar y activar salud" onPress={() => void accept()} disabled={!checked} loading={busy} />
      <SystemButton title="Ahora no" variant="ghost" onPress={cancel} disabled={busy} />
    </View></View>
  </Modal>;
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
  return <Section title="Salud y bienestar">
    <Card><Text style={styles.body}>{health.loading ? 'Comprobando el permiso…' : health.error ? 'No se ha podido comprobar el permiso de salud.' : health.erasurePending ? 'Permiso retirado. Falta terminar el borrado; reinténtalo.' : health.accepted ? 'Has permitido guardar y utilizar tus datos de salud. Puedes retirar el permiso y borrarlos.' : 'Sin permiso. NIVL no utiliza los registros de salud. Puedes exportar los datos anteriores o pedir su borrado.'}</Text>
      {health.error ? <SystemButton title="Volver a comprobar" variant="outline" onPress={() => void health.refresh()} disabled={busy} /> : !health.accepted && !health.erasurePending ? <SystemButton title="Revisar permiso de salud" variant="outline" onPress={health.ask} disabled={health.loading || busy} /> : null}
      <SystemButton title={health.erasurePending ? 'Terminar borrado' : 'Retirar y borrar salud'} variant="ghost" onPress={() => Alert.alert('Retirar permiso y borrar', T.erase, [
        { text: 'Cancelar', style: 'cancel' }, { text: 'Retirar y borrar', style: 'destructive', onPress: () => void erase() },
      ])} loading={busy} disabled={health.loading} />
      <Text style={styles.body}>La exportación y la eliminación de cuenta siguen disponibles debajo. Las direcciones temporales de fotos ya compartidas pueden seguir siendo válidas hasta que se elimine el archivo o caduquen.</Text>
      {error || health.error ? <Text style={styles.error} accessibilityRole="alert">{error ?? health.error}</Text> : null}
    </Card>
  </Section>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.bg },
  sheet: { maxHeight: '92%', padding: 20, paddingBottom: 32, backgroundColor: colors.panel, borderTopWidth: 1, borderColor: colors.line },
  copy: { paddingBottom: 16 },
  title: { fontFamily: fonts.heading, fontSize: 27, color: colors.text, marginBottom: 18 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textDim, marginBottom: 14 },
  check: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 18, minHeight: 52 },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.accentText, textDecorationLine: 'underline' },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.red, marginBottom: 12 },
});
