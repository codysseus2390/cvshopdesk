import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  PROJECTS,
  REQUIRED_FUNCTIONS,
  REQUIRED_POLICIES,
  evaluateSchema,
  inspectJournal,
  migrationHashes,
  readExpectedMigrations,
  readSchemaSnapshot,
  validateTarget,
} from "./release-schema.mjs";

const expected = [
  { tag: "0024_business_calendar", when: 123, hashes: migrationHashes("select 1;\n") },
];
const root = fileURLToPath(new URL("../", import.meta.url));

function guardExpressions(policy) {
  const guard = policy.permissions
    .map((permission) => `public.has_shop_permission(shop_id, '${permission}'::text)`)
    .join(" OR ");
  return {
    using_expression: ["r", "d", "w"].includes(policy.command) ? guard : null,
    check_expression: ["a", "w"].includes(policy.command) ? guard : null,
  };
}

function readySnapshot() {
  return {
    rows: [{ created_at: 123, hash: expected[0].hashes.lf }],
    calendarJsonb: true,
    policies: REQUIRED_POLICIES.map((policy) => ({
      table_name: policy.table,
      policy_name: policy.name,
      command: policy.command,
      restrictive: true,
      rls_enabled: true,
      authenticated: true,
      ...guardExpressions(policy),
    })),
    functions: REQUIRED_FUNCTIONS.map((fn) => ({
      signature: fn.signature,
      present: true,
      callable_function: true,
      security_definer: true,
      safe_search_path: true,
      anon_execute: false,
      public_execute: false,
      authenticated_execute: fn.authenticated,
    })),
    triggers: [
      {
        name: "business_calendar_guard",
        function_name: "guard_business_calendar",
        type: 23,
        enabled: true,
      },
      {
        name: "business_calendar_audit",
        function_name: "audit_business_calendar",
        type: 21,
        enabled: true,
      },
    ],
  };
}

test("target identity is bound to direct host or pooler username", () => {
  for (const [environment, ref] of Object.entries(PROJECTS)) {
    assert.equal(
      validateTarget(
        environment,
        `postgres://postgres:synthetic@db.${ref}.supabase.co:5432/postgres`,
      ).projectRef,
      ref,
    );
    assert.equal(
      validateTarget(
        environment,
        `postgres://postgres.${ref}:synthetic@aws-0-us-east-2.pooler.supabase.com:6543/postgres`,
      ).projectRef,
      ref,
    );
  }
  for (const url of [
    `postgres://postgres:synthetic@db.${PROJECTS.production}.supabase.co/postgres`,
    `postgres://postgres.${PROJECTS.production}:synthetic@aws-0-us-east-2.pooler.supabase.com:6543/postgres`,
    `postgres://postgres:synthetic@db.${PROJECTS.staging}.supabase.co.evil.test/postgres`,
    `postgres://postgres.${PROJECTS.staging}:synthetic@evil.test/postgres`,
    `postgres://postgres:synthetic@db.${PROJECTS.staging}.supabase.co/postgres?host=elsewhere`,
    `postgres://postgres:synthetic@db.${PROJECTS.staging}.supabase.co/other`,
    `postgres://postgres:synthetic@db.xbpkvbjmclokmbumhymg.supabase.co/postgres`,
  ])
    assert.throws(() => validateTarget("staging", url));
  assert.throws(() => validateTarget("preview", ""));
  assert.throws(() => validateTarget("staging", undefined));
});

test("journal comparisons explicitly report LF or CRLF without rewriting", () => {
  const hashes = migrationHashes("select 1;\r\n");
  assert.deepEqual(hashes, expected[0].hashes);
  assert.notEqual(hashes.lf, hashes.crlf);
  for (const lineEndings of ["lf", "crlf"]) {
    const result = inspectJournal(expected, [{ created_at: "123", hash: hashes[lineEndings] }]);
    assert.deepEqual(result.blockers, []);
    assert.equal(result.matches[0].lineEndings, lineEndings);
  }
  assert.throws(() => migrationHashes("select\r1;"));
});

test("the repository journal includes the TV notification migration", () => {
  const migrations = readExpectedMigrations(root);
  assert.equal(migrations.length, 26);
  assert.deepEqual(
    migrations.slice(-4).map(({ tag }) => tag),
    [
      "0022_enforce_edit_records_on_customers",
      "0023_effective_permissions",
      "0024_business_calendar",
      "0025_manage_tv_notifications",
    ],
  );
  assert.ok(migrations.every(({ hashes }) => /^[a-f0-9]{64}$/.test(hashes.lf)));
});

test("missing journal, missing migration, duplicate, extra and wrong hash all block", () => {
  for (const rows of [
    null,
    [],
    [{ created_at: 123, hash: "wrong" }],
    [
      { created_at: 123, hash: expected[0].hashes.lf },
      { created_at: 123, hash: expected[0].hashes.lf },
    ],
    [
      { created_at: 123, hash: expected[0].hashes.lf },
      { created_at: 456, hash: "unknown" },
    ],
  ]) {
    assert.ok(inspectJournal(expected, rows).blockers.length > 0);
  }
});

test("complete journal and required catalog capabilities pass", () => {
  assert.equal(evaluateSchema(expected, readySnapshot()).status, "pass");
});

