import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import {
  STAGING_PROJECT_REF,
  PRODUCTION_PROJECT_REF,
  HISTORICAL_PRODUCTION_PROJECT_REF,
} from "./backend-targets.mjs";

export function readDevelopmentEnv(root, overrides = process.env) {
  const env = {};
  // Vite development-mode file precedence; shell values win.
  for (const name of [".env", ".env.local", ".env.development", ".env.development.local"]) {
    const path = resolve(root, name);
    if (existsSync(path)) Object.assign(env, parseEnv(readFileSync(path, "utf8")));
  }
  return Object.assign(env, overrides);
}

export function validateBackendEnv(env, { allowedRefs, allowLocal = false, blockedRefs = [] }) {
  const problems = [];
  const targets = [];
  for (const name of ["SUPABASE_URL", "VITE_SUPABASE_URL"]) {
    let target;
    try {
      target = new URL(env[name]);
    } catch {
      problems.push(`${name} must be a separate development/staging backend URL.`);
      continue;
    }
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
    if (target.protocol !== "https:" && !(local && target.protocol === "http:")) {
      problems.push(`${name} must use HTTPS, or HTTP for a local backend.`);
    }
    if (
      target.hostname.includes("replace-with-") ||
      target.username ||
      target.password ||
      target.pathname !== "/" ||
      target.search ||
      target.hash
    ) {
      problems.push(`${name} must contain a real backend URL without credentials.`);
    }
    if (blockedRefs.some((ref) => target.hostname === `${ref}.supabase.co`)) {
      problems.push(`${name} points at the production project. Use a separate staging project.`);
    }
    if (
      !(local && allowLocal) &&
      !allowedRefs.some((ref) => target.origin === `https://${ref}.supabase.co`)
    ) {
      problems.push(`${name} is not an explicitly allowed backend for this environment.`);
    }
    targets.push(target.href.replace(/\/$/, ""));
  }
  if (targets.length === 2 && targets[0] !== targets[1]) {
    problems.push("SUPABASE_URL and VITE_SUPABASE_URL must point at the same backend.");
  }
  for (const name of ["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]) {
    const key = env[name] ?? "";
    let isPublic = key.startsWith("sb_publishable_");
    try {
      const payload = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString());
      isPublic = payload.role === "anon";
      if (
        payload.ref &&
        targets.length === 2 &&
        !targets.every((url) => url === `https://${payload.ref}.supabase.co`)
      ) {
        problems.push(`${name} belongs to a different backend project.`);
      }
    } catch {
      // New publishable keys are opaque, rather than JWTs.
    }
    if (!isPublic)
      problems.push(`${name} must be a publishable/anon key, never a service-role key.`);
  }
  if (env.SUPABASE_PUBLISHABLE_KEY !== env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    problems.push("The server and browser publishable keys must match.");
  }
  for (const name of Object.keys(env)) {
    if (/^VITE_.*(SERVICE_ROLE|SECRET|PRIVATE_KEY|OPENAI_API_KEY|ELEVENLABS_API_KEY)/i.test(name)) {
      problems.push(
        `${name} exposes a private credential to the browser. Remove its VITE_ prefix.`,
      );
    }
  }
  return problems;
}

export function validateDevelopmentEnv(env, additionalProductionRef) {
  const problems = validateBackendEnv(env, {
    allowedRefs: [STAGING_PROJECT_REF],
    allowLocal: true,
    blockedRefs: [
      PRODUCTION_PROJECT_REF,
      HISTORICAL_PRODUCTION_PROJECT_REF,
      additionalProductionRef,
    ].filter(Boolean),
  });
  if (!["development", "staging"].includes(env.SHOPDESK_ENVIRONMENT)) {
    problems.push("Set SHOPDESK_ENVIRONMENT=development or staging in .env.local.");
  }
  return problems;
}
