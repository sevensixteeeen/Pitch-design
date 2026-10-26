-- 0002: remember deleted accounts (BUG-003).
--
-- Deleting the Supabase login doesn't cancel the login tokens already handed out;
-- they stay valid until they expire (1 hour by default). Without this table, a tab
-- still open after "delete my account" would recreate the profile on its next
-- request and could create designs that nobody can ever log in to delete.
-- The API refuses (401) any token whose user id is listed here.
--
-- Only the id is kept: no email, no name. Rows are useless once every token
-- issued before the deletion has expired, so the daily purge job (milestone 3)
-- can delete rows older than a day.

create table deleted_accounts (
  id uuid primary key,  -- the Supabase auth user id (= the old profiles.id)
  deleted_at timestamptz not null default now()
);

-- same backstop as every table: invisible to Supabase's Data API
alter table deleted_accounts enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on deleted_accounts from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on deleted_accounts from authenticated';
  end if;
end;
$$;
