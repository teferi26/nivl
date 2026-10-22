-- NIVL · NNNN (borrador, número y huella los asigna el coordinador) · solicitudes de desistimiento de la web.
-- Chat «NIVL - Compras», subagente servidor, 2026-10-21. Contrato: docs/payment-audit/STRIPE-WEB.md.
-- Huella propuesta para scripts/apply-migrations.mjs:
--   to_regclass('public.withdrawal_requests') is not null
--
-- Qué es: el «botón de desistimiento» (Directiva (UE) 2023/2673, art. 11 bis de la 2011/83/UE) de la
-- Edge Function `desistimiento` REGISTRA aquí cada solicitud; soporte la tramita (reembolso proporcional
-- de la parte no usada, art. 108.4 TRLGDCU, y cancelación en Stripe) y envía el acuse por correo
-- (el servidor no tiene proveedor de correo para esto: ack_sent_at lo marca soporte).
--
-- Aditiva: solo crea una tabla nueva cerrada a anon/authenticated (como 0025/0027). No toca nada
-- desplegado. Re-ejecutable.
--
-- Datos personales: email y user_id. Al borrar la cuenta, user_id pasa a null (on delete set null) y la
-- fila se conserva con el email: es la prueba de una obligación legal (plazo de reclamación). Si el
-- coordinador prefiere seudonimizar el email al borrar, que lo haga en el trigger de borrado (0039).
-- PENDIENTE (regla de AGENTS.md): añadir withdrawal_requests a export_my_data() en la siguiente
-- migración de exportación (por user_id), y a la batería de humo.
begin;

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text check (email is null or char_length(email) <= 320),
  source text not null check (source in ('cuenta', 'formulario')),
  order_ref text check (order_ref is null or char_length(order_ref) <= 80),
  stripe_subscription_id text,
  stripe_customer_id text,
  -- true: sesión con fila Stripe, o correo del formulario = correo del cliente en Stripe.
  verified boolean not null default false,
  -- ¿dentro de los 14 días desde el alta de la suscripción? null = no se pudo saber.
  within_period boolean,
  reason text check (reason is null or char_length(reason) <= 500),
  requested_at timestamptz not null default now(),
  -- Lo rellena soporte.
  status text not null default 'pendiente' check (status in ('pendiente', 'tramitada', 'rechazada', 'duplicada')),
  ack_sent_at timestamptz,
  refund_cents integer check (refund_cents is null or refund_cents >= 0),
  resolved_at timestamptz,
  note text check (note is null or char_length(note) <= 500)
);
create index if not exists withdrawal_requests_pending_idx on public.withdrawal_requests (status, requested_at);
create index if not exists withdrawal_requests_email_idx on public.withdrawal_requests (email, requested_at);
create index if not exists withdrawal_requests_user_idx on public.withdrawal_requests (user_id);

alter table public.withdrawal_requests enable row level security;
revoke all on public.withdrawal_requests from public, anon, authenticated;
grant select, insert, update on public.withdrawal_requests to service_role;

comment on table public.withdrawal_requests is
  'nivl:desistimiento-web — solicitudes del botón de desistimiento (Edge Function desistimiento). Solo service_role.';

notify pgrst, 'reload schema';
commit;
