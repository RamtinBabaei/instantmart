import { spawnSync } from "node:child_process";
const email = process.argv[2];
if (!email || !/^[^\s'";]+@[^\s'";]+\.[^\s'";]+$/.test(email)) {
  console.error("Usage: pnpm db:admin your-registered-email@example.com");
  process.exit(1);
}
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
    "dist/server/wrangler.json",
    "--persist-to",
    ".wrangler/state",
    "--command",
    `UPDATE users SET role='admin' WHERE workspace_id='store' AND email='${email.toLowerCase()}' RETURNING id,email,role`,
  ],
  { stdio: "inherit" },
);
process.exit(r.status ?? 1);
