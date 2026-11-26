-- GuestFlow Office Companion
-- Run in the Supabase SQL Editor. This script creates application tables and seeds
-- the 40 visitor records plus historical activity from src/lib/ovms/seed.ts.
-- Auth users must be created with Supabase Auth (Dashboard or Admin API), not by
-- inserting directly into auth.users. The profile trigger assigns the safe default
-- role "user"; promote an account to admin only after its Auth account exists.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  username text not null unique,
  name text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.visitors (
  id text primary key,
  full_name text not null,
  contact text not null,
  purpose text not null,
  host text not null,
  time_in timestamptz not null default now(),
  time_out timestamptz,
  archived boolean not null default false,
  archived_at timestamptz,
  registered_by uuid references public.profiles (id) on delete set null
);

create table if not exists public.activity_logs (
  id text primary key,
  timestamp timestamptz not null default now(),
  user_id uuid references public.profiles (id) on delete set null,
  user_name text not null,
  action text not null,
  record_id text,
  details text,
  reason text,
  changes jsonb
);

create index if not exists visitors_registered_by_idx on public.visitors (registered_by);
create index if not exists visitors_time_in_idx on public.visitors (time_in desc);
create index if not exists activity_logs_user_timestamp_idx on public.activity_logs (user_id, timestamp desc);
create index if not exists activity_logs_record_id_idx on public.activity_logs (record_id);

create or replace function public.is_guestflow_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.status = 'active'
  );
$$;

revoke all on function public.is_guestflow_admin() from public;
grant execute on function public.is_guestflow_admin() to authenticated;

create or replace function public.create_guestflow_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
  insert into public.profiles (id, email, username, name, role, status)
  values (
    new.id,
    new.email,
    requested_username,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), requested_username),
    'user',
    'active'
  )
  on conflict (id) do update
  set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_guestflow on auth.users;
create trigger on_auth_user_created_guestflow
  after insert on auth.users
  for each row execute function public.create_guestflow_profile();

alter table public.profiles enable row level security;
alter table public.visitors enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists "profiles_read_self_or_admin" on public.profiles;
create policy "profiles_read_self_or_admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_guestflow_admin()));
drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_guestflow_admin()))
  with check (
    (id = (select auth.uid()) and role = 'user' and status = 'active')
    or (select public.is_guestflow_admin())
  );

drop policy if exists "visitors_read_owner_or_admin" on public.visitors;
create policy "visitors_read_owner_or_admin" on public.visitors
  for select to authenticated
  using (registered_by = (select auth.uid()) or (select public.is_guestflow_admin()));
drop policy if exists "visitors_insert_owner_or_admin" on public.visitors;
create policy "visitors_insert_owner_or_admin" on public.visitors
  for insert to authenticated
  with check (registered_by = (select auth.uid()) or (select public.is_guestflow_admin()));
drop policy if exists "visitors_update_owner_or_admin" on public.visitors;
create policy "visitors_update_owner_or_admin" on public.visitors
  for update to authenticated
  using (registered_by = (select auth.uid()) or (select public.is_guestflow_admin()))
  with check (registered_by = (select auth.uid()) or (select public.is_guestflow_admin()));
drop policy if exists "visitors_delete_owner_or_admin" on public.visitors;
create policy "visitors_delete_owner_or_admin" on public.visitors
  for delete to authenticated
  using (registered_by = (select auth.uid()) or (select public.is_guestflow_admin()));

drop policy if exists "logs_read_owner_or_admin" on public.activity_logs;
create policy "logs_read_owner_or_admin" on public.activity_logs
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_guestflow_admin()));
drop policy if exists "logs_insert_owner_or_admin" on public.activity_logs;
create policy "logs_insert_owner_or_admin" on public.activity_logs
  for insert to authenticated
  with check (user_id = (select auth.uid()) or (select public.is_guestflow_admin()));
