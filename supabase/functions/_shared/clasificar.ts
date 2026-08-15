// NIVL · Clasificar movimientos sin gastar un turno del coach.
//
// Decir si "MERCADONA 4471" es supermercado no requiere criterio: requiere
// leer. Es exactamente el trabajo de Haiku, y hacerlo con el coach cuesta unas
// cien veces más por dos motivos que se suman: la tarifa del modelo, y que el
// coach arrastra 50.000 fichas de contexto (dossier, doctrina, estudios) para
// responder algo que cabe en una línea.
//
// Aquí no se manda nada de eso. Solo la lista de conceptos y el catálogo de
// categorías. Un extracto entero de sesenta movimientos sale por céntimas.
//
// Lo que este módulo NO hace: decidir si un gasto está bien o mal, si toca
// recortar o qué presupuesto poner. Eso es criterio y es del coach.

import { callClaude, CHEAP_MODEL, type Usage } from './anthropic.ts';
import type { Db } from './db.ts';

const CATEGORIAS = [
  'ingreso_negocio', 'ingreso_nomina', 'ingreso_otro',
  'vivienda', 'suministros', 'super', 'restaurante', 'transporte', 'salud',
  'gimnasio', 'suscripciones', 'ocio', 'ropa', 'formacion', 'negocio',
  'impuestos', 'comisiones', 'ahorro', 'inversion', 'transferencia', 'otros',
];

const SISTEMA = `Clasificas movimientos bancarios españoles. Nada más.

Recibes una lista numerada de conceptos con su importe. Devuelves UNA línea por movimiento con el formato exacto:

N|categoria

Categorías admitidas, y ninguna otra:
${CATEGORIAS.join(', ')}

Reglas:
- El importe positivo es dinero que ENTRA: solo puede ser ingreso_negocio, ingreso_nomina, ingreso_otro, o transferencia si es traspaso entre cuentas propias.
- El importe negativo es dinero que SALE: cualquiera de las demás.
- Si el concepto no te dice de verdad lo que es, pon otros. No adivines: una categoría inventada ensucia el presupuesto más que un "otros" honesto.
- Ni una palabra fuera de las líneas N|categoria. Sin explicaciones, sin encabezados, sin markdown.`;

interface Fila {
  id: string;
  date: string;
  amount: number;
  description: string;
  counterparty: string | null;
}

export interface ResultadoClasificacion {
  revisados: number;
  clasificados: number;
  usage: Usage;
  model: string;
  resumen: string;
}

export async function clasificarPendientes(
  sb: Db,
  userId: string,
  tope = 60,
): Promise<ResultadoClasificacion> {
  const { data, error } = await sb
    .from('transactions')
    .select('id, date, amount, description, counterparty')
    .eq('user_id', userId)
    .eq('category', 'sin_clasificar')
    .order('date', { ascending: false })
    .limit(tope);
  if (error) throw error;

  const filas = (data ?? []) as Fila[];
  if (!filas.length) {
    return {
      revisados: 0,
      clasificados: 0,
      usage: {},
      model: CHEAP_MODEL,
      resumen: 'No hay movimientos sin clasificar.',
    };
  }

  const lista = filas
    .map((f, i) => `${i + 1}. ${Number(f.amount).toFixed(2)} € — ${f.counterparty ?? f.description}`)
    .join('\n');

  const turn = await callClaude({
    model: CHEAP_MODEL,
    system: [{ type: 'text', text: SISTEMA }],
    messages: [{ role: 'user', content: [{ type: 'text', text: lista }] }],
    maxTokens: 2000,
    effort: 'low',
  });

  const texto = turn.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');

  // Se parsea con tolerancia: si el modelo se sale del formato en una línea,
  // esa se descarta y las demás siguen valiendo. Un fallo de forma no puede
  // tumbar la clasificación entera.
  const porIndice = new Map<number, string>();
  for (const linea of texto.split('\n')) {
    const m = /^\s*(\d+)\s*\|\s*([a-z_]+)\s*$/.exec(linea);
    if (!m) continue;
    const idx = Number(m[1]);
    const cat = m[2]!;
    if (!CATEGORIAS.includes(cat)) continue;
    if (idx < 1 || idx > filas.length) continue;
    porIndice.set(idx, cat);
  }

  // Coherencia de signo. El modelo puede colocar una devolución de Amazon como
  // 'ocio' con importe positivo, y entonces ese ingreso desaparecería del
  // cálculo de lo que entra. El signo lo sabe el dato, no hace falta creerle.
  const INGRESOS = ['ingreso_negocio', 'ingreso_nomina', 'ingreso_otro', 'transferencia'];
  let clasificados = 0;
  const cuenta = new Map<string, number>();

  for (const [idx, cat] of porIndice) {
    const fila = filas[idx - 1]!;
    const entra = Number(fila.amount) >= 0;
    const final = entra && !INGRESOS.includes(cat) ? 'ingreso_otro' : cat;

    const { error: e } = await sb
      .from('transactions')
      .update({ category: final })
      .eq('id', fila.id)
      .eq('user_id', userId);
    if (e) continue;
    clasificados++;
    cuenta.set(final, (cuenta.get(final) ?? 0) + 1);
  }

  const detalle = [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${c} ${n}`)
    .join(' · ');

  return {
    revisados: filas.length,
    clasificados,
    usage: turn.usage,
    model: turn.model,
    resumen: clasificados
      ? `${clasificados} de ${filas.length} movimientos clasificados: ${detalle}.`
      : `Ninguno de los ${filas.length} pendientes se pudo clasificar.`,
  };
}
