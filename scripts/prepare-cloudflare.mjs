import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((s) => s !== "--")
    .reduce(
      (a, value, i, all) =>
        value.startsWith("--") ? [...a, [value.slice(2), all[i + 1]]] : a,
      [],
    ),
);
if (
  !/^[a-f0-9-]{36}$/.test(args["database-id"] ?? "") ||
  !/^[a-z0-9-]{3,63}$/.test(args.bucket ?? "")
) {
  console.error(
    "Usage: pnpm deploy:prepare -- --database-id <D1 UUID> --bucket <R2 bucket> [--name instantmart] [--demo-enabled true]",
  );
  process.exit(1);
}
const name = args.name ?? "instantmart";
if (!/^[a-z][a-z0-9-]{2,62}$/.test(name))
  throw new Error("Invalid worker name.");
const config = JSON.parse(readFileSync("dist/server/wrangler.json", "utf8"));
Object.assign(config, {
  name,
  main: resolve("dist/server/index.js"),
  compatibility_date: "2026-08-06",
  assets: { ...config.assets, directory: resolve("dist/client") },
  d1_databases: [
    {
      binding: "DB",
      database_name: "instantmart-db",
      database_id: args["database-id"],
    },
  ],
  r2_buckets: [{ binding: "BUCKET", bucket_name: args.bucket }],
  vars: { DEMO_ENABLED: args["demo-enabled"] === "true" ? "true" : "false" },
  observability: { enabled: true },
});
delete config.legacy_env;
mkdirSync(".cloudflare", { recursive: true });
writeFileSync(
  ".cloudflare/wrangler.json",
  JSON.stringify(config, null, 2) + "\n",
);
console.log(
  "Prepared .cloudflare/wrangler.json. No credentials are stored in it.",
);
