// Demo de la galería /kit/pantallas (solo desarrollo). Fase 3, Lote A
// (docs/design-v2/FASE3.md): el acceso con datos de mentira, sin sesión ni
// Supabase. Las acciones no hacen nada.
//
// Entrar (8 estados + el teclado fuera), restablecer (4), confirmar (2),
// arranque (2) y el 404. Pantallas de la pila: el hueco es el ancho entero.
import type { DemoPantalla } from '@/components/arena/galeria';
import { ArranqueCargando, ArranqueError, FueraDeLaArena } from './Arranque';
import { ConfirmarVista, RestablecerVista, type RestablecerVistaProps } from './EnlaceCuenta';
import { AVISO_RECUPERACION, SIN_TOCAR, type CamposLogin, type ModoLogin } from './formulario';
import { LoginVista, type LoginVistaProps } from './LoginVista';

const nada = () => {};

const VACIOS: CamposLogin = { nombre: '', correo: '', contrasena: '', repite: '', aceptado: false };
const TODO_TOCADO = { nombre: true, correo: true, contrasena: true, repite: true };

function login(modo: ModoLogin, extra: Partial<LoginVistaProps> = {}): LoginVistaProps {
  return {
    portal: false,
    modo,
    campos: VACIOS,
    tocados: SIN_TOCAR,
    verContrasena: false,
    error: null,
    aviso: null,
    enviando: false,
    plegada: false,
    onNombre: nada,
    onCorreo: nada,
    onContrasena: nada,
    onRepite: nada,
    onTocar: nada,
    onAceptar: nada,
    onVerContrasena: nada,
    onModo: nada,
    onEnviar: nada,
    onAbrir: nada,
    ...extra,
  };
}

const LLENO: CamposLogin = { ...VACIOS, correo: 'teferi@nivl.app', contrasena: 'el gato de mi abuela ronca' };

function restablecer(extra: Partial<RestablecerVistaProps>): RestablecerVistaProps {
  return {
    fase: 'formulario',
    fallo: null,
    correo: 'teferi@nivl.app',
    nueva: '',
    repite: '',
    ver: false,
    error: null,
    enviando: false,
    onNueva: nada,
    onRepite: nada,
    onVer: nada,
    onGuardar: nada,
    onContinuar: nada,
    onIrAEntrar: nada,
    ...extra,
  };
}

export const DEMO: DemoPantalla | null = {
  id: 'acceso',
  titulo: 'Acceso',
  marco: 'pila',
  estados: [
    { id: 'entrar', titulo: 'Entrar', render: () => <LoginVista {...login('signin', { campos: LLENO })} /> },
    {
      id: 'entrar-teclado',
      titulo: 'Entrar con teclado',
      render: () => <LoginVista {...login('signin', { campos: LLENO, plegada: true })} />,
    },
    { id: 'crear-vacio', titulo: 'Crear cuenta', render: () => <LoginVista {...login('signup')} /> },
    {
      id: 'crear-errores',
      titulo: 'Crear con errores',
      render: () => (
        <LoginVista
          {...login('signup', {
            campos: { nombre: 'Teferi', correo: 'teferi@correo', contrasena: 'gladiador', repite: 'gladiadora', aceptado: true },
            tocados: TODO_TOCADO,
          })}
        />
      ),
    },
    {
      id: 'recuperar',
      titulo: 'Recuperar',
      render: () => <LoginVista {...login('recover', { campos: { ...VACIOS, correo: 'teferi@nivl.app' } })} />,
    },
    {
      id: 'recuperar-enviado',
      titulo: 'Enlace enviado',
      render: () => (
        <LoginVista
          {...login('recover', { campos: { ...VACIOS, correo: 'teferi@nivl.app' }, aviso: AVISO_RECUPERACION })}
        />
      ),
    },
    {
      id: 'error-servidor',
      titulo: 'Error del servidor',
      render: () => (
        <LoginVista
          {...login('signin', {
            campos: LLENO,
            error: 'Correo o contraseña incorrectos.',
          })}
        />
      ),
    },
    {
      id: 'enviando',
      titulo: 'Enviando',
      render: () => <LoginVista {...login('signin', { campos: LLENO, enviando: true })} />,
    },
    {
      id: 'portal',
      titulo: 'Portal de creadores',
      render: () => <LoginVista {...login('signin', { portal: true, campos: LLENO })} />,
    },
    {
      id: 'restablecer-comprobando',
      titulo: 'Restablecer · comprobando',
      render: () => <RestablecerVista {...restablecer({ fase: 'comprobando' })} />,
    },
    {
      id: 'restablecer-formulario',
      titulo: 'Restablecer · formulario',
      render: () => <RestablecerVista {...restablecer({ nueva: 'mi gato ronca', repite: 'mi gato' })} />,
    },
    {
      id: 'restablecer-hecho',
      titulo: 'Restablecer · hecho',
      render: () => <RestablecerVista {...restablecer({ fase: 'hecho' })} />,
    },
    {
      id: 'restablecer-invalido',
      titulo: 'Restablecer · inválido',
      render: () => (
        <RestablecerVista
          {...restablecer({
            fase: 'invalido',
            fallo: 'Este enlace no es válido o ha caducado. Pide uno nuevo desde «¿Olvidaste tu contraseña?».',
          })}
        />
      ),
    },
    {
      id: 'confirmar-confirmando',
      titulo: 'Confirmar · confirmando',
      render: () => <ConfirmarVista error={null} onIrAEntrar={nada} />,
    },
    {
      id: 'confirmar-fallo',
      titulo: 'Confirmar · fallo',
      render: () => (
        <ConfirmarVista
          error="Este enlace no trae nada que confirmar. Abre el último correo que te enviamos o entra con tu contraseña."
          onIrAEntrar={nada}
        />
      ),
    },
    { id: 'arranque-cargando', titulo: 'Arranque · cargando', render: () => <ArranqueCargando /> },
    {
      id: 'arranque-error',
      titulo: 'Arranque · error',
      render: () => (
        <ArranqueError
          mensaje="Sin conexión. El sistema lo reintentará cuando vuelvas a tener red."
          onReintentar={nada}
          onCerrarSesion={nada}
        />
      ),
    },
    { id: '404', titulo: 'Ruta no encontrada', render: () => <FueraDeLaArena onVolver={nada} /> },
  ],
};
