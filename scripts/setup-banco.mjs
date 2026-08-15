// NIVL · Conectar el banco de verdad, sin CSV.
//
// Revolut no tiene API para cuentas personales, así que se entra por donde la
// ley europea obliga a dejar entrar: PSD2. GoCardless Bank Account Data (antes
// Nordigen) es el agregador con capa gratuita que da acceso a los movimientos
// una vez que TÚ autorizas la conexión desde la web de tu banco.
//
// Uso:
//   node scripts/setup-banco.mjs --conectar          → te da el enlace a autorizar
//   node scripts/setup-banco.mjs --sync              → baja movimientos y saldos
//   node scripts/setup-banco.mjs --bancos            → lista los bancos de España
//   node scripts/setup-banco.mjs --conectar --banco REVOLUT_REVOGB21
//
// Lo que tienes que hacer una vez:
//   1. Registro gratuito en https://bankaccountdata.gocardless.com/
//   2. User Secrets → crea uno → copia secret_id y secret_key
//   3. Pégalos en banco-token.txt (gitignorado), uno por línea:
//        secret_id
//        secret_key
//
// Las credenciales NO se pegan en el chat ni entran en el repositorio. El
// fichero está en .gitignore por la misma razón que supabase-token.txt.
//
// Aviso honesto: el consentimiento PSD2 caduca a los 90 días. Cuando expire,
// este script te lo dirá y bastará con volver a ejecutar --conectar.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirSesion, rest } from './session.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CRED = join(ROOT, 'banco-token.txt');
const ESTADO = join(ROOT, 'banco-estado.json');
const API = 'https://bankaccountdata.gocardless.com/api/v2';

const argv = process.argv.slice(2);
const bancoIdx = argv.indexOf('--banco');
const BANCO = bancoIdx !== -1 ? argv[bancoIdx + 1] : null;

