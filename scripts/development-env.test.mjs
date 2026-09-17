import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readDevelopmentEnv, validateDevelopmentEnv } from "./development-env.mjs";

const productionProjectId = "production-ref";
const staging = {
  SHOPDESK_ENVIRONMENT: "development",
  SUPABASE_URL: "https://staging-ref.supabase.co",
  VITE_SUPABASE_URL: "https://staging-ref.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_testPublicKey",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_testPublicKey",
};

test("accepts separate staging and local backends", () => {
  assert.deepEqual(validateDevelopmentEnv(staging, productionProjectId), []);
  assert.deepEqual(
    validateDevelopmentEnv(
      {
        ...staging,
        SUPABASE_URL: "http://127.0.0.1:54321",
        VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      },
      productionProjectId,
    ),
    [],
  );
});
test("rejects production even when labelled staging", () => {
  const problems = validateDevelopmentEnv(
    {
      ...staging,
      SHOPDESK_ENVIRONMENT: "staging",
      SUPABASE_URL: "https://production-ref.supabase.co",
      VITE_SUPABASE_URL: "https://production-ref.supabase.co",
    },
    productionProjectId,
  );
  assert.equal(problems.filter((problem) => problem.includes("production project")).length, 2);
});
test("rejects mixed targets and private browser credentials", () => {
  const problems = validateDevelopmentEnv(
    {
      ...staging,
      VITE_SUPABASE_URL: "https://other-ref.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_test",
      VITE_OPENAI_API_KEY: "test",
    },
    productionProjectId,
  );
  assert.ok(problems.some((problem) => problem.includes("same backend")));
  assert.ok(problems.some((problem) => problem.includes("never a service-role")));
  assert.ok(problems.some((problem) => problem.includes("private credential")));
});
test("rejects unsafe URLs and missing environment label", () => {
  const problems = validateDevelopmentEnv(
    {
      ...staging,
      SHOPDESK_ENVIRONMENT: "",
      SUPABASE_URL: "http://remote.example",
      VITE_SUPABASE_URL: "https://replace-with-staging-project-id.supabase.co",
    },
    productionProjectId,
  );
  assert.ok(problems.some((problem) => problem.includes("SHOPDESK_ENVIRONMENT")));
  assert.ok(problems.some((problem) => problem.includes("must use HTTPS")));
  assert.ok(problems.some((problem) => problem.includes("real backend URL")));
});
test("accepts anon JWTs and rejects service-role JWTs", () => {
  for (const role of ["anon", "service_role"]) {
    const key = `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
    const problems = validateDevelopmentEnv(
      { ...staging, SUPABASE_PUBLISHABLE_KEY: key, VITE_SUPABASE_PUBLISHABLE_KEY: key },
      productionProjectId,
    );
    assert.equal(problems.length === 0, role === "anon");
  }
});
test("uses Vite file precedence, with shell overrides last", () => {
  const root = mkdtempSync(join(tmpdir(), "shopdesk-env-"));
  try {
    for (const name of [".env", ".env.local", ".env.development", ".env.development.local"]) {
      writeFileSync(join(root, name), `TARGET=${name}\n`);
    }
    assert.equal(readDevelopmentEnv(root, {}).TARGET, ".env.development.local");
    assert.equal(readDevelopmentEnv(root, { TARGET: "shell" }).TARGET, "shell");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