test("missing calendar and restrictive permission policy block even with complete journal", () => {
  const snapshot = readySnapshot();
  snapshot.calendarJsonb = false;
  snapshot.policies[0].restrictive = false;
  const result = evaluateSchema(expected, snapshot);
  assert.equal(result.status, "fail");
  assert.equal(result.blockers.length, 2);
});

test("the expected permission must guard both USING and WITH CHECK for updates", () => {
  const snapshot = readySnapshot();
  const update = snapshot.policies.find(
    (policy) =>
      policy.table_name === "shop_settings" && policy.policy_name === "effective_settings_update",
  );
  update.check_expression = "public.has_shop_permission(shop_id, 'view_dashboard'::text)";
  assert.match(evaluateSchema(expected, snapshot).blockers.join(" "), /effective_settings_update/);
  update.check_expression = guardExpressions({
    command: "w",
    permissions: ["change_settings"],
  }).check_expression;
  update.using_expression = null;
  assert.match(evaluateSchema(expected, snapshot).blockers.join(" "), /effective_settings_update/);
});

test("imports policy requires both upload and approval permission paths", () => {
  const snapshot = readySnapshot();
  const update = snapshot.policies.find(
    (policy) => policy.table_name === "imports" && policy.policy_name === "effective_import_update",
  );
  update.using_expression = "public.has_shop_permission(shop_id, 'upload_imports'::text)";
  assert.match(evaluateSchema(expected, snapshot).blockers.join(" "), /effective_import_update/);
});

test("function grant drift and disabled or wrong calendar trigger block", () => {
  const snapshot = readySnapshot();
  snapshot.functions[0].anon_execute = true;
  snapshot.functions[4].authenticated_execute = true;
  snapshot.functions[5].callable_function = false;
  snapshot.triggers[0].type = 21;
  snapshot.triggers[1].enabled = false;
  assert.equal(evaluateSchema(expected, snapshot).blockers.length, 5);
});

test("absent capabilities cannot be mistaken for success", () => {
  const snapshot = readySnapshot();
  snapshot.policies = [];
  snapshot.functions = [];
  snapshot.triggers = [];
  assert.equal(evaluateSchema(expected, snapshot).status, "fail");
});

test("catalog inspection uses a read-only transaction and binds function signatures", async () => {
  const queries = [];
  const tx = async (parts, ...parameters) => {
    const query = parts.join("?");
    queries.push(query);
    if (query.includes("to_regclass")) return [{ present: false }];
    if (query.includes("pg_attribute")) return [{ present: false }];
    if (query.includes("from pg_policy")) return [];
    if (query.includes("from unnest(")) {
      assert.deepEqual(
        parameters[0],
        REQUIRED_FUNCTIONS.map(({ signature }) => signature),
      );
      assert.match(query, /unnest\(\?::text\[\]\)/);
      return [];
    }
    if (query.includes("from pg_trigger")) return [];
    throw new Error("Unexpected catalog query");
  };
  const snapshot = await readSchemaSnapshot({
    begin: (options, callback) => {
      assert.equal(options, "isolation level repeatable read read only");
      return callback(tx);
    },
  });
  assert.equal(snapshot.rows, null);
  assert.equal(queries.length, 5);
  assert.ok(queries.every((query) => /^\s*select\b/i.test(query)));
});

test("catalog checks match the migrated schema in disposable PostgreSQL", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb$$;
      grant usage on schema auth, storage, public to authenticated, anon, service_role;
      create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant all on storage.objects to authenticated;
      create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
    `);
    for (const migration of readExpectedMigrations(root)) {
      await db.exec(
        readFileSync(
          new URL(`../drizzle/migrations/${migration.tag}.sql`, import.meta.url),
          "utf8",
        ),
      );
    }
    const snapshot = await readSchemaSnapshot({
      begin: async (options, callback) => {
        await db.exec(`begin ${options}`);
        try {
          const result = await callback((parts, ...parameters) =>
            db
              .query(
                parts
                  .map(
                    (part, index) => `${part}${index < parameters.length ? `$${index + 1}` : ""}`,
                  )
                  .join(""),
                parameters,
              )
              .then(({ rows }) => rows),
          );
          await db.exec("rollback");
          return result;
        } catch (error) {
          await db.exec("rollback");
          throw error;
        }
      },
    });
    assert.equal(snapshot.rows, null);
    assert.deepEqual(evaluateSchema([], snapshot).blockers, [
      "Database Drizzle journal is missing.",
    ]);
  } finally {
    await db.close();
  }
});

test("CLI reports only authored validation errors and fails before any connection", () => {
  const cli = fileURLToPath(new URL("./check-release-schema.mjs", import.meta.url));
  for (const { args, url, blocker } of [
    { args: [], url: undefined, blocker: /Usage:/ },
    {
      args: ["--environment", "staging", "--commit", "0".repeat(40)],
      url: "postgres://postgres:synthetic@db.cblabtksphjsnkkyfnmo.supabase.co/postgres",
      blocker: /target does not match/,
    },
    {
      args: ["--environment", "staging", "--commit", "0".repeat(40)],
      url: `postgres://postgres:synthetic@db.${PROJECTS.staging}.supabase.co/postgres`,
      blocker: /requested commit checked out/,
    },
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, SUPABASE_DB_URL: url },
    });
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "fail");
    assert.match(report.blockers.join(" "), blocker);
    assert.doesNotMatch(result.stdout + result.stderr, /synthetic|postgres:\/\//);
  }
});
