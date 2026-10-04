// NIVL · Acceso: los datos y los efectos de la pantalla de entrar.
//
// Lo que antes vivía en login.tsx, cortado y pegado: el estado del
// formulario, el envío (entrar, registrar, pedir recuperación) con los
// mensajes de authFlow (Chat 3) y el cambio de modo. Devuelve las props de
// LoginVista. La cuenta es de NIVL (Supabase Auth propio): esta pantalla solo
// pinta y llama.

import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';
import { vibrar } from '@/design/haptics';
import { entrar, pedirRecuperacion, registrar } from '@/lib/authFlow';
import { SITIO_CREADORES } from '@/lib/sitio';
import { mensajeSistema } from '@/lib/validation';
import { AVISO_RECUPERACION, AVISO_REGISTRO, evaluarLogin, SIN_TOCAR, type CampoTocable, type ModoLogin, type Tocados } from './formulario';
import type { LoginVistaProps } from './LoginVista';

/**
 * Con el teclado fuera, la portada se pliega a la marca sola: en un móvil
 * pequeño el graderío empujaba el campo enfocado fuera de la vista. Solo
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
  const [mode, setMode] = useState<ModoLogin>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Tocados>(SIN_TOCAR);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const plegada = useTecladoFuera();

  const { puedeEnviar: canSubmit } = evaluarLogin(
    mode,
    { nombre: name, correo: email, contrasena: password, repite: confirm, aceptado: accepted },
    touched,
  );

  const reset = () => {
    setError(null);
    setNotice(null);
  };

  const switchMode = (next: ModoLogin) => {
    // En el portal de creadores solo se entra: ni alta ni recuperar.
    if (next === mode || (SITIO_CREADORES && next !== 'signin')) return;
    setMode(next);
    reset();
    setConfirm('');
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
        setNotice(AVISO_RECUPERACION);
      } else {
        const r = await registrar(email, password, name);
        if (r === 'confirmar_email') {
          // Se vuelve a Entrar con el correo puesto: lo siguiente es confirmar y entrar.
          setMode('signin');
          setPassword('');
          setConfirm('');
          setNotice(AVISO_REGISTRO);
        }
      }
    } catch (e) {
      vibrar('penalizacion');
      setError(mensajeSistema(e));
    } finally {
      setBusy(false);
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
    setConfirm('');
    setShowPassword(false);
    setError(null);
    if (tambienAviso) setNotice(null);
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
    modo: mode,
    campos: { nombre: name, correo: email, contrasena: password, repite: confirm, aceptado: accepted },
    tocados: touched,
    verContrasena: showPassword,
    error,
    aviso: notice,
    enviando: busy,
    plegada,
    onNombre: setName,
    onCorreo: setEmail,
    onContrasena: setPassword,
    onRepite: setConfirm,
    onTocar: tocar,
    onAceptar: () => setAccepted((a) => !a),
    onVerContrasena: () => setShowPassword((s) => !s),
    onModo: switchMode,
    onEnviar: submit,
    onAbrir: (url) => {
      Linking.openURL(url).catch(() => {});
    },
  };
}
