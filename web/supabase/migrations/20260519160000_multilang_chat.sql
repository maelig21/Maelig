-- =====================================================================
-- DEP — Migration 0003 : multilingue + chat équipe + connexion boîte mail
-- =====================================================================

-- ---------- PROFILES : telephone + langue maternelle + rôle préféré ----------
alter table profiles
  add column if not exists telephone text,
  add column if not exists langue_maternelle text default 'fr',
  add column if not exists langue_affichage text default 'fr',
  add column if not exists titre_poste text;

create index if not exists profiles_phone_idx on profiles((lower(telephone))) where telephone is not null;

-- ---------- CLIENTS : langue préférée (envoi devis dans sa langue) ----------
alter table clients
  add column if not exists langue text default 'fr';

-- ---------- CHAT MESSAGES (in-app, auto-traduit) ----------
create table if not exists chat_threads (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  subject text,
  devis_id uuid references devis(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  facture_id uuid references factures(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists chat_threads_org_idx on chat_threads(org_id, updated_at desc);

create table if not exists chat_messages (
  id uuid primary key default uuid_generate_v4(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  sender_id uuid references profiles(id) on delete set null,
  body_raw text not null,                       -- text as written by sender
  lang_raw text default 'fr',                   -- detected/declared language
  translations jsonb default '{}'::jsonb,       -- { "fr": "...", "ar": "...", "pt": "...", ... }
  attachments jsonb,                            -- array of {name, url, size}
  audio_url text,                               -- if voice message
  created_at timestamptz default now()
);
create index if not exists chat_msg_thread_idx on chat_messages(thread_id, created_at);
create index if not exists chat_msg_org_idx on chat_messages(org_id, created_at desc);

-- ---------- MAIL CONNECTIONS (Gmail OAuth pour envoyer depuis la boîte du patron) ----------
create table if not exists mail_connections (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null,                       -- 'google', 'outlook', 'imap'
  email text not null,
  display_name text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text,
  is_default boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists mail_connections_unique on mail_connections(org_id, provider, lower(email));
create index if not exists mail_connections_user_idx on mail_connections(user_id);

-- ---------- TRIGGERS ----------
drop trigger if exists chat_threads_updated_at on chat_threads;
create trigger chat_threads_updated_at before update on chat_threads for each row execute function set_updated_at();

drop trigger if exists mail_connections_updated_at on mail_connections;
create trigger mail_connections_updated_at before update on mail_connections for each row execute function set_updated_at();

-- bump chat_thread updated_at on new message
create or replace function bump_thread_on_msg() returns trigger language plpgsql as $$
begin
  update chat_threads set updated_at = now() where id = new.thread_id;
  return new;
end;$$;
drop trigger if exists chat_msg_bump_thread on chat_messages;
create trigger chat_msg_bump_thread after insert on chat_messages for each row execute function bump_thread_on_msg();

-- ---------- RLS ----------
alter table chat_threads enable row level security;
alter table chat_messages enable row level security;
alter table mail_connections enable row level security;

drop policy if exists "chat_threads all org" on chat_threads;
create policy "chat_threads all org" on chat_threads for all
  using (org_id = current_org_id() or is_admin_dep())
  with check (org_id = current_org_id() or is_admin_dep());

drop policy if exists "chat_messages all org" on chat_messages;
create policy "chat_messages all org" on chat_messages for all
  using (org_id = current_org_id() or is_admin_dep())
  with check (org_id = current_org_id() or is_admin_dep());

drop policy if exists "mail_connections owner" on mail_connections;
create policy "mail_connections owner" on mail_connections for all
  using ((org_id = current_org_id() and (user_id = auth.uid() or is_owner())) or is_admin_dep())
  with check ((org_id = current_org_id() and (user_id = auth.uid() or is_owner())) or is_admin_dep());

-- ---------- ORGS : langue préférée d'affichage ----------
alter table orgs
  add column if not exists langue_affichage text default 'fr',
  add column if not exists langues_supportees text[] default array['fr']::text[];
