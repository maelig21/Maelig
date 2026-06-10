-- =====================================================================
-- DEP — Migration 0004 : workflow validation patron + module incidents
-- =====================================================================

-- ---------- 1) Statut devis : ajout "en_attente_validation_patron" ----------
do $$ begin
  alter type devis_statut add value if not exists 'en_attente_validation_patron' before 'en_attente_validation';
exception when others then null; end $$;

-- Trigger : quand un esclave crée un devis, il bascule auto en en_attente_validation_patron
create or replace function force_slave_devis_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role user_role;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role = 'slave' then
    -- Slave force le statut en attente de validation patron
    if new.statut in ('en_attente_validation','signe_non_paye','facture_en_attente','facture_payee','facture_abandonnee') then
      new.statut := 'en_attente_validation_patron';
    end if;
  end if;
  return new;
end;$$;

drop trigger if exists devis_slave_force_status on devis;
create trigger devis_slave_force_status
  before insert or update of statut on devis
  for each row execute function force_slave_devis_status();

-- ---------- 2) Table CHANTIERS (regroupement par projet) ----------
create table if not exists chantiers (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  nom text not null,
  adresse text,
  client_id uuid references clients(id) on delete set null,
  statut text default 'actif',          -- 'actif','en_pause','termine','annule'
  date_debut date,
  date_fin_prevue date,
  date_fin_reelle date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists chantiers_org_idx on chantiers(org_id);
create index if not exists chantiers_statut_idx on chantiers(statut);

-- Lien devis -> chantier
alter table devis add column if not exists chantier_id uuid references chantiers(id) on delete set null;
alter table factures add column if not exists chantier_id uuid references chantiers(id) on delete set null;

-- ---------- 3) Table INCIDENTS ----------
do $$ begin
  create type incident_urgency as enum ('urgent','important','normal','info');
exception when duplicate_object then null; end $$;

do $$ begin
  create type incident_statut as enum ('ouvert','en_cours','resolu','escalade','ferme');
exception when duplicate_object then null; end $$;

create table if not exists incidents (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  sender_id uuid references profiles(id) on delete set null,
  chantier_id uuid references chantiers(id) on delete set null,
  devis_id uuid references devis(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  titre text,                            -- résumé court IA
  description_raw text,                   -- transcript vocal brut
  description_corrigee text,              -- corrigée + traduite FR
  lang_detected text,
  audio_url text,
  attachments jsonb default '[]'::jsonb, -- array of {url, type, name, size}
  urgency incident_urgency default 'normal',
  statut incident_statut default 'ouvert',
  ai_priorite_score numeric(3,2),         -- 0..1 (1 = max)
  ai_resume text,                         -- résumé IA pour patron
  ai_action_recommandee text,             -- conseil action immédiate
  reponse_patron text,                    -- réponse rapide patron
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists incidents_org_idx on incidents(org_id, created_at desc);
create index if not exists incidents_chantier_idx on incidents(chantier_id);
create index if not exists incidents_statut_idx on incidents(statut, urgency);
create index if not exists incidents_unresolved_idx on incidents(org_id, urgency) where statut in ('ouvert','en_cours','escalade');

-- ---------- 4) Thread de messages sur un incident ----------
create table if not exists incident_messages (
  id uuid primary key default uuid_generate_v4(),
  incident_id uuid not null references incidents(id) on delete cascade,
  sender_id uuid references profiles(id) on delete set null,
  body_raw text not null,
  body_corrected text,
  translations jsonb default '{}'::jsonb,
  audio_url text,
  attachments jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
create index if not exists incident_msg_inc on incident_messages(incident_id, created_at);

-- ---------- 5) Storage bucket photos chantier (privé per-org) ----------
insert into storage.buckets (id, name, public)
values ('chantier-media','chantier-media', false)
on conflict (id) do nothing;

drop policy if exists "chantier-media read" on storage.objects;
create policy "chantier-media read" on storage.objects for select using (
  bucket_id = 'chantier-media'
  and (split_part(name, '/', 1) = current_org_id()::text or is_admin_dep())
);
drop policy if exists "chantier-media write" on storage.objects;
create policy "chantier-media write" on storage.objects for insert with check (
  bucket_id = 'chantier-media'
  and (split_part(name, '/', 1) = current_org_id()::text or is_admin_dep())
);

-- ---------- 6) Triggers ----------
drop trigger if exists chantiers_updated_at on chantiers;
create trigger chantiers_updated_at before update on chantiers for each row execute function set_updated_at();

drop trigger if exists incidents_updated_at on incidents;
create trigger incidents_updated_at before update on incidents for each row execute function set_updated_at();

-- ---------- 7) RLS ----------
alter table chantiers enable row level security;
alter table incidents enable row level security;
alter table incident_messages enable row level security;

drop policy if exists "chantiers all org" on chantiers;
create policy "chantiers all org" on chantiers for all
  using (org_id = current_org_id() or is_admin_dep())
  with check (org_id = current_org_id() or is_admin_dep());

drop policy if exists "incidents read org" on incidents;
create policy "incidents read org" on incidents for select using (org_id = current_org_id() or is_admin_dep());
drop policy if exists "incidents insert org" on incidents;
create policy "incidents insert org" on incidents for insert with check (org_id = current_org_id() or is_admin_dep());
drop policy if exists "incidents update org" on incidents;
create policy "incidents update org" on incidents for update using (org_id = current_org_id() or is_admin_dep());
drop policy if exists "incidents delete owner" on incidents;
create policy "incidents delete owner" on incidents for delete using ((org_id = current_org_id() and is_owner()) or is_admin_dep());

drop policy if exists "incident_msg all org" on incident_messages;
create policy "incident_msg all org" on incident_messages for all
  using (exists (select 1 from incidents i where i.id = incident_id and (i.org_id = current_org_id() or is_admin_dep())))
  with check (exists (select 1 from incidents i where i.id = incident_id and (i.org_id = current_org_id() or is_admin_dep())));
