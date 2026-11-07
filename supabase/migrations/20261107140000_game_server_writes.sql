-- Atomic writes for the `game-action` Edge Function (service role only).
-- The rules engine runs in the function; these only persist its result in one transaction,
-- with optimistic concurrency on hands.version so two concurrent moves cannot both apply.

-- Deals a new hand: hand row (public) + one hand_tiles row per seat (private, RLS).
-- p_tiles is a JSON array indexed by seat, each item an array of [a, b] tiles.
create function public.save_new_hand(p_game uuid, p_starter smallint, p_required_opening jsonb, p_tiles jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games;
  v_hand uuid;
  v_seat integer;
  v_counts smallint[] := '{}';
begin
  select * into v_game from public.games where id = p_game and status = 'playing' for update;
  if v_game.id is null then
    raise exception 'game_not_playing' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_tiles) <> v_game.players then
    raise exception 'invalid_deal' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.hands where game_id = p_game and status = 'playing') then
    raise exception 'hand_in_progress' using errcode = 'P0001';
  end if;

  for v_seat in 0 .. v_game.players - 1 loop
    v_counts := v_counts || jsonb_array_length(p_tiles -> v_seat)::smallint;
  end loop;

  insert into public.hands (game_id, hand_no, starter_seat, turn_seat, tile_counts, required_opening, turn_deadline)
  values (
    p_game, v_game.hand_no + 1, p_starter, p_starter, v_counts, p_required_opening,
    now() + make_interval(secs => v_game.turn_seconds)
  )
  returning id into v_hand;

  for v_seat in 0 .. v_game.players - 1 loop
    insert into public.hand_tiles (hand_id, seat, tiles) values (v_hand, v_seat, p_tiles -> v_seat);
  end loop;

  update public.games set hand_no = hand_no + 1 where id = p_game;
  return v_hand;
end;
$$;

-- Persists one validated move. Returns false (and changes nothing) when the hand moved on
-- since the caller read it (version mismatch) so the caller can reload and retry.
-- p_state: { turn_seat, board, left_end, right_end, tile_counts, passes_in_row, status, result }
create function public.save_move(
  p_hand uuid,
  p_expected_version integer,
  p_seat smallint,
  p_kind text,
  p_tile jsonb,
  p_side text,
  p_state jsonb,
  p_seat_tiles jsonb,
  p_timeouts smallint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hand public.hands;
  v_game public.games;
  v_finished boolean := p_state ->> 'status' = 'finished';
  v_winner integer := (p_state -> 'result' ->> 'winnerTeam')::integer;
  v_points integer := coalesce((p_state -> 'result' ->> 'points')::integer, 0);
begin
  select * into v_hand from public.hands
   where id = p_hand and version = p_expected_version and status = 'playing'
   for update;
  if v_hand.id is null then
    return false;
  end if;
  select * into v_game from public.games where id = v_hand.game_id and status = 'playing' for update;
  if v_game.id is null then
    return false;
  end if;

  update public.hands
     set turn_seat = (p_state ->> 'turn_seat')::smallint,
         board = p_state -> 'board',
         left_end = (p_state ->> 'left_end')::smallint,
         right_end = (p_state ->> 'right_end')::smallint,
         tile_counts = array(select jsonb_array_elements_text(p_state -> 'tile_counts')::smallint),
         passes_in_row = (p_state ->> 'passes_in_row')::smallint,
         required_opening = null,
         status = case when v_finished then 'finished' else 'playing' end,
         result = case when v_finished then p_state -> 'result' else null end,
         turn_deadline = case when v_finished then null else now() + make_interval(secs => v_game.turn_seconds) end,
         finished_at = case when v_finished then now() else null end,
         version = version + 1
   where id = p_hand;

  if p_seat_tiles is not null then
    update public.hand_tiles set tiles = p_seat_tiles where hand_id = p_hand and seat = p_seat;
  end if;

  insert into public.moves (hand_id, seq, seat, kind, tile, side)
  values (p_hand, p_expected_version + 1, p_seat, p_kind, p_tile, p_side);

  update public.game_players set consecutive_timeouts = p_timeouts where game_id = v_game.id and seat = p_seat;

  if v_finished and v_winner is not null and v_points > 0 then
    if v_winner = 0 then
      update public.games set score_team0 = score_team0 + v_points where id = v_game.id;
    else
      update public.games set score_team1 = score_team1 + v_points where id = v_game.id;
    end if;
  end if;
  return true;
end;
$$;

revoke all on function
  public.save_new_hand(uuid, smallint, jsonb, jsonb),
  public.save_move(uuid, integer, smallint, text, jsonb, text, jsonb, jsonb, smallint)
from public, anon, authenticated;

grant execute on function
  public.save_new_hand(uuid, smallint, jsonb, jsonb),
  public.save_move(uuid, integer, smallint, text, jsonb, text, jsonb, jsonb, smallint)
to service_role;
