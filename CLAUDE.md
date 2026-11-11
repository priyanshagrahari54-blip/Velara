# CLAUDE.md — VELARA Master Configuration

Project: **VELARA — City of Shadows** (open-world city game, web tech)
Current stage: **Phase 1 — Professional Vertical Slice** (see `production/ROADMAP.md`)
Rigor mode: **standard** (design note → tests → implement → verify → docs)

## Commands

```bash
npm run dev            # dev server (localhost:3000)
npm run build          # production web build -> dist/
npm run test:physics   # headless physics validation (cannon-es)
npm run test:browser   # full gameplay smoke test (Playwright, 0-error gate)
npm run package:win    # Win7-compatible Electron .exe package
```

## Non-negotiables

1. **Zero console errors** — QA gate fails on any pageerror.
2. **Tests first for physics/vehicle changes** — `test/physics` suite must stay green.
3. **No gameplay logic in engine modules** and vice versa (see `.claude/rules/`).
4. **Offline-first** — no network calls at runtime, CSP enforced (index.html).
5. **Win7/G560 compat** — feature-detect, degrade via QualityManager, never crash.
6. Bade technical decisions = naya ADR in `docs/`.

## Key Docs

- `design/01-GDD.md` — game design
- `design/02-ART-DIRECTION.md` — visual targets (references/ images = source of truth)
- `docs/TECH-ARCHITECTURE.md` — module map
- `docs/QUALITY-SECURITY-COMPAT.md` — budgets, security, compat matrix
- `production/ROADMAP.md` — phases & acceptance criteria
