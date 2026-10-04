// NIVL · Administración del programa de creadores (local, solo el dueño).
//
// No hay pantalla de admin a propósito: así ningún dato de creadores pasa por
// el repo (que es público) ni por una interfaz expuesta. Este script habla con
// la base por la Management API, igual que apply-migrations.mjs, con el mismo
// token (supabase-token.txt, gitignorado, o SUPABASE_ACCESS_TOKEN).
//
// Uso:
//   node scripts/creadores.mjs lista
//   node scripts/creadores.mjs alta CODIGO "alias" [novato|pro|elite]
//   node scripts/creadores.mjs vincular CODIGO email
//   node scripts/creadores.mjs rango CODIGO novato|pro|elite
//   node scripts/creadores.mjs fijo CODIGO euros
//   node scripts/creadores.mjs activo CODIGO si|no
//   node scripts/creadores.mjs premio "texto"        (premio --quitar para borrarlo)
//   node scripts/creadores.mjs sbp si|no              (Small Business Program de Apple)
//   node scripts/creadores.mjs informe [AAAA-MM] [--csv]
//   node scripts/creadores.mjs liquidar CODIGO ["nota"]
//   node scripts/creadores.mjs pago CODIGO euros fijo_mensual|premio|contenido_externo|ajuste ["nota"] [--mes AAAA-MM]
//   node scripts/creadores.mjs rol CODIGO creador|comercial|clipper
//   node scripts/creadores.mjs reto lista
//   node scripts/creadores.mjs reto alta "título" AAAA-MM-DD AAAA-MM-DD objetivo ["premio"] [--rol clipper] [--desc "texto"]
//   node scripts/creadores.mjs reto cerrar ID
//   node scripts/creadores.mjs umbral pro|elite ventas90 [meses]   (umbral RANGO --quitar para borrarlo)
//   node scripts/creadores.mjs revisar-rangos [--aplicar --confirmar] [--solo CODIGO,CODIGO]
//
// rol, reto, umbral y revisar-rangos (y la columna rol de lista e informe)
// necesitan la 0046. `revisar-rangos` solo PROPONE: subir de rango sube la
// comisión y eso lo decide el dueño. Con `--aplicar` no cambia nada si no va
// también `--confirmar`; con `--solo` aplica únicamente esos códigos.
//
// `liquidar` enseña la vista previa y, al confirmar, apunta SOLO si la base
// sigue teniendo exactamente las mismas comisiones y descuentos: si algo cambió
// entre medias, no apunta nada y hay que volver a lanzarlo.
//
// Los exportes (--csv) van a privado/, que está gitignorado. Nunca pegues la
// salida de este script en un commit, un issue ni una captura.
//
// La transferencia real la haces tú fuera (banco, Whop…): `liquidar` y `pago`
// solo la APUNTAN en creator_payouts para que el panel del creador cuadre.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { missingTokenMessage, readToken } from './token.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PRIVADO = join(ROOT, 'privado');

function readEnv() {
  const out = {};
  try {
    for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch {
    /* sin .env */
  }
  return out;
}

const env = readEnv();
const URL_SB = process.env.EXPO_PUBLIC_SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const REF = URL_SB.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

function fallo(msg) {
  console.error(msg);
  process.exit(1);
}

async function sql(query) {
  const token = readToken(ROOT);
  if (!REF) fallo('No se pudo deducir el project ref de EXPO_PUBLIC_SUPABASE_URL.');
  if (!token) fallo(missingTokenMessage(ROOT));
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 600)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ── Validación y literales ──────────────────────────────────────────
// Todo lo que entra en el SQL pasa por aquí: o se valida contra un patrón
// cerrado, o va como literal con las comillas escapadas.

/** Literal de texto SQL. */
function q(v) {
  const s = String(v);
  if (s.includes('\u0000')) fallo('Texto con caracteres no válidos.');
  return `'${s.replace(/'/g, "''")}'`;
}

const RANGOS = ['novato', 'pro', 'elite'];
const ROLES = ['creador', 'comercial', 'clipper'];
const TIPOS_PAGO = ['fijo_mensual', 'premio', 'contenido_externo', 'ajuste'];

function codigo(raw) {
  const c = String(raw ?? '').replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z0-9_]{3,20}$/.test(c)) fallo(`Código no válido: «${raw ?? ''}». De 3 a 20 letras, números o _.`);
  return c;
}

function rango(raw) {
  const r = String(raw ?? '').toLowerCase().replace('é', 'e');
  if (!RANGOS.includes(r)) fallo(`Rango no válido: «${raw ?? ''}». Usa ${RANGOS.join(' | ')}.`);
  return r;
}

/** "12,50" o "12.50" → 1250. `negativo` solo para ajustes. */
function centimos(raw, { negativo = false } = {}) {
  const s = String(raw ?? '').trim().replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) fallo(`Importe no válido: «${raw ?? ''}». Ejemplo: 25 o 12,50.`);
  const c = Math.round(Number(s) * 100);
  if (c < 0 && !negativo) fallo('El importe no puede ser negativo aquí.');
  if (Math.abs(c) > 10_000_000) fallo('Importe fuera de rango.');
  return c;
}

