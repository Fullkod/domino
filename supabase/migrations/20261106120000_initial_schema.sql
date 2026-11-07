-- Domino — initial schema (club model).
-- Business rules: BUSINESS_LOGIC.md. Plan: .titan/plans/prp-clubes-y-mesas-con-apuesta.md.
-- Every table has RLS. Clients only READ through RLS (except club admins managing table
-- templates); every other write goes through a SECURITY DEFINER function with explicit grants,
-- or through the service role (Edge Function `game-action`, which runs the rules engine).
-- The app never handles money: clubs assign and withdraw chips; chips move between accounts of
-- the same club through a double-entry, append-only ledger (§3).

-- ---------------------------------------------------------------------------
-- Profiles and global roles (§2.1)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 30),
  role text not null default 'player' check (role in ('player', 'platform')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

create function public.is_platform()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'platform' and status = 'active'
  );
$$;

-- Raises unless the caller is signed in and not suspended. Returns the caller id.
create function public.assert_active_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    raise exception 'user_suspended' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

create function public.assert_platform()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
begin
  if not public.is_platform() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Global settings (singleton row)
-- ---------------------------------------------------------------------------

create table public.app_settings (
  id boolean primary key default true check (id),
  min_app_version text not null default '0.1.0',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

insert into public.app_settings (id) values (true);

-- ---------------------------------------------------------------------------
-- Clubs and membership (§2.2, §3.1, §6)
-- ---------------------------------------------------------------------------

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  -- Short public code players type to find the club.
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  name text not null check (char_length(name) between 2 and 40),
  owner_id uuid not null references public.profiles (id),
  status text not null default 'active' check (status in ('active', 'suspended')),
  rake_pct numeric(5, 2) not null default 5 check (rake_pct between 0 and 20),
  rake_cap integer check (rake_cap > 0),
  -- Share of the rake for the platform owner. 0 by decision D2 (BUSINESS_LOGIC §1.1).
  platform_share_pct numeric(5, 2) not null default 0 check (platform_share_pct between 0 and 100),
  created_at timestamptz not null default now()
);

create table public.club_members (
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'player' check (role in ('owner', 'admin', 'player')),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  primary key (club_id, user_id)
);

create index club_members_user_idx on public.club_members (user_id);
create index club_members_pending_idx on public.club_members (club_id, requested_at) where status = 'pending';

-- Active member of an active or suspended club (reads keep working while a club is suspended).
create function public.is_club_member(p_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club and user_id = auth.uid() and status = 'active'
  );
$$;

create function public.is_club_admin(p_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club and user_id = auth.uid() and status = 'active' and role in ('owner', 'admin')
  );
$$;

-- Raises unless the caller can administer the club and the club is active. Returns the caller id.
create function public.assert_club_admin(p_club uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
begin
  if not public.is_club_admin(p_club) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.clubs where id = p_club and status = 'active') then
    raise exception 'club_suspended' using errcode = 'P0001';
  end if;
  return v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Table templates, tables, seats (§4.1, §4.2)
-- ---------------------------------------------------------------------------

