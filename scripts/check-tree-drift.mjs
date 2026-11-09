/**
 * Detecta divergencia entre el repo producto (ORBE) y la copia que sirve la demo
 * (PROTOTIPO-360-CURSOR-V1). Dos árboles con el mismo motor se separan en días.
 *
 * Uso:
 *   node scripts/check-tree-drift.mjs                 # compara contra la ruta por defecto
 *   node scripts/check-tree-drift.mjs --other <ruta>
 *   node scripts/check-tree-drift.mjs --json
 *
 * Salida: exit 0 si los árboles coinciden, 1 si hay drift (usable en pre-push / CI).
 * Solo compara código, docs y config. media/ se verifica por manifiesto aparte.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DEFAULT_OTHER =
  process.env.ORBE_DEMO_TREE ||
  "C:/Users/SOTO/Documents/ED/simon/2026 2/gestion de proyectos/PROTOTIPO-360-CURSOR-V1";

/** Nada de esto entra en la comparación: binarios, generados o locales por diseño. */
const SKIP_DIRS = new Set([
  ".git",
  ".convex",
  ".cursor",
  "node_modules",
  "media",
  "panoramas",
  "backups",
  "reports",
  "test-results",
  "playwright-report",
  "coverage",
  "_restos_exras_bloqueados",
]);

const SKIP_FILES = new Set([".env", ".env.local", "package-lock.json"]);

/** Transitorios e ignorados por git: no son divergencia real. */
const SKIP_EXT = new Set([".tmp", ".log"]);

function parseArgs(argv) {
  const out = { other: DEFAULT_OTHER, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--other") out.other = argv[++i];
    else if (argv[i] === "--json") out.json = true;
  }
  return out;
}

function walk(root) {
  /** @type {Map<string, string>} */
  const map = new Map();
  /** @param {string} dir */
  const visit = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        visit(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (SKIP_FILES.has(entry.name)) continue;
      if (SKIP_EXT.has(path.extname(entry.name).toLowerCase())) continue;
      const rel = path.relative(root, abs).split(path.sep).join("/");
      // Normaliza CRLF/LF: los dos árboles viven en Windows con checkouts distintos.
      const raw = fs.readFileSync(abs);
      const normalized = raw.includes(0)
        ? raw
        : Buffer.from(raw.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
      map.set(rel, crypto.createHash("sha256").update(normalized).digest("hex"));
    }
  };
  visit(root);
  return map;
}

function mtime(root, rel) {
  try {
    return fs.statSync(path.join(root, rel)).mtime.toISOString().slice(0, 16).replace("T", " ");
  } catch {
    return "-";
  }
}

const args = parseArgs(process.argv.slice(2));

if (!fs.existsSync(args.other)) {
  console.error(`[drift] No existe el árbol de comparación: ${args.other}`);
  console.error("        Usa --other <ruta> o la variable ORBE_DEMO_TREE.");
  process.exit(2);
}

const here = walk(ROOT);
const there = walk(path.resolve(args.other));

const onlyHere = [...here.keys()].filter((k) => !there.has(k)).sort();
const onlyThere = [...there.keys()].filter((k) => !here.has(k)).sort();
const different = [...here.keys()]
  .filter((k) => there.has(k) && there.get(k) !== here.get(k))
  .sort();

const report = {
  productRoot: ROOT,
  demoRoot: path.resolve(args.other),
  productFiles: here.size,
  demoFiles: there.size,
  onlyInProduct: onlyHere,
  onlyInDemo: onlyThere,
  different: different.map((rel) => ({
    file: rel,
    productMtime: mtime(ROOT, rel),
    demoMtime: mtime(path.resolve(args.other), rel),
  })),
};

const drifted = onlyHere.length + onlyThere.length + different.length;

if (args.json) {
  console.log(JSON.stringify({ ...report, drifted }, null, 2));
} else {
  console.log("");
  console.log("Orbe360 · drift entre árboles");
  console.log(`  producto : ${report.productRoot} (${report.productFiles} archivos)`);
  console.log(`  demo     : ${report.demoRoot} (${report.demoFiles} archivos)`);
  console.log("");
  if (!drifted) {
    console.log("  OK — los dos árboles coinciden en código, docs y config.");
  } else {
    if (onlyHere.length) {
      console.log(`  Solo en producto (${onlyHere.length}):`);
      for (const f of onlyHere) console.log(`    + ${f}`);
    }
    if (onlyThere.length) {
      console.log(`  Solo en demo (${onlyThere.length}):`);
      for (const f of onlyThere) console.log(`    - ${f}`);
    }
    if (different.length) {
      console.log(`  Contenido distinto (${different.length}):`);
      console.log(`    ${"archivo".padEnd(46)} ${"producto".padEnd(17)} demo`);
      for (const d of report.different) {
        console.log(`    ${d.file.padEnd(46)} ${d.productMtime.padEnd(17)} ${d.demoMtime}`);
      }
    }
    console.log("");
    console.log(`  DRIFT: ${drifted} archivo(s). Ver docs/arquitectura/01-auditoria-2026-09-29.md`);
  }
  console.log("");
}

process.exit(drifted ? 1 : 0);
