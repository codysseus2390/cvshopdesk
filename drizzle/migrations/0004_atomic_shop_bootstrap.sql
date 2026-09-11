-- Atomic, race-safe, retry-safe owner bootstrap.
-- Verifies auth.uid() and the confirmed trusted owner email server-side, then creates the
-- shop and its owner membership together so no shop can ever be stranded without an owner.
CREATE OR REPLACE FUNCTION public.bootstrap_shop(p_name text, p_timezone text DEFAULT 'America/Chicago')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_shop_id uuid;
  v_owner uuid;
begin
  if v_user is null then
    raise exception 'Sign in required';
  end if;

  select lower(trim(u.email)), u.email_confirmed_at
    into v_email, v_confirmed
  from auth.users u
  where u.id = v_user;

  if v_email is null or v_email <> 'codysseus2390@gmail.com' or v_confirmed is null then
    raise exception 'Only the shop owner account with a confirmed email address can set up the shop';
  end if;

  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Shop name is required';
  end if;

  -- Serialise concurrent setup attempts for the whole install.
  perform pg_advisory_xact_lock(hashtext('cedar_valley_shop_bootstrap'));

  select id, created_by into v_shop_id, v_owner from public.shops order by created_at limit 1;

  if v_shop_id is not null then
    if v_owner <> v_user then
      raise exception 'A shop has already been set up';
    end if;
  else
    insert into public.shops (name, timezone, created_by)
    values (trim(p_name), coalesce(nullif(trim(p_timezone), ''), 'America/Chicago'), v_user)
    returning id into v_shop_id;
  end if;

  -- Retry-safe: repair or create the owner membership for the same account.
  insert into public.shop_members (shop_id, user_id, email, role, status, decided_at, decided_by)
  values (v_shop_id, v_user, v_email, 'owner', 'approved', now(), v_user)
  on conflict (user_id, role) do update
    set shop_id = excluded.shop_id,
        status = 'approved',
        decided_at = now(),
        decided_by = v_user;

  return v_shop_id;
end $$;

REVOKE ALL ON FUNCTION public.bootstrap_shop(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_shop(text, text) TO authenticated;