function siNo(raw) {
  const s = String(raw ?? '').toLowerCase();
  if (['si', 'sí', 'true', 'on', '1'].includes(s)) return true;
  if (['no', 'false', 'off', '0'].includes(s)) return false;
  return fallo(`Usa si | no (recibido «${raw ?? ''}»).`);
}

function mesActualMadrid() {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' })
    .formatToParts(new Date());
  const y = partes.find((p) => p.type === 'year')?.value;
  const m = partes.find((p) => p.type === 'month')?.value;
  return `${y}-${m}`;
}

const eur = (cents) => `${(Number(cents ?? 0) / 100).toFixed(2).replace('.', ',')} €`;

/**
 * Ficha retirada al borrar la cuenta (0056): inactiva, sin cuenta y con el
 * alias anonimizado. Decisión del dueño (04/10/2026, condiciones §7): su saldo
 * pendiente se pierde; la contabilidad se conserva sin derecho a cobro.
 */
export const ALIAS_RETIRADO = 'Creador retirado';
export function fichaRetirada(cr) {
  return !!cr && cr.active === false && !cr.vinculado && cr.alias === ALIAS_RETIRADO;
}
export const AVISO_RETIRADA =
  'Ficha retirada por borrado de cuenta: según las condiciones (§7), su saldo pendiente se pierde y no se liquida. ' +
  'La contabilidad se conserva, pero no se apunta ningún pago.';

async function creadorPorCodigo(c) {
  const [row] = await sql(
    `select id, code, alias, rank, active, monthly_fixed_cents, user_id is not null as vinculado, user_id
     from public.creators where code = ${q(c)};`,
  );
  if (!row) fallo(`No hay ningún creador con el código ${c}.`);
  return row;
}

async function confirmar(pregunta, esperado) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const r = (await rl.question(`${pregunta} Escribe ${esperado} para confirmar: `)).trim();
  rl.close();
  return r === esperado;
}

// ── Comandos ────────────────────────────────────────────────────────

export const SQL_LISTA = `select c.code, c.alias, c.role as rol, c.rank, c.active as activo, c.user_id is not null as vinculado,
            c.monthly_fixed_cents as fijo,
            (select count(*) from public.referrals r where r.creator_id = c.id)::int as cuentas
     from public.creators c order by c.active desc, c.created_at;`;

async function lista() {
  const rows = await sql(SQL_LISTA);
  if (!rows.length) return console.log('Aún no hay creadores. Da de alta uno con: alta CODIGO "alias" [rango]');
  console.table(rows.map((r) => ({ ...r, fijo: eur(r.fijo) })));
}

async function alta(rawCode, alias, rawRango = 'novato') {
  const c = codigo(rawCode);
  const a = String(alias ?? '').trim();
  if (!a || a.length > 40) fallo('El alias va entre comillas y tiene de 1 a 40 caracteres.');
  const r = rango(rawRango);
  const res = await sql(
    `insert into public.creators (code, alias, rank) values (${q(c)}, ${q(a)}, ${q(r)})
     on conflict (code) do nothing returning code;`,
  );
  if (!res.length) fallo(`El código ${c} ya existe.`);
  console.log(`Alta: ${c} · ${a} · creador ${r}. Enlace: https://nivl.app/c/${c}`);
  console.log('Para que vea su panel en la app: vincular CODIGO email-de-su-cuenta');
}

/** La cuenta de ese email y, si ya es de un creador, su código (user_id es único). */
export function sqlCuentaParaVincular(email) {
  return `select u.id::text as id, (select code from public.creators where user_id = u.id) as otro
     from auth.users u where lower(u.email) = ${q(String(email).trim().toLowerCase())} limit 1;`;
}

