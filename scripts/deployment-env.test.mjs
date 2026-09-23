import assert from "node:assert/strict";
import test from "node:test";
import { checkDeployment } from "./deployment-env.mjs";
import { STAGING_PROJECT_REF, PRODUCTION_PROJECT_REF } from "./backend-targets.mjs";

const config = (environment, ref) => ({
  VERCEL_ENV: environment,
  SUPABASE_URL: `https://${ref}.supabase.co`,
  VITE_SUPABASE_URL: `https://${ref}.supabase.co`,
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test",
});

const jwt = (role, ref) =>
  [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ role, ref })).toString("base64url"),
    "signature",
  ].join(".");

test("preview cannot use production, mixed, or unknown backends", async () => {
  for (const env of [
    config("preview", PRODUCTION_PROJECT_REF),
    config("production", STAGING_PROJECT_REF),
    config("preview", "unknown"),
    {
      ...config("preview", STAGING_PROJECT_REF),
      VITE_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
    },
  ]) {
    const result = await checkDeployment(env, () =>
      assert.fail("Must reject before sending any request"),
    );
    assert.ok(result.length > 0);
  }
});
test("verified targets perform only a zero-row schema GET", async () => {
  for (const [environment, ref] of [
    ["preview", STAGING_PROJECT_REF],
    ["production", PRODUCTION_PROJECT_REF],
  ]) {
    const keys = [];
    assert.deepEqual(
      await checkDeployment(config(environment, ref), async (url, options) => {
        assert.equal(url.origin, `https://${ref}.supabase.co`);
        assert.equal(url.pathname, "/rest/v1/shop_settings");
        assert.equal(url.searchParams.get("select"), "business_calendar");
        assert.equal(url.searchParams.get("limit"), "0");
        assert.equal([...url.searchParams.keys()].length, 2);
        assert.equal(options.method, "GET");
        assert.equal(options.redirect, "error");
        assert.ok(options.signal);
        assert.equal(options.headers.Authorization, undefined);
        keys.push(options.headers.apikey);
        return new Response("[]", { status: 200 });
      }),
      [],
    );
    assert.deepEqual(keys, ["sb_publishable_test", "sb_secret_test"]);
  }
});
test("missing, swapped, wrong-role, and wrong-project server credentials fail before requests", async () => {
  for (const key of [
    undefined,
    "sb_publishable_test",
    jwt("anon", STAGING_PROJECT_REF),
    jwt("authenticated", STAGING_PROJECT_REF),
    jwt("service_role", PRODUCTION_PROJECT_REF),
    "not-a-key",
  ]) {
    const problems = await checkDeployment(
      { ...config("preview", STAGING_PROJECT_REF), SUPABASE_SERVICE_ROLE_KEY: key },
      () => assert.fail("Invalid credentials must not trigger a request"),
    );
    assert.ok(problems.length > 0);
    assert.ok(!problems.join().includes(key ?? "absent-private-key"));
  }
});
test("legacy service_role JWT uses the same bearer and apikey headers as the server client", async () => {
  const key = jwt("service_role", STAGING_PROJECT_REF);
  let calls = 0;
  assert.deepEqual(
    await checkDeployment(
      { ...config("preview", STAGING_PROJECT_REF), SUPABASE_SERVICE_ROLE_KEY: key },
      async (_url, options) => {
        calls++;
        if (calls === 2) {
          assert.equal(options.headers.apikey, key);
          assert.equal(options.headers.Authorization, `Bearer ${key}`);
        }
        return new Response("[]", { status: 200 });
      },
    ),
    [],
  );
  assert.equal(calls, 2);
});
test("public access and server access are verified independently", async () => {
  let calls = 0;
  const failedPublic = await checkDeployment(config("preview", STAGING_PROJECT_REF), async () => {
    calls++;
    return new Response("private public-response text", { status: 401 });
  });
  assert.equal(calls, 1);
  assert.ok(failedPublic.length);
  assert.ok(!failedPublic.join().includes("private public-response text"));

  calls = 0;
  const failedServer = await checkDeployment(config("preview", STAGING_PROJECT_REF), async () => {
    calls++;
    return calls === 1
      ? new Response("[]", { status: 200 })
      : new Response("private server-response text", { status: 401 });
  });
  assert.equal(calls, 2);
  assert.ok(failedServer.length);
  assert.ok(!failedServer.join().includes("private server-response text"));
});
test("missing migration, inaccessible database, and malformed responses block build", async () => {
  for (const request of [
    async () => new Response("{}", { status: 400 }),
    async () => new Response("{}", { status: 401 }),
    async () => new Response("{}", { status: 200 }),
    async () => {
      throw new Error("private connection details");
    },
  ]) {
    const problems = await checkDeployment(config("preview", STAGING_PROJECT_REF), request);
    assert.ok(problems.length > 0);
    assert.ok(!problems.join().includes("private connection details"));
  }
});
test("missing deployment identity fails closed", async () => {
  assert.ok(
    (await checkDeployment(config(undefined, STAGING_PROJECT_REF), () => assert.fail())).length,
  );
});
