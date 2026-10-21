// Demo de la galería /kit/work (solo desarrollo): la economía de WORK con datos
// de mentira, sumados con la misma cuenta que la pantalla (derivarWork →
// moneywork). Sin sesión ni Supabase; las acciones no hacen nada. Hoy es el
// 21 de octubre de 2026.
import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { CabeceraMundo } from '@/components/modos/mundo/CabeceraMundo';
import { GlifoModo } from '@/components/modos/rueda/GlifoModo';
import { leerExtractoCsv, proponerImportacion } from '@/lib/moneyextracto';
import type { CategoriaPropia, CuentaWork, Fijo, MovWork } from '@/lib/moneywork';
import { derivarWork, type EntradaWork } from './calculoWork';
import { HojaCuenta, HojaFijo, HojaImportar, HojaMovimiento, HojaTransferencia, type CuentaElegible } from './HojasWork';
import { ACENTO, RADIO_BOTON, tinte } from './PiezasWork';
import { RevisionExtractoVista, type FilaRevision } from './RevisionExtractoVista';
import { WorkEconomiaVista, type AccionesWork, type EstadoBrief, type WorkEconomiaVistaProps } from './WorkEconomiaVista';

const nada = () => {};
export const HOY_DEMO = '2026-10-21';

const CUENTAS: CuentaWork[] = [
  { id: 'c1', name: 'Ibercaja', provider: 'banco', currency: 'EUR', opening_balance: 2480.35, opening_date: '2026-08-01', sort_order: 0, active: true },
  { id: 'c2', name: 'Revolut', provider: 'revolut', currency: 'EUR', opening_balance: 620, opening_date: '2026-08-01', sort_order: 1, active: true },
  { id: 'c3', name: 'Efectivo', provider: 'efectivo', currency: 'EUR', opening_balance: 85, opening_date: '2026-08-01', sort_order: 2, active: true },
];

const FIJOS: Fijo[] = [
  { id: 'f1', account_id: 'c1', kind: 'ingreso', name: 'Nómina', amount: 2150, day_of_month: 1, category: 'ingreso_nomina', user_category_id: null, start_date: '2026-08-01', end_date: null, active: true, generated_through: '2026-10' },
  { id: 'f2', account_id: 'c1', kind: 'gasto', name: 'Alquiler', amount: 750, day_of_month: 3, category: 'vivienda', user_category_id: null, start_date: '2026-08-01', end_date: null, active: true, generated_through: '2026-10' },
  { id: 'f3', account_id: 'c2', kind: 'gasto', name: 'Spotify', amount: 10.99, day_of_month: 12, category: 'suscripciones', user_category_id: null, start_date: '2026-08-01', end_date: null, active: true, generated_through: '2026-10' },
  { id: 'f4', account_id: 'c1', kind: 'gasto', name: 'Gimnasio', amount: 39.9, day_of_month: 28, category: 'gimnasio', user_category_id: null, start_date: '2026-08-01', end_date: null, active: true, generated_through: '2026-09' },
];

const PROPIAS: CategoriaPropia[] = [{ id: 'k1', name: 'Mascota', kind: 'gasto', base_category: 'otros', active: true }];

let n = 0;
function mov(date: string, amount: number, description: string, category: string, account_id = 'c1', extra: Partial<MovWork> = {}): MovWork {
  n += 1;
  return { id: `d${n}`, date, amount, description, counterparty: description, category, is_internal: false, account_id, ...extra };
}

function mes(m: string, k: number): MovWork[] {
  return [
    mov(`${m}-01`, 2150, 'Nómina', 'ingreso_nomina', 'c1', { recurring_id: 'f1' }),
    mov(`${m}-03`, -750, 'Alquiler', 'vivienda', 'c1', { recurring_id: 'f2' }),
    mov(`${m}-12`, -10.99, 'Spotify', 'suscripciones', 'c2', { recurring_id: 'f3' }),
    mov(`${m}-28`, -39.9, 'Gimnasio', 'gimnasio', 'c1', { recurring_id: 'f4' }),
    mov(`${m}-06`, -142.6 + k, 'Mercadona', 'super'),
    mov(`${m}-14`, -64.3, 'Cena con amigos', 'restaurante', 'c2'),
    mov(`${m}-18`, -48, 'Renfe', 'transporte'),
    mov(`${m}-20`, -62.3, 'Iberdrola', 'suministros'),
    mov(`${m}-24`, -35, 'Cine y palomitas', 'ocio', 'c2'),
  ];
}

