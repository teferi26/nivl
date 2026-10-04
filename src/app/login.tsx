// NIVL · /login: entrar, crear cuenta o recuperar la contraseña.
//
// La cuenta es de NIVL (Supabase Auth propio). Los mensajes de error y la
// lógica viven en authFlow.ts (Chat 3); el estado y el envío, en useLogin; lo
// que se ve, en LoginVista (src/components/acceso). En el portal de creadores
// (SITIO_CREADORES) solo se entra: sin registro ni recuperar.
//
// Un solo mecanismo para el teclado: el inset automático del ScrollView de
// Screen, que además lleva el campo enfocado a la vista. Junto a un
// KeyboardAvoidingView con padding, iOS sumaba el teclado dos veces.

import { LoginVista } from '@/components/acceso/LoginVista';
import { useLogin } from '@/components/acceso/useLogin';

export default function Login() {
  const vista = useLogin();
  return <LoginVista {...vista} />;
}
