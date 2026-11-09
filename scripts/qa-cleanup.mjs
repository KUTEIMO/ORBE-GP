/**
 * Run QA artifact cleanup against local Convex.
 * Prefers CONVEX_URL + login as superadmin; falls back to documenting the mutation.
 *
 * Usage:
 *   npm run qa:cleanup
 *   node scripts/qa-cleanup.mjs --dry-run
 */
const CONVEX = process.env.CONVEX_URL || "http://127.0.0.1:3210";
const dryRun = process.argv.includes("--dry-run");

async function convex(kind, path, args = {}) {
  const res = await fetch(`${CONVEX}/api/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const data = await res.json();
  if (!res.ok || data.status === "error") {
    throw new Error(data.errorMessage || data.message || "convex error");
  }
  return data.value;
}

async function main() {
  console.log(`QA cleanup → ${CONVEX}${dryRun ? " (dry-run)" : ""}`);
  const login = await convex("mutation", "auth:login", {
    email: "superadmin@orbe360.local",
    password: "OrbeSuper2026!",
  });
  if (!login?.ok || !login.token) {
    throw new Error(login?.error || "Login superadmin falló");
  }
  const result = await convex("mutation", "cleanupQa:cleanupQaArtifacts", {
    token: login.token,
    dryRun,
  });
  console.log(JSON.stringify(result, null, 2));
  await convex("mutation", "auth:logout", { token: login.token }).catch(() => {});
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