async function vincular(rawCode, email) {
  const c = codigo(rawCode);
  const e = String(email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fallo('Email no válido.');
  const cr = await creadorPorCodigo(c);
  // Antes de escribir: la cuenta existe y no es ya de otro creador (user_id es único).
  const [u] = await sql(sqlCuentaParaVincular(e));
  if (!u) fallo('No se ha vinculado: esa cuenta no ha entrado nunca en NIVL. Pídele que abra la app y entre, y repite.');
  if (u.otro === c) return console.log(`${c} ya estaba vinculado a esa cuenta. No se ha cambiado nada.`);
  if (u.otro) {
    fallo(
      `No se ha vinculado: esa cuenta ya está vinculada al creador ${u.otro}. Una cuenta solo puede tener un panel ` +
        'y no hay comando para desvincular: vincula a ese otro creador una cuenta distinta antes, o usa otra cuenta aquí.',
    );
  }
  if (cr.vinculado) {
    console.log(`${c} ya tiene otra cuenta vinculada. Si sigues, la nueva la sustituye y la anterior deja de ver el panel.`);
    if (!(await confirmar('¿Sustituir la cuenta vinculada?', c))) return console.log('Cancelado. No se ha cambiado nada.');
  }
  const res = await sql(
    `update public.creators set user_id = ${q(u.id)}
     where code = ${q(c)} and not exists (select 1 from public.creators where user_id = ${q(u.id)})
     returning code;`,
  );
  if (!res.length) fallo('No se ha vinculado: la cuenta acaba de vincularse a otro creador. Mira la lista y repite.');
  console.log(`${c} vinculado a su cuenta. Verá "Panel de creador" en Perfil.`);
}

async function cambiarRango(rawCode, rawRango) {
  const c = codigo(rawCode);
  const r = rango(rawRango);
  const res = await sql(`update public.creators set rank = ${q(r)} where code = ${q(c)} returning code;`);
  if (!res.length) fallo(`No hay ningún creador con el código ${c}.`);
  console.log(`${c} ahora es creador ${r}. Las comisiones ya generadas conservan su % (foto del cobro).`);
}

async function fijo(rawCode, euros) {
  const c = codigo(rawCode);
  const cents = centimos(euros);
  const cr = await creadorPorCodigo(c);
  if (cents > 0) {
    console.log(AVISO_FIJO);
    if (!(await confirmar(`¿Enseñar a ${cr.code} un fijo mensual de ${eur(cents)}?`, cr.code))) {
      return console.log('Cancelado. No se ha cambiado nada.');
    }
  }
  const res = await sql(`update public.creators set monthly_fixed_cents = ${cents} where code = ${q(c)} returning code;`);
  if (!res.length) fallo(`No hay ningún creador con el código ${c}.`);
  console.log(`${c}: fijo mensual ${eur(cents)}. Se apunta al pagarlo, con: pago ${c} ${euros} fijo_mensual`);
}

export const AVISO_FIJO =
  'Ojo: las condiciones publicadas dicen que hoy NO hay fijo mensual. Pon uno solo si lo has firmado por escrito ' +
  'con este creador. Fijarlo lo enseña en su panel; no lo paga (eso es pago … fijo_mensual).';
export const AVISO_PREMIO =
  'Ojo: las condiciones publicadas dicen que hoy NO hay convocatoria de premios activa. Pon un premio solo si antes ' +
  'has publicado sus bases (plazo, quién participa, desempate, premio concreto, entrega). Se ve en el panel de todos.';
export const AVISO_DESACTIVAR = [
  'Desactivar tiene estas consecuencias (según el código de la 0025 y la 0046):',
  '  · Deja de ver su panel en la app (todas las RPC del creador piden que esté activo).',
  '  · Su código deja de aceptarse: ninguna cuenta nueva se le puede atribuir mientras esté inactivo.',
  '  · Los cobros de sus cuentas MIENTRAS esté inactivo no le generan comisión, ni ahora ni al reactivarlo',
  '    (record_sale guarda la venta sin creador y no se recalcula). Si lo reactivas, los cobros posteriores sí.',
  '  · Lo ya generado sigue: la retención madura igual y liquidar funciona con él desactivado.',
].join('\n');

async function activo(rawCode, valor) {
  const c = codigo(rawCode);
  const on = siNo(valor);
  const cr = await creadorPorCodigo(c);
  if (cr.active === on) return console.log(`${c} ya estaba ${on ? 'activo' : 'desactivado'}. No se ha cambiado nada.`);
  if (!on) {
    const [deuda] = await sql(
      `select coalesce(sum(amount_cents) filter (where available_at > now()), 0)::int as retencion,
              coalesce(sum(amount_cents) filter (where available_at <= now()), 0)::int as disponible
       from public.commissions where creator_id = ${q(cr.id)} and status = 'pendiente';`,
    );
    console.log(AVISO_DESACTIVAR);
    console.log(`  · Ahora mismo: ${eur(deuda?.disponible)} disponibles y ${eur(deuda?.retencion)} en retención.`);
    if (!(await confirmar(`\n¿Desactivar a ${cr.code}?`, cr.code))) return console.log('Cancelado. No se ha cambiado nada.');
  }
  const res = await sql(`update public.creators set active = ${on} where code = ${q(c)} returning code;`);
  if (!res.length) fallo(`No hay ningún creador con el código ${c}.`);
  console.log(
    on
      ? `${c} activo. Vuelve a ver su panel y su código se acepta; los cobros de mientras estuvo inactivo no se recuperan.`
      : `${c} desactivado. Recuerda liquidar lo que tenga disponible y lo que madure en los próximos meses.`,
  );
}

async function premio(texto) {
  if (texto === '--quitar') {
    await sql('update public.creator_settings set prize_text = null;');
    return console.log('Premio quitado del panel.');
  }
  const t = String(texto ?? '').trim();
  if (!t || t.length > 200) fallo('El premio va entre comillas y tiene de 1 a 200 caracteres.');
  console.log(AVISO_PREMIO);
  if (!(await confirmar('¿Publicar este premio en el panel de todos los creadores?', 'PREMIO'))) {
    return console.log('Cancelado. No se ha cambiado nada.');
  }
  await sql(`update public.creator_settings set prize_text = ${q(t)};`);
  console.log('Premio del mes actualizado en el panel de los creadores.');
}

async function sbp(valor) {
  const on = siNo(valor);
  await sql(`update public.creator_settings set small_business_program = ${on};`);
  console.log(
    on
      ? 'Small Business Program: SÍ. Neto al 15 % y sin tope de % en Pro anual.'
      : 'Small Business Program: NO. Neto al 30 % y Pro anual limitado a 35 %.',
  );
}

/** Resumen por creador del mes AAAA-MM (hora de Madrid); el mes ya validado. */
export function sqlInforme(mes) {
  const desde = `(${q(`${mes}-01`)}::timestamp at time zone 'Europe/Madrid')`;
  const hasta = `((${q(`${mes}-01`)}::timestamp + interval '1 month') at time zone 'Europe/Madrid')`;

  return `select c.code, c.alias, c.role as rol, c.rank, c.active,
       (select count(*) from public.referrals r where r.creator_id = c.id)::int as cuentas,
       (select count(*) from public.referrals r where r.creator_id = c.id
          and r.created_at >= ${desde} and r.created_at < ${hasta})::int as cuentas_mes,
       (select count(distinct s.user_id) from public.commissions k join public.store_sales s on s.id = k.sale_id
          where k.creator_id = c.id and k.status <> 'anulada' and s.payment_number = 1
            and s.purchased_at >= ${desde} and s.purchased_at < ${hasta})::int as ventas_mes,
       (select coalesce(sum(k.amount_cents), 0) from public.commissions k join public.store_sales s on s.id = k.sale_id
          where k.creator_id = c.id and k.status <> 'anulada'
            and s.purchased_at >= ${desde} and s.purchased_at < ${hasta})::int as generado_mes,
       (select coalesce(sum(amount_cents), 0) from public.commissions
          where creator_id = c.id and status = 'pendiente' and available_at > now())::int as retencion,
       (select coalesce(sum(amount_cents), 0) from public.commissions
          where creator_id = c.id and status = 'pendiente' and available_at <= now())::int as disponible,
       (select coalesce(sum(amount_cents), 0) from public.commissions
          where creator_id = c.id and clawback and clawback_settled_at is null)::int as clawback,
       (select coalesce(sum(amount_cents), 0) from public.creator_payouts p
          where p.creator_id = c.id and p.paid_at >= ${desde} and p.paid_at < ${hasta})::int as pagado_mes,
       (select coalesce(sum(amount_cents), 0) from public.creator_payouts p where p.creator_id = c.id)::int as pagado_total,
       c.monthly_fixed_cents as fijo
     from public.creators c
     order by ventas_mes desc, c.alias;`;
}

async function informe(...args) {
  const csv = args.includes('--csv');
  const mes = args.find((a) => a !== '--csv') ?? mesActualMadrid();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) fallo('El mes va como AAAA-MM.');
  const rows = await sql(sqlInforme(mes));
  const [ajustes] = await sql(
    'select small_business_program, hold_days, renewal_pct, claim_window_days, prize_text from public.creator_settings;',
  );

  console.log(`Informe de creadores · ${mes} (hora de Madrid)`);
  console.log(
    `SBP: ${ajustes?.small_business_program ? 'sí' : 'no'} · retención ${ajustes?.hold_days} días · ` +
      `renovación ${ajustes?.renewal_pct} % · plazo del código ${ajustes?.claim_window_days} días`,
  );
  if (!rows.length) return console.log('Aún no hay creadores.');
  const dinero = ['generado_mes', 'retencion', 'disponible', 'clawback', 'pagado_mes', 'pagado_total', 'fijo'];
  console.table(
    rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, dinero.includes(k) ? eur(v) : v]))),
  );

  if (csv) {
    mkdirSync(PRIVADO, { recursive: true });
    const cols = Object.keys(rows[0]);
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const out = [cols.join(';'), ...rows.map((r) => cols.map((k) => esc(r[k])).join(';'))].join('\n');
    const file = join(PRIVADO, `creadores-${mes}.csv`);
    writeFileSync(file, out, 'utf8');
    console.log(`\nExportado a ${file} (céntimos; privado/ está gitignorado).`);
  }
}