drop policy if exists "logs_admin_update" on public.activity_logs;
create policy "logs_admin_update" on public.activity_logs
  for update to authenticated
  using ((select public.is_guestflow_admin()))
  with check ((select public.is_guestflow_admin()));
drop policy if exists "logs_admin_delete" on public.activity_logs;
create policy "logs_admin_delete" on public.activity_logs
  for delete to authenticated
  using ((select public.is_guestflow_admin()));

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.visitors to authenticated;
grant select, insert, update, delete on public.activity_logs to authenticated;

-- This conditional upsert attaches metadata to demo users only if you already
-- created the corresponding Supabase Auth users. It never writes to auth.users.
insert into public.profiles (id, email, username, name, role, status, created_at)
select u.id, u.email, d.username, d.name, d.role, d.status, d.created_at
from auth.users u
join (values
  ('msantos', 'Maria Santos', 'user', 'active', now() - interval '420 days'),
  ('jreyes', 'Jericho Reyes', 'user', 'active', now() - interval '300 days'),
  ('acruz', 'Angela Cruz', 'user', 'inactive', now() - interval '250 days'),
  ('rvillanueva', 'Ramon Villanueva', 'admin', 'active', now() - interval '500 days'),
  ('lmendoza', 'Liza Mendoza', 'admin', 'active', now() - interval '480 days')
) as d(username, name, role, status, created_at)
  on lower(u.email) = d.username || '@guestflow.local'
on conflict (id) do update set
  username = excluded.username,
  name = excluded.name,
  role = excluded.role,
  status = excluded.status,
  created_at = excluded.created_at;

with seed(id, full_name, contact, purpose, host, days_ago, hour, minute, timeout_minutes, username) as (
  values
    ('VIS-0001','Lourdes Pascual','09224561230','Payment / Billing','Accounting Office',29,10,5,35,'jreyes'),
    ('VIS-0002','Ernesto Aquino','09151239876','Other: Building inspection','Administrative Division',26,13,30,100,'msantos'),
    ('VIS-0003','Grace Villareal','09987778899','Document request','Records Section',23,9,20,35,'msantos'),
    ('VIS-0004','Dominic Tan','09324445566','Meeting / Appointment','IT Support — Engr. Lim',10,14,0,85,'jreyes'),
    ('VIS-0005','Rhea Mae Castillo','09062223344','Inquiry','Records Section',3,11,20,25,'msantos'),
    ('VIS-0006','Paolo Fernandez','09189990011','Payment / Billing','Accounting Office',1,14,5,35,'jreyes'),
    ('VIS-0007','Juan Dela Cruz','09171234567','Document request','Records Section',0,0,0,null,'msantos'),
    ('VIS-0008','Mark Anthony Gonzales','09453334455','Delivery','Procurement Unit',0,0,0,18,'msantos'),
    ('VIS-0009','Ana Liza Bautista','09281112233','Meeting / Appointment','Office of the Director — Atty. Ramos',0,0,0,null,'msantos'),
    ('VIS-0010','Kristine Joy Navarro','09175556677','Job application / Interview','HR Department',0,0,0,null,'jreyes')
), resolved as (
  select s.*,
    case when s.days_ago = 0 then now() - make_interval(mins =>
      case s.id when 'VIS-0007' then 214 when 'VIS-0008' then 170 when 'VIS-0009' then 126 else 48 end)
    else date_trunc('day', now()) - make_interval(days => s.days_ago) + make_interval(hours => s.hour, mins => s.minute)
    end as time_in
  from seed s
), all_visitors as (
  select * from resolved
  union all
  select format('VIS-%s', lpad((n + 10)::text, 4, '0')),
    (array['Carmela Domingo','Roberto Manalo','Elena Soriano','Miguel Alonzo','Patricia Ramos','Eduardo Salazar','Teresa Mercado','Gabriel Bautista','Maricel Flores','Adrian Santiago','Rosario Jimenez','Dennis Valdez','Beatriz Santiago','Ricardo Mendoza','Isabel Francisco','Victor Angeles','Catherine Dizon','Antonio Rivera','Mylene Torres','Joseph Buenaventura','Diana Garcia','Fernando Castillo','Aileen Padilla','Rafael Del Rosario','Nina Evangelista','Carlos Javier','Melissa Enriquez','Francis Ocampo','Leah Macapagal','Samuel Villanueva'])[n],
    '0917' || (3000100 + n)::text,
    (array['Document request','Payment / Billing','Job application / Interview','Meeting / Appointment','Delivery','Inquiry','Other: Facility maintenance'])[((n - 1) % 7) + 1],
    (array['Records Section','Accounting Office','HR Department','Office of the Director','Procurement Unit','IT Support','Administrative Division'])[((n - 1) % 7) + 1],
    1 + ((n - 1) % 29), 8 + ((n - 1) % 7), ((n * 7) % 40), 60,
    case when n % 2 = 1 then 'msantos' else 'jreyes' end,
    date_trunc('day', now()) - make_interval(days => 1 + ((n - 1) % 29))
      + make_interval(hours => 8 + ((n - 1) % 7), mins => ((n * 7) % 40))
  from generate_series(1, 30) n
), insert_visitors as (
  insert into public.visitors (id, full_name, contact, purpose, host, time_in, time_out, archived, registered_by)
  select v.id, v.full_name, v.contact, v.purpose, v.host, v.time_in,
    case when v.timeout_minutes is null then null else v.time_in + make_interval(mins => v.timeout_minutes) end,
    false,
    (select p.id from public.profiles p where p.username = v.username limit 1)
  from all_visitors v
  on conflict (id) do nothing
  returning id, full_name, host, time_in, time_out, registered_by
)
select count(*) as inserted_visitors from insert_visitors;

