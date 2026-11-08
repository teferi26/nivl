// NIVL · Acceso: los datos y los efectos de la pantalla de entrar.
//
// Lo que antes vivía en login.tsx, cortado y pegado: el estado del
// formulario, el envío (entrar, registrar, pedir recuperación) con los
// mensajes de authFlow (Chat 3), el reenvío del correo de confirmación y el
// cambio de modo. Devuelve las props de
// LoginVista. La cuenta es de NIVL (Supabase Auth propio): esta pantalla solo
// pinta y llama.

import * as Linking from 'expo-linking';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';
import { vibrar } from '@/design/haptics';
import { registrar as registrarEvento } from '@/lib/analitica';
import { entrar, pedirRecuperacion, reenviarConfirmacion, registrar } from '@/lib/authFlow';
import { SITIO_CREADORES } from '@/lib/sitio';
import { mensajeSistema } from '@/lib/validation';
import {
  avisoRecuperacion,
  avisoReenviado,
  avisoRegistro,
  ESPERA_REENVIO_S,
  evaluarLogin,
  NOMBRE_POR_DEFECTO,
  segundosRestantes,
  SIN_TOCAR,
  type CampoTocable,
  type ModoLogin,
  type Tocados,
} from './formulario';
import type { LoginVistaProps } from './LoginVista';

/**
 * Con el teclado fuera, la portada se pliega a la marca sola: en un móvil
 * pequeño el escudo empujaba el campo enfocado fuera de la vista. Solo
 * escucha; quien aparta el contenido sigue siendo el inset automático del
 * ScrollView de Screen (un solo mecanismo de teclado).
 */
function useTecladoFuera(): boolean {
  const [fuera, setFuera] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    // iOS avisa antes de moverse (la portada se pliega a la vez que sube el
    // teclado); Android solo avisa después.
    const sale = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const entra = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(sale, () => setFuera(true));
    const b = Keyboard.addListener(entra, () => setFuera(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return fuera;
}

export function useLogin(): LoginVistaProps {
  // Quien llega del cuestionario (/empezar) va directo a crear su cuenta.
  const { modo: modoPedido, desde } = useLocalSearchParams<{ modo?: string; desde?: string }>();
  const [mode, setMode] = useState<ModoLogin>(modoPedido === 'signup' && !SITIO_CREADORES ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Tocados>(SIN_TOCAR);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // El correo recién registrado: mientras esté en el campo se puede reenviar.
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [reenviando, setReenviando] = useState(false);
  const [mensajeReenvio, setMensajeReenvio] = useState<string | null>(null);
  const [esperaHasta, setEsperaHasta] = useState(0);
  const [ahora, setAhora] = useState(0);
  // Síncrono: dos toques seguidos no llegan a ver el estado actualizado.
  const bloqueoReenvio = useRef(0);
  const plegada = useTecladoFuera();

  const campos = { correo: email, contrasena: password, aceptado: accepted };
  const { puedeEnviar: canSubmit } = evaluarLogin(mode, campos, touched);

  useEffect(() => {
    if (esperaHasta === 0) return;
    // Por marca de tiempo: en segundo plano el intervalo se para y no atrasa.
    const id = setInterval(() => {
      const n = Date.now();
      setAhora(n);
      if (n >= esperaHasta) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [esperaHasta]);

  const reset = () => {
    setError(null);
    setNotice(null);
    setMensajeReenvio(null);
  };

  const switchMode = (next: ModoLogin) => {
    // En el portal de creadores solo se entra: ni alta ni recuperar.
    if (next === mode || (SITIO_CREADORES && next !== 'signin')) return;
    setMode(next);
    reset();
    setPendiente(null);
    setTouched(SIN_TOCAR);
  };

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    reset();
    try {
      if (mode === 'signin') {
        await entrar(email, password);
        // La puerta de sesión de _layout redirige al detectar la sesión.
      } else if (mode === 'recover') {
        await pedirRecuperacion(email);
        setNotice(avisoRecuperacion());
      } else {
        const r = await registrar(email, password, NOMBRE_POR_DEFECTO);
        registrarEvento('registro', { resultado: r });
        if (r === 'confirmar_email') {
          // Se vuelve a Entrar con el correo puesto: lo siguiente es abrir el enlace.
          setMode('signin');
          setPassword('');
          setPendiente(email);
          setNotice(avisoRegistro());
        }
      }
    } catch (e) {
      vibrar('penalizacion');
      setError(mensajeSistema(e));
    } finally {
      setBusy(false);
    }
  };

  const reenviar = async () => {
    const instante = Date.now();
    if (!pendiente || instante < bloqueoReenvio.current) return;
    const hasta = instante + ESPERA_REENVIO_S * 1000;
    bloqueoReenvio.current = hasta;
    setAhora(instante);
    setEsperaHasta(hasta);
    setReenviando(true);
    setMensajeReenvio(null);
    try {
      await reenviarConfirmacion(pendiente);
      setMensajeReenvio(avisoReenviado());
    } catch (e) {
      vibrar('penalizacion');
      setMensajeReenvio(mensajeSistema(e));
    } finally {
      setReenviando(false);
    }
  };

  // Lo de un intento anterior no se queda a la vista (revisión de Apple: el
  // login abría ya con «Correo o contraseña incorrectos» y la contraseña
  // puesta). El estado es local y se monta limpio, pero la misma instancia
  // sobrevive a dos salidas: la app a segundo plano (iOS la conserva en
  // memoria y «abrirla» es volver a esta pantalla tal cual) y, si el login
  // quedara debajo en la pila, volver a él. En las dos se borran el error y
  // la contraseña; el correo se queda. El aviso («revisa tu correo») sigue
  // si solo se ha ido a mirar el correo.
  const olvidarIntento = useCallback((tambienAviso: boolean) => {
    setPassword('');
    setShowPassword(false);
    setError(null);
    if (tambienAviso) {
      setNotice(null);
      setPendiente(null);
      setMensajeReenvio(null);
    }
    setTouched(SIN_TOCAR);
  }, []);

  // Al perder el foco (no al ganarlo: el aviso de «revisa tu correo» tras el
  // registro tiene que verse).
  useFocusEffect(useCallback(() => () => olvidarIntento(true), [olvidarIntento]));

  useEffect(() => {
    // Solo 'background': 'inactive' salta también con el Face ID del
    // autorrelleno de contraseñas de iOS y borraría lo que acaba de rellenar.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') olvidarIntento(false);
    });
    return () => sub.remove();
  }, [olvidarIntento]);

  const tocar = (campo: CampoTocable) => setTouched((t) => ({ ...t, [campo]: true }));

  return {
    portal: SITIO_CREADORES,
    desdePlan: desde === 'plan',
    modo: mode,
    campos,
    tocados: touched,
    verContrasena: showPassword,
    error,
    aviso: notice,
    enviando: busy,
    plegada,
    reenvio:
      mode === 'signin' && pendiente !== null && email === pendiente
        ? { segundos: segundosRestantes(esperaHasta, ahora), enviando: reenviando, mensaje: mensajeReenvio }
        : null,
    onCorreo: setEmail,
    onContrasena: setPassword,
    onTocar: tocar,
    onAceptar: () => setAccepted((a) => !a),
    onVerContrasena: () => setShowPassword((s) => !s),
    onModo: switchMode,
    onEnviar: submit,
    onReenviar: reenviar,
    // La ruta la crea el embudo público: hasta entonces no está en las tipadas.
    onCrearPlan: () => router.push('/empezar' as never),
    onAbrir: (url) => {
      Linking.openURL(url).catch(() => {});
    },
  };
}