create table public.table_templates (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  max_pip smallint not null default 9 check (max_pip in (6, 9)),
  format text not null default 'pairs' check (format in ('pairs', 'one_vs_one')),
  mode text not null default 'all_in' check (mode in ('all_in')),
  entry integer not null check (entry between 5 and 10500),
  target_points integer not null default 100 check (target_points > 0),
  scoring text not null default 'all_hands' check (scoring in ('all_hands', 'opponents')),
  turn_seconds integer not null default 30 check (turn_seconds between 10 and 120),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index table_templates_club_idx on public.table_templates (club_id, sort_order);

create function public.table_capacity(p_format text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case p_format when 'one_vs_one' then 2 else 4 end::smallint;
$$;

create table public.game_tables (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  template_id uuid not null references public.table_templates (id),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished', 'closed')),
  current_game_id uuid,
  created_at timestamptz not null default now()
);

create index game_tables_template_waiting_idx on public.game_tables (template_id) where status = 'waiting';
create index game_tables_club_idx on public.game_tables (club_id, status);

create table public.table_seats (
  table_id uuid not null references public.game_tables (id) on delete cascade,
  seat smallint not null check (seat between 0 and 3),
  user_id uuid not null references public.profiles (id) on delete cascade,
  is_ready boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (table_id, seat),
  -- A player can only be seated at one table at a time.
  unique (user_id)
);

-- ---------------------------------------------------------------------------
-- Games, hands, moves (§4–§5)
-- ---------------------------------------------------------------------------

create table public.games (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  table_id uuid not null references public.game_tables (id),
  template_id uuid not null references public.table_templates (id),
  status text not null default 'playing' check (status in ('playing', 'finished', 'cancelled')),
  -- Rules and money snapshot taken when the game starts.
  entry integer not null check (entry > 0),
  players smallint not null check (players in (2, 4)),
  max_pip smallint not null,
  target_points integer not null,
  scoring text not null,
  turn_seconds integer not null,
  rake_pct numeric(5, 2) not null,
  rake_cap integer,
  platform_share_pct numeric(5, 2) not null,
  -- Settlement (§4.3). pot = entry × players; rake includes platform_rake.
  pot integer not null,
  rake integer not null default 0 check (rake between 0 and pot),
  platform_rake integer not null default 0 check (platform_rake between 0 and rake),
  score_team0 integer not null default 0,
  score_team1 integer not null default 0,
  winner_team smallint check (winner_team in (0, 1)),
  end_reason text check (end_reason in ('target_reached', 'abandoned', 'cancelled_by_admin', 'abandoned_first_hand')),
  hand_no integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint games_pot check (pot = entry * players)
);

create index games_club_started_idx on public.games (club_id, started_at);

alter table public.game_tables
  add constraint game_tables_current_game_fk foreign key (current_game_id) references public.games (id);

create table public.game_players (
  game_id uuid not null references public.games (id) on delete cascade,
  seat smallint not null check (seat between 0 and 3),
  user_id uuid not null references public.profiles (id),
  team smallint generated always as (seat % 2) stored,
  consecutive_timeouts smallint not null default 0,
  payout integer not null default 0 check (payout >= 0),
  refunded boolean not null default false,
  primary key (game_id, seat),
  unique (game_id, user_id)
);

create index game_players_user_idx on public.game_players (user_id);

-- Public state of a hand: everyone at the table sees it. Never contains tiles in hand.
create table public.hands (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  hand_no integer not null,
  starter_seat smallint not null check (starter_seat between 0 and 3),
  turn_seat smallint not null check (turn_seat between 0 and 3),
  board jsonb not null default '[]'::jsonb,
  left_end smallint,
  right_end smallint,
  tile_counts smallint[] not null,
  passes_in_row smallint not null default 0,
  required_opening jsonb,
  status text not null default 'playing' check (status in ('playing', 'finished')),
  result jsonb,
  turn_deadline timestamptz,
  -- Optimistic concurrency for the Edge Function: update ... where version = expected.
  version integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (game_id, hand_no)
);

-- Private tiles: each player can only read their own row (§5.6).
create table public.hand_tiles (
  hand_id uuid not null references public.hands (id) on delete cascade,
  seat smallint not null check (seat between 0 and 3),
  tiles jsonb not null,
  primary key (hand_id, seat)
);

create table public.moves (
  id bigint generated always as identity primary key,
  hand_id uuid not null references public.hands (id) on delete cascade,
  seq integer not null,
  seat smallint not null check (seat between 0 and 3),
  kind text not null check (kind in ('play', 'pass', 'timeout_play', 'timeout_pass')),
  tile jsonb,
  side text check (side in ('left', 'right')),
  created_at timestamptz not null default now(),
  unique (hand_id, seq)
);

-- ---------------------------------------------------------------------------
-- Chips: accounts + double-entry, append-only ledger (§3.2)
-- Invariant: the balances of every club add up to 0 (issuance is the only negative account).
-- ---------------------------------------------------------------------------

create table public.chip_accounts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  kind text not null check (kind in ('issuance', 'treasury', 'platform', 'player', 'pot')),
  user_id uuid references public.profiles (id),
  game_id uuid references public.games (id),
  balance bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint chip_accounts_non_negative check (kind = 'issuance' or balance >= 0),
  constraint chip_accounts_owner check (
    (kind = 'player' and user_id is not null and game_id is null)
    or (kind = 'pot' and game_id is not null and user_id is null)
    or (kind in ('issuance', 'treasury', 'platform') and user_id is null and game_id is null)
  )
);

create unique index chip_accounts_club_singleton_idx on public.chip_accounts (club_id, kind)
  where kind in ('issuance', 'treasury', 'platform');
create unique index chip_accounts_player_idx on public.chip_accounts (club_id, user_id) where kind = 'player';
create unique index chip_accounts_pot_idx on public.chip_accounts (game_id) where kind = 'pot';
create index chip_accounts_user_idx on public.chip_accounts (user_id) where user_id is not null;

create table public.chip_ledger (
  id bigint generated always as identity primary key,
  club_id uuid not null references public.clubs (id),
  kind text not null check (kind in ('issue', 'assign', 'withdraw', 'buy_in', 'payout', 'rake', 'refund', 'adjustment')),
  amount integer not null check (amount > 0),
  from_account uuid not null references public.chip_accounts (id),
  to_account uuid not null references public.chip_accounts (id),
  from_balance_after bigint not null,
  to_balance_after bigint not null,
  game_id uuid references public.games (id),
  note text,
  -- null = done by the system (game server).
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint chip_ledger_distinct check (from_account <> to_account),
  constraint chip_ledger_adjustment_note check (kind <> 'adjustment' or char_length(coalesce(note, '')) > 0)
);

create index chip_ledger_club_idx on public.chip_ledger (club_id, created_at desc);
create index chip_ledger_from_idx on public.chip_ledger (from_account, created_at desc);
create index chip_ledger_to_idx on public.chip_ledger (to_account, created_at desc);
create index chip_ledger_game_idx on public.chip_ledger (game_id) where game_id is not null;

create function public.forbid_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'chip_ledger is append-only; post a compensating entry instead';
end;
$$;

create trigger chip_ledger_no_update
  before update or delete on public.chip_ledger
  for each row execute function public.forbid_ledger_mutation();

-- Single entry point for balance changes. Internal: only other definer functions call it.
-- Each kind can only move chips between specific account kinds of the same club.
create function public._post_chips(
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

create function public._club_account(p_club uuid, p_kind text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.chip_accounts where club_id = p_club and kind = p_kind and user_id is null and game_id is null;
  if v_id is null then
    raise exception 'chip_account_not_found' using errcode = 'P0001';
  end if;
  return v_id;
end;
$$;

-- Player account in a club, created on first use (membership approval).
create function public._player_account(p_club uuid, p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.chip_accounts where club_id = p_club and kind = 'player' and user_id = p_user;
  if v_id is null then
    insert into public.chip_accounts (club_id, kind, user_id) values (p_club, 'player', p_user) returning id into v_id;
  end if;
  return v_id;
end;
$$;

create function public._player_balance(p_club uuid, p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select balance from public.chip_accounts where club_id = p_club and kind = 'player' and user_id = p_user),
    0
  );
$$;

-- ---------------------------------------------------------------------------
-- New users: profile only (chip accounts are per club)
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
begin
  if v_name is null or char_length(v_name) not between 2 and 30 then
    v_name := 'Jugador ' || left(new.id::text, 6);
  end if;
  insert into public.profiles (id, display_name) values (new.id, v_name);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Player RPCs
-- ---------------------------------------------------------------------------

create function public.update_my_display_name(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
begin
  update public.profiles set display_name = trim(p_name) where id = v_uid;
end;
$$;

-- Lets a player see a club before asking to join it.
create function public.find_club(p_code text)
returns table (club_id uuid, club_name text, members bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_active_user();
  return query
    select c.id, c.name,
           (select count(*) from public.club_members m where m.club_id = c.id and m.status = 'active')
      from public.clubs c
     where c.code = upper(trim(p_code)) and c.status = 'active';
end;
$$;

create function public.request_join_club(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
  v_club uuid;
  v_status text;
begin
  select id into v_club from public.clubs where code = upper(trim(p_code)) and status = 'active';
  if v_club is null then
    raise exception 'club_not_found' using errcode = 'P0001';
  end if;

  select status into v_status from public.club_members where club_id = v_club and user_id = v_uid for update;
  if v_status is null then
    insert into public.club_members (club_id, user_id) values (v_club, v_uid);
  elsif v_status = 'rejected' then
    update public.club_members
       set status = 'pending', requested_at = now(), reviewed_by = null, reviewed_at = null
     where club_id = v_club and user_id = v_uid;
  elsif v_status = 'suspended' then
    raise exception 'member_suspended' using errcode = 'P0001';
  end if;
  -- pending or active: nothing to do.
  return v_club;
end;
$$;

-- Matchmaking: seats the caller at a waiting table of the template, creating one if needed.
-- Players cannot pick a table or seat, which makes arranging partners harder (§5.6).
create function public.join_table(p_template uuid)
returns table (joined_table_id uuid, joined_seat smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
  v_tpl public.table_templates;
  v_capacity smallint;
  v_table uuid;
  v_seat smallint;
begin
  select t.* into v_tpl
    from public.table_templates t
    join public.clubs c on c.id = t.club_id
   where t.id = p_template and t.is_active and c.status = 'active';
  if v_tpl.id is null then
    raise exception 'table_not_available' using errcode = 'P0001';
  end if;
  if not public.is_club_member(v_tpl.club_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if exists (select 1 from public.table_seats s where s.user_id = v_uid) then
    raise exception 'already_seated' using errcode = 'P0001';
  end if;
  if public._player_balance(v_tpl.club_id, v_uid) < v_tpl.entry then
    raise exception 'insufficient_chips' using errcode = 'P0001';
  end if;

  v_capacity := public.table_capacity(v_tpl.format);

  select t.id into v_table
    from public.game_tables t
   where t.template_id = p_template
     and t.status = 'waiting'
     and (select count(*) from public.table_seats s where s.table_id = t.id) < v_capacity
   order by t.created_at
   limit 1
   for update skip locked;

  if v_table is null then
    insert into public.game_tables (club_id, template_id) values (v_tpl.club_id, p_template) returning id into v_table;
  end if;

  select min(g.s)::smallint into v_seat
    from generate_series(0, v_capacity - 1) as g(s)
   where not exists (select 1 from public.table_seats s where s.table_id = v_table and s.seat = g.s);

  insert into public.table_seats (table_id, seat, user_id) values (v_table, v_seat, v_uid);
  return query select v_table, v_seat;
end;
$$;

create function public.leave_table()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
begin
  delete from public.table_seats s
   using public.game_tables t
   where s.user_id = v_uid
     and t.id = s.table_id
     and t.status in ('waiting', 'finished');
  if not found then
    raise exception 'cannot_leave_now' using errcode = 'P0001';
  end if;
end;
$$;

-- Ready requires enough chips for the entry; the buy-in itself happens in start_game.
create function public.set_ready(p_ready boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
  v_entry integer;
  v_club uuid;
begin
  select tp.entry, t.club_id into v_entry, v_club
    from public.table_seats s
    join public.game_tables t on t.id = s.table_id
    join public.table_templates tp on tp.id = t.template_id
   where s.user_id = v_uid and t.status in ('waiting', 'finished');
  if v_entry is null then
    raise exception 'not_seated' using errcode = 'P0001';
  end if;
  if p_ready and public._player_balance(v_club, v_uid) < v_entry then
    raise exception 'insufficient_chips' using errcode = 'P0001';
  end if;
  update public.table_seats set is_ready = p_ready where user_id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Game server RPCs (service role only; called by the `game-action` Edge Function)
-- ---------------------------------------------------------------------------

-- Buy-in of every ready player in one transaction and opens the game (§4.2).
-- If anyone is short of chips, nobody pays: their ready flag is cleared and the function
-- returns null. Dealing the first hand is up to the caller.
create function public.start_game(p_table uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.game_tables;
  v_tpl public.table_templates;
  v_club public.clubs;
  v_capacity smallint;
  v_game uuid;
  v_pot uuid;
  v_short integer;
  v_player record;
begin
  select * into v_table from public.game_tables
   where id = p_table and status in ('waiting', 'finished')
   for update;
  if v_table.id is null then
    raise exception 'table_not_startable' using errcode = 'P0001';
  end if;
  select * into v_tpl from public.table_templates where id = v_table.template_id;
  select * into v_club from public.clubs where id = v_table.club_id;
  if v_club.status <> 'active' then
    raise exception 'club_suspended' using errcode = 'P0001';
  end if;

  v_capacity := public.table_capacity(v_tpl.format);
  if (select count(*) from public.table_seats where table_id = p_table and is_ready) <> v_capacity then
    raise exception 'table_not_ready' using errcode = 'P0001';
  end if;

  -- Lock the player accounts in a stable order, then check balances.
  perform 1 from public.chip_accounts a
    where a.club_id = v_club.id and a.kind = 'player'
      and a.user_id in (select user_id from public.table_seats where table_id = p_table)
    order by a.id
    for update;

  update public.table_seats s
     set is_ready = false
   where s.table_id = p_table
     and public._player_balance(v_club.id, s.user_id) < v_tpl.entry;
  get diagnostics v_short = row_count;
  if v_short > 0 then
    return null;
  end if;

  insert into public.games (
    club_id, table_id, template_id, entry, players, max_pip, target_points, scoring, turn_seconds,
    rake_pct, rake_cap, platform_share_pct, pot
  ) values (
    v_club.id, p_table, v_tpl.id, v_tpl.entry, v_capacity, v_tpl.max_pip, v_tpl.target_points, v_tpl.scoring,
    v_tpl.turn_seconds, v_club.rake_pct, v_club.rake_cap, v_club.platform_share_pct, v_tpl.entry * v_capacity
  ) returning id into v_game;

  insert into public.chip_accounts (club_id, kind, game_id) values (v_club.id, 'pot', v_game) returning id into v_pot;

  for v_player in select seat, user_id from public.table_seats where table_id = p_table order by seat loop
    insert into public.game_players (game_id, seat, user_id) values (v_game, v_player.seat, v_player.user_id);
    perform public._post_chips(
      public._player_account(v_club.id, v_player.user_id), v_pot, v_tpl.entry, 'buy_in', v_game, null, null
    );
  end loop;

  update public.game_tables set status = 'playing', current_game_id = v_game where id = p_table;
  update public.table_seats set is_ready = false where table_id = p_table;
  return v_game;
end;
$$;

-- Ends a game and settles the pot (§4.3): the rake goes to the club treasury (and the platform
-- share, if any), the rest to the winning side, split evenly; an odd chip goes to the lowest seat.
-- Idempotent: a game that is no longer playing is left untouched and false is returned.
create function public.finish_game(p_game uuid, p_winner_team smallint, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games;
  v_pot uuid;
  v_rake integer;
  v_platform_rake integer;
  v_prize integer;
  v_winners integer;
  v_share integer;
  v_extra integer;
  v_amount integer;
  r record;
begin
  select * into v_game from public.games where id = p_game for update;
  if v_game.id is null then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;
  if v_game.status <> 'playing' then
    return false;
  end if;
  if p_winner_team is null or p_winner_team not in (0, 1) then
    raise exception 'invalid_winner' using errcode = 'P0001';
  end if;
  if p_reason not in ('target_reached', 'abandoned') then
    raise exception 'invalid_reason' using errcode = 'P0001';
  end if;

  v_rake := least(round(v_game.pot * v_game.rake_pct / 100)::integer, coalesce(v_game.rake_cap, v_game.pot));
  v_platform_rake := floor(v_rake * v_game.platform_share_pct / 100)::integer;
  v_prize := v_game.pot - v_rake;
  select count(*) into v_winners from public.game_players where game_id = p_game and team = p_winner_team;
  v_share := v_prize / v_winners;
  v_extra := v_prize - v_share * v_winners;

  select id into v_pot from public.chip_accounts where game_id = p_game and kind = 'pot';

  for r in
    select seat, user_id from public.game_players where game_id = p_game and team = p_winner_team order by seat
  loop
    v_amount := v_share + v_extra;
    v_extra := 0;
    if v_amount > 0 then
      perform public._post_chips(
        v_pot, public._player_account(v_game.club_id, r.user_id), v_amount, 'payout', p_game, null, null
      );
    end if;
    update public.game_players set payout = v_amount where game_id = p_game and seat = r.seat;
  end loop;

  if v_rake - v_platform_rake > 0 then
    perform public._post_chips(
      v_pot, public._club_account(v_game.club_id, 'treasury'), v_rake - v_platform_rake, 'rake', p_game, null, null
    );
  end if;
  if v_platform_rake > 0 then
    perform public._post_chips(
      v_pot, public._club_account(v_game.club_id, 'platform'), v_platform_rake, 'rake', p_game, null, null
    );
  end if;

  update public.games
     set status = 'finished', winner_team = p_winner_team, end_reason = p_reason, finished_at = now(),
         rake = v_rake, platform_rake = v_platform_rake
   where id = p_game;
  update public.hands set status = 'finished', finished_at = now(), turn_deadline = null
   where game_id = p_game and status = 'playing';
  update public.game_tables set status = 'finished' where current_game_id = p_game;
  return true;
end;
$$;

-- Cancels a game: refunds the entry to every player except `p_except_user` (the player who
-- abandoned during the first hand, or null to refund all). A forfeited entry goes to the club
-- treasury as rake (§4.4).
create function public._cancel_game(p_game uuid, p_reason text, p_except_user uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games;
  v_pot uuid;
  v_forfeit integer := 0;
  r record;
begin
  select * into v_game from public.games where id = p_game and status = 'playing' for update;
  if v_game.id is null then
    raise exception 'game_not_playing' using errcode = 'P0001';
  end if;
  select id into v_pot from public.chip_accounts where game_id = p_game and kind = 'pot';

  for r in select seat, user_id from public.game_players where game_id = p_game order by seat loop
    if r.user_id is not distinct from p_except_user then
      v_forfeit := v_forfeit + v_game.entry;
    else
      perform public._post_chips(
        v_pot, public._player_account(v_game.club_id, r.user_id), v_game.entry, 'refund', p_game, p_actor, p_reason
      );
      update public.game_players set refunded = true where game_id = p_game and seat = r.seat;
    end if;
  end loop;

  if v_forfeit > 0 then
    perform public._post_chips(
      v_pot, public._club_account(v_game.club_id, 'treasury'), v_forfeit, 'rake', p_game, p_actor, p_reason
    );
  end if;

  update public.games
     set status = 'cancelled', end_reason = p_reason, finished_at = now(), rake = v_forfeit
   where id = p_game;
  update public.hands set status = 'finished', finished_at = now(), turn_deadline = null
   where game_id = p_game and status = 'playing';
  update public.game_tables set status = 'finished' where current_game_id = p_game;
end;
$$;

create function public.cancel_game_first_hand_abandon(p_game uuid, p_leaver uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select public._cancel_game(p_game, 'abandoned_first_hand', p_leaver, null);
$$;

-- ---------------------------------------------------------------------------
-- Club admin RPCs (§2.2, §3)
-- ---------------------------------------------------------------------------

create function public.club_review_member(p_club uuid, p_user uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_club_admin(p_club);
begin
  update public.club_members
     set status = case when p_approve then 'active' else 'rejected' end,
         reviewed_by = v_uid, reviewed_at = now()
   where club_id = p_club and user_id = p_user and status = 'pending';
  if not found then
    raise exception 'request_not_pending' using errcode = 'P0001';
  end if;
  if p_approve then
    perform public._player_account(p_club, p_user);
  end if;
end;
$$;

-- Suspends or reactivates a member. Only the owner can act on admins; nobody acts on the owner.
create function public.club_set_member_status(p_club uuid, p_user uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_club_admin(p_club);
  v_target_role text;
begin
  if p_status not in ('active', 'suspended') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  select role into v_target_role from public.club_members
   where club_id = p_club and user_id = p_user and status in ('active', 'suspended');
  if v_target_role is null then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
  if v_target_role = 'owner' or p_user = v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_target_role = 'admin'
     and not exists (select 1 from public.club_members where club_id = p_club and user_id = v_uid and role = 'owner') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.club_members set status = p_status, reviewed_by = v_uid, reviewed_at = now()
   where club_id = p_club and user_id = p_user;
end;
$$;

create function public.club_set_member_role(p_club uuid, p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_club_admin(p_club);
begin
  if not exists (select 1 from public.club_members where club_id = p_club and user_id = v_uid and role = 'owner') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'player') then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;
  update public.club_members set role = p_role
   where club_id = p_club and user_id = p_user and role <> 'owner' and status = 'active';
  if not found then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- Treasury → player. The club settles any payment with the player outside the app.
create function public.club_assign_chips(p_club uuid, p_user uuid, p_amount integer, p_note text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_club_admin(p_club);
begin
  if not exists (select 1 from public.club_members where club_id = p_club and user_id = p_user and status = 'active') then
    raise exception 'member_not_active' using errcode = 'P0001';
  end if;
  perform public._post_chips(
    public._club_account(p_club, 'treasury'), public._player_account(p_club, p_user), p_amount, 'assign', null, v_uid, p_note
  );
  return public._player_balance(p_club, p_user);
end;
$$;

-- Player → treasury. Works for suspended members too (chips are frozen, not lost).
create function public.club_withdraw_chips(p_club uuid, p_user uuid, p_amount integer, p_note text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_club_admin(p_club);
begin
  perform public._post_chips(
    public._player_account(p_club, p_user), public._club_account(p_club, 'treasury'), p_amount, 'withdraw', null, v_uid, p_note
  );
  return public._player_balance(p_club, p_user);
end;
$$;

-- Manual correction with a mandatory note. Positive = to the player, negative = from the player.
create function public.club_adjust_chips(p_club uuid, p_user uuid, p_amount integer, p_note text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_club_admin(p_club);
  v_player uuid;
  v_treasury uuid := public._club_account(p_club, 'treasury');
begin
  if p_amount is null or p_amount = 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if char_length(coalesce(trim(p_note), '')) = 0 then
    raise exception 'note_required' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.club_members where club_id = p_club and user_id = p_user and status <> 'rejected') then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
  v_player := public._player_account(p_club, p_user);
  if p_amount > 0 then
    perform public._post_chips(v_treasury, v_player, p_amount, 'adjustment', null, v_uid, trim(p_note));
  else
    perform public._post_chips(v_player, v_treasury, -p_amount, 'adjustment', null, v_uid, trim(p_note));
  end if;
  return public._player_balance(p_club, p_user);
end;
$$;

create function public.club_cancel_game(p_game uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club uuid;
  v_uid uuid;
begin
  select club_id into v_club from public.games where id = p_game;
  if v_club is null then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;
  v_uid := public.assert_club_admin(v_club);
  perform public._cancel_game(p_game, 'cancelled_by_admin', null, v_uid);
end;
$$;

-- Only the owner changes the club rake; it applies to games started afterwards.
create function public.club_update_rake(p_club uuid, p_rake_pct numeric, p_rake_cap integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_club_admin(p_club);
begin
  if not exists (select 1 from public.club_members where club_id = p_club and user_id = v_uid and role = 'owner') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.clubs set rake_pct = p_rake_pct, rake_cap = p_rake_cap where id = p_club;
end;
$$;

-- Games and chip flows of a club for a period, by game start / movement time (§6).
create function public.club_report(p_club uuid, p_from timestamptz, p_to timestamptz)
returns table (
  games bigint,
  cancelled_games bigint,
  pot_total bigint,
  rake_total bigint,
  platform_rake_total bigint,
  chips_issued bigint,
  chips_assigned bigint,
  chips_withdrawn bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not (public.is_club_admin(p_club) or public.is_platform()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select
      (select count(*) from public.games g
        where g.club_id = p_club and g.started_at >= p_from and g.started_at < p_to),
      (select count(*) from public.games g
        where g.club_id = p_club and g.status = 'cancelled' and g.started_at >= p_from and g.started_at < p_to),
      (select coalesce(sum(g.pot), 0)::bigint from public.games g
        where g.club_id = p_club and g.status = 'finished' and g.started_at >= p_from and g.started_at < p_to),
      (select coalesce(sum(g.rake), 0)::bigint from public.games g
        where g.club_id = p_club and g.started_at >= p_from and g.started_at < p_to),
      (select coalesce(sum(g.platform_rake), 0)::bigint from public.games g
        where g.club_id = p_club and g.started_at >= p_from and g.started_at < p_to),
      (select coalesce(sum(l.amount), 0)::bigint from public.chip_ledger l
        where l.club_id = p_club and l.kind = 'issue' and l.created_at >= p_from and l.created_at < p_to),
      (select coalesce(sum(l.amount), 0)::bigint from public.chip_ledger l
        where l.club_id = p_club and l.kind = 'assign' and l.created_at >= p_from and l.created_at < p_to),
      (select coalesce(sum(l.amount), 0)::bigint from public.chip_ledger l
        where l.club_id = p_club and l.kind = 'withdraw' and l.created_at >= p_from and l.created_at < p_to);
end;
$$;

-- ---------------------------------------------------------------------------
-- Platform RPCs (§2.1)
-- ---------------------------------------------------------------------------

create function public.platform_create_club(p_name text, p_owner uuid, p_rake_pct numeric default 5, p_rake_cap integer default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_platform();
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_club uuid;
begin
  if not exists (select 1 from public.profiles where id = p_owner and status = 'active') then
    raise exception 'owner_not_found' using errcode = 'P0001';
  end if;

  loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1), '')
      into v_code from generate_series(1, 6);
    exit when not exists (select 1 from public.clubs where code = v_code);
  end loop;

  insert into public.clubs (code, name, owner_id, rake_pct, rake_cap)
  values (v_code, trim(p_name), p_owner, p_rake_pct, p_rake_cap)
  returning id into v_club;

  insert into public.club_members (club_id, user_id, role, status, reviewed_by, reviewed_at)
  values (v_club, p_owner, 'owner', 'active', v_uid, now());

  insert into public.chip_accounts (club_id, kind)
  values (v_club, 'issuance'), (v_club, 'treasury'), (v_club, 'platform');
  perform public._player_account(v_club, p_owner);
  return v_club;
end;
$$;

create function public.platform_set_club_status(p_club uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_platform();
  if p_status not in ('active', 'suspended') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  update public.clubs set status = p_status where id = p_club;
  if not found then
    raise exception 'club_not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- Issuance → club treasury.
create function public.platform_issue_chips(p_club uuid, p_amount integer, p_note text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_platform();
begin
  perform public._post_chips(
    public._club_account(p_club, 'issuance'), public._club_account(p_club, 'treasury'), p_amount, 'issue', null, v_uid, p_note
  );
  return (select balance from public.chip_accounts where club_id = p_club and kind = 'treasury');
end;
$$;

create function public.platform_set_user_status(p_user uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_platform();
begin
  if p_user = v_uid then
    raise exception 'cannot_change_own_status' using errcode = 'P0001';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  update public.profiles set status = p_status where id = p_user;
end;
$$;

create function public.platform_update_settings(p_min_app_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_platform();
begin
  update public.app_settings
     set min_app_version = p_min_app_version, updated_at = now(), updated_by = v_uid
   where id;
end;
$$;

-- Ledger integrity check (criterion 5): returns one row per problem; no rows = books balance.
-- Callable by the platform role and by the service role (scheduled checks).
create function public.chip_audit()
returns table (club_id uuid, account_id uuid, problem text, expected bigint, actual bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is not null and not public.is_platform() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    -- Each balance equals what the ledger says.
    select a.club_id, a.id, 'ledger_mismatch'::text, x.ledger_balance, a.balance
      from public.chip_accounts a
      cross join lateral (
        select coalesce(sum(l.amount) filter (where l.to_account = a.id), 0)
             - coalesce(sum(l.amount) filter (where l.from_account = a.id), 0) as ledger_balance
          from public.chip_ledger l
         where l.from_account = a.id or l.to_account = a.id
      ) x
     where x.ledger_balance <> a.balance
    union all
    -- Every club adds up to zero.
    select a.club_id, null::uuid, 'club_not_zero'::text, 0::bigint, sum(a.balance)::bigint
      from public.chip_accounts a
     group by a.club_id
    having sum(a.balance) <> 0
    union all
    -- Pots of games that are over must be empty.
    select a.club_id, a.id, 'closed_pot_not_empty'::text, 0::bigint, a.balance
      from public.chip_accounts a
      join public.games g on g.id = a.game_id
     where a.kind = 'pot' and g.status <> 'playing' and a.balance <> 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function grants. Supabase grants EXECUTE to anon by default: revoke everything in the
-- schema, then grant only what each caller needs. New functions in later migrations must
-- declare their own grants (AGENTS.md).
-- ---------------------------------------------------------------------------

revoke all on all functions in schema public from public, anon, authenticated;

-- Used inside RLS policies and by the app to decide what to show.
grant execute on function
  public.is_platform(),
  public.is_club_member(uuid),
  public.is_club_admin(uuid),
  public.table_capacity(text)
to authenticated;

grant execute on function
  public.update_my_display_name(text),
  public.find_club(text),
  public.request_join_club(text),
  public.join_table(uuid),
  public.leave_table(),
  public.set_ready(boolean),
  public.club_review_member(uuid, uuid, boolean),
  public.club_set_member_status(uuid, uuid, text),
  public.club_set_member_role(uuid, uuid, text),
  public.club_assign_chips(uuid, uuid, integer, text),
  public.club_withdraw_chips(uuid, uuid, integer, text),
  public.club_adjust_chips(uuid, uuid, integer, text),
  public.club_cancel_game(uuid),
  public.club_update_rake(uuid, numeric, integer),
  public.club_report(uuid, timestamptz, timestamptz),
  public.platform_create_club(text, uuid, numeric, integer),
  public.platform_set_club_status(uuid, text),
  public.platform_issue_chips(uuid, integer, text),
  public.platform_set_user_status(uuid, text),
  public.platform_update_settings(text),
  public.chip_audit()
to authenticated;

grant execute on function
  public.start_game(uuid),
  public.finish_game(uuid, smallint, text),
  public.cancel_game_first_hand_abandon(uuid, uuid),
  public.chip_audit()
to service_role;

-- ---------------------------------------------------------------------------
-- RLS: clients read only (club admins also manage table templates); writes happen in the
-- functions above.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.table_templates enable row level security;
alter table public.game_tables enable row level security;
alter table public.table_seats enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.hands enable row level security;
alter table public.hand_tiles enable row level security;
alter table public.moves enable row level security;
alter table public.chip_accounts enable row level security;
alter table public.chip_ledger enable row level security;

-- Display names are visible to every signed-in player (tables, member lists).
create policy profiles_read on public.profiles
  for select to authenticated using (true);

-- The app checks min_app_version before login.
create policy app_settings_read on public.app_settings
  for select to anon, authenticated using (true);

-- A club is visible to anyone with a membership row (including pending) and to the platform.
create policy clubs_read on public.clubs
  for select to authenticated using (
    (select public.is_platform())
    or exists (select 1 from public.club_members m where m.club_id = clubs.id and m.user_id = (select auth.uid()))
  );

-- Own membership rows; active members see who else is in the club; admins see requests.
create policy club_members_read on public.club_members
  for select to authenticated using (
    user_id = (select auth.uid())
    or (status = 'active' and public.is_club_member(club_id))
    or public.is_club_admin(club_id)
    or (select public.is_platform())
  );

create policy table_templates_read on public.table_templates
  for select to authenticated using (
    public.is_club_member(club_id) or (select public.is_platform())
  );

-- Club admins manage their table templates directly (name, entry, rules, active flag).
create policy table_templates_admin_insert on public.table_templates
  for insert to authenticated with check (public.is_club_admin(club_id));
create policy table_templates_admin_update on public.table_templates
  for update to authenticated using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));

create policy game_tables_read on public.game_tables
  for select to authenticated using (public.is_club_member(club_id) or (select public.is_platform()));

create policy table_seats_read on public.table_seats
  for select to authenticated using (
    exists (
      select 1 from public.game_tables t
       where t.id = table_seats.table_id
         and (public.is_club_member(t.club_id) or (select public.is_platform()))
    )
  );

create policy games_read on public.games
  for select to authenticated using (public.is_club_member(club_id) or (select public.is_platform()));

create policy game_players_read on public.game_players
  for select to authenticated using (
    exists (
      select 1 from public.games g
       where g.id = game_players.game_id
         and (public.is_club_member(g.club_id) or (select public.is_platform()))
    )
  );

create policy hands_read on public.hands
  for select to authenticated using (
    exists (
      select 1 from public.games g
       where g.id = hands.game_id
         and (public.is_club_member(g.club_id) or (select public.is_platform()))
    )
  );

create policy moves_read on public.moves
  for select to authenticated using (
    exists (
      select 1 from public.hands h
      join public.games g on g.id = h.game_id
       where h.id = moves.hand_id
         and (public.is_club_member(g.club_id) or (select public.is_platform()))
    )
  );

-- The core anti-cheat rule: a player only ever reads their own tiles.
create policy hand_tiles_read_own on public.hand_tiles
  for select to authenticated using (
    exists (
      select 1
        from public.hands h
        join public.game_players p on p.game_id = h.game_id
       where h.id = hand_tiles.hand_id
         and p.seat = hand_tiles.seat
         and p.user_id = (select auth.uid())
    )
  );

-- Own accounts; club admins see every account of their club; the platform sees all.
create policy chip_accounts_read on public.chip_accounts
  for select to authenticated using (
    user_id = (select auth.uid())
    or public.is_club_admin(club_id)
    or (select public.is_platform())
  );

create policy chip_ledger_read on public.chip_ledger
  for select to authenticated using (
    public.is_club_admin(club_id)
    or (select public.is_platform())
    or exists (
      select 1 from public.chip_accounts a
       where a.id in (chip_ledger.from_account, chip_ledger.to_account)
         and a.kind = 'player'
         and a.user_id = (select auth.uid())
    )
  );

-- Belt and braces: no direct writes from clients on anything but table templates, even if a
-- policy is added by mistake.
revoke insert, update, delete on
  public.profiles, public.app_settings, public.clubs, public.club_members, public.game_tables,
  public.table_seats, public.games, public.game_players, public.hands, public.hand_tiles, public.moves,
  public.chip_accounts, public.chip_ledger
from anon, authenticated;
revoke delete on public.table_templates from anon, authenticated;
revoke insert, update on public.table_templates from anon;

-- ---------------------------------------------------------------------------
-- Realtime: lobby, board and balances. postgres_changes respects RLS, so hand_tiles changes
-- only reach the owner and chip_accounts changes only reach the account holder and club admins.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.game_tables, public.table_seats, public.games, public.hands, public.hand_tiles, public.chip_accounts,
  public.club_members;
