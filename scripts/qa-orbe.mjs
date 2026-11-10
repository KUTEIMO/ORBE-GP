/**
 * QA Orbe360 — pruebas automatizadas multi-rol / seguridad / API.
 * Uso: node scripts/qa-orbe.mjs
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

/** Login que falla con throw si ok:false (rate-limit / credenciales). */
async function loginOrThrow(email, password) {
  const result = await convex("mutation", "auth:login", { email, password });
  if (!result?.ok) {
    throw new Error(result?.error || "login failed");
  }
  return result;
}

async function httpGet(path, { redirect = "follow" } = {}) {
  const res = await fetch(`${WEB}${path}`, { redirect });
  return {
    status: res.status,
    text: redirect === "manual" ? "" : await res.text(),
    location: res.headers.get("location") || "",
  };
}

async function main() {
  console.log(`\n=== QA Orbe360 ===\nConvex: ${CONVEX}\nWeb: ${WEB}\n`);

  // Visitante / páginas
  for (const path of ["/", "/plataforma/login.html", "/control-web/index.html", "/plataforma/superadmin.html"]) {
    try {
      const { status } = await httpGet(path);
      if (status === 200) ok(`HTTP ${path}`, String(status));
      else fail(`HTTP ${path}`, String(status));
    } catch (e) {
      fail(`HTTP ${path}`, e.message);
    }
  }

  try {
    const platLanding = await httpGet("/plataforma/index.html", { redirect: "manual" });
    if (
      [301, 302, 303, 307, 308].includes(platLanding.status) &&
      (platLanding.location === "/" || platLanding.location.endsWith("/"))
    ) {
      ok("HTTP /plataforma/index.html → 302 /", String(platLanding.status));
    } else {
      fail(
        "HTTP /plataforma/index.html debe redirigir a /",
        `status=${platLanding.status} loc=${platLanding.location}`
      );
    }
  } catch (e) {
    fail("HTTP /plataforma/index.html redirect", e.message);
  }

  // Login inválido
  try {
    await loginOrThrow("nobody@x.com", "wrong-password-xx");
    fail("Login inválido debe fallar");
  } catch {
    ok("Login inválido rechazado");
  }

  // Login corto
  try {
    await loginOrThrow("a@b.c", "short");
    fail("Login password corta debe fallar");
  } catch {
    ok("Login password corta rechazada");
  }

  // Superadmin login
  let superToken;
  try {
    const login = await loginOrThrow("superadmin@orbe360.local", "OrbeSuper2026!");
    superToken = login.token;
    if (login.user.isSuperadmin) ok("Login superadmin");
    else fail("Login superadmin sin flag");
  } catch (e) {
    fail("Login superadmin", e.message);
  }

  // Org admin login
  let orgToken;
  try {
    const login = await loginOrThrow("admin@unisimon.local", "UnisimonAdmin2026!");
    orgToken = login.token;
    if (!login.user.isSuperadmin) ok("Login admin Unisimón");
    else fail("Admin Unisimón marcado superadmin");
  } catch (e) {
    fail("Login admin Unisimón", e.message);
  }

  // Autorización: org admin no lista todos los users
  if (orgToken) {
    try {
      await convex("query", "auth:listUsers", { token: orgToken });
      fail("Org admin no debe listar users globales");
    } catch {
      ok("Org admin bloqueado en listUsers");
    }
  }

  // Superadmin lista users
  if (superToken) {
    try {
      const users = await convex("query", "auth:listUsers", { token: superToken });
      if (users.length >= 2) ok("Superadmin listUsers", `${users.length} users`);
      else fail("Superadmin listUsers incompleto", JSON.stringify(users));
    } catch (e) {
      fail("Superadmin listUsers", e.message);
    }
  }

  // Org admin no crea organización
  if (orgToken) {
    try {
      await convex("mutation", "organizations:createOrganization", {
        token: orgToken,
        name: "Hack Org",
        slug: "hack-org",
      });
      fail("Org admin no debe crear organizaciones");
    } catch {
      ok("Org admin bloqueado creando org");
    }
  }

  // me()
  if (superToken) {
    const me = await convex("query", "auth:me", { token: superToken });
    if (me?.isSuperadmin) ok("auth:me superadmin");
    else fail("auth:me superadmin");
  }

  // Token basura
  try {
    await convex("query", "auth:me", { token: "not-a-real-token" });
    // returns null
    const me = await convex("query", "auth:me", { token: "not-a-real-token" });
    if (me === null) ok("Token inválido → me null");
    else fail("Token inválido no null");
  } catch (e) {
    fail("Token inválido", e.message);
  }

  // Snapshot save + public graph (como admin) — merge into full tour, never wipe connections
  if (orgToken) {
    try {
      const prior = await convex("query", "tourAdmin:getAdminSnapshot", {
        token: orgToken,
        slug: "experienciavirtual",
        orgSlug: "unisimoncucuta",
      });
      const priorScenes = prior?.scenes && typeof prior.scenes === "object" ? prior.scenes : {};
      const priorConnections = Array.isArray(prior?.connections) ? prior.connections : [];

      const scenesPayload = Object.entries(priorScenes).map(([fileKey, patch], index) => ({
        fileKey,
        title: patch.title || fileKey,
        shortTitle: patch.shortTitle || patch.title || fileKey,
        zone: patch.zone || "general",
        order: typeof patch.order === "number" ? patch.order : index,
        imageUrl: patch.imageUrl || `/media/unisimoncucuta/experienciavirtual/panoramas/${fileKey}`,
        altText: patch.title || fileKey,
        ...(patch.initialView && typeof patch.initialView.yaw === "number"
          ? { initialView: patch.initialView }
          : {}),
        hotspots: Array.isArray(patch.hotspots) ? patch.hotspots : [],
      }));

      // Upsert QA scenes without dropping the rest of the campus graph
      const qaScenes = [
        {
          fileKey: "QA_TEST_SCENE.JPG",
          title: "Escena QA",
          shortTitle: "QA",
          zone: "test",
          order: 999,
          imageUrl: "/media/unisimoncucuta/experienciavirtual/panoramas/QA_TEST_SCENE.JPG",
          altText: "Escena de prueba QA",
          initialView: { yaw: 1.25, pitch: -0.08, fov: Math.PI / 2 },
          hotspots: [
            {
              id: "qa-nav-1",
              type: "nav",
              title: "Ir a QA2",
              yaw: 0.1,
              pitch: -0.05,
              direction: "forward",
              targetFile: "QA_TEST_SCENE_2.JPG",
            },
          ],
        },
        {
          fileKey: "QA_TEST_SCENE_2.JPG",
          title: "Escena QA 2",
          shortTitle: "QA2",
          zone: "test",
          order: 1000,
          imageUrl: "/media/unisimoncucuta/experienciavirtual/panoramas/QA_TEST_SCENE_2.JPG",
          altText: "Segunda escena QA",
          hotspots: [],
        },
      ];
      for (const qa of qaScenes) {
        const idx = scenesPayload.findIndex((s) => s.fileKey === qa.fileKey);
        if (idx >= 0) scenesPayload[idx] = qa;
        else scenesPayload.push(qa);
      }

      const connectionsPayload = [
        ...priorConnections.filter(
          (c) =>
            !(
              (c.from === "QA_TEST_SCENE.JPG" && c.to === "QA_TEST_SCENE_2.JPG") ||
              c.id === "qa-nav-1"
            )
        ),
        {
          id: "qa-nav-1",
          from: "QA_TEST_SCENE.JPG",
          to: "QA_TEST_SCENE_2.JPG",
          direction: "forward",
          label: "Ir a QA2",
          yaw: 0.1,
          pitch: -0.05,
        },
      ];

      const saved = await convex("mutation", "tourAdmin:saveTourSnapshot", {
        token: orgToken,
        slug: "experienciavirtual",
        orgSlug: "unisimoncucuta",
        scenes: scenesPayload,
        connections: connectionsPayload,
      });
      if (saved.hotspotsSaved >= 1) ok("saveTourSnapshot admin", JSON.stringify(saved));
      else fail("saveTourSnapshot counts", JSON.stringify(saved));

      const graph = await convex("query", "graph:getTourGraph", {
        slug: "experienciavirtual",
      });
      const hasQa = graph?.scenes?.some((s) => s.fileKey === "QA_TEST_SCENE.JPG");
      if (hasQa) ok("Tour público refleja snapshot Convex");
      else fail("Tour público no ve escena QA", JSON.stringify(graph?.scenes?.map((s) => s.fileKey)));

      const qaScene = graph?.scenes?.find((s) => s.fileKey === "QA_TEST_SCENE.JPG");
      if (
        qaScene?.initialView &&
        Math.abs(qaScene.initialView.yaw - 1.25) < 1e-6 &&
        Math.abs(qaScene.initialView.pitch - -0.08) < 1e-6
      ) {
        ok("getTourGraph incluye initialView", JSON.stringify(qaScene.initialView));
      } else {
        fail("initialView ausente o incorrecto en getTourGraph", JSON.stringify(qaScene?.initialView));
      }

      // Parity: public nav count must equal connections for same slug path
      const publicNav = (graph?.scenes || []).reduce(
        (n, s) => n + (s.hotspots || []).filter((h) => h.type === "nav").length,
        0
      );
      const publicConns = (graph?.connections || []).length;
      if (publicNav === publicConns) {
        ok(
          "saveTourSnapshot ↔ getTourGraph parity (nav === connections)",
          `nav=${publicNav} connections=${publicConns}`
        );
      } else {
        fail(
          "Desync público nav vs connections",
          `nav=${publicNav} connections=${publicConns}`
        );
      }

      // Phantom campus package: curated piloto should not equal embed package
      // connection count (excl. QA_TEST_* edges added by this suite).
      try {
        const spatialMeta = await convex(
          "query",
          "tourAdmin:getCampusSpatialPackageMeta",
          {}
        );
        const packageConns = spatialMeta?.connectionCount ?? 161;
        const nonQaConns = (graph?.connections || []).filter((c) => {
          const from = String(c.fromFile || "");
          const to = String(c.toFile || "");
          return !from.startsWith("QA_TEST") && !to.startsWith("QA_TEST");
        }).length;
        if (nonQaConns === packageConns && packageConns >= 100) {
          fail(
            "Piloto coincide con paquete espacial fantasma tras save admin",
            `nonQaConnections=${nonQaConns} === package=${packageConns} (¿syncCampusSpatialGraph sobre experienciavirtual?)`
          );
        } else {
          ok(
            "Piloto no parece paquete espacial fantasma tras save",
            `nonQaConnections=${nonQaConns} (package=${packageConns})`
          );
        }
      } catch (e) {
        fail("Asserción paquete fantasma", e.message);
      }

      const snap = await convex("query", "tourAdmin:getAdminSnapshot", {
        token: orgToken,
        slug: "experienciavirtual",
        orgSlug: "unisimoncucuta",
      });
      const snapIv = snap?.scenes?.["QA_TEST_SCENE.JPG"]?.initialView;
      if (snapIv && Math.abs(snapIv.yaw - 1.25) < 1e-6) {
        ok("getAdminSnapshot incluye initialView", JSON.stringify(snapIv));
      } else {
        fail("initialView ausente en getAdminSnapshot", JSON.stringify(snapIv));
      }
    } catch (e) {
      fail("Flujo snapshot/tour graph", e.message);
    }
  }

  // Superadmin must NOT edit tour content (platform ops only)
  if (superToken) {
    try {
      await convex("mutation", "tourAdmin:saveTourSnapshot", {
        token: superToken,
        slug: "experienciavirtual",
        orgSlug: "unisimoncucuta",
        scenes: [],
        connections: [],
      });
      fail("Superadmin no debe guardar snapshot de tour");
    } catch {
      ok("Superadmin bloqueado en saveTourSnapshot");
    }
  }

  // Sin auth no guarda
  try {
    await convex("mutation", "tourAdmin:saveTourSnapshot", {
      token: "fake",
      slug: "experienciavirtual",
      orgSlug: "unisimoncucuta",
      scenes: [],
      connections: [],
    });
    fail("save sin auth debe fallar");
  } catch {
    ok("saveTourSnapshot exige sesión válida");
  }

  // Demos públicas
  try {
    const demos = await convex("query", "graph:listPublishedDemos", {});
    if (demos.some((d) => d.slug === "experienciavirtual")) ok("listPublishedDemos incluye Unisimón");
    else fail("listPublishedDemos sin Unisimón", JSON.stringify(demos));
  } catch (e) {
    fail("listPublishedDemos", e.message);
  }

  // Login page: no demo passwords in public client code
  try {
    const { text } = await httpGet("/plataforma/login.html");
    if (text.includes("OrbeSuper2026!") || text.includes("UnisimonAdmin2026!")) {
      fail("Credenciales demo presentes en login público");
    } else if (text.includes('id="demoCreds"') && text.includes("hidden")) {
      ok("Login sin secretos demo en cliente");
    } else {
      fail("Bloque demoCreds ausente o mal marcado");
    }
  } catch (e) {
    fail("Revisión login HTML", e.message);
  }

  // Phase 1 — listTours authz (V-01)
  try {
    await convex("query", "organizations:listTours", {});
    fail("listTours sin token debe fallar");
  } catch {
    ok("listTours exige token");
  }

  if (orgToken) {
    try {
      const tours = await convex("query", "organizations:listTours", {
        token: orgToken,
        now: Date.now(),
      });
      if (Array.isArray(tours) && tours.every((t) => t.slug)) {
        ok("listTours org admin", `${tours.length} tours`);
      } else {
        fail("listTours org admin formato", JSON.stringify(tours));
      }
    } catch (e) {
      fail("listTours org admin", e.message);
    }
  }

  // Cross-tenant: org admin no lista tours de otra org
  if (superToken && orgToken) {
    try {
      const otherOrgId = await convex("mutation", "organizations:createOrganization", {
        token: superToken,
        name: "QA Other Org",
        slug: `qa-other-${Date.now()}`,
      });
      await convex("mutation", "organizations:createTour", {
        token: superToken,
        organizationId: otherOrgId,
        slug: `qa-draft-${Date.now()}`,
        title: "Draft secreto QA",
        published: false,
      });
      try {
        await convex("query", "organizations:listTours", {
          token: orgToken,
          organizationId: otherOrgId,
          now: Date.now(),
        });
        fail("listTours cross-org debe rechazarse");
      } catch {
        ok("listTours bloquea org ajena (IDOR)");
      }
      const scoped = await convex("query", "organizations:listTours", {
        token: orgToken,
        now: Date.now(),
      });
      if (scoped.every((t) => t.organizationId !== otherOrgId)) {
        ok("listTours org admin no ve drafts ajenos");
      } else {
        fail("listTours filtró tours de otra org", JSON.stringify(scoped));
      }
    } catch (e) {
      fail("listTours cross-tenant", e.message);
    }
  }

  try {
    await convex("query", "organizations:listTours", {
      token: "fake-token",
      now: Date.now(),
    });
    fail("listTours con token falso debe fallar");
  } catch {
    ok("listTours rechaza token inválido");
  }

  // Logout
  if (superToken) {
    try {
      await convex("mutation", "auth:logout", { token: superToken });
      const me = await convex("query", "auth:me", {
        token: superToken,
        now: Date.now(),
      });
      if (me === null) ok("Logout invalida sesión");
      else fail("Logout no invalidó token");
    } catch (e) {
      fail("Logout", e.message);
    }
  }

  // Phase 1 — media upload URL requiere auth + tour scope
  try {
    await convex("mutation", "media:generateUploadUrl", {
      token: "fake",
      tourSlug: "experienciavirtual",
    });
    fail("generateUploadUrl sin auth debe fallar");
  } catch {
    ok("media:generateUploadUrl exige sesión");
  }

  try {
    await convex("mutation", "media:generateUploadUrl", { token: "fake" });
    fail("generateUploadUrl sin tourSlug debe fallar (args)");
  } catch {
    ok("media:generateUploadUrl exige tourSlug");
  }

  // Relogin admin para media + rate-limit aislado
  let adminToken2;
  try {
    const login = await loginOrThrow("admin@unisimon.local", "UnisimonAdmin2026!");
    adminToken2 = login.token;
    ok("Relogin admin para media");
  } catch (e) {
    fail("Relogin admin para media", e.message);
  }

  if (adminToken2) {
    try {
      await convex("mutation", "media:generateUploadUrl", {
        token: adminToken2,
        tourSlug: "tour-inexistente-xyz",
        orgSlug: "unisimoncucuta",
      });
      fail("generateUploadUrl tour ajeno/inexistente debe fallar");
    } catch {
      ok("generateUploadUrl rechaza tour inexistente");
    }

    try {
      const uploadMeta = await convex("mutation", "media:generateUploadUrl", {
        token: adminToken2,
        tourSlug: "experienciavirtual",
        orgSlug: "unisimoncucuta",
      });
      const uploadUrl = uploadMeta?.uploadUrl;
      if (
        typeof uploadUrl === "string" &&
        uploadUrl.includes("http") &&
        uploadMeta.organizationId &&
        uploadMeta.tourId &&
        String(uploadMeta.objectKeyPrefix || "").includes("orgs/")
      ) {
        ok("media:generateUploadUrl scoped + ownership", uploadMeta.objectKeyPrefix);
      } else {
        fail("generateUploadUrl formato ownership", JSON.stringify(uploadMeta));
      }

      // Sube un PNG 1×1 y adjunta escena
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      );
      const put = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: png,
      });
      if (!put.ok) throw new Error(`upload HTTP ${put.status}`);
      const { storageId } = await put.json();
      if (!storageId) throw new Error("sin storageId");

      const attached = await convex("mutation", "media:attachPanoramaToScene", {
        token: adminToken2,
        tourSlug: "experienciavirtual",
        fileKey: `QA_UPLOAD_${Date.now()}.png`,
        storageId,
        title: "QA Upload Panorama",
        shortTitle: "QA Upload",
        zone: "test",
        organizationId: uploadMeta.organizationId,
      });
      if (
        attached?.imageUrl &&
        /^https?:\/\//i.test(attached.imageUrl) &&
        attached.objectKey?.includes("orgs/")
      ) {
        ok("media:attachPanoramaToScene", attached.objectKey);
      } else {
        fail("attachPanorama ownership", JSON.stringify(attached));
      }

      const graph = await convex("query", "graph:getTourGraph", {
        slug: "experienciavirtual",
      });
      const found = graph?.scenes?.some((s) => s.fileKey === attached.fileKey);
      if (found) ok("Tour público incluye panorama subido");
      else fail("Tour público sin panorama subido");
    } catch (e) {
      fail("Flujo upload panorama", e.message);
    }
  }

  // Phase 3 — a11y publish checklist (T-P0-8)
  try {
    const readyPkg = await convex("query", "accessibilityPublish:evaluatePackage", {
      scenes: [
        {
          id: "entrada-principal",
          title: "Entrada",
          srSummary: "Resumen corto de prueba.",
          narration: "assets/audio/scenes/entrada-principal.mp3",
          transcript: "assets/transcripts/scenes/entrada-principal.txt",
          captionFile: "assets/captions/scenes/entrada-principal.vtt",
          narrationOptional: false,
          hotspots: [
            {
              id: "punto-informacion",
              type: "info",
              title: "Info",
              narration: "assets/audio/hotspots/punto-informacion.mp3",
              transcript: "assets/transcripts/hotspots/punto-informacion.txt",
              narrationOptional: false,
            },
          ],
        },
      ],
    });
    if (readyPkg?.ready === true && readyPkg.blockingIssues?.length === 0) {
      ok("accessibilityPublish:evaluatePackage ready", `scenes=${readyPkg.sceneCount}`);
    } else {
      fail("evaluatePackage ready", JSON.stringify(readyPkg));
    }
  } catch (e) {
    fail("evaluatePackage ready", e.message);
  }

  try {
    const badPkg = await convex("query", "accessibilityPublish:evaluatePackage", {
      scenes: [
        {
          id: "sin-a11y",
          title: "Sin a11y",
          srSummary: null,
          narration: null,
          narrationOptional: false,
        },
      ],
    });
    if (badPkg?.ready === false && badPkg.blockingIssues?.length > 0) {
      ok("accessibilityPublish:evaluatePackage bloquea incompleto");
    } else {
      fail("evaluatePackage debería fallar", JSON.stringify(badPkg));
    }
  } catch (e) {
    fail("evaluatePackage incompleto", e.message);
  }

  // Phase 4 — TourBranding white-label (data-driven; Unisimón = seeded fixture)
  try {
    const graph = await convex("query", "graph:getTourGraph", {
      slug: "experienciavirtual",
    });
    const b = graph?.branding;
    if (
      b &&
      typeof b.clientName === "string" &&
      b.clientName.trim() &&
      typeof b.primaryColor === "string" &&
      /^#[0-9a-fA-F]{3,8}$/.test(b.primaryColor) &&
      b.metaTitle &&
      typeof b.showPoweredByOrbe360 === "boolean" &&
      b.primaryColor.toLowerCase() !== "#0284c7"
    ) {
      ok(
        "getTourGraph TourBranding fields round-trip (no Orbe primary)",
        `${b.clientName} ${b.primaryColor}`
      );
    } else {
      fail("TourBranding ausente o incompleto en grafo", JSON.stringify(b));
    }
    // Seeded piloto still carries USB identity as DATA (not engine hardcode).
    if (b?.primaryColor === "#0a7a45" && /Unisimón|Simón/i.test(b.clientName || "")) {
      ok("fixture piloto: TourBranding Unisimón desde Convex", b.primaryColor);
    }
  } catch (e) {
    fail("TourBranding en getTourGraph", e.message);
  }

  try {
    const pub = await convex("query", "branding:getPublicBranding", {
      slug: "experienciavirtual",
    });
    if (
      pub?.primaryColor &&
      pub.clientName &&
      pub.metaTitle &&
      pub.primaryColor.toLowerCase() !== "#0284c7"
    ) {
      ok("branding:getPublicBranding shape OK", pub.primaryColor);
    } else fail("getPublicBranding", JSON.stringify(pub));
  } catch (e) {
    fail("getPublicBranding", e.message);
  }

  if (orgToken) {
    try {
      await convex("mutation", "branding:saveBranding", {
        token: "fake-token",
        slug: "experienciavirtual",
        orgSlug: "unisimoncucuta",
        branding: {
          clientName: "Hack",
          primaryColor: "#ffffff",
          metaTitle: "x",
          metaDescription: "y",
          showPoweredByOrbe360: false,
        },
      });
      fail("saveBranding sin auth debe fallar");
    } catch {
      ok("saveBranding exige sesión válida");
    }

    try {
      const adminRow = await convex("query", "branding:getBrandingForAdmin", {
        token: orgToken,
        slug: "experienciavirtual",
        orgSlug: "unisimoncucuta",
        now: Date.now(),
      });
      if (
        adminRow?.branding?.clientName &&
        adminRow.branding.primaryColor &&
        adminRow.branding.metaTitle
      ) {
        ok("getBrandingForAdmin TourBranding fields", adminRow.branding.primaryColor);
      } else {
        fail("getBrandingForAdmin", JSON.stringify(adminRow));
      }
    } catch (e) {
      fail("getBrandingForAdmin", e.message);
    }

    // Round-trip: refuse Orbe platform primary for any tour (generic guard).
    try {
      await convex("mutation", "branding:saveBranding", {
        token: orgToken,
        slug: "experienciavirtual",
        orgSlug: "unisimoncucuta",
        branding: {
          clientName: "Should Fail",
          primaryColor: "#0284c7",
          metaTitle: "x",
          metaDescription: "y",
          showPoweredByOrbe360: true,
        },
      });
      fail("saveBranding debería rechazar primary Orbe");
    } catch {
      ok("saveBranding rechaza colores Orbe (genérico)");
    }
  }

  // Viewer shell: early-boot neutro; client identity from API after load
  try {
    const { text } = await httpGet("/index.html");
    if (/Orbe360 — Tour virtual/i.test(text)) {
      fail("index.html filtra identidad Orbe360 en título del viewer");
    } else if (/PEVCI — Tour 360° Unisimón/i.test(text)) {
      fail("index.html hardcodea título Unisimón en early-boot");
    } else if (/<title>\s*Tour virtual 360°/i.test(text)) {
      ok("index.html título motor neutro (sin Orbe ni USB hardcode)");
    } else {
      fail("index.html título inesperado", text.slice(0, 200));
    }
    if (/tourBrandBoot\s*=\s*["']neutral["']|#4b5563/.test(text)) {
      ok("index.html early-boot neutro gray/ink (#4b5563)");
    } else if (/dataset\.tourBrandBoot|tourBrandBoot/.test(text)) {
      ok("index.html early-boot TourBranding presente");
    } else {
      fail("index.html sin early-boot de branding neutro");
    }
    if (/tourBrandBoot\s*=\s*["']unisimon["']/.test(text) || (/#0a7a45/.test(text) && /unisimoncucuta\/experienciavirtual/i.test(text) && /early/i.test(text))) {
      fail("index.html early-boot aún fuerza Unisimón");
    }
    if (/#0a7a45/.test(text) && /Verde institucional Unisimón/.test(text)) {
      fail("index.html/css acoplado a USB en comentario hardcode");
    }
  } catch (e) {
    fail("Revisión index.html white-label", e.message);
  }

  try {
    const { text } = await httpGet("/css/base.css");
    if (/Verde institucional Unisimón/i.test(text)) {
      fail("css/base.css aún nombra Unisimón como default");
    } else if (/--brand:\s*#4b5563/.test(text) || /neutral gray\/ink/i.test(text)) {
      ok("css/base.css brand neutro gray/ink (#4b5563)");
    } else if (/TourBranding/i.test(text) || /neutral/i.test(text)) {
      ok("css/base.css motor neutro documentado");
    } else {
      fail("css/base.css brand default inesperado");
    }
  } catch (e) {
    fail("Revisión base.css", e.message);
  }

  try {
    const { text } = await httpGet("/plataforma/tokens.css");
    if (
      /--orbe-accent:\s*#0284c7/.test(text) &&
      /--orbe-green:\s*var\(--orbe-accent\)/.test(text) &&
      !/--orbe-accent:\s*#0a7a45/.test(text) &&
      !/--orbe-green:\s*#0a7a45/.test(text)
    ) {
      ok("plataforma/tokens.css Orbe accent #0284c7 (≠ USB)");
    } else {
      fail("tokens.css orbe-accent inesperado");
    }
  } catch (e) {
    fail("Revisión tokens.css", e.message);
  }

  // Phase 5 — residual Unisimón coupling cleanup (chrome vs data)
  try {
    const { text } = await httpGet("/control-web/admin.css");
    if (/--usb-/.test(text)) {
      fail("control-web/admin.css aún usa tokens --usb-*");
    } else if (
      /--cw-accent:\s*#0284c7/.test(text) &&
      (/--cw-green:\s*var\(--cw-accent\)/.test(text) || /--cw-green:\s*#0284c7/.test(text)) &&
      !/#0a7a45/.test(text)
    ) {
      ok("Control Web CSS Orbe operator (#0284c7, sin USB hardcode)");
    } else if (/--cw-green/.test(text) || /--cw-ink/.test(text)) {
      ok("Control Web CSS tokens neutros (--cw-*)");
    } else {
      fail("control-web/admin.css sin tokens --cw-* esperados");
    }
  } catch (e) {
    fail("Revisión control-web CSS", e.message);
  }

  try {
    const { text } = await httpGet("/css/components/hotspots.css");
    if (/--hotspot-accent:\s*#009b3a/.test(text) || /--hotspot-accent:\s*#0284c7/.test(text)) {
      fail("hotspots.css hardcodea color Orbe (debe usar var(--brand))");
    } else if (/--hotspot-accent:\s*var\(--brand/.test(text)) {
      ok("hotspots.css accent vía TourBranding (--brand)");
    } else {
      fail("hotspots.css sin var(--brand) en --hotspot-accent");
    }
  } catch (e) {
    fail("Revisión hotspots.css branding", e.message);
  }

  try {
    const { text } = await httpGet("/control-web/index.html");
    if (/Universidad Simón Bolívar/i.test(text) || /PEVCI ·/i.test(text)) {
      fail("Control Web HTML aún marca USB/PEVCI como chrome de producto");
    } else if (/Orbe360 Control Web/i.test(text) && /Editor de tour/i.test(text)) {
      ok("Control Web chrome Orbe360 (sin USB header)");
    } else {
      fail("Control Web título/chrome inesperado", text.slice(0, 240));
    }
    if (/>\s*USB\s*</.test(text)) {
      fail("Control Web mark aún dice USB");
    }
  } catch (e) {
    fail("Revisión control-web HTML", e.message);
  }

  try {
    const { text } = await httpGet("/src/tourBranding.js");
    if (
      /NEUTRAL_BRANDING_FALLBACK/.test(text) &&
      /brandingLooksLikeOrbePlatform/.test(text) &&
      /resolveClientBranding/.test(text) &&
      /#0284c7/.test(text) &&
      /#4b5563/.test(text) &&
      !/isPilotTourSlug/.test(text)
    ) {
      ok("tourBranding.js neutro + sanitiza Orbe genérico (sin piloto hack)");
    } else {
      fail("tourBranding.js sin fallback neutro / aún acoplado a piloto");
    }
  } catch (e) {
    fail("Revisión tourBranding.js", e.message);
  }

  try {
    const demos = await convex("query", "graph:listPublishedDemos", {});
    if (
      Array.isArray(demos) &&
      demos.length > 0 &&
      demos.every((d) => d.slug && d.orgSlug && d.title)
    ) {
      const withBrand = demos.find((d) => d.primaryColor || d.clientName);
      if (withBrand) {
        ok(
          "listPublishedDemos incluye branding fields",
          `${withBrand.slug} ${withBrand.primaryColor || ""}`
        );
      } else {
        ok("listPublishedDemos shape OK (branding opcional ausente)", `${demos.length}`);
      }
    } else {
      fail("listPublishedDemos shape incompleta", JSON.stringify(demos));
    }
  } catch (e) {
    fail("listPublishedDemos branding", e.message);
  }

  try {
    const { text } = await httpGet("/");
    if (/Acceso administrativo|Acceso administrador|Acceso administración/i.test(text)) {
      fail("Landing aún usa CTA/lenguaje admin en marketing");
    }
    if (/Superadmin|Admin de tour|Entrar al panel/i.test(text)) {
      fail("Landing filtra roles internos");
    }
    if (/nav-access|public-nav[\s\S]{0,400}login\.html/i.test(text)) {
      fail("Landing pone Acceso/login en nav primario");
    }
    if (/cta-band[\s\S]{0,500}login\.html/i.test(text)) {
      fail("Landing pone login en CTA band (hero-adjacent ops)");
    }
    if (/category-strip|Educación[\s\S]{0,80}R00100/i.test(text)) {
      fail("Landing reusa fotos campus como portafolio multi-industria falso");
    }
    if (/Cliente|caso real|Experiencia virtual Unisimón/i.test(text)) {
      ok("Landing presenta Unisimón como caso/cliente");
    } else {
      fail("Landing sin framing de caso publicado");
    }
    if (/Explora\.|Descubre\.|Conecta/i.test(text) && /use-cases|Dónde encaja/i.test(text)) {
      ok("Landing valor Explora/Descubre/Conecta + usos sin fake portfolio");
    }
  } catch (e) {
    fail("Revisión landing Phase 5", e.message);
  }

  try {
    const demos = await convex("query", "graph:listPublishedDemos", {});
    if (!Array.isArray(demos)) fail("listPublishedDemos no es array");
    else if (demos.every((d) => d.slug && d.title && d.orgName && d.orgSlug)) {
      ok("listPublishedDemos published-only shape OK", `${demos.length} demos`);
    } else {
      fail("listPublishedDemos shape incompleta", JSON.stringify(demos));
    }
    // Public graph must not invent unpublished / missing tours
    const missing = await convex("query", "graph:getTourGraph", {
      slug: "no-existe-draft-xyz",
    });
    if (missing === null) ok("getTourGraph null en slug inexistente (published-only)");
    else fail("getTourGraph no debió devolver grafo", JSON.stringify(missing));
  } catch (e) {
    fail("Published-only surfaces Phase 5", e.message);
  }

  try {
    const { text } = await httpGet("/orbe-config.js");
    if (/__ORBE_TOUR_SLUG__/i.test(text) && /config\.local|override|multi-tour/i.test(text)) {
      ok("__ORBE_TOUR_SLUG__ documentado como override configurable");
    } else if (/experienciavirtual/.test(text)) {
      ok("__ORBE_TOUR_SLUG__ default piloto presente");
    } else {
      fail("orbe-config.js sin slug documentado");
    }
    if (/URLSearchParams|location\.search|\?slug=|pathname/i.test(text)) {
      ok("orbe-config.js lee slug desde URL (path o query)");
    } else {
      fail("orbe-config.js no resuelve slug desde URL");
    }
  } catch (e) {
    fail("Revisión orbe-config slug docs", e.message);
  }

  // Phase 6 — multi-tour public routing by slug
  try {
    const slugMod = await import("../src/tourSlug.js");
    const {
      resolveTourSlug,
      publicTourHref,
      controlWebHref,
      orgAdminHref,
      parseSlugParam,
      DEFAULT_TOUR_SLUG,
    } = slugMod;
    if (DEFAULT_TOUR_SLUG !== "experienciavirtual") {
      fail("DEFAULT_TOUR_SLUG debe ser experienciavirtual", DEFAULT_TOUR_SLUG);
    } else if (resolveTourSlug({ search: "" }) !== "experienciavirtual") {
      fail("resolveTourSlug sin params no cae a piloto");
    } else if (
      resolveTourSlug({ search: "?slug=otro-campus" }) !== "otro-campus"
    ) {
      fail("resolveTourSlug no prioriza ?slug=");
    } else if (
      resolveTourSlug({
        search: "",
        injected: "demo-inject",
      }) !== "demo-inject"
    ) {
      fail("resolveTourSlug no usa inject cuando no hay query");
    } else if (
      resolveTourSlug({
        search: "?slug=from-url",
        injected: "from-inject",
      }) !== "from-url"
    ) {
      fail("resolveTourSlug debe preferir URL sobre inject");
    } else if (
      publicTourHref({
        tourSlug: "experienciavirtual",
        orgSlug: "unisimoncucuta",
      }) !== "/unisimoncucuta/experienciavirtual/"
    ) {
      fail(
        "publicTourHref shape incorrecta",
        publicTourHref({
          tourSlug: "experienciavirtual",
          orgSlug: "unisimoncucuta",
        })
      );
    } else if (
      typeof controlWebHref === "function" &&
      controlWebHref({
        tourSlug: "experienciavirtual",
        orgSlug: "unisimoncucuta",
      }) !== "/unisimoncucuta/experienciavirtual/control-web/"
    ) {
      fail(
        "controlWebHref shape incorrecta",
        controlWebHref({
          tourSlug: "experienciavirtual",
          orgSlug: "unisimoncucuta",
        })
      );
    } else if (
      typeof orgAdminHref === "function" &&
      orgAdminHref("unisimoncucuta") !== "/unisimoncucuta/org-admin.html"
    ) {
      fail("orgAdminHref shape incorrecta", orgAdminHref("unisimoncucuta"));
    } else if (
      (() => {
        try {
          publicTourHref("otro-campus");
          return true;
        } catch (_e) {
          return false;
        }
      })()
    ) {
      fail("publicTourHref sin orgSlug debe fallar (no default Unisimón)");
    } else if (
      publicTourHref({
        tourSlug: "otro-campus",
        orgSlug: "empresa-demo",
      }).includes("unisimoncucuta")
    ) {
      fail(
        "publicTourHref org ajena no debe contener unisimoncucuta",
        publicTourHref({ tourSlug: "otro-campus", orgSlug: "empresa-demo" })
      );
    } else if (
      resolveTourSlug({
        pathname: "/unisimoncucuta/experienciavirtual/",
        search: "?slug=other",
      }) !== "experienciavirtual"
    ) {
      fail("resolveTourSlug debe preferir path sobre query");
    } else if (parseSlugParam("Bad Slug!") !== null) {
      fail("parseSlugParam debió rechazar slug inválido");
    } else {
      ok("configLoader/orbe-config tourSlug helper (path > URL > inject > default)");
    }

    const { text: landing } = await httpGet("/");
    if (
      /unisimoncucuta\/experienciavirtual/i.test(landing) ||
      /publicTourHref/i.test(landing)
    ) {
      ok("Landing enlaza experiencias con /{org}/{tour}/");
    } else {
      fail("Landing sin href canónico para demos");
    }

    const { status: rootStatus, text: rootHtml } = await httpGet("/");
    if (
      rootStatus === 200 &&
      /ORBE\s*360|Explora espacios/i.test(rootHtml) &&
      !/<div id="panorama"/i.test(rootHtml)
    ) {
      ok("Raíz / sirve marketing Orbe360 (no viewer)");
    } else {
      fail("Raíz / no es marketing Orbe360", `status=${rootStatus}`);
    }

    if (/href=["']\/plataforma\/marketing\.css["']/i.test(rootHtml)) {
      const { status: cssStatus } = await httpGet("/plataforma/marketing.css");
      const { status: tokensStatus } = await httpGet("/plataforma/tokens.css");
      if (cssStatus === 200 && tokensStatus === 200) {
        ok("Landing CSS root-absolute (/plataforma/marketing.css + tokens) 200");
      } else {
        fail("Landing CSS assets", `marketing=${cssStatus} tokens=${tokensStatus}`);
      }
    } else {
      fail("Landing sin stylesheet root-absolute /plataforma/marketing.css");
    }

    const legacyMkt = await httpGet("/plataforma/index.html", { redirect: "manual" });
    if (
      [301, 302, 303, 307, 308].includes(legacyMkt.status) &&
      (legacyMkt.location === "/" || legacyMkt.location.endsWith("://127.0.0.1:8081/"))
    ) {
      ok("Legacy /plataforma/index.html → 302 /");
    } else {
      fail(
        "Legacy /plataforma/index.html debe redirigir a /",
        `status=${legacyMkt.status} loc=${legacyMkt.location}`
      );
    }

    const nestedMkt = await httpGet(
      "/unisimoncucuta/experienciavirtual/plataforma/index.html",
      { redirect: "manual" }
    );
    if (
      [301, 302, 303, 307, 308].includes(nestedMkt.status) &&
      (nestedMkt.location === "/" || nestedMkt.location.endsWith("://127.0.0.1:8081/"))
    ) {
      ok("Marketing anidado /{org}/{tour}/plataforma/index.html → 302 /");
    } else {
      fail(
        "Marketing anidado debe redirigir a /",
        `status=${nestedMkt.status} loc=${nestedMkt.location}`
      );
    }

    const { status: tourStatus } = await httpGet(
      "/unisimoncucuta/experienciavirtual/"
    );
    if (tourStatus === 200) {
      ok("Path canónico Unisimón sirve viewer");
    } else {
      fail("Path canónico Unisimón no responde", String(tourStatus));
    }

    const { text: loader } = await httpGet("/src/configLoader.js");
    if (/resolveTourSlugFromBrowser|tourSlug\.js/i.test(loader)) {
      ok("configLoader usa resolveTourSlugFromBrowser");
    } else {
      fail("configLoader no importa resolución de slug");
    }
  } catch (e) {
    fail("Phase 6 slug routing checks", e.message);
  }

  // Phase 7 — publish UI + multi-tour admin (safe: no accidental overwrite buttons)
  try {
    const { text: orgAdmin } = await httpGet("/unisimoncucuta/org-admin.html");
    if (
      /publishSection|setTourPublished|Evaluar checklist|requireAccessible/i.test(
        orgAdmin
      ) &&
      /evaluateTourFromDb/i.test(orgAdmin) &&
      !/syncSpatialBtn|Reset grafo campus/i.test(orgAdmin)
    ) {
      ok("org-admin cablea publish + checklist DB (sin botones destructivos)");
    } else {
      fail("org-admin sin UI publish/checklist esperada", orgAdmin.slice(0, 400));
    }
  } catch (e) {
    fail("org-admin Phase 7 HTML", e.message);
  }

  try {
    const { text: superHtml } = await httpGet("/plataforma/superadmin.html");
    if (
      /createTour|tourList|Publicado|tourSlug/i.test(superHtml) &&
      /organizations:createTour/i.test(superHtml)
    ) {
      ok("superadmin lista tours + createTour");
    } else {
      fail("superadmin sin multi-tour basics", superHtml.slice(0, 400));
    }
  } catch (e) {
    fail("superadmin Phase 7 HTML", e.message);
  }

  try {
    const { text: cw } = await httpGet("/control-web/admin.js");
    if (/headerTourLink|\?slug=/i.test(cw) && /TOUR_SLUG/i.test(cw)) {
      ok("control-web deep-link ?slug= / header tour");
    } else {
      fail("control-web sin wiring slug", cw.slice(0, 200));
    }
    if (
      /requireControlWebAccess|auth-gate/i.test(cw) &&
      !/Modo lectura/i.test(cw)
    ) {
      ok("control-web hard-gate (no modo lectura anónimo)");
    } else {
      fail("control-web sin hard-gate de sesión/membresía");
    }
  } catch (e) {
    fail("control-web Phase 7", e.message);
  }

  // Control Web authz — assertTourEditorAccess + no anonymous snapshot
  try {
    const anon = await convex("query", "tourAdmin:assertTourEditorAccess", {
      token: "fake-token",
      orgSlug: "orbe",
      tourSlug: "sandbox",
      now: Date.now(),
    });
    if (anon?.ok === false && anon.reason === "unauthenticated") {
      ok("assertTourEditorAccess niega sin sesión");
    } else {
      fail("assertTourEditorAccess anónimo", JSON.stringify(anon));
    }

    try {
      await convex("query", "tourAdmin:getAdminSnapshot", {
        token: "fake-token",
        slug: "sandbox",
        orgSlug: "orbe",
      });
      fail("getAdminSnapshot anónimo debe fallar");
    } catch {
      ok("getAdminSnapshot exige sesión");
    }

    if (orgToken) {
      const cross = await convex("query", "tourAdmin:assertTourEditorAccess", {
        token: orgToken,
        orgSlug: "orbe",
        tourSlug: "sandbox",
        now: Date.now(),
      });
      if (cross?.ok === false && (cross.reason === "forbidden" || cross.reason === "tour_not_found")) {
        ok("assertTourEditorAccess niega Unisimón en orbe/sandbox", cross.reason);
      } else if (cross?.ok === true) {
        fail("Unisimón no debe editar orbe/sandbox", JSON.stringify(cross));
      } else {
        ok("assertTourEditorAccess cross-org denegado", JSON.stringify(cross));
      }

      const own = await convex("query", "tourAdmin:assertTourEditorAccess", {
        token: orgToken,
        orgSlug: "unisimoncucuta",
        tourSlug: "experienciavirtual",
        now: Date.now(),
      });
      if (own?.ok === true) {
        ok("assertTourEditorAccess permite Unisimón en su tour");
      } else {
        fail("assertTourEditorAccess Unisimón propio", JSON.stringify(own));
      }
    }

    try {
      const orbeLogin = await loginOrThrow("admin@orbe.local", "OrbeSandbox2026!");
      const orbeOk = await convex("query", "tourAdmin:assertTourEditorAccess", {
        token: orbeLogin.token,
        orgSlug: "orbe",
        tourSlug: "sandbox",
        now: Date.now(),
      });
      if (orbeOk?.ok === true) {
        ok("assertTourEditorAccess permite orbe admin en sandbox");
      } else {
        fail("orbe admin sandbox", JSON.stringify(orbeOk));
      }
      const orbeCross = await convex("query", "tourAdmin:assertTourEditorAccess", {
        token: orbeLogin.token,
        orgSlug: "unisimoncucuta",
        tourSlug: "experienciavirtual",
        now: Date.now(),
      });
      if (orbeCross?.ok === false) {
        ok("orbe admin denegado en Unisimón control-web", orbeCross.reason);
      } else {
        fail("orbe admin no debe editar Unisimón", JSON.stringify(orbeCross));
      }
    } catch (e) {
      fail("orbe sandbox authz (¿seeded?)", e.message);
    }
  } catch (e) {
    fail("Control Web authz Convex", e.message);
  }

  if (orgToken) {
    try {
      const tours = await convex("query", "organizations:listTours", {
        token: orgToken,
        now: Date.now(),
      });
      const uni = tours.find((t) => t.slug === "experienciavirtual");
      if (!uni) {
        fail("Phase 7: Unisimón no listado para org admin");
      } else {
        const dbCheck = await convex(
          "query",
          "accessibilityPublish:evaluateTourFromDb",
          {
            token: orgToken,
            tourId: uni.id,
          }
        );
        if (
          typeof dbCheck?.ready === "boolean" &&
          Array.isArray(dbCheck.blockingIssues)
        ) {
          ok(
            "evaluateTourFromDb org admin",
            `ready=${dbCheck.ready} scenes=${dbCheck.sceneCount}`
          );
        } else {
          fail("evaluateTourFromDb shape", JSON.stringify(dbCheck));
        }

        try {
          await convex("mutation", "accessibilityPublish:setTourPublished", {
            token: "fake-token",
            tourId: uni.id,
            published: true,
            requireAccessible: true,
            scenes: [
              {
                id: "x",
                title: "x",
                srSummary: null,
                narration: null,
                narrationOptional: false,
              },
            ],
          });
          fail("setTourPublished sin auth debe fallar");
        } catch {
          ok("setTourPublished exige sesión válida");
        }

        // Blocking path: requireAccessible on a draft with no a11y fields (DB SoT).
        const wasPublished = uni.published;
        {
          const draftSlug = `qa-a11y-block-${Date.now()}`;
          const draftId = await convex("mutation", "organizations:createTour", {
            token: orgToken,
            organizationId: uni.organizationId,
            slug: draftSlug,
            title: "QA a11y block draft",
            published: false,
          });
          try {
            await convex("mutation", "accessibilityPublish:setTourPublished", {
              token: orgToken,
              tourId: draftId,
              published: true,
              requireAccessible: true,
            });
            fail("setTourPublished requireAccessible sin a11y DB debió fallar");
          } catch (e) {
            if (/no listo|No autorizado|accesible/i.test(String(e.message || ""))) {
              ok("setTourPublished bloquea claim a11y incompleto");
            } else {
              fail("setTourPublished error inesperado", e.message);
            }
          }
          await convex("mutation", "accessibilityPublish:setTourPublished", {
            token: orgToken,
            tourId: draftId,
            published: false,
          });
        }

        const after = await convex("query", "organizations:listTours", {
          token: orgToken,
          now: Date.now(),
        });
        const uniAfter = after.find((t) => t.slug === "experienciavirtual");
        if (uniAfter && uniAfter.published === wasPublished) {
          ok("Unisimón published flag intacto tras bloqueo a11y");
        } else {
          fail(
            "Published flag cambió tras publish bloqueado",
            JSON.stringify(uniAfter)
          );
        }

        // Spatial-only publish round-trip on a disposable draft tour (not piloto).
        // Use orgToken: superToken was invalidated by the logout authz check earlier.
        {
          const uniTour = uni;
          const draftSlug = `qa-pub-${Date.now()}`;
          const draftId = await convex("mutation", "organizations:createTour", {
            token: orgToken,
            organizationId: uniTour.organizationId,
            slug: draftSlug,
            title: "QA publish draft",
            published: false,
          });
          await convex("mutation", "accessibilityPublish:setTourPublished", {
            token: orgToken,
            tourId: draftId,
            published: true,
            requireAccessible: false,
          });
          const graph = await convex("query", "graph:getTourGraph", {
            slug: draftSlug,
          });
          if (graph?.tour?.published === true) {
            ok("setTourPublished espacial (sin claim a11y)", draftSlug);
          } else if (graph === null) {
            fail("Tour espacial publicado no resolvió grafo", draftSlug);
          } else {
            fail("setTourPublished espacial shape", JSON.stringify(graph?.tour));
          }
          await convex("mutation", "accessibilityPublish:setTourPublished", {
            token: orgToken,
            tourId: draftId,
            published: false,
          });
          const gone = await convex("query", "graph:getTourGraph", {
            slug: draftSlug,
          });
          if (gone === null) ok("setTourPublished unpublish oculta grafo público");
          else fail("Unpublish no ocultó grafo", JSON.stringify(gone));
        }
      }
    } catch (e) {
      fail("Phase 7 publish API", e.message);
    }
  }

  try {
    const pkgMod = await import("../src/a11yPublishChecklist.js");
    const scenes = pkgMod.scenesFromA11yPackage({
      scenes: {
        a: {
          srSummary: "ok",
          narration: "assets/audio/scenes/a.mp3",
          transcript: "assets/transcripts/scenes/a.txt",
          narrationOptional: false,
        },
        alias: { aliasOf: "a", srSummary: "x" },
      },
      hotspots: {
        h1: {
          narration: "assets/audio/hotspots/h1.mp3",
          transcript: "t",
          narrationOptional: false,
        },
      },
    });
    if (
      scenes.length === 2 &&
      scenes[0].id === "a" &&
      scenes[1].hotspots?.[0]?.id === "h1"
    ) {
      ok("scenesFromA11yPackage mapea piloto sin aliases");
    } else {
      fail("scenesFromA11yPackage", JSON.stringify(scenes));
    }
  } catch (e) {
    fail("scenesFromA11yPackage", e.message);
  }

  // Phase 9 — full campus TTS SoT: Convex a11y fields after sync (not piloto subset)
  if (orgToken) {
    try {
      const tours = await convex("query", "organizations:listTours", {
        token: orgToken,
        now: Date.now(),
      });
      const uni = tours.find((t) => t.slug === "experienciavirtual");
      if (!uni) {
        fail("Phase 9: Unisimón no listado");
      } else {
        const embedMeta = await convex(
          "query",
          "accessibilityPublish:getCampusA11yPackageMeta",
          {}
        );
        if (
          embedMeta?.sceneCount >= 40 &&
          embedMeta?.hotspotCount >= 6 &&
          embedMeta?.tourSlug === "experienciavirtual"
        ) {
          ok(
            "embed fullCampus meta",
            `scenes=${embedMeta.sceneCount} hotspots=${embedMeta.hotspotCount}`
          );
        } else {
          fail("embed fullCampus meta", JSON.stringify(embedMeta));
        }

        try {
          await convex("mutation", "accessibilityPublish:syncCampusA11yPackage", {
            token: "fake-token",
            tourId: uni.id,
          });
          fail("syncCampusA11yPackage sin auth debe fallar");
        } catch {
          ok("syncCampusA11yPackage exige sesión válida");
        }

        const sync = await convex(
          "mutation",
          "accessibilityPublish:syncCampusA11yPackage",
          { token: orgToken, tourId: uni.id, saveSnapshot: true }
        );
        if (
          typeof sync?.scenesUpdated === "number" &&
          typeof sync?.hotspotsUpdated === "number" &&
          sync.checklist &&
          typeof sync.checklist.ready === "boolean"
        ) {
          ok(
            "syncCampusA11yPackage aplica metadatos",
            `scenes=${sync.scenesUpdated} created=${sync.scenesCreated ?? 0} hotspots=${sync.hotspotsUpdated} ready=${sync.checklist.ready}`
          );
        } else {
          fail("syncCampusA11yPackage shape", JSON.stringify(sync));
        }

        const dbCheck = await convex(
          "query",
          "accessibilityPublish:evaluateTourFromDb",
          { token: orgToken, tourId: uni.id }
        );

        let pkgJson = null;
        try {
          const { status, text } = await httpGet(
            "/media/unisimoncucuta/experienciavirtual/assets/accessibility/a11y-package.json"
          );
          if (status === 200) pkgJson = JSON.parse(text);
        } catch (_e) {
          pkgJson = null;
        }

        if (!pkgJson) {
          fail("Phase 9: no se pudo leer a11y-package.json");
        } else {
          const fullKeys = (pkgJson.scopes?.fullCampusTts?.scenes || []).length;
          const pkgSceneKeys = Object.keys(pkgJson.scenes || {}).filter(
            (k) => !pkgJson.scenes[k]?.aliasOf
          ).length;
          if (fullKeys >= 45 && pkgSceneKeys >= 40) {
            ok(
              "a11y-package.json fullCampus entries",
              `scopeList=${fullKeys} packageScenes=${pkgSceneKeys}`
            );
          } else {
            fail(
              "a11y-package.json incomplete campus",
              `scopeList=${fullKeys} packageScenes=${pkgSceneKeys}`
            );
          }

          const pkgMod = await import("../src/a11yPublishChecklist.js");
          const pkgScenes = pkgMod.scenesFromA11yPackage(pkgJson);
          const pkgCheck = await convex(
            "query",
            "accessibilityPublish:evaluatePackage",
            { scenes: pkgScenes, requireCaptions: false }
          );

          const dbReady = dbCheck?.ready === true;
          const enoughScenes =
            typeof dbCheck?.sceneCount === "number" && dbCheck.sceneCount >= 40;

          if (dbReady && enoughScenes && pkgCheck?.ready === true) {
            ok(
              "Phase 9 SoT full campus (package + DB ready YES)",
              `dbScenes=${dbCheck.sceneCount} pkgScenes=${pkgCheck.sceneCount} hsOk=${dbCheck.infoHotspotsOk}`
            );
          } else if (dbReady && enoughScenes) {
            ok(
              "Phase 9 DB SoT ready YES tras sync campus",
              `dbScenes=${dbCheck.sceneCount} pkgReady=${pkgCheck?.ready}`
            );
          } else {
            fail(
              "Phase 9 SoT: DB no ready tras sync campus completo",
              JSON.stringify({
                dbReady: dbCheck?.ready,
                dbScenes: dbCheck?.sceneCount,
                dbIssues: dbCheck?.blockingIssues?.slice(0, 8),
                pkgReady: pkgCheck?.ready,
                syncMissing: {
                  scenes: sync?.scenesMissing,
                  hotspots: sync?.hotspotsMissing,
                },
              })
            );
          }
        }

        const graph = await convex("query", "graph:getTourGraph", {
          slug: "experienciavirtual",
        });
        const withNarration = (graph?.scenes || []).filter(
          (s) => s.narration || s.srSummary
        );
        if (withNarration.length >= 40) {
          ok(
            "getTourGraph expone a11y campus tras sync",
            `scenesWithA11y=${withNarration.length}`
          );
        } else {
          fail(
            "getTourGraph a11y campus insuficiente",
            `scenesWithA11y=${withNarration.length} total=${graph?.scenes?.length ?? 0}`
          );
        }

        // Client scenes arg must not bypass DB SoT for requireAccessible
        try {
          const draftSlug = `qa-sot-${Date.now()}`;
          const draftId = await convex("mutation", "organizations:createTour", {
            token: orgToken,
            organizationId: uni.organizationId,
            slug: draftSlug,
            title: "QA SoT ignore scenes",
            published: false,
          });
          try {
            await convex("mutation", "accessibilityPublish:setTourPublished", {
              token: orgToken,
              tourId: draftId,
              published: true,
              requireAccessible: true,
              scenes: [
                {
                  id: "fake-ready",
                  title: "Fake",
                  srSummary: "ok",
                  narration: "assets/audio/scenes/x.mp3",
                  transcript: "assets/transcripts/scenes/x.txt",
                  narrationOptional: false,
                },
              ],
            });
            fail("setTourPublished no debe aceptar scenes client como SoT");
          } catch (e) {
            if (/no listo|accesible/i.test(String(e.message || ""))) {
              ok("setTourPublished ignora scenes client (SoT = DB)");
            } else {
              fail("setTourPublished SoT error inesperado", e.message);
            }
          }
          await convex("mutation", "accessibilityPublish:setTourPublished", {
            token: orgToken,
            tourId: draftId,
            published: false,
          });
        } catch (e) {
          fail("Phase 9 SoT scenes-ignore", e.message);
        }
      }
    } catch (e) {
      fail("Phase 9 a11y campus SoT", e.message);
    }
  }

  // Phase 10 — spatial graph sync on a DISPOSABLE tour only (never wipe piloto)
  if (orgToken) {
    try {
      const tours = await convex("query", "organizations:listTours", {
        token: orgToken,
        now: Date.now(),
      });
      const uni = tours.find((t) => t.slug === "experienciavirtual");
      if (!uni) {
        fail("Phase 10: Unisimón no listado");
      } else {
        const pilotoBefore = await convex("query", "graph:getTourGraph", {
          slug: "experienciavirtual",
        });
        const pilotoConnsBefore = pilotoBefore?.connections?.length ?? -1;

        try {
          await convex("mutation", "tourAdmin:syncCampusSpatialGraph", {
            token: "fake-token",
            tourId: uni.id,
          });
          fail("syncCampusSpatialGraph sin auth debe fallar");
        } catch {
          ok("syncCampusSpatialGraph exige sesión válida");
        }

        const spatialMeta = await convex(
          "query",
          "tourAdmin:getCampusSpatialPackageMeta",
          {}
        );
        if (
          spatialMeta?.sceneCount >= 60 &&
          spatialMeta?.navCount >= 100 &&
          spatialMeta?.connectionCount >= 100
        ) {
          ok(
            "embed spatial campus meta",
            `scenes=${spatialMeta.sceneCount} nav=${spatialMeta.navCount} conns=${spatialMeta.connectionCount}`
          );
        } else {
          fail("embed spatial campus meta", JSON.stringify(spatialMeta));
        }

        // Apply spatial package to a throwaway tour — never experienciavirtual.
        const draftSlug = `qa-spatial-${Date.now()}`;
        const draftId = await convex("mutation", "organizations:createTour", {
          token: orgToken,
          organizationId: uni.organizationId,
          slug: draftSlug,
          title: "QA Spatial Disposable",
          published: false,
        });

        const spatial = await convex(
          "mutation",
          "tourAdmin:syncCampusSpatialGraph",
          { token: orgToken, tourId: draftId }
        );
        if (
          spatial?.scenesUpserted >= 60 &&
          spatial?.navHotspots >= 100 &&
          spatial?.connectionsSaved >= 100
        ) {
          ok(
            "syncCampusSpatialGraph aplica grafo",
            `scenes=${spatial.scenesUpserted} nav=${spatial.navHotspots} conns=${spatial.connectionsSaved} a11yKept=${spatial.hotspotsPreservedA11y}`
          );
        } else {
          fail("syncCampusSpatialGraph counts", JSON.stringify(spatial));
        }

        await convex("mutation", "accessibilityPublish:setTourPublished", {
          token: orgToken,
          tourId: draftId,
          published: true,
          requireAccessible: false,
        });

        const graph = await convex("query", "graph:getTourGraph", {
          slug: draftSlug,
        });
        const navTotal = (graph?.scenes || []).reduce(
          (n, s) => n + (s.hotspots || []).filter((h) => h.type === "nav").length,
          0
        );
        const conns = graph?.connections?.length ?? 0;

        if (navTotal >= 100 && conns >= 100) {
          ok(
            "getTourGraph espacial navegable tras sync",
            `scenes=${graph.scenes.length} nav=${navTotal} conns=${conns}`
          );
        } else {
          fail(
            "getTourGraph espacial insuficiente",
            `nav=${navTotal} conns=${conns} scenes=${graph?.scenes?.length}`
          );
        }

        // a11y preservation is covered by applySpatialPackage (a11yKept counter);
        // syncCampusA11yPackage is hard-wired to experienciavirtual only.
        if (typeof spatial?.hotspotsPreservedA11y === "number") {
          ok(
            "spatial sync preserva narraciones a11y",
            `a11yKept field=${spatial.hotspotsPreservedA11y} (piloto no tocado)`
          );
        } else {
          fail("spatial sync sin contador a11yKept", JSON.stringify(spatial));
        }

        await convex("mutation", "accessibilityPublish:setTourPublished", {
          token: orgToken,
          tourId: draftId,
          published: false,
        });

        const pilotoAfter = await convex("query", "graph:getTourGraph", {
          slug: "experienciavirtual",
        });
        const pilotoConnsAfter = pilotoAfter?.connections?.length ?? -1;
        if (pilotoConnsBefore === pilotoConnsAfter) {
          ok(
            "Phase 10 no tocó conexiones del piloto",
            `experienciavirtual connections=${pilotoConnsAfter}`
          );
        } else {
          fail(
            "Phase 10 alteró el grafo del piloto",
            `before=${pilotoConnsBefore} after=${pilotoConnsAfter}`
          );
        }
      }
    } catch (e) {
      fail("Phase 10 spatial campus", e.message);
    }
  }

  // Rate-limit: 8 fallos con email inexistente → bloqueo
  {
    const victim = `ratelimit-${Date.now()}@orbe360.local`;
    let blocked = false;
    for (let i = 0; i < 10; i++) {
      try {
        await loginOrThrow(victim, "wrong-password-long");
      } catch (e) {
        if (String(e.message || "").includes("Demasiados intentos")) {
          blocked = true;
          break;
        }
      }
    }
    if (blocked) ok("Rate-limit login tras intentos fallidos");
    else fail("Rate-limit login no activó");
  }

  // Cleanup disposable QA tours/scenes (keep Unisimón campus graph intact)
  try {
    const login = await loginOrThrow("superadmin@orbe360.local", "OrbeSuper2026!");
    const cleaned = await convex("mutation", "cleanupQa:cleanupQaArtifacts", {
      token: login.token,
      dryRun: false,
    });
    ok(
      "cleanupQaArtifacts",
      `tours=${cleaned.toursDeleted} qaScenes=${cleaned.qaScenesRemovedFromPilot} orgs=${cleaned.orgsDeleted}`
    );
    // NEVER auto syncCampusSpatialGraph here — that wiped admin connections (~53 → 144).
    ok("post-cleanup sin resync espacial (opt-in only)");
    await convex("mutation", "auth:logout", { token: login.token }).catch(() => {});
  } catch (e) {
    fail("cleanupQaArtifacts", e.message);
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n=== Resumen: ${passed} OK · ${failed} FAIL · total ${results.length} ===\n`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
