-- Lets the platform find a registered user by email (to make them owner of a new club).
-- Emails live in auth.users, which clients cannot read.

create function public.platform_find_user(p_email text)
returns table (user_id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_platform();
  return query
    select p.id, p.display_name
      from auth.users u
      join public.profiles p on p.id = u.id
     where lower(u.email) = lower(trim(p_email));
end;
$$;

revoke all on function public.platform_find_user(text) from public, anon, authenticated;
grant execute on function public.platform_find_user(text) to authenticated;
