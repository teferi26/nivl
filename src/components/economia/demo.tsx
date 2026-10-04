// Demo de la galería /kit/pantallas (solo desarrollo). FASE3 G2 · Economía.
//
// EconomiaVista con movimientos de mentira, sumados con la misma cuenta que
// la pantalla (calcularEconomia → moneymath): sin sesión ni Supabase. El día
// es el 18 de octubre de 2026 para que el mes vaya por la mitad (con el 2,
// el del resto de la galería, la proyección no dice nada). Los traspasos
// entre cuentas propias van marcados y no cuentan. Las acciones no hacen nada.
import type { DemoPantalla } from '@/components/arena/galeria';
import type { Budget, MoneyAccount, MoneyPlan, Transaction } from '@/lib/money';
import { calcularEconomia } from './calculo';
import { EconomiaVista, type EconomiaVistaProps } from './EconomiaVista';
import { HojaClasificar, HojaEfectivo } from './HojasEconomia';

const nada = () => {};
const HOY = '2026-10-18';

let n = 0;
function mov(date: string, amount: number, description: string, category: string, is_internal = false): Transaction {
  n += 1;
  return {
    id: `t${n}`,
    date,
    amount,
    description,
    counterparty: description,
    category,
    is_internal,
    currency: 'EUR',
    source: 'revolut',
    notes: null,
  };
}

/** Un mes cerrado típico: nómina, alquiler, súper, suscripciones y un traspaso. */
function mes(m: string, extra = 0): Transaction[] {
  return [
    mov(`${m}-01`, 2150, 'Nómina', 'ingreso_nomina'),
    mov(`${m}-02`, -750, 'Alquiler', 'vivienda'),
    mov(`${m}-05`, -12.99, 'Netflix', 'suscripciones'),
    mov(`${m}-06`, -10.99, 'Spotify', 'suscripciones'),
    mov(`${m}-07`, -39.9, 'Basic-Fit', 'gimnasio'),
    mov(`${m}-09`, -96.4 - extra, 'Mercadona', 'super'),
    mov(`${m}-16`, -84.15, 'Mercadona', 'super'),
    mov(`${m}-20`, -62.3, 'Iberdrola', 'suministros'),
    mov(`${m}-22`, -48, 'Restaurante La Tasca', 'restaurante'),
    mov(`${m}-25`, -300, 'A cuenta de ahorro', 'ahorro'),
    mov(`${m}-26`, -500, 'Traspaso a BBVA', 'transferencia', true),
    mov(`${m}-26`, 500, 'Traspaso desde Revolut', 'transferencia', true),
  ];
}

const MOVS: Transaction[] = [
  // Octubre, hasta hoy.
  mov('2026-10-01', 2150, 'Nómina', 'ingreso_nomina'),
  mov('2026-10-02', -750, 'Alquiler', 'vivienda'),
  mov('2026-10-05', -12.99, 'Netflix', 'suscripciones'),
  mov('2026-10-06', -10.99, 'Spotify', 'suscripciones'),
  mov('2026-10-07', -39.9, 'Basic-Fit', 'gimnasio'),
  mov('2026-10-09', -112.35, 'Mercadona', 'super'),
  mov('2026-10-12', -86, 'Restaurante La Tasca', 'restaurante'),
  mov('2026-10-14', -64.5, 'Cabify', 'transporte'),
  mov('2026-10-15', -42.7, 'AMZN MKTP ES 4471', 'sin_clasificar'),
  mov('2026-10-16', -18.9, 'BIZUM A LUCIA M', 'sin_clasificar'),
  mov('2026-10-17', -129, 'DECATHLON 0231', 'sin_clasificar'),
  ...mes('2026-09', 20),
  ...mes('2026-08', 0),
  ...mes('2026-07', 35),
];

const CUENTAS: MoneyAccount[] = [
  { id: 'a1', name: 'Revolut', provider: 'revolut', currency: 'EUR', balance: 3240.55, balance_at: HOY, active: true },
  { id: 'a2', name: 'BBVA', provider: 'bbva', currency: 'EUR', balance: 15180, balance_at: HOY, active: true },
];

const PLAN: MoneyPlan = {
  id: 'p1',
  from_date: '2026-09-01',
  income_target: 2500,
  spend_cap: 1500,
  savings_target: 300,
  runway_target_months: 6,
  currency: 'EUR',
  rationale: null,
};

const PRESUPUESTOS: Budget[] = [
  { id: 'b1', category: 'restaurante', monthly_limit: 80, rationale: null },
  { id: 'b2', category: 'super', monthly_limit: 300, rationale: null },
];

