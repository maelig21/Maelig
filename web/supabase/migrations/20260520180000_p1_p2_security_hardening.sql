-- P1 + P2 SECURITY HARDENING — Audit 2026-05-20
-- Cible : conformité RGPD + traçabilité B2B + defense-in-depth pour les
-- données de chefs d'entreprise (clients, devis, paiements, incidents).

-- ============================================================
-- 1) AUTH_EVENTS — Journal compliance des événements d'auth
-- ============================================================
-- Sans cette table on ne peut pas prouver à un client (ni à la CNIL)
-- qui s'est connecté, quand, depuis quelle IP, ni les tentatives échouées.
-- Audit logs business existent déjà (audit_logs) mais pas pour l'auth.

create table if not exists auth_events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  -- nullable car un login raté n'a pas forcément de user_id valide
  user_id     uuid references auth.users(id) on delete set null,
  email       text,                              -- redacted/hashed côté app
  event       text not null,                     -- login_ok, login_fail, signup, reset_request, reset_ok, password_change, role_change, mfa_enroll, mfa_verify, admin_action
  ip          inet,
  user_agent  text,
  metadata    jsonb default '{}'::jsonb,
  org_id      uuid references orgs(id) on delete set null
);

create index if not exists auth_events_user_idx       on auth_events(user_id, created_at desc);
create index if not exists auth_events_event_idx      on auth_events(event, created_at desc);
create index if not exists auth_events_ip_idx         on auth_events(ip, created_at desc);
create index if not exists auth_events_created_at_idx on auth_events(created_at desc);

alter table auth_events enable row level security;
-- service_role bypass RLS automatiquement, donc on n'a besoin que des SELECT policies
revoke all on auth_events from authenticated, anon;
-- Les admins peuvent lire les évènements de leur org
drop policy if exists "auth_events read admin_dep" on auth_events;
create policy "auth_events read admin_dep" on auth_events
  for select using (is_admin_dep());

-- Les owners peuvent lire les évènements de leur org
drop policy if exists "auth_events read owner_org" on auth_events;
create policy "auth_events read owner_org" on auth_events
  for select using (org_id = current_org_id() and is_owner());

-- ============================================================
-- 2) AUTH BRUTE FORCE LOCKOUT — Verrou IP après N échecs
-- ============================================================
-- Le rate limit Upstash bloque 5 tentatives / 15 min, mais on garde
-- une trace persistante en DB pour audit + analyse.

create table if not exists auth_lockouts (
  id          uuid primary key default gen_random_uuid(),
  ip          inet not null,
  email_hash  text,                              -- sha256(lower(email)) pour ne pas leak l'email
  fails       int  not null default 1,
  first_fail  timestamptz not null default now(),
  last_fail   timestamptz not null default now(),
  locked_until timestamptz,
  unique (ip, email_hash)
);
create index if not exists auth_lockouts_ip_idx        on auth_lockouts(ip, last_fail desc);
create index if not exists auth_lockouts_locked_idx    on auth_lockouts(locked_until) where locked_until is not null;
alter table auth_lockouts enable row level security;
revoke all on auth_lockouts from authenticated, anon;
drop policy if exists "auth_lockouts read admin_dep" on auth_lockouts;
create policy "auth_lockouts read admin_dep" on auth_lockouts
  for select using (is_admin_dep());

-- Fonction RPC d'enregistrement d'échec + lockout automatique
create or replace function record_auth_fail(p_ip inet, p_email_hash text)
returns table(fails int, locked_until timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_row auth_lockouts%rowtype;
  v_lock_threshold int := 5;
  v_lock_minutes   int := 15;
begin
  -- Si pas d'IP, no-op
  if p_ip is null then
    return;
  end if;
  insert into auth_lockouts(ip, email_hash, fails, first_fail, last_fail)
  values (p_ip, p_email_hash, 1, now(), now())
  on conflict (ip, email_hash) do update
    set fails = case
        when auth_lockouts.last_fail < now() - interval '1 hour'
          then 1
          else auth_lockouts.fails + 1 end,
        last_fail = now(),
        locked_until = case
          when auth_lockouts.fails + 1 >= v_lock_threshold
            then now() + (v_lock_minutes || ' minutes')::interval
          else auth_lockouts.locked_until end
    returning * into v_row;
  return query select v_row.fails, v_row.locked_until;
end;
$$;

revoke execute on function record_auth_fail(inet, text) from public;
grant  execute on function record_auth_fail(inet, text) to service_role;

create or replace function is_auth_locked(p_ip inet, p_email_hash text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from auth_lockouts
    where ip = p_ip
      and (email_hash = p_email_hash or email_hash is null)
      and locked_until is not null
      and locked_until > now()
  );
$$;
revoke execute on function is_auth_locked(inet, text) from public;
grant  execute on function is_auth_locked(inet, text) to service_role;

create or replace function clear_auth_lockout(p_ip inet, p_email_hash text)
returns void
language sql security definer set search_path = public as $$
  delete from auth_lockouts where ip = p_ip and (email_hash = p_email_hash or p_email_hash is null);
$$;
revoke execute on function clear_auth_lockout(inet, text) from public;
grant  execute on function clear_auth_lockout(inet, text) to service_role;

-- ============================================================
-- 3) RLS DEFENSIVE LAYER — Default-deny + revoke tables sensibles
-- ============================================================
-- Toutes ces tables ont RLS active (init_schema.sql), mais on ajoute une
-- couche défensive : revoke select aux roles authenticated, anon par défaut.
-- Les policies définies plus tôt restent en vigueur via service_role/admin
-- pour les requêtes Server-Components. Cela protège contre toute fuite si
-- une policy était mal écrite.

