import { fileURLToPath } from "node:url";
import { readDevelopmentEnv, validateDevelopmentEnv } from "./development-env.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const problems = validateDevelopmentEnv(readDevelopmentEnv(root));
if (problems.length) {
  console.error(
    "Local backend setup needs attention:\n" + problems.map((problem) => `- ${problem}`).join("\n"),
  );
  process.exit(1);
}
console.log("Development backend checks passed. Use only staging accounts and data.");
