// Demo de la galería /kit/pantallas (solo desarrollo). FASE3 G1 · Contrato.
//
// ContratoVista con datos de mentira: sin sesión ni Supabase. El «hoy» es el
// fijo de la galería (HOY_DEMO). Las acciones no hacen nada.
import type { DemoPantalla } from '@/components/arena/galeria';
import { HOY_DEMO } from '@/components/arena/demoDatos';
import type { Letter, Rule } from '@/lib/types';
import { ContratoVista, type ContratoVistaProps } from './ContratoVista';
import { HojaCarta, HojaNorma, OPCIONES_APERTURA } from './HojasContrato';

const nada = () => {};

function regla(n: number, text: string, consequence: string): Rule {
  return {
    id: `r${n}`,
    user_id: 'demo-usuario',
    position: n,
    text,
    consequence,
    active: true,
    created_at: '2026-09-01T09:00:00Z',
  };
}

const REGLAS: Rule[] = [
  regla(0, 'Escribir el diario todos los días: lo vivido y el plan del día', 'Correr 8 km'),
  regla(1, 'Nada de alcohol', '1 día comiendo solo limpio'),
  regla(2, 'Nada de cafeína', '1 día sin pantallas de ocio'),
  regla(3, 'Comer limpio a diario', 'Correr 4,5 km'),
  regla(4, 'Ningún plan se interpone a mis objetivos', 'Reorganizar la semana y compensar el tiempo'),
];

const CARTA_SELLADA: Letter = {
  id: 'l1',
  user_id: 'demo-usuario',
  body: 'No sé cómo estarás.',
  sealed_at: '2026-09-02T21:00:00Z',
  open_at: '2031-09-02',
  opened_at: null,
};

const CARTA_LISTA: Letter = { ...CARTA_SELLADA, sealed_at: '2025-10-01T21:00:00Z', open_at: '2026-10-01' };

const CARTA_ABIERTA: Letter = {
  ...CARTA_LISTA,
  opened_at: '2026-10-02T08:10:00Z',
  body: 'Hace un año empezabas con NIVL sin saber si duraría una semana. Si lees esto, ha durado. Ahora sube el listón: lo que hoy te parece imposible es el siguiente contrato.',
};

function base(cambios: Partial<ContratoVistaProps> = {}): ContratoVistaProps {
  return {
    cargado: true,
    errorCarga: null,
    hoy: HOY_DEMO,
    conPerfil: true,
    reglas: REGLAS,
    bonus: 40,
    gastadoSemana: 25,
    carta: CARTA_SELLADA,
    sembrando: false,
    acciones: {
      onVolver: nada,
      onNuevaNorma: nada,
      onRomper: nada,
      onEliminar: nada,
      onCanjear: nada,
      onCargarPlantilla: nada,
      onEscribirCarta: nada,
      onAbrirCarta: nada,
      onReintentar: nada,
    },
    ...cambios,
  };
}

const ERROR = 'Sin conexión. Revisa la red y vuelve a intentarlo.';

export const DEMO: DemoPantalla | null = {
  id: 'contrato',
  titulo: 'Contrato',
  marco: 'pila',
  estados: [
    { id: 'lleno', titulo: 'Normas firmadas · carta sellada', render: () => <ContratoVista {...base()} /> },
    {
      id: 'vacio',
      titulo: 'Sin normas ni carta',
      render: () => <ContratoVista {...base({ reglas: [], carta: null, bonus: 0, gastadoSemana: 0 })} />,
    },
    {
      id: 'carta-lista',
      titulo: 'Ha llegado el día de la carta',
      render: () => <ContratoVista {...base({ carta: CARTA_LISTA })} />,
    },
    {
      id: 'carta-abierta',
      titulo: 'Carta abierta',
      render: () => <ContratoVista {...base({ carta: CARTA_ABIERTA })} />,
    },
    { id: 'cargando', titulo: 'Cargando', render: () => <ContratoVista {...base({ cargado: false })} /> },
    {
      id: 'error',
      titulo: 'Error al cargar',
      render: () => <ContratoVista {...base({ errorCarga: ERROR, conPerfil: false, reglas: [], carta: null })} />,
    },
    {
      id: 'hoja-norma',
      titulo: 'Hoja · norma nueva con error',
      render: () => (
        <>
          <ContratoVista {...base()} />
          <HojaNorma
            visible
            texto="Nada de redes sociales antes de las 12"
            consecuencia="Correr 5 km"
            guardando={false}
            error={ERROR}
            onTexto={nada}
            onConsecuencia={nada}
            onGuardar={nada}
            onCerrar={nada}
          />
        </>
      ),
    },
    {
      id: 'hoja-carta',
      titulo: 'Hoja · carta',
      render: () => (
        <>
          <ContratoVista {...base({ carta: null })} />
          <HojaCarta
            visible
            hoy={HOY_DEMO}
            cuerpo="No sé cómo estarás, ni en qué situación. Solo sé que hoy he decidido empezar."
            opcion={OPCIONES_APERTURA[2]!}
            sellando={false}
            error={null}
            onCuerpo={nada}
            onOpcion={nada}
            onSellar={nada}
            onCerrar={nada}
          />
        </>
      ),
    },
  ],
};
