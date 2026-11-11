/**
 * Verify Control Web authz is membership-based for ANY user (not seed allowlists).
 *
 * Checks:
 * 1. No/invalid session → assertTourEditorAccess denies
 * 2. Seed Unisimón admin denied on orbe/sandbox
 * 3. Seed Orbe admin allowed on orbe/sandbox, denied on Unisimón
 * 4. Fresh third user (createAdminUser + membership) same rules
 * 5. Client gate present in control-web sources
 *
 * Does NOT wipe Unisimón graph. Does NOT call syncCampusSpatialGraph.
 *
 * Usage: node scripts/verify-control-web-authz.mjs
 */
const CONVEX = process.env.CONVEX_URL || "http://127.0.0.1:3210";
const WEB = process.env.WEB_URL || "http://127.0.0.1:8081";

const results = [];
function ok(name, detail = "") {
  results.push({ name, pass: true, detail });
  console.log(`✔ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, pass: false, detail });
  console.error(`✖ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function convex(kind, path, args = {}) {
  const res = await fetch(`${CONVEX}/api/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const data = await res.json();
  if (!res.ok || data.status === "error") {
    const err = new Error(data.errorMessage || data.message || "convex error");
    err.data = data;
    throw err;
  }
  return data.value;
}

async function login(email, password) {
  const result = await convex("mutation", "auth:login", { email, password });
  if (!result?.ok) throw new Error(result?.error || `login failed: ${email}`);
  return result;
}

async function assertAccess(token, orgSlug, tourSlug) {
  return await convex("query", "tourAdmin:assertTourEditorAccess", {
    token,
    orgSlug,
    tourSlug,
    now: Date.now(),
  });
}

const THIRD_EMAIL = `qa-third-${Date.now()}@orbe-authz.test`;
const THIRD_PASS = "QaThirdUser2026!";

async function main() {
  console.log("=== verify-control-web-authz ===\n");

  // Client sources
  try {
    const gate = await fetch(`${WEB}/control-web/auth-gate.js`).then((r) =>
      r.text()
    );
    const admin = await fetch(`${WEB}/control-web/admin.js`).then((r) =>
      r.text()
    );
    const html = await fetch(`${WEB}/control-web/index.html`).then((r) =>
      r.text()
    );
    if (
      /requireControlWebAccess|assertTourEditorAccess/i.test(gate) &&
      /requireControlWebAccess/i.test(admin) &&
      /cw-locked|cwAuthGate/i.test(html) &&
      !/Modo lectura/i.test(admin)
    ) {
      ok("Client hard-gate (auth-gate + cw-locked, no modo lectura)");
    } else {
      fail("Client hard-gate missing or still has anonymous read mode");
    }
  } catch (e) {
    fail("Fetch control-web sources", e.message);
  }

  // Anonymous
  try {
    const anon = await assertAccess("not-a-session", "orbe", "sandbox");
    if (anon?.ok === false && anon.reason === "unauthenticated") {
      ok("Anonymous denied on orbe/sandbox");
    } else {
      fail("Anonymous should be unauthenticated", JSON.stringify(anon));
    }
  } catch (e) {
    fail("Anonymous assert", e.message);
  }

  try {
    await convex("query", "tourAdmin:getAdminSnapshot", {
      token: "fake",
      slug: "sandbox",
      orgSlug: "orbe",
    });
    fail("getAdminSnapshot must reject anonymous");
  } catch {
    ok("getAdminSnapshot rejects anonymous");
  }

  // Seed Unisimón → orbe deny
  try {
    const uni = await login("admin@unisimon.local", "UnisimonAdmin2026!");
    const uniToken = uni.token;
    const cross = await assertAccess(uniToken, "orbe", "sandbox");
    if (cross?.ok === false) {
      ok("Unisimón admin denied on orbe/sandbox", cross.reason);
    } else {
      fail("Unisimón must not edit orbe sandbox", JSON.stringify(cross));
    }
    const own = await assertAccess(uniToken, "unisimoncucuta", "experienciavirtual");
    if (own?.ok === true) ok("Unisimón admin allowed on own tour");
    else fail("Unisimón own tour", JSON.stringify(own));
  } catch (e) {
    fail("Unisimón seed login/assert", e.message);
  }

  // Seed Orbe → sandbox ok, unisimon deny
  try {
    const orbe = await login("admin@orbe.local", "OrbeSandbox2026!");
    const okSandbox = await assertAccess(orbe.token, "orbe", "sandbox");
    if (okSandbox?.ok === true) ok("Orbe admin allowed on sandbox");
    else fail("Orbe sandbox", JSON.stringify(okSandbox));
    const denyUni = await assertAccess(
      orbe.token,
      "unisimoncucuta",
      "experienciavirtual"
    );
    if (denyUni?.ok === false) {
      ok("Orbe admin denied on Unisimón", denyUni.reason);
    } else {
      fail("Orbe must not edit Unisimón", JSON.stringify(denyUni));
    }
  } catch (e) {
    fail("Orbe seed login/assert (seed sandbox?)", e.message);
  }

  // Third user — proves membership policy for users created today
  let superToken = null;
  let thirdUserId = null;
  try {
    const superLogin = await login(
      "superadmin@orbe360.local",
      "OrbeSuper2026!"
    );
    superToken = superLogin.token;
    const orgs = await convex("query", "organizations:listOrganizations", {
      token: superToken,
      now: Date.now(),
    });
    const orbeOrg = orgs.find((o) => o.slug === "orbe");
    if (!orbeOrg) throw new Error("org orbe not found — run seed:orbe-sandbox");

    thirdUserId = await convex("mutation", "auth:createAdminUser", {
      token: superToken,
      email: THIRD_EMAIL,
      name: "QA Third Editor",
      password: THIRD_PASS,
      organizationId: orbeOrg.id,
      role: "tourEditor",
    });
    ok("Created third user with tourEditor membership", THIRD_EMAIL);

    const third = await login(THIRD_EMAIL, THIRD_PASS);
    const thirdOk = await assertAccess(third.token, "orbe", "sandbox");
    if (thirdOk?.ok === true) {
      ok("Third user (new account) allowed on orbe/sandbox");
    } else {
      fail("Third user should edit via membership only", JSON.stringify(thirdOk));
    }
    const thirdDeny = await assertAccess(
      third.token,
      "unisimoncucuta",
      "experienciavirtual"
    );
    if (thirdDeny?.ok === false) {
      ok("Third user denied on Unisimón (no membership)", thirdDeny.reason);
    } else {
      fail("Third user must not edit Unisimón", JSON.stringify(thirdDeny));
    }

    // Snapshot must also reject third user on Unisimón
    try {
      await convex("query", "tourAdmin:getAdminSnapshot", {
        token: third.token,
        slug: "experienciavirtual",
        orgSlug: "unisimoncucuta",
      });
      fail("getAdminSnapshot must reject third user on Unisimón");
    } catch {
      ok("getAdminSnapshot rejects third user on Unisimón");
    }

    // tourEditor cannot publish/archive/rename or overwrite org branding
    const orbeTours = await convex("query", "organizations:listTours", {
      token: third.token,
      organizationId: orbeOrg.id,
      now: Date.now(),
    });
    const sandboxTour = orbeTours.find((t) => t.slug === "sandbox");
    if (sandboxTour) {
      try {
        await convex("mutation", "accessibilityPublish:setTourPublished", {
          token: third.token,
          tourId: sandboxTour.id,
          published: false,
        });
        fail("tourEditor must not publish/unpublish tours");
      } catch {
        ok("tourEditor denied on accessibilityPublish:setTourPublished");
      }
      try {
        await convex("mutation", "organizations:updateTourTitle", {
          token: third.token,
          tourId: sandboxTour.id,
          title: "Hack Title",
        });
        fail("tourEditor must not rename tours");
      } catch {
        ok("tourEditor denied on organizations:updateTourTitle");
      }
      try {
        await convex("mutation", "organizations:setTourArchived", {
          token: third.token,
          tourId: sandboxTour.id,
          archived: true,
        });
        fail("tourEditor must not archive tours");
      } catch {
        ok("tourEditor denied on organizations:setTourArchived");
      }
    }

    try {
      await convex("mutation", "branding:saveBranding", {
        token: third.token,
        slug: "sandbox",
        orgSlug: "orbe",
        branding: {
          clientName: "Orbe Hack",
          primaryColor: "#4b5563",
          metaTitle: "Hack",
          metaDescription: "Hack",
          showPoweredByOrbe360: true,
        },
      });
      fail("tourEditor must not modify branding");
    } catch {
      ok("tourEditor denied on branding:saveBranding");
    }
  } catch (e) {
    fail("Third-user membership path", e.message);
  } finally {
    if (superToken && thirdUserId) {
      try {
        await convex("mutation", "cleanupQa:cleanupQaArtifacts", {
          token: superToken,
          dryRun: false,
        });
        ok("Cleaned up disposable QA third-user artifacts");
      } catch (cleanupErr) {
        console.warn("Cleanup note:", cleanupErr?.message || cleanupErr);
      }
    }
  }

  const failed = results.filter((r) => !r.pass);
  console.log(
    `\n=== ${results.length - failed.length}/${results.length} passed ===`
  );
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
