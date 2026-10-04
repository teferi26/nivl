// Se aplica a cada pantalla del Stack sin desmontar el navegador. Las pantallas
// protegidas ni se montan hasta comprobar la confirmación guardada en el servidor.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SystemButton } from '@/components/SystemButton';
import { Card, Check, Screen, ScreenHeader, Skeleton } from '@/components/ui';
import { confirmarEdad, fetchEdadConfirmada } from '@/lib/age';
import { useAuth } from '@/lib/auth';
import { cerrarSesion } from '@/lib/authFlow';
import { EDAD_MINIMA } from '@/lib/consentmath';
import { colors, fonts } from '@/lib/theme';
import { mensajeSistema } from '@/lib/validation';

type Estado = 'cargando' | 'pendiente' | 'guardando' | 'confirmada' | 'error';
interface Lectura {
  userId: string | null;
  estado: Estado;
  aviso: string | null;
}
interface EdadContexto extends Lectura {
  consultar: () => Promise<void>;
  confirmar: () => Promise<void>;
}
const EdadContext = createContext<EdadContexto | null>(null);

export function EdadMinimaProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [lectura, setLectura] = useState<Lectura>({ userId: null, estado: 'cargando', aviso: null });
  const intento = useRef(0);
  const guardando = useRef(false);

  const consultar = useCallback(async () => {
    const actual = ++intento.current;
    guardando.current = false;
    setLectura({ userId, estado: 'cargando', aviso: null });
    if (!userId) return;
    try {
      const confirmada = await fetchEdadConfirmada();
      if (actual !== intento.current) return;
      setLectura({ userId, estado: confirmada ? 'confirmada' : 'pendiente', aviso: null });
    } catch (e) {
      if (actual !== intento.current) return;
      setLectura({ userId, estado: 'error', aviso: mensajeSistema(e) });
    }
  }, [userId]);

  useEffect(() => {
    // `intento` es un contador, no un nodo: invalidar al salir es justo lo que
    // se quiere (una lectura en vuelo de la sesión anterior ya no escribe).
    const contador = intento;
    void consultar();
    return () => {
      contador.current++;
    };
  }, [consultar]);

  const confirmar = async () => {
    if (!userId || lectura.userId !== userId || lectura.estado !== 'pendiente' || guardando.current) return;
    guardando.current = true;
    const actual = ++intento.current;
    setLectura({ userId, estado: 'guardando', aviso: null });
    try {
      await confirmarEdad();
      if (actual === intento.current) setLectura({ userId, estado: 'confirmada', aviso: null });
    } catch (e) {
      if (actual === intento.current) setLectura({ userId, estado: 'pendiente', aviso: mensajeSistema(e) });
    } finally {
      if (actual === intento.current) guardando.current = false;
    }
  };

  // Una respuesta de otra sesión nunca abre la cuenta que acaba de entrar.
  const propia: Lectura = lectura.userId === userId
    ? lectura
    : { userId, estado: 'cargando', aviso: null };
  return <EdadContext.Provider value={{ ...propia, consultar, confirmar }}>{children}</EdadContext.Provider>;
}

export function useEdadMinima() {
  const contexto = useContext(EdadContext);
  if (!contexto) throw new Error('Falta EdadMinimaProvider');
  return contexto;
}

export function EdadMinimaGuard({ children, routeName }: PropsWithChildren<{ routeName: string }>) {
  const { session, loading } = useAuth();
  const edad = useEdadMinima();
  // Estas rutas son públicas también con sesión: el enlace de creador debe
  // poder guardar el código antes de enviar a la persona a la raíz.
  if (routeName === 'login' || routeName === 'c' || routeName.startsWith('c/') || routeName.startsWith('auth/') || (__DEV__ && (routeName === 'kit' || routeName.startsWith('kit/')))) return <>{children}</>;
  if (!loading && session && edad.estado === 'confirmada') return <>{children}</>;
  return <ConfirmacionEdad key={session?.user.id ?? 'sin-sesion'} autenticado={!loading && !!session} />;
}

function ConfirmacionEdad({ autenticado }: { autenticado: boolean }) {
  const { estado, aviso, consultar, confirmar } = useEdadMinima();
  const [marcada, setMarcada] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [avisoSalida, setAvisoSalida] = useState<string | null>(null);
  const pendiente = estado === 'pendiente' || estado === 'guardando';
  const salir = async () => {
    if (saliendo) return;
    setSaliendo(true);
    setAvisoSalida(null);
    try {
      // La misma salida que Perfil: olvida el dispositivo (push, avisos, claves
      // locales) antes del signOut, para no dejar restos (auditoría 1.0.8).
      await cerrarSesion();
    } catch (e) {
      setAvisoSalida(mensajeSistema(e));
    } finally {
      setSaliendo(false);
    }
  };

  return (
    <Screen contentStyle={styles.screen}>
      <ScreenHeader eyebrow="Antes de entrar" title="Tu edad" subtitle={`NIVL es para personas de ${EDAD_MINIMA} años o más.`} />
      {!autenticado || estado === 'cargando' ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Comprobando la confirmación de edad">
          <Skeleton height={96} />
        </View>
      ) : pendiente ? (
        <Card variant="outline">
          <Text style={styles.body}>Confirma que cumples la edad mínima para continuar. No hace falta indicar tu fecha de nacimiento.</Text>
          <Pressable
            style={styles.check}
            accessibilityRole="checkbox"
            accessibilityLabel={`Tengo ${EDAD_MINIMA} años o más`}
            accessibilityState={{ checked: marcada, disabled: estado === 'guardando' || saliendo }}
            disabled={estado === 'guardando' || saliendo}
            onPress={() => setMarcada((v) => !v)}
          >
            <Check checked={marcada} size={24} />
            <Text style={styles.label}>Tengo {EDAD_MINIMA} años o más.</Text>
          </Pressable>
          <SystemButton
            title="Confirmar y continuar"
            onPress={() => { if (marcada) void confirmar(); }}
            disabled={!marcada || saliendo}
            loading={estado === 'guardando'}
          />
        </Card>
      ) : (
        <SystemButton title="Volver a comprobar" onPress={() => void consultar()} disabled={saliendo} />
      )}
      {autenticado && aviso ? <Text style={styles.error} accessibilityRole="alert">{aviso}</Text> : null}
      {avisoSalida ? <Text style={styles.error} accessibilityRole="alert">{avisoSalida}</Text> : null}
      {autenticado ? (
        <SystemButton title="Cerrar sesión" variant="ghost" onPress={() => void salir()} loading={saliendo} style={styles.exit} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 32 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textDim },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, marginVertical: 14 },
  label: { flex: 1, minWidth: 0, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  error: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.red, marginTop: 14 },
  exit: { marginTop: 14 },
});
