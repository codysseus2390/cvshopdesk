import { validateBackendEnv } from "./development-env.mjs";
import { STAGING_PROJECT_REF, PRODUCTION_PROJECT_REF } from "./backend-targets.mjs";

function serverKeyProblem(key, ref) {
  if (!key) return "SUPABASE_SERVICE_ROLE_KEY is required for the server runtime.";
  if (key.startsWith("sb_secret_") && key.length > "sb_secret_".length) return null;
  if (key.startsWith("sb_"))
    return "SUPABASE_SERVICE_ROLE_KEY must be a secret key or service_role JWT.";
  const parts = key.split(".");
  if (parts.length !== 3)
    return "SUPABASE_SERVICE_ROLE_KEY must be a secret key or service_role JWT.";
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (payload.role !== "service_role")
      return "SUPABASE_SERVICE_ROLE_KEY must have the service_role role.";
    if (payload.ref && payload.ref !== ref)
      return "SUPABASE_SERVICE_ROLE_KEY belongs to a different backend project.";
  } catch {
    return "SUPABASE_SERVICE_ROLE_KEY must be a secret key or service_role JWT.";
  }
  return null;
}

function keyHeaders(key) {
  const headers = { apikey: key, Accept: "application/json" };
  // The server client removes the bearer header for modern opaque API keys.
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function checkZeroRowAccess(url, key, request, label) {
  try {
    const response = await request(url, {
      method: "GET",
      headers: keyHeaders(key),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (!response.ok) {
      const status = Number.isInteger(response.status) ? ` (HTTP ${response.status})` : "";
      return `${label} preflight failed${status}. Verify migration 0024 and API access before deploying.`;
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length !== 0)
      return `${label} preflight returned an unexpected response.`;
  } catch {
    return `${label} preflight could not complete. Deployment is blocked until the backend can be verified.`;
  }
  return null;
}

export async function checkDeployment(env, request = fetch) {
  if (!["preview", "production"].includes(env.VERCEL_ENV)) {
    return [
      "VERCEL_ENV must identify preview or production; use the ordinary build command for local/CI builds.",
    ];
  }
  const ref = env.VERCEL_ENV === "preview" ? STAGING_PROJECT_REF : PRODUCTION_PROJECT_REF;
  const problems = validateBackendEnv(env, { allowedRefs: [ref] });
  const serverProblem = serverKeyProblem(env.SUPABASE_SERVICE_ROLE_KEY, ref);
  if (serverProblem) problems.push(serverProblem);
  if (problems.length) return problems;
  // Read-only, zero-row schema check. Full SQL/RLS and journal verification is
  // a separate release gate; this catches the missing-column production incident.
  const url = new URL("/rest/v1/shop_settings", env.SUPABASE_URL);
  url.searchParams.set("select", "business_calendar");
  url.searchParams.set("limit", "0");
  const publicProblem = await checkZeroRowAccess(
    url,
    env.SUPABASE_PUBLISHABLE_KEY,
    request,
    "Public backend schema",
  );
  if (publicProblem) return [publicProblem];
  const privilegedProblem = await checkZeroRowAccess(
    url,
    env.SUPABASE_SERVICE_ROLE_KEY,
    request,
    "Server backend schema",
  );
  if (privilegedProblem) return [privilegedProblem];
  return [];
}