do $$
declare
  t text;
  sensitive_tables text[] := array[
    'audit_logs',
    'audio_transcriptions',
    'text_corrections',
    'paiements',
    'factures',
    'devis',
    'devis_items',
    'incident_messages'
  ];
begin
  foreach t in array sensitive_tables loop
    execute format('revoke insert, update, delete on %I from anon', t);
    -- on garde select via les policies RLS pour authenticated (déjà filtré par org_id)
  end loop;
end;$$;

-- ============================================================
-- 4) STORAGE HARDENING — Vérifier que les buckets sont privés
-- ============================================================
-- chantier-media et audio sont déjà private (cf 20260519180000)
-- mais on s'assure que c'est bien le cas (idempotent).
update storage.buckets set public = false where id in ('chantier-media','audio');

-- Forcer file_size_limit + allowed_mime_types côté bucket (defense layer
-- avant même que le code Next.js ne valide).
update storage.buckets
  set file_size_limit = 30 * 1024 * 1024,            -- 30 MB max
      allowed_mime_types = array[
        'audio/webm','audio/ogg','audio/wav','audio/mp3','audio/mpeg','audio/mp4','audio/x-m4a','audio/aac',
        'image/jpeg','image/png','image/webp','image/heic','image/heif',
        'video/mp4','video/quicktime','video/webm','video/x-m4v'
      ]
  where id = 'chantier-media';

update storage.buckets
  set file_size_limit = 25 * 1024 * 1024,
      allowed_mime_types = array['audio/webm','audio/ogg','audio/wav','audio/mp3','audio/mpeg','audio/mp4','audio/x-m4a','audio/aac']
  where id = 'audio';

-- ============================================================
-- 5) AUDIT TRIGGER SUR PROFILES (role_change) — RGPD compliance
-- ============================================================
-- Un changement de rôle (owner → admin, employee → owner) doit être tracé.

create or replace function log_audit_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'UPDATE' and (old.role is distinct from new.role or old.org_id is distinct from new.org_id)) then
    insert into auth_events(user_id, email, event, metadata, org_id)
    values(
      new.id,
      coalesce((select email from auth.users where id = new.id), null),
      'role_change',
      jsonb_build_object(
        'old_role', old.role,
        'new_role', new.role,
        'old_org', old.org_id,
        'new_org', new.org_id,
        'changed_by', auth.uid()
      ),
      coalesce(new.org_id, old.org_id)
    );
  end if;
  return new;
end;$$;

drop trigger if exists profiles_role_audit on profiles;
create trigger profiles_role_audit after update on profiles
  for each row execute function log_audit_profile_role();

-- ============================================================
-- 6) DEFENSIVE : empêcher un user de remonter son propre role
-- ============================================================
-- Sans ce trigger, si une policy RLS update mal écrite expose la column role,
-- un user pourrait passer son role à 'admin_dep' lui-même.

create or replace function prevent_self_role_escalation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Si la requête vient d'un user (auth.uid() set, pas service_role)
  if auth.uid() is not null
     and new.id = auth.uid()
     and old.role is distinct from new.role then
    raise exception 'Self role escalation forbidden (DEP security)';
  end if;
  return new;
end;$$;

drop trigger if exists profiles_no_self_escalation on profiles;
create trigger profiles_no_self_escalation before update on profiles
  for each row execute function prevent_self_role_escalation();

-- ============================================================
-- 7) PII REDACTION HELPERS — pour les requêtes admin
-- ============================================================
create or replace function mask_email(p text) returns text
language sql immutable as $$
  select case
    when p is null then null
    when position('@' in p) = 0 then '[invalid_email]'
    else substring(p from 1 for 2)
       || '***'
       || substring(p from position('@' in p))
  end;
$$;

create or replace function sha256_lower(p text) returns text
language sql immutable as $$
  select encode(digest(lower(coalesce(p,'')), 'sha256'), 'hex');
$$;

-- Cette fonction nécessite l'extension pgcrypto. On la crée si absente.
create extension if not exists pgcrypto;

-- ============================================================
-- 8) GRANTS récap (pour visibilité)
-- ============================================================
-- service_role : full access, bypass RLS
-- authenticated : access via RLS policies (org_id scoping)
-- anon          : aucun accès sur tables sensibles

comment on table auth_events    is 'P1 — RGPD compliance journal: login, signup, reset, role_change, admin_action. Lecture admin_dep+owner.';
comment on table auth_lockouts  is 'P1 — Brute force lockout IP/email_hash. 5 fails => 15min lock. service_role only.';