function leerCredenciales() {
  if (!existsSync(CRED)) {
    console.error(
      `No encuentro ${CRED}.\n\n` +
        'Créalo con dos líneas: el secret_id y el secret_key de tu cuenta gratuita en\n' +
        'https://bankaccountdata.gocardless.com/  (User Secrets → Create new).\n\n' +
        'No los pegues en el chat ni en ningún otro sitio: ese fichero está en .gitignore.',
    );
    process.exit(1);
  }
  const lineas = readFileSync(CRED, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  if (lineas.length < 2) {
    console.error('banco-token.txt necesita dos líneas: secret_id y secret_key.');
    process.exit(1);
  }
  return { secretId: lineas[0], secretKey: lineas[1] };
}

async function token() {
  const { secretId, secretKey } = leerCredenciales();
  const r = await fetch(`${API}/token/new/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });
  if (!r.ok) {
    // Nunca se imprime el cuerpo entero: puede traer de vuelta las credenciales.
    console.error(`GoCardless rechazó las credenciales (HTTP ${r.status}). Revisa banco-token.txt.`);
    process.exit(1);
  }
  return (await r.json()).access;
}

async function api(ruta, access, opciones = {}) {
  const r = await fetch(`${API}${ruta}`, {
    ...opciones,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${access}`,
      ...(opciones.headers ?? {}),
    },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${ruta}: HTTP ${r.status} ${texto.slice(0, 400)}`);
  return texto ? JSON.parse(texto) : null;
}

const access = await token();

// ── Listar bancos ───────────────────────────────────────────────────
if (argv.includes('--bancos')) {
  const bancos = await api('/institutions/?country=es', access);
  for (const b of bancos) console.log(`${b.id.padEnd(40)} ${b.name}`);
  console.log(`\n${bancos.length} bancos. Usa el identificador de la izquierda con --banco.`);
  process.exit(0);
}

// ── Conectar ────────────────────────────────────────────────────────
if (argv.includes('--conectar')) {
  let institucion = BANCO;
  if (!institucion) {
    const bancos = await api('/institutions/?country=es', access);
    const revolut = bancos.find((b) => /revolut/i.test(b.name));
    if (!revolut) {
      console.error('No encuentro Revolut entre los bancos de España. Lanza --bancos y elige con --banco.');
      process.exit(1);
    }
    institucion = revolut.id;
    console.log(`Banco: ${revolut.name} (${revolut.id})`);
  }

  // 730 días es el máximo que permite la norma; cada banco da lo que da y la
  // API recorta sola si pides más de lo que ese banco ofrece.
  const acuerdo = await api('/agreements/enduser/', access, {
    method: 'POST',
    body: JSON.stringify({
      institution_id: institucion,
      max_historical_days: 730,
      access_valid_for_days: 90,
      access_scope: ['balances', 'transactions'],
    }),
  }).catch(async (e) => {
    // Si el banco no da 730 días, se reintenta con lo estándar en vez de morir.
    if (!/max_historical_days/i.test(String(e))) throw e;
    console.log('Ese banco no ofrece 2 años de histórico. Pidiendo 90 días.');
    return api('/agreements/enduser/', access, {
      method: 'POST',
      body: JSON.stringify({
        institution_id: institucion,
        max_historical_days: 90,
        access_valid_for_days: 90,
        access_scope: ['balances', 'transactions'],
      }),
    });
  });

  const req = await api('/requisitions/', access, {
    method: 'POST',
    body: JSON.stringify({
      redirect: 'https://nivl.app/banco-ok',
      institution_id: institucion,
      agreement: acuerdo.id,
      reference: `nivl-${acuerdo.id.slice(0, 8)}`,
      user_language: 'ES',
    }),
  });

  writeFileSync(ESTADO, JSON.stringify({ requisition: req.id, institucion }, null, 2));
  console.log(
    '\nAbre este enlace en el móvil o en el navegador y autoriza el acceso de solo lectura:\n\n' +
      `  ${req.link}\n\n` +
      'Cuando termines y vuelvas, ejecuta:\n\n  node scripts/setup-banco.mjs --sync\n',
  );
  process.exit(0);
}

// ── Sincronizar ─────────────────────────────────────────────────────
if (!argv.includes('--sync')) {
  console.log(
    'Uso:\n' +
      '  node scripts/setup-banco.mjs --conectar   → enlace para autorizar el banco\n' +
      '  node scripts/setup-banco.mjs --sync       → baja movimientos y saldos\n' +
      '  node scripts/setup-banco.mjs --bancos     → lista los bancos disponibles\n',
  );
  process.exit(0);
}

if (!existsSync(ESTADO)) {
  console.error('No hay ninguna conexión guardada. Lanza primero --conectar.');
  process.exit(1);
}
const { requisition } = JSON.parse(readFileSync(ESTADO, 'utf8'));

const req = await api(`/requisitions/${requisition}/`, access);
if (req.status !== 'LN' || !req.accounts?.length) {
  console.error(
    `La conexión todavía no está autorizada (estado ${req.status}).\n` +
      'Abre el enlace que te dio --conectar, autoriza en tu banco y vuelve a intentarlo.\n' +
      'Si el consentimiento ha caducado (a los 90 días), lanza --conectar otra vez.',
  );
  process.exit(1);
}

const sesion = await abrirSesion(ROOT);
const db = rest(sesion);
console.log(`Sesión abierta para ${sesion.email} · ${req.accounts.length} cuenta(s) autorizadas`);

const reglas = (await db.select('category_rules', 'select=pattern,category,priority')).sort(
  (a, b) => b.priority - a.priority || b.pattern.length - a.pattern.length,
);
if (!reglas.length) {
  console.log('Aviso: no hay reglas de categorización. Lanza antes: node scripts/import-revolut.mjs --semilla');
}

function categorizar(texto, importe) {
  const t = texto.toLowerCase();
  for (const r of reglas) if (t.includes(r.pattern.toLowerCase())) return r.category;
  return importe >= 0 ? 'ingreso_otro' : 'sin_clasificar';
}

let totalNuevos = 0;

for (const cuentaId of req.accounts) {
  const detalle = await api(`/accounts/${cuentaId}/`, access).catch(() => ({}));
  const meta = await api(`/accounts/${cuentaId}/details/`, access).catch(() => ({ account: {} }));
  const nombre =
    meta.account?.name ?? meta.account?.ownerName ?? `${detalle.institution_id ?? 'Banco'} ${String(cuentaId).slice(0, 6)}`;
  const divisa = meta.account?.currency ?? 'EUR';

  const cuentas = await db.select('money_accounts', `name=eq.${encodeURIComponent(nombre)}&select=*`);
  let cuenta = cuentas[0];
  if (!cuenta) {
    [cuenta] = await db.insert('money_accounts', [
      {
        user_id: sesion.userId,
        name: nombre,
        provider: 'revolut',
        currency: divisa,
        external_id: cuentaId,
      },
    ]);
  }

  const { transactions } = await api(`/accounts/${cuentaId}/transactions/`, access);
  // Solo las contabilizadas: las pendientes cambian de importe y de fecha, y
  // si se guardan acaban duplicadas cuando el banco las confirma.
  const booked = transactions?.booked ?? [];

  const filas = booked
    .map((t) => {
      const fecha = (t.bookingDate ?? t.valueDate ?? '').slice(0, 10);
      const importe = Number(t.transactionAmount?.amount);
      if (!fecha || !Number.isFinite(importe) || importe === 0) return null;

      const desc =
        t.remittanceInformationUnstructured ??
        (Array.isArray(t.remittanceInformationUnstructuredArray)
          ? t.remittanceInformationUnstructuredArray.join(' ')
          : null) ??
        t.creditorName ??
        t.debtorName ??
        'Movimiento';
      const contraparte = importe < 0 ? (t.creditorName ?? desc) : (t.debtorName ?? desc);
      const interno = /^(to|from|a|de) (my|mi) /i.test(desc) || /vault|pocket|bolsillo/i.test(desc);

      return {
        user_id: sesion.userId,
        account_id: cuenta?.id ?? null,
        date: fecha,
        amount: importe,
        currency: t.transactionAmount?.currency ?? divisa,
        description: String(desc).slice(0, 300),
        counterparty: contraparte ? String(contraparte).slice(0, 200) : null,
        category: interno ? 'transferencia' : categorizar(`${desc} ${contraparte ?? ''}`, importe),
        source: 'openbanking',
        // El id del banco es la mejor huella que existe: es estable y único.
        // Solo se recurre a fecha+importe+texto cuando el banco no lo manda.
        dedup_hash: t.transactionId
          ? `gc|${t.transactionId}`
          : `gc|${fecha}|${importe.toFixed(2)}|${String(desc).toLowerCase().slice(0, 60)}`,
        is_internal: interno,
      };
    })
    .filter(Boolean);

  let nuevos = 0;
  for (let i = 0; i < filas.length; i += 400) {
    const r = await db.insert('transactions', filas.slice(i, i + 400), {
      ignorarDuplicados: true,
      onConflict: 'user_id,dedup_hash',
    });
    nuevos += r.length;
  }
  totalNuevos += nuevos;

  const { balances } = await api(`/accounts/${cuentaId}/balances/`, access).catch(() => ({ balances: [] }));
  const saldo =
    balances?.find((b) => /interimAvailable|closingBooked|expected/i.test(b.balanceType ?? '')) ?? balances?.[0];
  if (cuenta && saldo?.balanceAmount?.amount) {
    await db.update('money_accounts', `id=eq.${cuenta.id}`, {
      balance: Number(saldo.balanceAmount.amount),
      balance_at: saldo.referenceDate ? `${saldo.referenceDate}T23:59:59Z` : new Date().toISOString(),
      external_id: cuentaId,
    });
  }

  console.log(
    `  ${nombre}: ${filas.length} movimientos leídos, ${nuevos} nuevos` +
      (saldo?.balanceAmount?.amount ? ` · saldo ${saldo.balanceAmount.amount} ${divisa}` : ''),
  );
}

console.log(
  `\n${totalNuevos} movimientos nuevos.\n` +
    'Vuelve a lanzar --sync cuando quieras: los repetidos se descartan solos.\n' +
    'El consentimiento caduca a los 90 días; cuando pase, --conectar otra vez.',
);
