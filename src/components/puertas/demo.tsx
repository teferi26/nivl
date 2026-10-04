// Demo de la galería /kit/pantallas (solo desarrollo). Fase 3, Lote B1
// (docs/design-v2/FASE3.md): las puertas con datos de mentira, sin sesión ni
// Supabase. Las acciones no hacen nada.
//
// Edad (6 estados), permiso de salud (puerta 4 + hoja 3), consentimiento de
// la IA (2) y denuncia (3). Pantallas de la pila: el hueco es el ancho entero.
import type { DemoPantalla } from '@/components/arena/galeria';
import { Screen } from '@/components/ui';
import { EDAD_MINIMA } from '@/lib/consentmath';
import { MENSAJE_SIN_CONEXION } from '@/lib/validation';
import { ConsentimientoIAVista } from './ConsentimientoIAVista';
import { DenunciaVista, type DenunciaVistaProps } from './DenunciaVista';
import { EdadVista, type EdadVistaProps } from './EdadVista';
import { HojaSaludVista, PuertaSaludVista, type HojaSaludVistaProps, type PuertaSaludVistaProps } from './SaludVista';

const nada = () => {};

function edad(extra: Partial<EdadVistaProps>): EdadVistaProps {
  return {
    edadMinima: EDAD_MINIMA,
    autenticado: true,
    estado: 'pendiente',
    aviso: null,
    avisoSalida: null,
    marcada: false,
    saliendo: false,
    onMarcar: nada,
    onConfirmar: nada,
    onReintentar: nada,
    onSalir: nada,
    ...extra,
  };
}

function puerta(extra: Partial<PuertaSaludVistaProps>): PuertaSaludVistaProps {
  return {
    cargando: false,
    error: null,
    borradoPendiente: false,
    onVolver: nada,
    onRevisar: nada,
    onReintentar: nada,
    onPerfil: nada,
    ...extra,
  };
}

function hoja(extra: Partial<HojaSaludVistaProps>): HojaSaludVistaProps {
  return {
    visible: true,
    marcada: false,
    ocupada: false,
    error: null,
    onMarcar: nada,
    onAceptar: nada,
    onCancelar: nada,
    onErrorEnlace: nada,
    ...extra,
  };
}

function denuncia(extra: Partial<DenunciaVistaProps>): DenunciaVistaProps {
  return {
    visible: true,
    motivo: null,
    aviso: null,
    enviada: false,
    ocupada: false,
    onMotivo: nada,
    onEnviar: nada,
    onCerrar: nada,
    ...extra,
  };
}

const SIN_RED = MENSAJE_SIN_CONEXION;

/** Las hojas de la IA salen sobre una pantalla vacía: la de debajo no es suya. */
const Fondo = () => <Screen>{null}</Screen>;

export const DEMO: DemoPantalla | null = {
  id: 'puertas',
  titulo: 'Puertas',
  marco: 'pila',
  estados: [
    { id: 'edad-cargando', titulo: 'Edad · comprobando', render: () => <EdadVista {...edad({ estado: 'cargando' })} /> },
    { id: 'edad-pendiente', titulo: 'Edad · sin marcar', render: () => <EdadVista {...edad({})} /> },
    { id: 'edad-marcada', titulo: 'Edad · marcada', render: () => <EdadVista {...edad({ marcada: true })} /> },
    {
      id: 'edad-guardando',
      titulo: 'Edad · guardando',
      render: () => <EdadVista {...edad({ marcada: true, estado: 'guardando' })} />,
    },
    {
      id: 'edad-fallo',
      titulo: 'Edad · no se ha guardado',
      render: () => <EdadVista {...edad({ marcada: true, aviso: SIN_RED })} />,
    },
    {
      id: 'edad-bloqueada',
      titulo: 'Edad · sin comprobar',
      render: () => <EdadVista {...edad({ estado: 'error', aviso: SIN_RED })} />,
    },
    { id: 'salud-puerta', titulo: 'Salud · puerta', render: () => <PuertaSaludVista {...puerta({})} /> },
    { id: 'salud-cargando', titulo: 'Salud · comprobando', render: () => <PuertaSaludVista {...puerta({ cargando: true })} /> },
    { id: 'salud-error', titulo: 'Salud · sin comprobar', render: () => <PuertaSaludVista {...puerta({ error: SIN_RED })} /> },
    {
      id: 'salud-borrado',
      titulo: 'Salud · borrado pendiente',
      render: () => <PuertaSaludVista {...puerta({ borradoPendiente: true })} />,
    },
    {
      id: 'salud-hoja',
      titulo: 'Salud · hoja',
      render: () => (
        <>
          <PuertaSaludVista {...puerta({})} />
          <HojaSaludVista {...hoja({})} />
        </>
      ),
    },
    {
      id: 'salud-hoja-marcada',
      titulo: 'Salud · hoja marcada',
      render: () => (
        <>
          <PuertaSaludVista {...puerta({})} />
          <HojaSaludVista {...hoja({ marcada: true })} />
        </>
      ),
    },
    {
      id: 'salud-hoja-error',
      titulo: 'Salud · hoja con fallo',
      render: () => (
        <>
          <PuertaSaludVista {...puerta({})} />
          <HojaSaludVista {...hoja({ marcada: true, error: SIN_RED })} />
        </>
      ),
    },
    {
      id: 'ia-hoja',
      titulo: 'IA · consentimiento',
      render: () => (
        <>
          <Fondo />
          <ConsentimientoIAVista visible ocupada={false} aviso={null} onAceptar={nada} onCerrar={nada} />
        </>
      ),
    },
    {
      id: 'ia-error',
      titulo: 'IA · no se ha guardado',
      render: () => (
        <>
          <Fondo />
          <ConsentimientoIAVista visible ocupada={false} aviso={SIN_RED} onAceptar={nada} onCerrar={nada} />
        </>
      ),
    },
    {
      id: 'denuncia',
      titulo: 'Denuncia · elegir motivo',
      render: () => (
        <>
          <Fondo />
          <DenunciaVista {...denuncia({ motivo: 'salud' })} />
        </>
      ),
    },
    {
      id: 'denuncia-enviada',
      titulo: 'Denuncia · enviada',
      render: () => (
        <>
          <Fondo />
          <DenunciaVista {...denuncia({ enviada: true, aviso: 'Denuncia registrada. El equipo revisará esta respuesta.' })} />
        </>
      ),
    },
    {
      id: 'denuncia-error',
      titulo: 'Denuncia · fallo',
      render: () => (
        <>
          <Fondo />
          <DenunciaVista {...denuncia({ motivo: 'ofensivo', aviso: SIN_RED })} />
        </>
      ),
    },
  ],
};
