-- Read-only views of the chip books for the supervisor (and the platform): balances per club
-- and the ledger with readable account names. No contacts, no e-mails, no hands.

create function public.assert_auditor_or_platform()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_active_user();
  if not (public.is_auditor() or public.is_platform()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- One row per club. issued = net chips the platform has put in (issues − retirements).
create function public.audit_books()
returns table (
  club_id uuid,
  club_name text,
  club_code text,
  club_status text,
  platform_share_pct numeric,
  issued bigint,
  treasury bigint,
  players bigint,
  pots bigint,
  platform_share bigint,
  player_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.assert_auditor_or_platform();
  return query
    select c.id, c.name, c.code, c.status, c.platform_share_pct,
           coalesce(-sum(a.balance) filter (where a.kind = 'issuance'), 0)::bigint,
           coalesce(sum(a.balance) filter (where a.kind = 'treasury'), 0)::bigint,
           coalesce(sum(a.balance) filter (where a.kind = 'player'), 0)::bigint,
           coalesce(sum(a.balance) filter (where a.kind = 'pot'), 0)::bigint,
           coalesce(sum(a.balance) filter (where a.kind = 'platform'), 0)::bigint,
           count(*) filter (where a.kind = 'player')
      from public.clubs c
      left join public.chip_accounts a on a.club_id = c.id
     group by c.id
     order by c.name;
end;
$$;

-- Ledger page, newest first. p_kinds null = every kind; p_before = id cursor for paging.
create function public.audit_movements(
  p_club uuid default null,
  p_kinds text[] default null,
  p_before bigint default null,
  p_limit integer default 100
)
returns table (
  id bigint,
  created_at timestamptz,
  club_id uuid,
  club_name text,
  kind text,
  amount integer,
  from_kind text,
  from_name text,
  to_kind text,
  to_name text,
  actor_name text,
  note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.assert_auditor_or_platform();
  return query
    select l.id, l.created_at, l.club_id, c.name, l.kind, l.amount,
           fa.kind, fp.display_name, ta.kind, tp.display_name, ap.display_name, l.note
      from public.chip_ledger l
      join public.clubs c on c.id = l.club_id
      join public.chip_accounts fa on fa.id = l.from_account
      join public.chip_accounts ta on ta.id = l.to_account
      left join public.profiles fp on fp.id = fa.user_id
      left join public.profiles tp on tp.id = ta.user_id
      left join public.profiles ap on ap.id = l.created_by
     where (p_club is null or l.club_id = p_club)
       and (p_kinds is null or l.kind = any (p_kinds))
       and (p_before is null or l.id < p_before)
     order by l.id desc
     limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

revoke all on function
  public.assert_auditor_or_platform(),
  public.audit_books(),
  public.audit_movements(uuid, text[], bigint, integer)
from public, anon, authenticated;

grant execute on function
  public.audit_books(),
  public.audit_movements(uuid, text[], bigint, integer)
to authenticated;
