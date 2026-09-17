import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readDevelopmentEnv, validateDevelopmentEnv } from "./development-env.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const config = readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");
const productionProjectId = config.match(/project_id\s*=\s*"([^"]+)"/)?.[1];
if (!productionProjectId) {
  console.error("Cannot identify production from supabase/config.toml; refusing local startup.");
  process.exit(1);
}
const problems = validateDevelopmentEnv(readDevelopmentEnv(root), productionProjectId);
if (problems.length) {
  console.error(
    "Local backend setup needs attention:\n" + problems.map((problem) => `- ${problem}`).join("\n"),
  );
  process.exit(1);
}
console.log("Development backend checks passed. Use only staging accounts and data.");
