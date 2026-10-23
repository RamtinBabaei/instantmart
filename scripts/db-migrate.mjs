import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
const config = resolve("dist/server/wrangler.json");
const state = process.env.INSTANTMART_LOCAL_STATE ?? ".wrangler/state";
if (!existsSync(config)) {
  console.error("Run pnpm build before applying local migrations.");
  process.exit(1);
}
const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
function execute(args) {
  const r = spawnSync(
    process.execPath,
    [
      "--import",
      "./scripts/sites-env.mjs",
      "./node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      config,
      "--persist-to",
      state,
      ...args,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    process.stderr.write(r.stderr || r.stdout);
    process.exit(r.status ?? 1);
  }
  return r.stdout;
}
execute([
  "--command",
  "CREATE TABLE IF NOT EXISTS __instantmart_migrations (name TEXT PRIMARY KEY)",
  "--json",
]);
for (const entry of journal.entries) {
  const name = entry.tag;
  const rows = JSON.parse(
    execute([
      "--command",
      `SELECT name FROM __instantmart_migrations WHERE name='${name}'`,
      "--json",
    ]),
  );
  if (rows.some((r) => r.results?.length)) {
    console.log("Already applied: " + name);
    continue;
  }
  execute(["--file", resolve("drizzle", name + ".sql"), "--json"]);
  execute([
    "--command",
    `INSERT INTO __instantmart_migrations(name) VALUES ('${name}')`,
    "--json",
  ]);
  console.log("Applied: " + name);
}
console.log("Local database is ready.");
