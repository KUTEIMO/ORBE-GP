# AGENTS.md — Orbe360

Guidance for coding agents working in this repository.

1. Read [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) and [docs/producto/32-routing-multi-empresa-url.md](docs/producto/32-routing-multi-empresa-url.md) before changing routing or seed.
2. Prefer **virtual URL routing** (shared motor). Never duplicate the viewer per tenant.
3. Preserve Convex hotspot/connection graphs — migrate slugs with in-place `patch` only.
4. Keep **superadmin** unable to edit tour content (`userCanEditTour`).
5. Local web: `npm start` → `scripts/dev-server.mjs` (rewrites). Convex: `npx convex dev` (not `deploy`).
6. Do not claim TalkBack/NVDA support without device verification.
7. **One working tree.** This repo is the source of truth; any other copy is a deployment. Run `npm run check:drift` before pushing — see [docs/arquitectura/01-auditoria-2026-09-29.md](docs/arquitectura/01-auditoria-2026-09-29.md).
8. Before freezing a state, tag it and snapshot it; never `reset --hard` / `clean -fd` / `push --force`. Procedure: [docs/VERSION-ESTABLE-2026-09-29.md](docs/VERSION-ESTABLE-2026-09-29.md).
9. Docs map: [docs/README.md](docs/README.md).
10. Follow [docs/producto/66-reglas-diseno-ui-ux-y-flujos-orbe360.md](docs/producto/66-reglas-diseno-ui-ux-y-flujos-orbe360.md) for all new UI components/views: enforce the 5-category content policy, Orbe Soft Clay (`#0284c7`) vs client white-label (`TourBranding`) isolation, SVG icons (no emojis), mutually exclusive role/session states, single-scroll modals without repeated per-row buttons, no destructive DB reset actions in admin UI, and verify live in local Chrome before syncing mirrors or GitHub.
