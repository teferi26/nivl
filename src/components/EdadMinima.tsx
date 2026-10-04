// Se aplica a cada pantalla del Stack sin desmontar el navegador. Las pantallas
// protegidas ni se montan hasta comprobar la confirmación guardada en el servidor.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { EdadVista } from '@/components/puertas/EdadVista';
import { confirmarEdad, fetchEdadConfirmada } from '@/lib/age';
import { useAuth } from '@/lib/auth';
import { EDAD_MINIMA } from '@/lib/consentmath';
import { supabase } from '@/lib/supabase';
import { mensajeSistema } from '@/lib/validation';

// La vibración de la casilla se carga al tocarla: así la puerta no arrastra el
// módulo nativo de vibraciones a sus tests ni a su primer pintado.
const vibrarSeleccion = () => {
  import('@/design/haptics').then((m) => m.vibrar('seleccion')).catch(() => {});
};

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
  const salir = async () => {
    if (saliendo) return;
    setSaliendo(true);
    setAvisoSalida(null);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (e) {
      setAvisoSalida(mensajeSistema(e));
    } finally {
      setSaliendo(false);
    }
  };

  return (
    <EdadVista
      edadMinima={EDAD_MINIMA}
      autenticado={autenticado}
      estado={estado}
      aviso={aviso}
      avisoSalida={avisoSalida}
      marcada={marcada}
      saliendo={saliendo}
      onMarcar={() => {
        vibrarSeleccion();
        setMarcada((v) => !v);
      }}
      onConfirmar={() => { if (marcada) void confirmar(); }}
      onReintentar={() => void consultar()}
      onSalir={() => void salir()}
    />
  );
}