async function liquidar(rawCode, nota) {
  const c = codigo(rawCode);
  const cr = await creadorPorCodigo(c);
  if (fichaRetirada(cr)) fallo(AVISO_RETIRADA);
  const [detalle, [claw]] = [await sql(sqlDetalleLiquidacion(cr.id)), await sql(sqlFotoDescuentos(cr.id))];
  const foto = fotoLiquidacion(detalle, claw);

  console.log(`Liquidación de ${cr.code} · ${cr.alias} (creador ${cr.rank})`);
  if (detalle.length) {
    console.table(detalle.map(({ id, ...r }) => ({ ...r, amount_cents: eur(r.amount_cents) })));
  }
  console.log(`Disponible:  ${eur(foto.disponible)} (${foto.n} comisiones fuera de retención)`);
  console.log(`A descontar: ${eur(foto.descuento)} (${foto.nDescuentos} reembolsos de comisiones ya pagadas)`);
  console.log(`A pagar:     ${eur(Math.max(foto.aPagar, 0))}`);
  if (foto.aPagar <= 0) return console.log('\nNada que liquidar ahora.');

  if (!(await confirmar(`\n¿Apuntar el pago de ${eur(foto.aPagar)} a ${cr.code}? La transferencia la haces tú.`, cr.code))) {
    return console.log('Cancelado. No se ha apuntado nada.');
  }
  const nt = nota ? String(nota).slice(0, 280) : null;
  // Una sola sentencia: liquidate_creator solo se llama si la base sigue teniendo
  // EXACTAMENTE las comisiones y descuentos de la vista previa (dentro de una
  // sentencia now() no avanza, así que nada madura entre la comprobación y el apunte).
  const res = await sql(sqlLiquidarSiIgual(cr.id, foto, nt));
  const r = leerResultado(res);
  if (!r) {
    fallo(
      '\nNo se ha apuntado nada: desde la vista previa ha cambiado algo (una comisión maduró, llegó un reembolso ' +
        'u otra liquidación se adelantó). Vuelve a lanzar liquidar y revisa la cifra nueva.',
    );
  }
  if (!r.ok) return console.log('La base no ha apuntado nada (no hay importe positivo que pagar):', r);
  if (Number(r.amount) !== foto.aPagar) {
    // No debería pasar con la comprobación de arriba; si pasa, manda lo apuntado.
    console.log(`\nATENCIÓN: la base ha apuntado ${eur(r.amount)}, distinto de los ${eur(foto.aPagar)} de la vista previa.`);
    console.log(`Transfiere ${eur(r.amount)}, que es lo que ve el creador como cobrado, y revisa el informe.`);
    return;
  }
  console.log(`Apuntado: ${eur(r.amount)} a ${cr.code}, la misma cifra de la vista previa. Transfiere exactamente eso.`);
  console.log('Ya sale en su panel como cobrado.');
}

