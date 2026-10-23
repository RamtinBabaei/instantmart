import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
function files(path) {
  return readdirSync(path).flatMap((name) => {
    const p = join(path, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
if (!existsSync("dist/client")) {
  console.error("Run pnpm build first.");
  process.exit(1);
}
const assets = files("dist/client"),
  js = assets.filter((p) => p.endsWith(".js")),
  css = assets.filter((p) => p.endsWith(".css"));
const gzip = (paths) =>
  paths.reduce((n, p) => n + gzipSync(readFileSync(p)).length, 0);
const report = {
  javascriptGzipBytes: gzip(js),
  cssGzipBytes: gzip(css),
  largestJavascriptGzipBytes: Math.max(
    ...js.map((p) => gzipSync(readFileSync(p)).length),
  ),
  heroImageBytes: statSync("public/images/hero.webp").size,
  mobileHeroBytes: statSync("public/images/hero-mobile.webp").size,
  fontBytes: files("public/fonts")
    .filter((p) => p.endsWith(".woff2"))
    .reduce((n, p) => n + statSync(p).size, 0),
};
console.log(JSON.stringify(report, null, 2));
if (
  report.javascriptGzipBytes > 400000 ||
  report.cssGzipBytes > 25000 ||
  report.largestJavascriptGzipBytes > 120000 ||
  report.heroImageBytes > 250000 ||
  report.fontBytes > 150000
) {
  console.error("Bundle budget exceeded.");
  process.exit(1);
}
console.log(
  "Bundle budgets passed. These are transfer budgets, not a Lighthouse or field Core Web Vitals score.",
);
