create extension if not exists "pgcrypto";

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  email text not null, first_name text not null, last_name text not null, mobile text not null,
  event_type text not null, event_address text not null, pickup_date date not null, dropoff_date date not null,
  pickup_time time, dropoff_time time,
  package_interest text not null, add_ons text[] not null default '{}', guest_count integer, additional_details text not null default '',
  terms_accepted boolean not null default false, photo_id_paths text[] not null default '{}',
  status text not null default 'submitted' check (status in ('submitted','confirmed','completed','cancelled')),
  calendar_event_link text, calendar_error text, internal_email_sent boolean not null default false,
  customer_email_sent boolean not null default false, confirmation_email_sent boolean not null default false,
  payment_received_at timestamptz, bank_transfer_refunded_at timestamptz,
  payment_method text, hire_amount_cents integer, security_deposit_cents integer,
  hire_payment_status text not null default 'unpaid', deposit_payment_status text not null default 'not_required',
  bank_transfer_option text not null default 'both' check (bank_transfer_option in ('payid','bank_account','both')),
  stripe_customer_id text, stripe_hire_payment_intent_id text, stripe_deposit_payment_intent_id text,
  payment_token text, deposit_captured_cents integer, deposit_released_at timestamptz, deposit_captured_at timestamptz,
  bank_transfer_reference text,
  internal_notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.booking_email_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  recipient_email text not null,
  email_type text not null check (email_type in ('booking_request','confirmation','pickup_reminder','custom','invoice','payment_receipt','deposit_authorisation','deposit_release','deposit_capture','enquiry')),
  provider_message_id text,
  sent_at timestamptz not null default now()
);
create index if not exists booking_email_log_booking_id_idx on public.booking_email_log(booking_id);
create index if not exists booking_email_log_sent_at_idx on public.booking_email_log(sent_at);
alter table public.booking_email_log drop constraint if exists booking_email_log_email_type_check;
alter table public.booking_email_log add constraint booking_email_log_email_type_check check (email_type in ('booking_request','confirmation','pickup_reminder','custom','invoice','payment_receipt','deposit_authorisation','deposit_release','deposit_capture','enquiry'));
alter table public.bookings add column if not exists reminder_sent_at timestamptz;
alter table public.bookings add column if not exists add_ons text[] not null default '{}';
alter table public.bookings add column if not exists confirmation_email_sent boolean not null default false;
alter table public.bookings add column if not exists pickup_time time;
alter table public.bookings add column if not exists dropoff_time time;
alter table public.bookings add column if not exists payment_method text;
alter table public.bookings add column if not exists hire_amount_cents integer;
alter table public.bookings add column if not exists security_deposit_cents integer;
alter table public.bookings add column if not exists hire_payment_status text not null default 'unpaid';
alter table public.bookings add column if not exists deposit_payment_status text not null default 'not_required';
alter table public.bookings add column if not exists stripe_customer_id text;
alter table public.bookings add column if not exists stripe_hire_payment_intent_id text;
alter table public.bookings add column if not exists stripe_deposit_payment_intent_id text;
alter table public.bookings add column if not exists payment_token text;
alter table public.bookings add column if not exists deposit_captured_cents integer;
alter table public.bookings add column if not exists deposit_released_at timestamptz;
alter table public.bookings add column if not exists deposit_captured_at timestamptz;
alter table public.bookings add column if not exists bank_transfer_reference text;
alter table public.bookings add column if not exists payment_received_at timestamptz;
alter table public.bookings add column if not exists bank_transfer_refunded_at timestamptz;
alter table public.bookings add column if not exists bank_transfer_option text not null default 'both';
drop constraint if exists bookings_bank_transfer_option_check on public.bookings;
alter table public.bookings add constraint bookings_bank_transfer_option_check check (bank_transfer_option in ('payid','bank_account','both'));
create unique index if not exists bookings_payment_token_idx on public.bookings(payment_token) where payment_token is not null;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  invoice_number text not null unique,
  payment_method text not null,
  hire_amount_cents integer not null,
  security_deposit_cents integer not null default 0,
  total_amount_cents integer not null,
  currency text not null default 'aud',
  payment_url text,
  bank_transfer_option text not null default 'both' check (bank_transfer_option in ('payid','bank_account','both')),
  status text not null default 'issued',
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invoices_booking_id_idx on public.invoices(booking_id);
alter table public.invoices add column if not exists bank_transfer_option text not null default 'both';
drop constraint if exists invoices_bank_transfer_option_check on public.invoices;
alter table public.invoices add constraint invoices_bank_transfer_option_check check (bank_transfer_option in ('payid','bank_account','both'));
create table if not exists public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  document_type text not null check (document_type in ('invoice','payment_receipt','deposit_authorisation','deposit_release','deposit_capture')),
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_id, document_type)
);
create index if not exists billing_documents_booking_id_idx on public.billing_documents(booking_id);
alter table public.invoices enable row level security;
revoke all on public.invoices from anon, authenticated;
drop policy if exists "service role manages invoices" on public.invoices;
create policy "service role manages invoices" on public.invoices for all to service_role using (true) with check (true);
alter table public.billing_documents enable row level security;
revoke all on public.billing_documents from anon, authenticated;
drop policy if exists "service role manages billing documents" on public.billing_documents;
create policy "service role manages billing documents" on public.billing_documents for all to service_role using (true) with check (true);
create or replace function public.set_bookings_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at before update on public.invoices
for each row execute function public.set_bookings_updated_at();
alter table public.bookings alter column guest_count drop not null;
alter table public.bookings enable row level security;
revoke all on public.bookings from anon, authenticated;
drop policy if exists "service role manages bookings" on public.bookings;
create policy "service role manages bookings" on public.bookings for all to service_role using (true) with check (true);
alter table public.booking_email_log enable row level security;
revoke all on public.booking_email_log from anon, authenticated;
drop policy if exists "service role manages booking email log" on public.booking_email_log;
create policy "service role manages booking email log" on public.booking_email_log for all to service_role using (true) with check (true);
drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at before update on public.bookings
for each row execute function public.set_bookings_updated_at();

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'purge-booking-email-log';
select cron.schedule(
  'purge-booking-email-log',
  '15 0 * * *',
  $$delete from public.booking_email_log where sent_at < now() - interval '30 days'$$
);

insert into storage.buckets (id, name, public) values ('booking-photo-ids', 'booking-photo-ids', false) on conflict (id) do nothing;
drop policy if exists "service role manages booking photos" on storage.objects;
create policy "service role manages booking photos" on storage.objects for all to service_role using (bucket_id = 'booking-photo-ids') with check (bucket_id = 'booking-photo-ids');

-- Create an Auth user in Supabase Dashboard (Authentication > Users) for each administrator.
-- Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY
-- in the deployment environment. Never expose the service role key to a browser.
