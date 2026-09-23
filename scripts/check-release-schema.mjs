import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import {
  SafeError,
  evaluateSchema,
  readExpectedMigrations,
  readSchemaSnapshot,
  validateTarget,
} from "./release-schema.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const report = { checkedAt: new Date().toISOString(), status: "fail", blockers: [] };
let sql;
try {
  if (
    args.length !== 4 ||
    args[0] !== "--environment" ||
    args[2] !== "--commit" ||
    !/^[a-f0-9]{40}$/.test(args[3])
  ) {
    throw new SafeError(
      "Usage: --environment staging|production --commit <full lowercase commit SHA>.",
    );
  }
  Object.assign(report, validateTarget(args[1], process.env.SUPABASE_DB_URL));
  report.candidateCommit = args[3];
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (head !== report.candidateCommit || dirty) {
    throw new SafeError(
      "Release evidence requires the requested commit checked out with no tracked changes.",
    );
  }
  const expected = readExpectedMigrations(root);
  sql = postgres(process.env.SUPABASE_DB_URL, {
    max: 1,
    prepare: false,
    ssl: "verify-full",
    connect_timeout: 10,
    idle_timeout: 10,
    onnotice: () => {},
    connection: { application_name: "shopdesk-release-preflight", statement_timeout: 15000 },
  });
  let snapshot;
  try {
    snapshot = await readSchemaSnapshot(sql);
  } catch {
    // Database/provider errors can include URLs or credentials. Never echo them.
    throw new SafeError(
      "Database schema inspection failed; verify connectivity and catalog-read access privately.",
    );
  }
  Object.assign(report, evaluateSchema(expected, snapshot));
} catch (error) {
  // Only explicitly authored messages can appear in release evidence.
  report.blockers.push(
    error instanceof SafeError
      ? error.message
      : "Preflight could not complete; verify repository inputs, connectivity and read access privately.",
  );
} finally {
  if (sql) await sql.end({ timeout: 5 }).catch(() => {});
}
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.status === "pass" ? 0 : 1;