// ── Liquidación: SQL y cálculo puros (se prueban en scripts/test-creadores-cli.mjs) ──

/** Comisiones que liquidate_creator pagaría ahora mismo (el id no se enseña; sirve de foto). */
export function sqlDetalleLiquidacion(creatorId) {
  return `select k.id::text as id, k.kind, k.pct, k.amount_cents, s.product_id, s.purchased_at::date as cobro,
            k.available_at::date as disponible_desde
     from public.commissions k join public.store_sales s on s.id = k.sale_id
     where k.creator_id = ${q(creatorId)} and k.status = 'pendiente' and k.available_at <= now()
     order by s.purchased_at, k.id;`;
}

/** Descuentos (clawback) pendientes que liquidate_creator saldaría ahora mismo. */
export function sqlFotoDescuentos(creatorId) {
  return `select coalesce(sum(amount_cents), 0)::int as cents, count(*)::int as n,
            coalesce(string_agg(id::text, ',' order by id), '') as ids
     from public.commissions
     where creator_id = ${q(creatorId)} and clawback and clawback_settled_at is null;`;
}

/** Foto de la vista previa: importes y la lista exacta de filas que se tocarían. */
export function fotoLiquidacion(detalle, claw) {
  const ids = detalle.map((r) => String(r.id)).sort();
  for (const id of [...ids, ...String(claw?.ids ?? '').split(',').filter(Boolean)]) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error(`id de comisión inesperado: ${id}`);
  }
  const disponible = detalle.reduce((s, r) => s + Number(r.amount_cents), 0);
  const descuento = Number(claw?.cents ?? 0);
  return {
    ids: ids.join(','),
    idsDescuentos: String(claw?.ids ?? '').split(',').filter(Boolean).sort().join(','),
    disponible,
    descuento,
    n: detalle.length,
    nDescuentos: Number(claw?.n ?? 0),
    aPagar: disponible - descuento,
  };
}

/**
 * Una sola sentencia: llama a liquidate_creator SOLO si las comisiones disponibles
 * y los descuentos pendientes son los mismos (ids e importes) que en la foto.
 * Si algo cambió devuelve 0 filas y no escribe nada.
 */
export function sqlLiquidarSiIgual(creatorId, foto, nota) {
  const id = q(creatorId);
  // Mismo orden que fotoLiquidacion (texto, ordenado con la intercalación "C" como sort() de JS).
  return `select public.liquidate_creator(c.id, ${nota ? q(nota) : 'null'}) as r
     from public.creators c
     where c.id = ${id}
       and (select coalesce(string_agg(k.id::text, ',' order by k.id::text collate "C"), '')
            from public.commissions k
            where k.creator_id = ${id} and k.status = 'pendiente' and k.available_at <= now()) = ${q(foto.ids)}
       and (select coalesce(sum(k.amount_cents), 0)
            from public.commissions k
            where k.creator_id = ${id} and k.status = 'pendiente' and k.available_at <= now()) = ${Number(foto.disponible)}
       and (select coalesce(string_agg(k.id::text, ',' order by k.id::text collate "C"), '')
            from public.commissions k
            where k.creator_id = ${id} and k.clawback and k.clawback_settled_at is null) = ${q(foto.idsDescuentos)}
       and (select coalesce(sum(k.amount_cents), 0)
            from public.commissions k
            where k.creator_id = ${id} and k.clawback and k.clawback_settled_at is null) = ${Number(foto.descuento)};`;
}

/** Resultado de sqlLiquidarSiIgual: el jsonb de liquidate_creator, o null si no se llamó. */
export function leerResultado(res) {
  const fila = Array.isArray(res) ? res[0] : undefined;
  if (!fila) return null;
  return typeof fila.r === 'string' ? JSON.parse(fila.r) : fila.r;
}

