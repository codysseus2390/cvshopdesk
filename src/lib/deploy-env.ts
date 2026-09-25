/**
 * Distinguishes a real Vercel Production deploy from a PR Preview build or local
 * dev, baked in at build time (see vite.config.ts). Preview and local dev both
 * read as "not production" — only a manual Production build reads as production.
 */
export function isProductionDeploy(): boolean {
  return import.meta.env["VITE_DEPLOY_ENV"] === "production";
}
