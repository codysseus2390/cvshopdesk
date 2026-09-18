import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Offline SQL preparation only. This script never connects to a database.
const root = fileURLToPath(new URL("../", import.meta.url));
const projectRef = process.argv[2];
const productionRef = readFileSync(resolve(root, "supabase/config.toml"), "utf8").match(
  /project_id\s*=\s*"([^"]+)"/,
)?.[1];
if (!productionRef || !/^[a-z]{20}$/.test(projectRef ?? "") || projectRef === productionRef) {
  throw new Error("Provide a verified, separate Supabase staging project reference.");
}

const folder = resolve(root, "drizzle/migrations");
const journal = JSON.parse(readFileSync(resolve(folder, "meta/_journal.json"), "utf8"));
if (journal.dialect !== "postgresql" || !journal.entries.length) {
  throw new Error("Expected the repository's PostgreSQL migration journal.");
}

const migrations = journal.entries.map((entry, index) => {
  if (
    entry.idx !== index ||
    !/^\d{4}_[a-z0-9_]+$/.test(entry.tag) ||
    !Number.isSafeInteger(entry.when) ||
    entry.when <= (journal.entries[index - 1]?.when ?? 0)
  ) {
    throw new Error("Migration order or journal metadata is invalid.");
  }
  // Hash Git's canonical LF text, independent of the Windows checkout's EOLs.
  const sql = readFileSync(resolve(folder, `${entry.tag}.sql`), "utf8").replace(/\r\n/g, "\n");
  const hash = createHash("sha256").update(sql).digest("hex");
  return `-- ${entry.tag}\n${sql.replaceAll("--> statement-breakpoint", "")}\n\ninsert into drizzle.__drizzle_migrations (hash, created_at) values ('${hash}', ${entry.when});`;
});

process.stdout.write(`-- Fresh staging bootstrap for ${projectRef} ONLY.
-- Verify the Supabase dashboard URL/name before running the whole script.
-- The project reference is an operator check, not a database identity assertion.
-- Refuses populated backends; any SQL error rolls back the entire setup.
begin;
set local statement_timeout = '60s';
lock table auth.users, storage.buckets in share row exclusive mode;
do $staging_guard$
begin
  if current_database() <> 'postgres' or current_user <> 'postgres' then
    raise exception 'Run through the verified staging dashboard as postgres';
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind in ('r', 'p'))
     or exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                where n.nspname = 'public' and t.typtype = 'e')
     or exists (select 1 from pg_namespace where nspname = 'drizzle')
     or exists (select 1 from auth.users)
     or exists (select 1 from storage.buckets) then
    raise exception 'Fresh staging only: existing schema, users, or buckets detected';
  end if;
  if (select count(*) from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) <> 3 then
    raise exception 'Required Supabase roles are missing';
  end if;
end
$staging_guard$;

create schema drizzle;
create table drizzle.__drizzle_migrations (
  id serial primary key,
  hash text not null,
  created_at bigint
);
alter table drizzle.__drizzle_migrations enable row level security;
revoke all on schema drizzle from public, anon, authenticated;
revoke all on table drizzle.__drizzle_migrations from public, anon, authenticated;
revoke all on sequence drizzle.__drizzle_migrations_id_seq from public, anon, authenticated;

${migrations.join("\n\n")}

-- Bucket creation was absent from the source migrations; never make it public.
insert into storage.buckets (id, name, public, file_size_limit)
values ('shop-uploads', 'shop-uploads', false, 26214400);

-- Fail before committing if the reconstructed schema has unexpected access.
do $staging_acceptance$
begin
  if (select count(*) from drizzle.__drizzle_migrations) <> ${migrations.length} then
    raise exception 'Incomplete migration journal';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')) <> 21
     or exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity) then
    raise exception 'Expected 21 public tables, all with RLS';
  end if;
  -- Supabase's pre-existing rls_auto_enable returns event_trigger, which is
  -- invoked by database events and cannot be called as an ordinary API RPC.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.prosecdef
               and p.prorettype <> 'event_trigger'::regtype
               and has_function_privilege('anon', p.oid, 'execute')) then
    raise exception 'Anonymous app SECURITY DEFINER execution detected';
  end if;
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname in ('shop members read uploads', 'shop members upload files',
                         'shop managers update uploads', 'shop managers delete uploads')) <> 4 then
    raise exception 'Expected private shop upload policies';
  end if;
end
$staging_acceptance$;
commit;

select 'staging schema applied' as result,
       (select count(*) from drizzle.__drizzle_migrations) as migrations,
       (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity) as rls_tables,
       (select public from storage.buckets where id = 'shop-uploads') as uploads_public;
`);