const MOVS: MovWork[] = [
  mov('2026-10-01', 2150, 'Nómina', 'ingreso_nomina', 'c1', { recurring_id: 'f1' }),
  mov('2026-10-03', -750, 'Alquiler', 'vivienda', 'c1', { recurring_id: 'f2' }),
  mov('2026-10-12', -10.99, 'Spotify', 'suscripciones', 'c2', { recurring_id: 'f3' }),
  mov('2026-10-05', -186.4, 'Mercadona', 'super'),
  mov('2026-10-09', -92.5, 'Restaurante La Tasca', 'restaurante', 'c2'),
  mov('2026-10-11', -54.2, 'Gasolinera Repsol', 'transporte'),
  mov('2026-10-15', -38, 'Pienso y veterinario', 'otros', 'c3', { user_category_id: 'k1' }),
  mov('2026-10-18', -300, 'Al bolsillo de ahorro', 'transferencia', 'c1', { is_internal: true, transfer_id: 't1' }),
  mov('2026-10-18', 300, 'Al bolsillo de ahorro', 'transferencia', 'c2', { is_internal: true, transfer_id: 't1' }),
  mov('2026-10-19', -24.9, 'Libro de Python', 'formacion', 'c2'),
  mov('2026-10-20', -3.2, 'Café', 'restaurante', 'c3'),
  ...mes('2026-09', 30),
  ...mes('2026-08', 0),
];

const ENTRADA: EntradaWork = { cuentas: CUENTAS, movs: MOVS, fijos: FIJOS, categorias: PROPIAS };

const BRIEF_TEXTO =
  'En septiembre se fue sobre todo en casa (812 €) y en comida (207 €). Gastaste un 2 % más que en agosto, casi todo por el súper.\n' +
  'Tus fijos se llevan el 37 % de lo que entra: es sano, pero revisa si Spotify y el gimnasio siguen mereciendo la pena.\n' +
  'Para octubre: separa el día 1 lo de los fijos en Ibercaja y pon un tope de 180 € a comer fuera. Apunta el efectivo el mismo día, que es lo que más se escapa.\n\n' +
  'Esto no es asesoramiento financiero.';

export const ACCIONES_DEMO: AccionesWork = {
  onRefrescar: nada,
  onReintentar: nada,
  onGasto: nada,
  onIngreso: nada,
  onTransferir: nada,
  onNuevaCuenta: nada,
  onCuenta: nada,
  onNuevoFijo: nada,
  onFijo: nada,
  onMovimiento: nada,
  onBrief: nada,
  onImportar: nada,
  onCategorias: nada,
  onCoach: nada,
  onOlvidarAviso: nada,
};

function Emblema() {
  return (
    <View style={styles.emblema}>
      <GlifoModo modo="work" tamano={22} color={ACENTO} />
    </View>
  );
}

export const CABECERA_DEMO = (
  <CabeceraMundo modo="work" nivel={{ modo: 'work', xp: 6400, nivel: 11, xpEnNivel: 1700, xpSiguiente: 2800 }} emblema={<Emblema />} />
);

function vista(cambios: Partial<WorkEconomiaVistaProps> = {}, entrada: EntradaWork = ENTRADA, brief: { texto: string | null; estado: EstadoBrief } = { texto: BRIEF_TEXTO, estado: 'listo' }): WorkEconomiaVistaProps {
  return {
    cabecera: CABECERA_DEMO,
    estado: 'listo',
    error: null,
    refrescando: false,
    hoy: HOY_DEMO,
    datos: derivarWork(entrada, HOY_DEMO, brief),
    aviso: null,
    acciones: ACCIONES_DEMO,
    ...cambios,
  };
}

const CUENTAS_HOJA: CuentaElegible[] = derivarWork(ENTRADA, HOY_DEMO, { texto: null, estado: 'sin_texto' }).vista.cuentas.map((c) => ({
  id: c.id,
  nombre: c.nombre,
  tipo: c.tipo,
  saldo: c.saldo,
}));

const CSV_DEMO = [
  'Fecha operación;Fecha valor;Concepto;Importe;Saldo',
  '20/10/2026;20/10/2026;COMPRA TARJ. MERCADONA 4471;-58,40;2.410,10',
  '19/10/2026;19/10/2026;BIZUM DE LUCIA M;25,00;2.468,50',
  '17/10/2026;17/10/2026;RECIBO IBERDROLA CLIENTES;-61,90;2.443,50',
  '15/10/2026;15/10/2026;NETFLIX.COM;-12,99;2.505,40',
  '13/10/2026;13/10/2026;CAFETERIA EL PUNTO;-3,20;2.518,39',
  '11/10/2026;11/10/2026;REPSOL E.S. 2231;-54,20;2.521,59',
  '05/10/2026;05/10/2026;COMPRA TARJ. MERCADONA 4471;-186,40;2.575,79',
  '03/10/2026;03/10/2026;TRANSF. ALQUILER OCTUBRE;-750,00;2.762,19',
].join('\n');

function filasRevision(): FilaRevision[] {
  const lectura = leerExtractoCsv(CSV_DEMO);
  return proponerImportacion(lectura.filas, 'Ibercaja', [], [
    { date: '2026-10-05', amount: -186.4, dedup_hash: 'Ibercaja|2026-10-05|-186.40|compra tarj. mercadona 4471', source: 'extracto' },
    { date: '2026-10-11', amount: -54.2, dedup_hash: 'app|x', source: 'manual' },
    { date: '2026-10-13', amount: -3.2, dedup_hash: 'app|y', source: 'manual' },
  ]).map((f) => ({ ...f, marcada: f.estado === 'nuevo', propia: null }));
}

