/**
 * Auditoría de rutas locales (href/src) — fallar CI si hay rotas.
 * node scripts/audit-routes.mjs
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const skipDirs = new Set(["node_modules", "dist", "vendors", ".git", "playwright-report", "test-results"]);

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(ent.name) || ent.name.startsWith(".")) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(html|js|css|md)$/i.test(ent.name)) acc.push(p);
  }
  return acc;
}

const issues = [];
const files = walk(root);
const re = /\b(?:href|src)=["']([^"'#]+)["']/gi;

for (const file of files) {
  if (file.includes(`${path.sep}scripts${path.sep}`)) continue;
  let text = fs.readFileSync(file, "utf8");
  if (file.endsWith(".md")) {
    text = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "");
  }
  const dir = path.dirname(file);
  let m;
  while ((m = re.exec(text))) {
    let url = m[1].trim();
    if (!url || url.startsWith("http") || url.startsWith("data:") || url.startsWith("mailto:") || url.startsWith("//")) continue;
    if (url.includes("${") || url.includes("{{")) continue;
    url = url.split("?")[0].split("#")[0];
    if (!url || url.endsWith("/")) {
      // Virtual multi-tenant tour prefixes (served by scripts/dev-server.mjs)
      if (/^\/?[a-z0-9-]+\/[a-z0-9-]+\/?$/i.test(url.replace(/^\//, "/"))) {
        const segs = url.replace(/^\/+|\/+$/g, "").split("/");
        if (
          segs.length === 2 &&
          !["plataforma", "control-web", "src", "css", "assets"].includes(segs[0])
        ) {
          continue;
        }
      }
      // directorio: exigir index.html
      const asDir = url.startsWith("/")
        ? path.join(root, url.replace(/^\//, ""), "index.html")
        : path.join(dir, url, "index.html");
      const bare = url.startsWith("/")
        ? path.join(root, url.replace(/^\//, ""))
        : path.resolve(dir, url);
      if (!fs.existsSync(asDir) && !fs.existsSync(bare)) {
        issues.push({
          file: path.relative(root, file),
          url: m[1],
          reason: "ruta de directorio sin index.html resoluble (usar .../index.html)",
        });
      }
      continue;
    }
    const target = url.startsWith("/")
      ? path.join(root, url.replace(/^\//, ""))
      : path.resolve(dir, url);
    if (!fs.existsSync(target)) {
      issues.push({
        file: path.relative(root, file),
        url: m[1],
        reason: `no existe: ${path.relative(root, target)}`,
      });
    }
  }
}

console.log(`Archivos escaneados: ${files.length}`);
console.log(`Problemas: ${issues.length}`);
for (const i of issues) console.log(`- ${i.file} → ${i.url} (${i.reason})`);
if (issues.length) process.exitCode = 1;