async function pago(rawCode, euros, tipo, ...resto) {
  const args = [...resto];
  const mesOpt = opcion(args, '--mes');
  const c = codigo(rawCode);
  if (!TIPOS_PAGO.includes(tipo)) fallo(`Tipo no válido. Usa ${TIPOS_PAGO.join(' | ')} (las comisiones van con liquidar).`);
  const cents = centimos(euros, { negativo: tipo === 'ajuste' });
  const actual = mesActualMadrid();
  const mes = mesOpt ?? actual;
  const err = errorMesPago(mes, actual);
  if (err) fallo(err);
  if (args.length > 1) fallo('Sobran argumentos: la nota va entre comillas y como mucho una.');
  const nota = args[0];
  const cr = await creadorPorCodigo(c);
  if (fichaRetirada(cr)) fallo(AVISO_RETIRADA);
  const nt = nota ? String(nota).slice(0, 280) : null;
  if (!(await confirmar(`¿Apuntar ${eur(cents)} (${tipo}, periodo ${mes}) a ${cr.code}?`, cr.code))) {
    return console.log('Cancelado.');
  }
  await sql(
    `insert into public.creator_payouts (creator_id, kind, amount_cents, period, note)
     values (${q(cr.id)}, ${q(tipo)}, ${cents}, ${q(mes)}, ${nt ? q(nt) : 'null'});`,
  );
  console.log(`Apuntado: ${eur(cents)} (${tipo}) a ${cr.code}, periodo ${mes}.`);
  if (mes !== actual) console.log('El informe cuenta pagado_mes por la fecha del apunte (hoy), no por el periodo.');
}

/** `--mes` de pago: AAAA-MM, no futuro (el periodo es a qué mes corresponde lo pagado). */
export function errorMesPago(mes, actual) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes ?? ''))) return `Mes no válido: «${mes ?? ''}». Usa AAAA-MM.`;
  if (mes > actual) return `El periodo ${mes} es futuro: un pago se apunta en el mes al que corresponde, ya empezado.`;
  return null;
}

// ── Programa gamificado (0046) ──────────────────────────────────────

function rol(raw) {
  const r = String(raw ?? '').toLowerCase();
  if (!ROLES.includes(r)) fallo(`Rol no válido: «${raw ?? ''}». Usa ${ROLES.join(' | ')}.`);
  return r;
}

/** "AAAA-MM-DD" → expresión SQL del inicio de ese día (o del siguiente) en hora de Madrid. */
export function diaMadrid(raw, { masUno = false } = {}) {
  const d = String(raw ?? '');
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d)) fallo(`Fecha no válida: «${d}». Usa AAAA-MM-DD.`);
  return `((${q(d)}::date${masUno ? " + interval '1 day'" : ''})::timestamp at time zone 'Europe/Madrid')`;
}