/** Lo mismo con más gasto: el ritmo pasa de ×1,1 y el colchón queda corto. */
const MOVS_DESBORDADO: Transaction[] = [
  ...MOVS,
  mov('2026-10-10', -420, 'Ryanair', 'ocio'),
  mov('2026-10-11', -380, 'Booking.com', 'ocio'),
  mov('2026-10-13', -210, 'El Corte Inglés', 'ropa'),
];

function base(cambios: Partial<EconomiaVistaProps> = {}, movs = MOVS, cuentas = CUENTAS, plan: MoneyPlan | null = PLAN): EconomiaVistaProps {
  return {
    cargado: true,
    errorCarga: null,
    refrescando: false,
    hayMovimientos: movs.length > 0,
    datos: calcularEconomia(movs, cuentas, plan, HOY),
    plan,
    presupuestos: PRESUPUESTOS,
    clasificando: false,
    aprendido: null,
    acciones: {
      onVolver: nada,
      onRefrescar: nada,
      onReintentar: nada,
      onNuevo: nada,
      onEditar: nada,
      onClasificarTodo: nada,
      onOlvidarAprendido: nada,
    },
    ...cambios,
  };
}

const ERROR = 'Sin conexión. Revisa la red y vuelve a intentarlo.';
const SIN_CLASIFICAR = MOVS.find((m) => m.category === 'sin_clasificar')!;

export const DEMO: DemoPantalla | null = {
  id: 'economia',
  titulo: 'Economía',
  marco: 'pila',
  estados: [
    { id: 'lleno', titulo: 'Mes en curso con plan', render: () => <EconomiaVista {...base()} /> },
    {
      id: 'desbordado',
      titulo: 'Ritmo desbordado y bajo el colchón',
      render: () => (
        <EconomiaVista
          {...base({}, MOVS_DESBORDADO, [{ ...CUENTAS[0]!, balance: 4100 }, { ...CUENTAS[1]!, balance: 0 }])}
        />
      ),
    },
    {
      id: 'sin-plan',
      titulo: 'Sin plan ni histórico',
      render: () => (
        <EconomiaVista
          {...base({}, MOVS.filter((m) => m.date >= '2026-10-01' && m.category !== 'sin_clasificar'), [], null)}
        />
      ),
    },
    {
      id: 'aprendido',
      titulo: 'Tras clasificar a mano',
      render: () => (
        <EconomiaVista {...base({ aprendido: '3 movimientos clasificados. A partir de ahora lo hace solo.' })} />
      ),
    },
    {
      id: 'vacio',
      titulo: 'Sin movimientos',
      render: () => <EconomiaVista {...base({}, [], [], null)} />,
    },
    { id: 'cargando', titulo: 'Cargando', render: () => <EconomiaVista {...base({ cargado: false })} /> },
    {
      id: 'error',
      titulo: 'Error al cargar',
      render: () => <EconomiaVista {...base({ errorCarga: ERROR }, [], [], null)} />,
    },
    {
      id: 'error-con-datos',
      titulo: 'Error al refrescar',
      render: () => <EconomiaVista {...base({ errorCarga: ERROR })} />,
    },
    {
      id: 'hoja-clasificar',
      titulo: 'Hoja · clasificar',
      render: () => (
        <>
          <EconomiaVista {...base()} />
          <HojaClasificar movimiento={SIN_CLASIFICAR} error={null} onElegir={nada} onCerrar={nada} />
        </>
      ),
    },
    {
      id: 'hoja-efectivo',
      titulo: 'Hoja · efectivo',
      render: () => (
        <>
          <EconomiaVista {...base()} />
          <HojaEfectivo
            visible
            importe="-12,50"
            concepto="Café y periódico"
            categoria="restaurante"
            guardando={false}
            errorImporte={null}
            errorConcepto={null}
            error={null}
            onImporte={nada}
            onConcepto={nada}
            onCategoria={nada}
            onGuardar={nada}
            onCerrar={nada}
          />
        </>
      ),
    },
    {
      id: 'hoja-efectivo-errores',
      titulo: 'Hoja · efectivo con fallos',
      render: () => (
        <>
          <EconomiaVista {...base()} />
          <HojaEfectivo
            visible
            importe=""
            concepto=""
            categoria="otros"
            guardando={false}
            errorImporte="Escribe el importe. Negativo si es gasto, positivo si es ingreso."
            errorConcepto={null}
            error={ERROR}
            onImporte={nada}
            onConcepto={nada}
            onCategoria={nada}
            onGuardar={nada}
            onCerrar={nada}
          />
        </>
      ),
    },
  ],
};
