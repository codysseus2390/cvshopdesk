import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { STAGING_PROJECT_REF, PRODUCTION_PROJECT_REF } from "./backend-targets.mjs";

export const PROJECTS = Object.freeze({
  staging: STAGING_PROJECT_REF,
  production: PRODUCTION_PROJECT_REF,
});

export class SafeError extends Error {}

export function validateTarget(environment, connectionString) {
  const ref = PROJECTS[environment];
  if (!ref) throw new SafeError("Expected --environment staging or production.");
  let target;
  try {
    target = new URL(connectionString);
  } catch {
    throw new SafeError("SUPABASE_DB_URL must be an explicit PostgreSQL connection URL.");
  }
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    target.pathname !== "/postgres" ||
    target.search ||
    target.hash ||
    !target.password
  ) {
    throw new SafeError(
      "Use a PostgreSQL URL for /postgres with credentials and no query overrides.",
    );
  }
  const direct =
    target.hostname === `db.${ref}.supabase.co` &&
    target.username === "postgres" &&
    ["", "5432"].includes(target.port);
  // Supavisor shared pooler connection format. Unknown provider/host formats fail closed.
  const pooler =
    /^aws-\d+-[a-z]+-[a-z]+-\d+\.pooler\.supabase\.com$/.test(target.hostname) &&
    target.username === `postgres.${ref}` &&
    ["", "5432", "6543"].includes(target.port);
  if (!direct && !pooler) {
    throw new SafeError("Database target does not match the explicitly selected project.");
  }
  return { environment, projectRef: ref, connectionMode: direct ? "direct" : "pooler" };
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function migrationHashes(source) {
  const lf = source.replace(/\r\n/g, "\n");
  if (lf.includes("\r")) throw new SafeError("Unsupported migration line endings.");
  return { lf: sha256(lf), crlf: sha256(lf.replace(/\n/g, "\r\n")) };
}

export function readExpectedMigrations(root) {
  const folder = resolve(root, "drizzle/migrations");
  const journal = JSON.parse(readFileSync(resolve(folder, "meta/_journal.json"), "utf8"));
  if (journal.dialect !== "postgresql" || !journal.entries?.length) {
    throw new SafeError("Repository migration journal is invalid.");
  }
  const seen = new Set();
  return journal.entries.map((entry, index) => {
    if (
      entry.idx !== index ||
      !/^\d{4}_[a-z0-9_]+$/.test(entry.tag) ||
      seen.has(entry.tag) ||
      !Number.isSafeInteger(entry.when) ||
      entry.when <= (journal.entries[index - 1]?.when ?? 0)
    ) {
      throw new SafeError("Repository migration order is invalid.");
    }
    seen.add(entry.tag);
    let source;
    try {
      source = readFileSync(resolve(folder, `${entry.tag}.sql`), "utf8");
    } catch {
      throw new SafeError(`Repository migration file missing: ${entry.tag}.`);
    }
    return { tag: entry.tag, when: entry.when, hashes: migrationHashes(source) };
  });
}

export function inspectJournal(expected, rows) {
  const blockers = [];
  const matches = [];
  if (rows === null) blockers.push("Database Drizzle journal is missing.");
  const remaining = [...(rows ?? [])];
  for (const migration of expected) {
    const candidates = remaining.filter((row) => String(row.created_at) === String(migration.when));
    if (candidates.length === 0) {
      blockers.push(`Missing journal migration: ${migration.tag}.`);
      continue;
    }
    if (candidates.length > 1) blockers.push(`Duplicate journal timestamp: ${migration.tag}.`);
    for (const row of candidates) {
      remaining.splice(remaining.indexOf(row), 1);
      const lineEndings = Object.keys(migration.hashes).find(
        (variant) => migration.hashes[variant] === row.hash,
      );
      if (!lineEndings) blockers.push(`Journal hash mismatch: ${migration.tag}.`);
      else matches.push({ tag: migration.tag, lineEndings });
    }
  }
  if (remaining.length) blockers.push(`Unexpected journal entries: ${remaining.length}.`);
  return { blockers, matches };
}