/** AAAA-MM-DD que existe de verdad en el calendario (2026-02-30 no). */
export function fechaReal(d) {
  const m = String(d ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const f = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return f.toISOString().slice(0, 10) === d;
}

/** Fechas de un reto: las dos reales y el fin no antes del inicio (el último día entra entero). */
export function errorFechasReto(desde, hasta) {
  if (!fechaReal(desde)) return `Fecha de inicio no válida: «${desde ?? ''}». Usa AAAA-MM-DD con un día que exista.`;
  if (!fechaReal(hasta)) return `Fecha de fin no válida: «${hasta ?? ''}». Usa AAAA-MM-DD con un día que exista.`;
  if (hasta < desde) return `El reto acaba (${hasta}) antes de empezar (${desde}). La fecha de fin va después o es la misma.`;
  return null;
}

/** Saca `--nombre valor` de la lista de argumentos. */
function opcion(args, nombre) {
  const i = args.indexOf(nombre);
  if (i < 0) return undefined;
  const v = args[i + 1];
  if (v === undefined || v.startsWith('--')) fallo(`Falta el valor de ${nombre}.`);
  args.splice(i, 2);
  return v;
}

async function cambiarRol(rawCode, rawRol) {
  const c = codigo(rawCode);
  const r = rol(rawRol);
  const res = await sql(`update public.creators set role = ${q(r)} where code = ${q(c)} returning code;`);
  if (!res.length) fallo(`No hay ningún creador con el código ${c}.`);
  console.log(`${c} ahora es ${r}. Cambia qué retos ve; la comisión sigue siendo la de su rango.`);
}

async function reto(sub, ...resto) {
  const args = [...resto];
  if (sub === 'lista') {
    const rows = await sql(
      `select id, title, role, goal_sales as objetivo,
              to_char(starts_at at time zone 'Europe/Madrid', 'YYYY-MM-DD HH24:MI') as desde,
              to_char(ends_at at time zone 'Europe/Madrid', 'YYYY-MM-DD HH24:MI') as hasta,
              case when now() < starts_at then 'próximo' when now() < ends_at then 'activo' else 'terminado' end as estado
       from public.creator_challenges order by starts_at desc limit 50;`,
    );
    if (!rows.length) return console.log('No hay retos. Crea uno con: reto alta "título" desde hasta objetivo');
    return console.table(rows);
  }
  if (sub === 'alta') {
    const r = opcion(args, '--rol');
    const desc = opcion(args, '--desc');
    const [titulo, desde, hasta, objetivo, premioTxt] = args;
    const t = String(titulo ?? '').trim();
    if (!t || t.length > 80) fallo('El título va entre comillas y tiene de 1 a 80 caracteres.');
    const n = Number(objetivo);
    if (!Number.isInteger(n) || n <= 0 || n > 100000) fallo('El objetivo es un número entero de ventas mayor que 0.');
    const d = desc === undefined ? null : String(desc).trim();
    if (d !== null && d.length > 300) fallo('La descripción tiene como mucho 300 caracteres.');
    const p = premioTxt === undefined ? null : String(premioTxt).trim();
    if (p !== null && p.length > 200) fallo('El premio tiene como mucho 200 caracteres.');
    const errFechas = errorFechasReto(desde, hasta);
    if (errFechas) fallo(errFechas);
    const ini = diaMadrid(desde);
    const fin = diaMadrid(hasta, { masUno: true }); // el último día entra entero
    const [row] = await sql(
      `insert into public.creator_challenges (title, description, starts_at, ends_at, goal_sales, prize_text, role)
       values (${q(t)}, ${d ? q(d) : 'null'}, ${ini}, ${fin}, ${n}, ${p ? q(p) : 'null'}, ${r ? q(rol(r)) : 'null'})
       returning id;`,
    );
    console.log(`Reto creado: ${row?.id}. ${r ? `Solo ${rol(r)}.` : 'Para todos los roles.'}`);
    console.log('En la app de tienda un premio que hable de dinero no se enseña; en la web, sí.');
    return;
  }
  if (sub === 'cerrar') {
    const id = String(args[0] ?? '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      fallo('ID de reto no válido (uuid; míralo con: reto lista).');
    }
    // Si aún no ha empezado, se borra; si está en curso, termina ahora.
    const borrado = await sql(`delete from public.creator_challenges where id = ${q(id)} and starts_at > now() returning id;`);
    if (borrado.length) return console.log('El reto no había empezado: borrado.');
    const res = await sql(
      `update public.creator_challenges set ends_at = now() where id = ${q(id)} and ends_at > now() returning id;`,
    );
    if (!res.length) fallo('No hay ningún reto activo con ese ID (o ya había terminado).');
    console.log('Reto cerrado: termina ahora y su tabla queda congelada.');
    return;
  }
  fallo('Usa: reto lista | reto alta … | reto cerrar ID');
}

async function umbral(rawRango, ventas, meses) {
  const r = rango(rawRango);
  if (r === 'novato') fallo('Novato es el rango de entrada: no lleva umbral.');
  if (ventas === '--quitar') {
    await sql(`delete from public.creator_rank_rules where rank = ${q(r)};`);
    return console.log(`Umbral de ${r} quitado.`);
  }
  const v = Number(ventas);
  const m = meses === undefined ? 0 : Number(meses);
  if (!Number.isInteger(v) || v < 0 || v > 100000) fallo('Las ventas de 90 días son un entero ≥ 0.');
  if (!Number.isInteger(m) || m < 0 || m > 120) fallo('Los meses seguidos son un entero entre 0 y 120.');
  await sql(
    `insert into public.creator_rank_rules (rank, min_sales_90d, min_months_active, updated_at)
     values (${q(r)}, ${v}, ${m}, now())
     on conflict (rank) do update set min_sales_90d = excluded.min_sales_90d,
       min_months_active = excluded.min_months_active, updated_at = now();`,
  );
  console.log(`Umbral de ${r}: ${v} ventas en 90 días${m ? ` y ${m} meses seguidos con venta` : ''}. Solo sirve para proponer.`);
}

/** Meses seguidos con venta, como creator_progress: el mes en curso no rompe la racha. */
export function racha(meses, mesActual) {
  const set = new Set(meses);
  let [y, m] = mesActual.split('-').map(Number);
  const atras = () => {
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  };
  const clave = () => `${y}-${String(m).padStart(2, '0')}`;
  if (!set.has(clave())) atras();
  let n = 0;
  while (set.has(clave()) && n < 120) {
    n++;
    atras();
  }
  return n;
}

async function revisarRangos(...flags) {
  const args = [...flags];
  const soloRaw = opcion(args, '--solo');
  const desconocidas = args.filter((f) => f !== '--aplicar' && f !== '--confirmar');
  if (desconocidas.length) fallo(`Opción desconocida: ${desconocidas.join(' ')}`);
  const aplicar = args.includes('--aplicar');
  const confirmado = args.includes('--confirmar');
  const solo = soloRaw === undefined ? null : listaCodigos(soloRaw);
  if (solo && typeof solo === 'string') fallo(solo);
  const reglas = await sql('select rank, min_sales_90d, min_months_active from public.creator_rank_rules;');
  if (!reglas.length) return console.log('No hay umbrales. Fíjalos con: umbral pro|elite ventas90 [meses]');
  // Venta = la de creator_panel/creator_board: primer cobro con comisión viva.
  const rows = await sql(
    `select c.code, c.alias, c.rank,
       (select count(distinct s.user_id) from public.store_sales s
          join public.commissions k on k.sale_id = s.id and k.status <> 'anulada'
          where s.creator_id = c.id and s.payment_number = 1 and s.purchased_at >= now() - interval '90 days')::int as ventas90,
       coalesce((select string_agg(distinct to_char(s.purchased_at at time zone 'Europe/Madrid', 'YYYY-MM'), ',')
          from public.store_sales s join public.commissions k on k.sale_id = s.id and k.status <> 'anulada'
          where s.creator_id = c.id and s.payment_number = 1), '') as meses
     from public.creators c where c.active order by c.code;`,
  );
  const propuestas = proponerRangos(rows, reglas, mesActualMadrid());
  if (!propuestas.length) return console.log('Todos los creadores activos están en el rango que marcan los umbrales.');
  console.log('Propuestas (nada se aplica sin --aplicar --confirmar):');
  console.table(propuestas);
  const bajadas = propuestas.filter((p) => p.cambio === 'baja');
  if (bajadas.length) console.log(AVISO_BAJADAS(bajadas.map((p) => p.code)));

  const { elegidas, fuera } = elegirSolo(propuestas, solo);
  if (fuera.length) {
    fallo(`--solo incluye códigos sin propuesta: ${fuera.join(', ')}. Revisa la tabla; no se ha cambiado nada.`);
  }
  const como = solo ? `revisar-rangos --aplicar --confirmar --solo ${elegidas.map((p) => p.code).join(',')}` : null;
  if (!aplicar) {
    console.log('Para aplicarlas todas: revisar-rangos --aplicar --confirmar');
    return console.log(`Para aplicar solo algunas: revisar-rangos --aplicar --confirmar --solo CODIGO,CODIGO${como ? `\n(con la tuya: ${como})` : ''}`);
  }
  if (!confirmado) return console.log('Falta --confirmar. No se ha cambiado nada.');
  let hechas = 0;
  const saltadas = [];
  for (const p of elegidas) {
    // Solo si sigue en el rango que se revisó: si alguien lo cambió entre medias, no se pisa.
    const res = await sql(
      `update public.creators set rank = ${q(rango(p.propuesto))}
       where code = ${q(codigo(p.code))} and rank = ${q(rango(p.actual))} returning code;`,
    );
    if (res.length) hechas++;
    else saltadas.push(p.code);
  }
  console.log(`Aplicadas ${hechas} de ${elegidas.length}${solo ? ` (solo ${elegidas.map((p) => p.code).join(', ')})` : ''}.`);
  if (saltadas.length) console.log(`Sin tocar (su rango cambió entre medias): ${saltadas.join(', ')}.`);
  console.log('Las comisiones ya generadas conservan su % (foto del cobro).');
}

export const AVISO_BAJADAS = (codigos) =>
  `ATENCIÓN: hay propuestas de BAJAR de rango (${codigos.join(', ')}). La base no guarda si un rango se fijó a mano ` +
  '(no hay columna para eso), así que este comando no puede distinguir a quien subiste tú por encima de los umbrales. ' +
  'Si alguno es un rango pactado, no lo bajes: aplica solo el resto con --solo CODIGO,CODIGO.';

/** "a,B_2 , c" → ['A', 'B_2', 'C'] sin repetidos; un texto de error si algún código no vale. */
export function listaCodigos(raw) {
  const partes = String(raw ?? '')
    .split(',')
    .map((s) => s.replace(/\s/g, '').toUpperCase())
    .filter(Boolean);
  if (!partes.length) return 'Falta la lista de --solo: CODIGO,CODIGO.';
  const mal = partes.filter((c) => !/^[A-Z0-9_]{3,20}$/.test(c));
  if (mal.length) return `Código no válido en --solo: ${mal.join(', ')}. De 3 a 20 letras, números o _.`;
  return [...new Set(partes)];
}

/** Con `solo` (lista de códigos) se queda con esas propuestas; `fuera` son los códigos sin propuesta. */
export function elegirSolo(propuestas, solo) {
  if (!solo) return { elegidas: propuestas, fuera: [] };
  const set = new Set(solo);
  return {
    elegidas: propuestas.filter((p) => set.has(p.code)),
    fuera: solo.filter((c) => !propuestas.some((p) => p.code === c)),
  };
}

/** Rango que marcan los umbrales para cada creador activo; devuelve solo los que cambian. */
export function proponerRangos(rows, reglas, mes) {
  const regla = Object.fromEntries(reglas.map((r) => [r.rank, r]));
  const propuestas = [];
  for (const r of rows) {
    const seguidos = racha(String(r.meses ?? '').split(',').filter(Boolean), mes);
    let merecido = 'novato';
    for (const k of RANGOS) {
      const g = regla[k];
      if (k !== 'novato' && g && r.ventas90 >= g.min_sales_90d && seguidos >= g.min_months_active) merecido = k;
    }
    if (merecido !== r.rank) {
      const sube = RANGOS.indexOf(merecido) > RANGOS.indexOf(r.rank);
      propuestas.push({
        code: r.code,
        alias: r.alias,
        actual: r.rank,
        propuesto: merecido,
        ventas90: r.ventas90,
        meses_seguidos: seguidos,
        cambio: sube ? 'sube' : 'baja',
      });
    }
  }
  return propuestas;
}

// ── Entrada ─────────────────────────────────────────────────────────

const COMANDOS = {
  lista,
  alta,
  vincular,
  rango: cambiarRango,
  fijo,
  activo,
  premio,
  sbp,
  informe,
  liquidar,
  pago,
  rol: cambiarRol,
  reto,
  umbral,
  'revisar-rangos': revisarRangos,
};

// Al importarlo desde un test no arranca la CLI: solo se exportan las piezas puras.
const ES_CLI =
  Boolean(process.argv[1]) && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (ES_CLI) {
  const [cmd, ...args] = process.argv.slice(2);
  const fn = COMANDOS[cmd];
  if (!fn) {
    console.log(
      readFileSync(fileURLToPath(import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => l.startsWith('//   node'))
        .map((l) => l.slice(5))
        .join('\n'),
    );
    process.exit(cmd ? 1 : 0);
  }

  try {
    await fn(...args);
  } catch (e) {
    fallo(`Falló: ${e.message}`);
  }
}