export interface EstadoWorkDemo {
  id: string;
  titulo: string;
  render: () => ReactElement;
}

export const ESTADOS_WORK: EstadoWorkDemo[] = [
  { id: 'general', titulo: 'Mes en curso con brief', render: () => <WorkEconomiaVista {...vista()} /> },
  {
    id: 'brief-cifras',
    titulo: 'Brief sin IA (sin Pro)',
    render: () => <WorkEconomiaVista {...vista({ aviso: '1 fijo apuntado al día de hoy.' }, ENTRADA, { texto: null, estado: 'sin_pro' })} />,
  },
  {
    id: 'primera',
    titulo: 'Sin cuentas todavía',
    render: () => <WorkEconomiaVista {...vista({}, { cuentas: [], movs: [], fijos: [], categorias: [] })} />,
  },
  { id: 'preparando', titulo: 'Sin la 0075 (estado vacío)', render: () => <WorkEconomiaVista {...vista({ estado: 'no_disponible', datos: null })} /> },
  { id: 'cargando', titulo: 'Cargando', render: () => <WorkEconomiaVista {...vista({ estado: 'cargando', datos: null })} /> },
  {
    id: 'hoja-gasto',
    titulo: 'Hoja · gasto en dos toques',
    render: () => (
      <>
        <WorkEconomiaVista {...vista()} />
        <HojaMovimiento
          tipo="gasto"
          importe="12,50"
          concepto=""
          cuentas={CUENTAS_HOJA}
          cuenta="c3"
          propias={PROPIAS}
          guardando={false}
          errorImporte={null}
          error={null}
          onTipo={nada}
          onImporte={nada}
          onConcepto={nada}
          onCuenta={nada}
          onCategoria={nada}
          onCerrar={nada}
        />
      </>
    ),
  },
  {
    id: 'hoja-transferencia',
    titulo: 'Hoja · transferencia',
    render: () => (
      <>
        <WorkEconomiaVista {...vista()} />
        <HojaTransferencia
          visible
          cuentas={CUENTAS_HOJA}
          origen="c1"
          destino="c2"
          importe="300"
          concepto=""
          guardando={false}
          errorImporte={null}
          error={null}
          onOrigen={nada}
          onDestino={nada}
          onImporte={nada}
          onConcepto={nada}
          onGuardar={nada}
          onCerrar={nada}
        />
      </>
    ),
  },
  {
    id: 'hoja-cuenta',
    titulo: 'Hoja · cuenta con saldo inicial',
    render: () => (
      <>
        <WorkEconomiaVista {...vista({}, { cuentas: [], movs: [], fijos: [], categorias: [] })} />
        <HojaCuenta
          visible
          editando={false}
          nombre="Ibercaja"
          tipo="banco"
          saldo="2.480,35"
          guardando={false}
          errorNombre={null}
          errorSaldo={null}
          error={null}
          onNombre={nada}
          onTipo={nada}
          onSaldo={nada}
          onGuardar={nada}
          onCerrar={nada}
        />
      </>
    ),
  },
  {
    id: 'hoja-fijo',
    titulo: 'Hoja · ingreso mensual',
    render: () => (
      <>
        <WorkEconomiaVista {...vista()} />
        <HojaFijo
          tipo="ingreso"
          nombre="Nómina"
          importe="2.150"
          dia="1"
          cuentas={CUENTAS_HOJA}
          cuenta="c1"
          grupo="casa"
          esteMes
          guardando={false}
          errorNombre={null}
          errorImporte={null}
          errorDia={null}
          error={null}
          onNombre={nada}
          onImporte={nada}
          onDia={nada}
          onCuenta={nada}
          onGrupo={nada}
          onEsteMes={nada}
          onGuardar={nada}
          onCerrar={nada}
        />
      </>
    ),
  },
  {
    id: 'hoja-importar',
    titulo: 'Hoja · importar extracto',
    render: () => (
      <>
        <WorkEconomiaVista {...vista()} />
        <HojaImportar visible cuentas={CUENTAS_HOJA} cuenta="c1" puedeElegir leyendo={false} error={null} onCuenta={nada} onElegir={nada} onCerrar={nada} />
      </>
    ),
  },
  {
    id: 'revision',
    titulo: 'Revisión del extracto',
    render: () => (
      <RevisionExtractoVista
        archivo="movimientos_octubre.csv"
        cuenta="Ibercaja"
        filas={filasRevision()}
        descartadas={1}
        guardando={false}
        error={null}
        propias={PROPIAS}
        onAlternar={nada}
        onCategoria={nada}
        onTodas={nada}
        onGuardar={nada}
        onCancelar={nada}
      />
    ),
  },
];

const styles = StyleSheet.create({
  emblema: {
    width: 44,
    height: 44,
    borderRadius: RADIO_BOTON,
    borderWidth: 1.5,
    borderColor: ACENTO,
    backgroundColor: tinte(0.08, ACENTO),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
