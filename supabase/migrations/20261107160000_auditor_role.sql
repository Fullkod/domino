-- Read-only supervisor ("Supervisión", profiles.role = 'auditor'): sees the chip books of the
-- operator and of every club (accounts, ledger, audit). It never sees contacts, hands or any
-- personal data beyond display names, and cannot run any action. BUSINESS_LOGIC.md §2.1.
-- Granted by SQL only: update public.profiles set role = 'auditor' where id = '<user>';

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('player', 'platform', 'auditor'));

create function public.is_auditor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'auditor' and status = 'active'
  );
$$;

revoke all on function public.is_auditor() from public, anon, authenticated;
grant execute on function public.is_auditor() to authenticated;

-- Club names and codes (to label the books).
drop policy clubs_read on public.clubs;
create policy clubs_read on public.clubs
  for select to authenticated using (
    (select public.is_platform())
    or (select public.is_auditor())
    or exists (select 1 from public.club_members m where m.club_id = clubs.id and m.user_id = (select auth.uid()))
  );

drop policy chip_accounts_read on public.chip_accounts;
create policy chip_accounts_read on public.chip_accounts
  for select to authenticated using (
    user_id = (select auth.uid())
    or public.is_club_admin(club_id)
    or (select public.is_platform())
    or (select public.is_auditor())
  );

drop policy chip_ledger_read on public.chip_ledger;
create policy chip_ledger_read on public.chip_ledger
  for select to authenticated using (
    public.is_club_admin(club_id)
    or (select public.is_platform())
    or (select public.is_auditor())
    or exists (
      select 1 from public.chip_accounts a
       where a.id in (chip_ledger.from_account, chip_ledger.to_account)
         and a.kind = 'player'
         and a.user_id = (select auth.uid())
    )
  );

-- Ledger integrity check, now also for the supervisor.
create or replace function public.chip_audit()
returns table (club_id uuid, account_id uuid, problem text, expected bigint, actual bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is not null and not (public.is_platform() or public.is_auditor()) then
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
