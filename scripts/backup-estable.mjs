import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const dateStr = "2026-10-06";
const backupDir = path.join(ROOT, "backups", `estable-${dateStr}`);
fs.mkdirSync(backupDir, { recursive: true });

console.log(`[Backup] Generando punto de restauración en ${backupDir}...`);

// 1. Manifiesto de media
const mediaDir = path.join(ROOT, "media");
const manifestLines = ["Path,Size,SHA256"];

function scanDir(dir, relPrefix = "") {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      scanDir(full, rel);
    } else if (entry.isFile()) {
      const buf = fs.readFileSync(full);
      const hash = crypto.createHash("sha256").update(buf).digest("hex");
      manifestLines.push(`"${rel}",${buf.length},${hash}`);
    }
  }
}

if (fs.existsSync(mediaDir)) {
  scanDir(mediaDir);
  const manifestFile = path.join(backupDir, "media-manifest.csv");
  fs.writeFileSync(manifestFile, manifestLines.join("\n"), "utf-8");
  console.log(`[Backup] Manifiesto de media creado: ${manifestLines.length - 1} archivos`);
}

// 2. ZIP del código
const zipFile = path.join(backupDir, `orbe-codigo-estable-${dateStr}.zip`);
if (fs.existsSync(zipFile)) {
  fs.unlinkSync(zipFile);
}

console.log("[Backup] Comprimiendo código fuente...");
const psScriptFile = path.join(backupDir, "make-zip.ps1");
const psContent = `
$excludes = @('.git', 'node_modules', 'media', 'backups', '.convex', '.cursor', '_restos_exras_bloqueados')
$items = Get-ChildItem -Path '${ROOT.replace(/'/g, "''")}' | Where-Object { $excludes -notcontains $_.Name } | ForEach-Object { $_.FullName }
Compress-Archive -Path $items -DestinationPath '${zipFile.replace(/'/g, "''")}' -Force
`;

fs.writeFileSync(psScriptFile, psContent, "utf-8");
execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptFile}"`, { stdio: "inherit" });
fs.unlinkSync(psScriptFile);

console.log(`[Backup] Archivo ZIP creado con éxito: ${zipFile}`);