-- Preserve the prototype's generated registration and checkout history.
insert into public.activity_logs (id, timestamp, user_id, user_name, action, record_id, details)
select 'SEED-' || v.id || '-IN', v.time_in, v.registered_by,
  coalesce(p.name, case when v.registered_by is null then 'Imported prototype' else p.name end),
  'Registered visitor', v.id, v.full_name || ' → ' || v.host
from public.visitors v
left join public.profiles p on p.id = v.registered_by
where v.id between 'VIS-0001' and 'VIS-0040'
on conflict (id) do nothing;

insert into public.activity_logs (id, timestamp, user_id, user_name, action, record_id, details)
select 'SEED-' || v.id || '-OUT', v.time_out, v.registered_by,
  coalesce(p.name, 'Imported prototype'),
  'Checked-out visitor', v.id, v.full_name
from public.visitors v
left join public.profiles p on p.id = v.registered_by
where v.time_out is not null and v.id between 'VIS-0001' and 'VIS-0040'
on conflict (id) do nothing;

insert into public.activity_logs (id, timestamp, user_id, user_name, action, record_id, details)
values
  ('SEED-LOGIN-10D', now() - interval '10 days 1 hour', null, 'Jericho Reyes', 'Login', null, null),
  ('SEED-EDIT-VIS4', now() - interval '9 days 1 hour', null, 'Ramon Villanueva', 'Edited visitor', 'VIS-0004', 'Host clarified by visitor.'),
  ('SEED-STAFF-ANGELA', now() - interval '6 days 1 hour', null, 'Ramon Villanueva', 'Deactivated staff', 'U-003', 'Angela Cruz — transferred to another office'),
  ('SEED-EXPORT-WEEKLY', now() - interval '1 day 7 hours', null, 'Liza Mendoza', 'Exported report', null, 'Weekly report (CSV)')
on conflict (id) do nothing;

-- To promote a real account after it has signed up, run as the project owner:
-- update public.profiles set role = 'admin' where email = 'admin@example.com';
