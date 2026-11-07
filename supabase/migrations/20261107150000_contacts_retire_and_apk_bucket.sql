-- Contacts (club → players, platform → club admins), chip retirement back to the platform,
-- per-club platform share of the rake, and the public bucket that hosts the latest APK.
-- BUSINESS_LOGIC.md §3.3 (operator ↔ club) and §7 (distribution).

-- ---------------------------------------------------------------------------
-- Contacts. Any economic agreement happens outside the app (§1): the app only shows who to
-- talk to when someone runs out of chips. club_id null = the platform operator's contacts,
-- visible to club admins; otherwise the club's contacts, visible to its active members.
-- ---------------------------------------------------------------------------

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.clubs (id) on delete cascade,
  label text not null check (char_length(label) between 2 and 40),
  -- International format, digits only (an optional leading +): used for wa.me links.
  phone text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  sort_order smallint not null default 0,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index contacts_club_idx on public.contacts (club_id, sort_order);

-- Admin of at least one active club: may read the platform's contacts.
create function public.is_any_club_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_members
    where user_id = auth.uid() and status = 'active' and role in ('owner', 'admin')
  );
$$;

create function public.can_manage_contacts(p_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_club is null then public.is_platform() else public.is_club_admin(p_club) end;
$$;

-- At most 5 contacts per club (and 5 for the platform).
create function public.contacts_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.contacts c where c.club_id is not distinct from new.club_id) >= 5 then
    raise exception 'too_many_contacts' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger contacts_limit
  before insert on public.contacts
  for each row execute function public.contacts_limit();

alter table public.contacts enable row level security;

create policy contacts_read on public.contacts
  for select to authenticated using (
    (select public.is_platform())
    or (club_id is null and (select public.is_any_club_admin()))
    or (club_id is not null and public.is_club_member(club_id))
  );
create policy contacts_insert on public.contacts
  for insert to authenticated with check (public.can_manage_contacts(club_id));
create policy contacts_update on public.contacts
  for update to authenticated using (public.can_manage_contacts(club_id)) with check (public.can_manage_contacts(club_id));
create policy contacts_delete on public.contacts
  for delete to authenticated using (public.can_manage_contacts(club_id));

revoke all on public.contacts from anon;

-- ---------------------------------------------------------------------------
-- Retirement: chips go back from a club (treasury, or its platform-share account) to the
-- issuance account. Used when the operator settles with a club outside the app (a club that
-- returns chips, the platform share being paid, a club closing). Note always required.
-- ---------------------------------------------------------------------------

alter table public.chip_ledger drop constraint chip_ledger_kind_check;
alter table public.chip_ledger add constraint chip_ledger_kind_check
  check (kind in ('issue', 'retire', 'assign', 'withdraw', 'buy_in', 'payout', 'rake', 'refund', 'adjustment'));
alter table public.chip_ledger add constraint chip_ledger_retire_note
  check (kind <> 'retire' or char_length(coalesce(note, '')) > 0);

create or replace function public._post_chips(
  p_from uuid,
  p_to uuid,
  p_amount integer,
  p_kind text,
  p_game uuid default null,
  p_actor uuid default null,
  p_note text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from public.chip_accounts;
  v_to public.chip_accounts;
  v_from_after bigint;
  v_to_after bigint;
  v_id bigint;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;

  -- Lock both accounts in a stable order to avoid deadlocks.
  perform 1 from public.chip_accounts where id in (p_from, p_to) order by id for update;
  select * into v_from from public.chip_accounts where id = p_from;
  select * into v_to from public.chip_accounts where id = p_to;
  if v_from.id is null or v_to.id is null then
    raise exception 'chip_account_not_found' using errcode = 'P0001';
  end if;
  if v_from.club_id <> v_to.club_id then
    raise exception 'cross_club_transfer' using errcode = 'P0001';
  end if;

  if not (
    (p_kind = 'issue' and v_from.kind = 'issuance' and v_to.kind = 'treasury')
    or (p_kind = 'retire' and v_from.kind in ('treasury', 'platform') and v_to.kind = 'issuance')
    or (p_kind = 'assign' and v_from.kind = 'treasury' and v_to.kind = 'player')
    or (p_kind = 'withdraw' and v_from.kind = 'player' and v_to.kind = 'treasury')
    or (p_kind = 'buy_in' and v_from.kind = 'player' and v_to.kind = 'pot')
    or (p_kind in ('payout', 'refund') and v_from.kind = 'pot' and v_to.kind = 'player')
    or (p_kind = 'rake' and v_from.kind = 'pot' and v_to.kind in ('treasury', 'platform'))
    or (p_kind = 'adjustment' and (
      (v_from.kind = 'treasury' and v_to.kind = 'player') or (v_from.kind = 'player' and v_to.kind = 'treasury')
    ))
  ) then
    raise exception 'invalid_chip_movement' using errcode = 'P0001';
  end if;

  if v_from.kind <> 'issuance' and v_from.balance < p_amount then
    raise exception 'insufficient_chips' using errcode = 'P0001';
  end if;

  update public.chip_accounts set balance = balance - p_amount, updated_at = now()
   where id = p_from returning balance into v_from_after;
  update public.chip_accounts set balance = balance + p_amount, updated_at = now()
   where id = p_to returning balance into v_to_after;

  insert into public.chip_ledger (
    club_id, kind, amount, from_account, to_account, from_balance_after, to_balance_after, game_id, note, created_by
  ) values (
    v_from.club_id, p_kind, p_amount, p_from, p_to, v_from_after, v_to_after, p_game, p_note, p_actor
  ) returning id into v_id;

  return v_id;
end;
$$;

-- p_source: 'treasury' or 'platform' (the club's accumulated platform share).
create function public.platform_retire_chips(p_club uuid, p_source text, p_amount integer, p_note text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_platform();
begin
  if p_source not in ('treasury', 'platform') then
    raise exception 'invalid_source' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'note_required' using errcode = 'P0001';
  end if;
  perform public._post_chips(
    public._club_account(p_club, p_source), public._club_account(p_club, 'issuance'), p_amount, 'retire', null, v_uid, trim(p_note)
  );
  return (select balance from public.chip_accounts where club_id = p_club and kind = p_source);
end;
$$;

-- Share of each game's rake that goes to the club's platform account (0 for the operator's
-- own clubs; a lever for third-party clubs). Applies to games started afterwards.
create function public.platform_set_club_share(p_club uuid, p_share_pct numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_platform();
  if p_share_pct is null or p_share_pct < 0 or p_share_pct > 100 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  update public.clubs set platform_share_pct = p_share_pct where id = p_club;
  if not found then
    raise exception 'club_not_found' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function
  public.is_any_club_admin(),
  public.can_manage_contacts(uuid),
  public.contacts_limit(),
  public._post_chips(uuid, uuid, integer, text, uuid, uuid, text),
  public.platform_retire_chips(uuid, text, integer, text),
  public.platform_set_club_share(uuid, numeric)
from public, anon, authenticated;

-- Used inside RLS policies.
grant execute on function public.is_any_club_admin(), public.can_manage_contacts(uuid) to authenticated;
-- Each checks the caller is the platform.
grant execute on function
  public.platform_retire_chips(uuid, text, integer, text),
  public.platform_set_club_share(uuid, numeric)
to authenticated;

-- ---------------------------------------------------------------------------
-- APK distribution: public bucket with a single `domino.apk` (always the latest, overwritten
-- by the GitHub Action) and `latest.json`. Uploads only with the service role; no policies.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('apk', 'apk', true, 104857600, array['application/vnd.android.package-archive', 'application/json'])
on conflict (id) do nothing;