export const REQUIRED_POLICIES = [
  ...["customers", "vehicles", "inventory_items", "shop_jobs", "tire_orders"].flatMap((table) =>
    ["insert", "update", "delete"].map((command) => ({
      table,
      name: `effective_permission_${command}`,
      command: { insert: "a", update: "w", delete: "d" }[command],
      permissions: ["edit_records"],
    })),
  ),
  ...[
    ["technician_productivity", "effective_productivity_read", "r", "view_productivity"],
    ["metric_corrections", "effective_productivity_history_read", "r", "view_productivity"],
    ["technician_productivity", "effective_productivity_insert", "a", "edit_dashboard_numbers"],
    ["technician_productivity", "effective_productivity_update", "w", "edit_dashboard_numbers"],
    ["metric_snapshots", "effective_dashboard_read", "r", "view_dashboard"],
    ["metric_corrections", "effective_corrections_read", "r", "view_dashboard"],
    ["ai_actions", "effective_ai_actions_read", "r", "use_assistant"],
    ["shop_settings", "effective_settings_insert", "a", "change_settings"],
    ["shop_settings", "effective_settings_update", "w", "change_settings"],
    ["notifications", "effective_notifications_insert", "a", "manage_notifications"],
    ["imports", "effective_import_insert", "a", "upload_imports"],
    ["imports", "effective_import_update", "w", "upload_imports", "approve_imports"],
    ["imports", "effective_import_read", "r", "upload_imports", "approve_imports"],
  ].map(([table, name, command, ...permissions]) => ({ table, name, command, permissions })),
];

function hasPermissionGuards(expression, permissions) {
  return permissions.every((permission) =>
    new RegExp(
      `(?:public\\.)?has_shop_permission\\s*\\(\\s*shop_id\\s*,\\s*'${permission}'(?:\\s*::\\s*text)?\\s*\\)`,
    ).test(expression ?? ""),
  );
}

export const REQUIRED_FUNCTIONS = [
  { signature: "public.has_shop_permission(uuid,text)", authenticated: true },
  { signature: "public.can_edit_records(uuid,uuid)", authenticated: true },
  {
    signature:
      "public.save_shop_metrics(uuid,date,public.report_scope,numeric,numeric,integer,integer,public.metric_source,uuid,text,jsonb,text)",
    authenticated: true,
  },
  {
    signature:
      "public.save_period_productivity(uuid,date,text,numeric,text,public.report_scope,text)",
    authenticated: true,
  },
  {
    signature:
      "public._save_metric_snapshot(uuid,date,public.report_scope,numeric,integer,integer,public.metric_source,uuid,text,jsonb,text)",
    authenticated: false,
  },
  { signature: "public.save_business_calendar(uuid,jsonb,boolean,date)", authenticated: true },
  { signature: "public.guard_business_calendar()", authenticated: false },
  { signature: "public.audit_business_calendar()", authenticated: false },
];

