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

const validAuthSettings = () =>
  new Response(JSON.stringify({ external: { email: true }, disable_signup: false }), {
    status: 200,
  });

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
test("verified targets check public Auth settings and server schema with read-only GETs", async () => {
  for (const [environment, ref] of [
    ["preview", STAGING_PROJECT_REF],
    ["production", PRODUCTION_PROJECT_REF],
  ]) {
    const calls = [];
    assert.deepEqual(
      await checkDeployment(config(environment, ref), async (url, options) => {
        assert.equal(url.origin, `https://${ref}.supabase.co`);
        assert.equal(options.method, "GET");
        assert.equal(options.redirect, "error");
        assert.ok(options.signal instanceof AbortSignal);
        assert.ok(!options.signal.aborted);
        assert.equal(options.headers.Authorization, undefined);
        assert.equal(options.headers.Accept, "application/json");
        calls.push({ path: url.pathname, key: options.headers.apikey });
        if (url.pathname === "/auth/v1/settings") {
          assert.equal(url.search, "");
          return validAuthSettings();
        }
        assert.equal(url.pathname, "/rest/v1/shop_settings");
        assert.equal(url.searchParams.get("select"), "business_calendar");
        assert.equal(url.searchParams.get("limit"), "0");
        assert.equal([...url.searchParams.keys()].length, 2);
        return new Response("[]", { status: 200 });
      }),
      [],
    );
    assert.deepEqual(calls, [
      { path: "/auth/v1/settings", key: "sb_publishable_test" },
      { path: "/rest/v1/shop_settings", key: "sb_secret_test" },
    ]);
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
        return calls === 1 ? validAuthSettings() : new Response("[]", { status: 200 });
      },
    ),
    [],
  );
  assert.equal(calls, 2);
});
test("legacy anon JWT uses bearer auth only for the public Auth settings request", async () => {
  const key = jwt("anon", STAGING_PROJECT_REF);
  let calls = 0;
  assert.deepEqual(
    await checkDeployment(
      {
        ...config("preview", STAGING_PROJECT_REF),
        SUPABASE_PUBLISHABLE_KEY: key,
        VITE_SUPABASE_PUBLISHABLE_KEY: key,
      },
      async (url, options) => {
        calls++;
        if (calls === 1) {
          assert.equal(url.pathname, "/auth/v1/settings");
          assert.equal(options.headers.apikey, key);
          assert.equal(options.headers.Authorization, `Bearer ${key}`);
          return validAuthSettings();
        }
        assert.equal(url.pathname, "/rest/v1/shop_settings");
        assert.equal(options.headers.apikey, "sb_secret_test");
        assert.equal(options.headers.Authorization, undefined);
        return new Response("[]", { status: 200 });
      },
    ),
    [],
  );
  assert.equal(calls, 2);
});
test("public access and server access are verified independently", async () => {
  let calls = 0;
  const failedPublic = await checkDeployment(
    config("preview", STAGING_PROJECT_REF),
    async (url) => {
      calls++;
      assert.equal(url.pathname, "/auth/v1/settings");
      return new Response("private public-response text", { status: 401 });
    },
  );
  assert.equal(calls, 1);
  assert.ok(failedPublic.length);
  assert.ok(!failedPublic.join().includes("private public-response text"));

  calls = 0;
  const failedServer = await checkDeployment(config("preview", STAGING_PROJECT_REF), async () => {
    calls++;
    return calls === 1
      ? validAuthSettings()
      : new Response("private server-response text", { status: 401 });
  });
  assert.equal(calls, 2);
  assert.ok(failedServer.length);
  assert.ok(!failedServer.join().includes("private server-response text"));
});
test("private table denial to anonymous users does not block a valid public key", async () => {
  let calls = 0;
  assert.deepEqual(
    await checkDeployment(config("preview", STAGING_PROJECT_REF), async (url, options) => {
      calls++;
      if (url.pathname === "/auth/v1/settings") {
        assert.equal(options.headers.apikey, "sb_publishable_test");
        return validAuthSettings();
      }
      assert.equal(url.pathname, "/rest/v1/shop_settings");
      assert.equal(options.headers.apikey, "sb_secret_test");
      return new Response("[]", { status: 200 });
    }),
    [],
  );
  assert.equal(calls, 2);
});
test("malformed Auth settings and public-key failures block before server schema access", async () => {
  for (const response of [
    new Response("invalid key", { status: 401 }),
    new Response("{}", { status: 200 }),
    new Response("null", { status: 200 }),
    new Response("[]", { status: 200 }),
    new Response(JSON.stringify({ external: null, disable_signup: false }), { status: 200 }),
    new Response(JSON.stringify({ external: [], disable_signup: false }), { status: 200 }),
    new Response(JSON.stringify({ external: {}, disable_signup: "false" }), { status: 200 }),
    new Response("not json", { status: 200 }),
  ]) {
    let calls = 0;
    const problems = await checkDeployment(config("preview", STAGING_PROJECT_REF), async (url) => {
      calls++;
      assert.equal(url.pathname, "/auth/v1/settings");
      return response;
    });
    assert.ok(problems.length > 0);
    assert.equal(calls, 1);
    assert.ok(!problems.join().includes("invalid key"));
  }
});
test("missing server column, inaccessible schema, and malformed schema responses block build", async () => {
  for (const serverResponse of [
    new Response('{"code":"42703","message":"column missing"}', { status: 400 }),
    new Response("private response", { status: 401 }),
    new Response("{}", { status: 200 }),
    new Response("[{}]", { status: 200 }),
  ]) {
    let calls = 0;
    const problems = await checkDeployment(config("preview", STAGING_PROJECT_REF), async () => {
      calls++;
      return calls === 1 ? validAuthSettings() : serverResponse;
    });
    assert.ok(problems.length > 0);
    assert.equal(calls, 2);
    assert.ok(!problems.join().includes("private response"));
    assert.ok(!problems.join().includes("column missing"));
  }
});
test("request errors are sanitized and fail closed at either gate", async () => {
  for (const failingCall of [1, 2]) {
    let calls = 0;
    const problems = await checkDeployment(config("preview", STAGING_PROJECT_REF), async () => {
      calls++;
      if (calls === failingCall) throw new Error("private connection details");
      return validAuthSettings();
    });
    assert.ok(problems.length > 0);
    assert.equal(calls, failingCall);
    assert.ok(!problems.join().includes("private connection details"));
  }
});
test("missing deployment identity fails closed", async () => {
  assert.ok(
    (await checkDeployment(config(undefined, STAGING_PROJECT_REF), () => assert.fail())).length,
  );
});
