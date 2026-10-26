-- schema.sql: first migration for the Canva-style editor clone.
-- Python API (FastAPI + psycopg 3) on Supabase Postgres (15+). See architecture.md.
--
-- ACCESS RULE: data-layer checks. Every query the FastAPI app runs filters by
-- owner_id = the signed-in user's id (the "sub" claim of their verified login
-- token). The API connects as the table owner, which bypasses row level security.
--
-- BACKSTOP: row level security is turned on for every table with NO policies, and
-- the anon/authenticated roles lose all table rights. Supabase's auto-generated
-- Data API (which anyone holding the public "anon" key can call) therefore reads
-- and writes nothing. Also untick "public" under Settings > Data API > Exposed schemas.
--
-- PORTABLE: nothing here references Supabase's own `auth` or `storage` schemas, so
-- the same file runs on a plain local Postgres for tests. Storage buckets are set
-- up in the dashboard (see architecture.md, "Files").
--
-- Needs Postgres 15+ for `on delete set null (column)`.

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per Supabase Auth user, created by the API on the first
-- request that user makes (insert ... on conflict do nothing).
-- id IS the Supabase auth user id, so it has no default.
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key,
  display_name text
    check (display_name is null or char_length(btrim(display_name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- folders: one level deep (no folders inside folders)
-- ---------------------------------------------------------------------------
create table folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- target of the composite foreign key from designs: a design can only be
  -- put in a folder that has the same owner
  constraint folders_id_owner_key unique (id, owner_id)
);
create index folders_owner_name_idx on folders (owner_id, lower(name));

-- ---------------------------------------------------------------------------
-- templates: written by you (seed SQL / service role), read by every user.
-- No owner. Copied into a new design; never linked to it afterwards.
-- ---------------------------------------------------------------------------
create table templates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 255),
  category text not null
    check (category in ('social_post', 'story', 'presentation', 'a4_document', 'poster')),
  width_px integer not null check (width_px between 40 and 8000),
  height_px integer not null check (height_px between 40 and 8000),
  content jsonb not null,
  thumbnail_path text not null,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint templates_area_cap check (width_px::bigint * height_px <= 25000000),
  constraint templates_has_pages check (
    case when jsonb_typeof(content -> 'pages') = 'array'
         then jsonb_array_length(content -> 'pages') between 1 and 200
         else false end
  )
);
create index templates_browse_idx on templates (category, sort_order) where is_published;

-- ---------------------------------------------------------------------------
-- designs: one row per design. Pages and elements live in `content` (typed
-- JSON, validated by Pydantic in the API before every write).
-- ---------------------------------------------------------------------------
create table designs (
  -- the browser may send its own uuid, so a retried "create" is harmless
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  folder_id uuid,
  title text not null default 'Untitled design'
    check (char_length(btrim(title)) between 1 and 255),
  width_px integer not null check (width_px between 40 and 8000),
  height_px integer not null check (height_px between 40 and 8000),
  display_unit text not null default 'px'
    check (display_unit in ('px', 'in', 'mm', 'cm')),
  content jsonb not null,
  page_count integer generated always as (
    case when jsonb_typeof(content -> 'pages') = 'array'
         then jsonb_array_length(content -> 'pages')
         else 0 end
  ) stored,
  -- bumps on every content save; a save that sends an old revision is refused (409)
  revision integer not null default 1 check (revision >= 1),
  thumbnail_path text,
  deleted_at timestamptz,          -- set = in Trash; purged 30 days later
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint designs_area_cap check (width_px::bigint * height_px <= 25000000),
  -- "cannot delete the last page" is enforced here, not only in the UI
  constraint designs_has_pages check (
    case when jsonb_typeof(content -> 'pages') = 'array'
         then jsonb_array_length(content -> 'pages') between 1 and 200
         else false end
  ),
  constraint designs_content_size check (octet_length(content::text) <= 2000000),
  constraint designs_id_owner_key unique (id, owner_id),
  -- deleting a folder moves its designs back to the Projects root
  constraint designs_folder_same_owner_fk foreign key (folder_id, owner_id)
    references folders (id, owner_id) on delete set null (folder_id)
);
-- home "recent designs" + the owner foreign key (not partial, so cascades use it)
create index designs_owner_recent_idx on designs (owner_id, updated_at desc);
-- folder view + the folder foreign key
create index designs_folder_idx on designs (folder_id, owner_id);
-- trash list + the 30-day purge job
create index designs_trash_idx on designs (deleted_at) where deleted_at is not null;
-- milestone 4 (search your designs):
--   create extension if not exists pg_trgm;
--   create index designs_title_trgm_idx on designs using gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- assets: images the user uploaded. The file lives in Supabase Storage at
-- storage_path; this row is created as 'pending' before the upload and marked
-- 'ready' after the API confirms the file arrived.
-- ---------------------------------------------------------------------------
create table assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  storage_path text not null unique,
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 26214400),   -- 25 MB
  width_px integer check (width_px between 1 and 8000),
  height_px integer check (height_px between 1 and 8000),
  original_name text check (original_name is null or char_length(original_name) <= 255),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assets_ready_has_size check (
    status = 'pending' or (width_px is not null and height_px is not null)
  )
);
-- Uploads panel + the owner foreign key + the per-user storage quota sum
create index assets_owner_recent_idx on assets (owner_id, created_at desc);
create index assets_trash_idx on assets (deleted_at) where deleted_at is not null;
-- cleanup of uploads that were started but never finished
create index assets_pending_idx on assets (created_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- design_versions (milestone 4, version history): snapshots of older content.
-- At most one snapshot per design per 10 minutes of editing; 1,000 kept per design.
-- ---------------------------------------------------------------------------
create table design_versions (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null,
  owner_id uuid not null references profiles (id) on delete cascade,
  revision integer not null,
  width_px integer not null,
  height_px integer not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint design_versions_design_fk foreign key (design_id, owner_id)
    references designs (id, owner_id) on delete cascade
);
create index design_versions_design_idx on design_versions (design_id, created_at desc);
create index design_versions_owner_idx on design_versions (owner_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger folders_updated_at before update on folders
  for each row execute function set_updated_at();
create trigger templates_updated_at before update on templates
  for each row execute function set_updated_at();
create trigger designs_updated_at before update on designs
  for each row execute function set_updated_at();
create trigger assets_updated_at before update on assets
  for each row execute function set_updated_at();
create trigger design_versions_updated_at before update on design_versions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Backstop against Supabase's auto-generated Data API (see header)
-- ---------------------------------------------------------------------------
alter table profiles        enable row level security;
alter table folders         enable row level security;
alter table templates       enable row level security;
alter table designs         enable row level security;
alter table assets          enable row level security;
alter table design_versions enable row level security;

do $$
begin
  -- these roles exist on Supabase; skip quietly on a plain local Postgres
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
  end if;
end;
$$;