export function inspectCapabilities(snapshot) {
  const blockers = [];
  if (snapshot.calendarJsonb !== true) blockers.push("Missing business_calendar JSONB column.");
  for (const expected of REQUIRED_POLICIES) {
    const policy = snapshot.policies.find(
      (row) => row.table_name === expected.table && row.policy_name === expected.name,
    );
    if (
      !policy ||
      policy.command !== expected.command ||
      policy.restrictive !== true ||
      policy.rls_enabled !== true ||
      policy.authenticated !== true ||
      ((expected.command === "r" || expected.command === "d" || expected.command === "w") &&
        !hasPermissionGuards(policy.using_expression, expected.permissions)) ||
      ((expected.command === "a" || expected.command === "w") &&
        !hasPermissionGuards(policy.check_expression, expected.permissions))
    ) {
      blockers.push(
        `Missing or incompatible restrictive policy: ${expected.table}.${expected.name}.`,
      );
    }
  }
  for (const expected of REQUIRED_FUNCTIONS) {
    const fn = snapshot.functions.find((row) => row.signature === expected.signature);
    if (
      !fn ||
      fn.present !== true ||
      fn.callable_function !== true ||
      fn.security_definer !== true ||
      fn.safe_search_path !== true ||
      fn.anon_execute !== false ||
      fn.public_execute !== false ||
      fn.authenticated_execute !== expected.authenticated
    ) {
      blockers.push(`Missing or incompatible function/grants: ${expected.signature}.`);
    }
  }
  for (const [name, functionName, type] of [
    ["business_calendar_guard", "guard_business_calendar", 23],
    ["business_calendar_audit", "audit_business_calendar", 21],
  ]) {
    const trigger = snapshot.triggers.find((row) => row.name === name);
    if (
      !trigger ||
      trigger.function_name !== functionName ||
      Number(trigger.type) !== type ||
      trigger.enabled !== true
    ) {
      blockers.push(`Missing or incompatible calendar trigger: ${name}.`);
    }
  }
  return blockers;
}

export async function readSchemaSnapshot(sql) {
  // All catalog and journal reads share one consistent, read-only transaction.
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    const [journal] =
      await tx`select to_regclass('drizzle.__drizzle_migrations') is not null as present`;
    const rows = journal.present
      ? await tx`select hash, created_at from drizzle.__drizzle_migrations order by created_at, id`
      : null;
    const [calendar] = await tx`
      select exists (
        select 1 from pg_attribute a join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'shop_settings'
          and a.attname = 'business_calendar' and not a.attisdropped
          and a.atttypid = 'jsonb'::regtype
      ) as present`;
    const policies = await tx`
      select c.relname as table_name, p.polname as policy_name, p.polcmd as command,
        not p.polpermissive as restrictive, c.relrowsecurity as rls_enabled,
        (select oid from pg_roles where rolname = 'authenticated') = any(p.polroles) as authenticated,
        pg_get_expr(p.polqual, p.polrelid) as using_expression,
        pg_get_expr(p.polwithcheck, p.polrelid) as check_expression
      from pg_policy p join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'`;
    const signatures = REQUIRED_FUNCTIONS.map((fn) => fn.signature);
    const functions = await tx`
      select wanted.signature, p.oid is not null as present,
        p.prokind = 'f' as callable_function,
        p.prosecdef as security_definer,
        coalesce('search_path=public' = any(p.proconfig), false) as safe_search_path,
        has_function_privilege('anon', p.oid, 'execute') as anon_execute,
        has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
        exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
          where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_execute
      from unnest(${signatures}::text[]) as wanted(signature)
      left join pg_proc p on p.oid = to_regprocedure(wanted.signature)`;
    const triggers = await tx`
      select t.tgname as name, p.proname as function_name, t.tgtype as type,
        t.tgenabled in ('O','A') as enabled
      from pg_trigger t join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_proc p on p.oid = t.tgfoid
      join pg_namespace pn on pn.oid = p.pronamespace
      where n.nspname = 'public' and pn.nspname = 'public' and c.relname = 'shop_settings'
        and not t.tgisinternal`;
    return { rows, calendarJsonb: calendar.present, policies, functions, triggers };
  });
}

export function evaluateSchema(expected, snapshot) {
  const journal = inspectJournal(expected, snapshot.rows);
  const blockers = [...journal.blockers, ...inspectCapabilities(snapshot)];
  return {
    status: blockers.length ? "fail" : "pass",
    blockers,
    migrationMatches: journal.matches,
    expectedMigrationCount: expected.length,
    recordedMigrationCount: snapshot.rows?.length ?? 0,
    scope:
      "Read-only journal and schema prerequisites; does not prove role-token or browser behavior.",
  };
}
