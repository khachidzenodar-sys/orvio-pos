-- Run once in the Supabase SQL editor. Only the server service_role can access
-- this table. Browser Auth tokens MUST NOT bypass the manager-PIN API checks.
create table if not exists public.pos_store (
  id uuid primary key references auth.users(id) on delete cascade,
  version bigint not null default 0 check (version >= 0),
  document text not null
);
alter table public.pos_store enable row level security;
revoke all on table public.pos_store from public, anon, authenticated;
grant select, insert, update on table public.pos_store to service_role;
-- No anon/authenticated RLS policies are intentionally created.

-- Dashboard automatic-RLS event trigger must not be callable by API roles.
do $$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
 end if;
end $$;
