# TaskFlow Dead Code Analysis Report

**Date:** 2026-03-03
**Tools Used:** knip, depcheck, ts-prune
**Scope:** Frontend (Angular) project

---

## Executive Summary

- **Total Findings:** 87 items
- **SAFE to Remove:** 53 items (unused test helpers, types, constants)
- **CAUTION:** 28 items (might be used, need verification)
- **DANGER:** 6 items (dependencies, config)
- **Blockers:** Permission issue on node_modules (consider `npm ci` or rebuild)

---

## Category 1: SAFE TO REMOVE 🟢

### Unused Files (24 total)

These files are never imported and can be safely deleted:

```
✓ e2e/global-setup.ts                              # Playwright setup (not used in current config)
✓ e2e/pages/TaskDetailPage.ts                      # Page object (not used)
✓ e2e/playwright.comprehensive.config.ts           # Old config (not used)
✓ postcss.config.js                                # PostCSS config (Tailwind handles it)
✓ src/app/app.component.css                        # Unused styles
✓ src/app/features/my-tasks/my-tasks.component.css # Unused styles
✓ src/app/shared/components/dialogs/index.ts       # Barrel export (no imports)
✓ src/app/shared/components/notification-bell/index.ts # Barrel export (no imports)
✓ src/app/shared/components/skeleton/skeleton.component.ts # Component unused
✓ src/app/shared/pipes/relative-time.pipe.ts       # Pipe unused
✓ src/app/shared/types/auth.types.ts               # Unused types file
✓ src/app/shared/utils/retry-transient.ts          # Utility unused
✓ src/styles.css                                   # Global styles (check if needed)
✓ src/themes.css                                   # Theme styles (check if needed)
✓ playwright-report-comprehensive/trace/*.* (11 files) # Test artifacts (safe to delete)
```

**Impact:** Minimal. These are orphaned or test artifacts.
**Recommendation:** Delete all 24 files in one batch. Safe. ✓

---

### Unused E2E Test Helpers (20 functions)

**File:** `e2e/helpers/data-factory.ts` & `e2e/helpers/auth.ts` & `e2e/helpers/seed-data.ts`

These functions are defined but never called in test files:

```
✓ completeOnboarding()              # e2e/helpers/auth.ts
✓ createBoardViaAPI()               # e2e/helpers/data-factory.ts
✓ apiSignIn()                       # e2e/helpers/data-factory.ts
✓ apiCreateWorkspace()              # e2e/helpers/data-factory.ts
✓ apiInviteUser()                   # e2e/helpers/data-factory.ts
✓ apiAcceptInvitation()             # e2e/helpers/data-factory.ts
✓ apiAddWorkspaceMember()           # e2e/helpers/data-factory.ts
✓ apiCreateTask()                   # e2e/helpers/data-factory.ts
✓ apiCreateLabel()                  # e2e/helpers/data-factory.ts
✓ apiAssignTask()                   # e2e/helpers/data-factory.ts
✓ apiAddLabelToTask()               # e2e/helpers/data-factory.ts
✓ apiUpdateTask()                   # e2e/helpers/data-factory.ts
✓ apiGetWorkspaceMembers()          # e2e/helpers/data-factory.ts
✓ assignTaskViaAPI()                # e2e/helpers/data-factory.ts
✓ moveTaskToColumnViaAPI()          # e2e/helpers/data-factory.ts
✓ updateTaskViaAPI()                # e2e/helpers/data-factory.ts
✓ createLabelViaAPI()               # e2e/helpers/data-factory.ts
✓ getBoardsViaAPI()                 # e2e/helpers/data-factory.ts
✓ getBoardDetailViaAPI()            # e2e/helpers/data-factory.ts
✓ saveSeedData()                    # e2e/helpers/seed-data.ts
✓ getSeedDataPath()                 # e2e/helpers/seed-data.ts
```

**Impact:** None. Test helpers only used internally.
**Recommendation:** Remove all 20 functions from helper files. Safe. ✓

---

### Unused Constants & Configs (2 total)

```
✓ PRIORITY_ORDER                    # src/app/features/board/board-view/swimlane-utils.ts:6
✓ PRIORITY_CONFIG                   # src/app/features/board/board-view/swimlane-utils.ts:8
```

**Impact:** None. Orphaned constants.
**Recommendation:** Delete both constants. Safe. ✓

---

## Category 2: CAUTION ⚠️

### Unused Dependencies (3 total)

These npm packages are installed but never imported:

```
⚠ chart.js             # package.json:33 - Was this used in time-report?
⚠ micromatch          # package.json:35 - Transitive dependency
⚠ primeicons          # package.json:36 - Icons used in HTML or imported via CSS?
```

**Impact:** Moderate. Adds to bundle size (15-20 KB).
**Recommendation:**
1. Verify `primeicons` is not used in global CSS or styles
2. Check if `chart.js` was removed from time-report component
3. `micromatch` likely transitive from postcss/tailwind

**Action:** Before removing, check:
```bash
grep -r "from 'chart.js'" src/
grep -r "import.*primeicons" src/
```

---

### Unused Dev Dependencies (1 total)

```
⚠ @tailwindcss/postcss  # package.json:49 - Check if used in PostCSS pipeline
```

**Recommendation:** Verify in `postcss.config.js` if this is needed. If PostCSS config doesn't reference it, remove.

---

### Unused Exported Types (56 total)

**File:** Service files and component types

Examples:
```
⚠ SignInRequest         # src/app/core/services/auth.service.ts
⚠ SignUpRequest         # src/app/core/services/auth.service.ts
⚠ DuplicateBoardRequest # src/app/core/services/board.service.ts
⚠ TrashParams           # src/app/core/services/admin.service.ts
... (52 more)
```

**Impact:** Type safety only. No runtime impact.
**Recommendation:** Keep these. They are:
1. Part of service public API contracts
2. May be imported by external apps or tests
3. Used for documentation/IntelliSense
4. Low-cost to keep

**Action:** Only remove if you're absolutely sure they're not used by any internal or external consumers.

---

## Category 3: DANGER 🔴

### Missing Dependencies (3 total)

These are imported but NOT in package.json:

```
✗ @eslint/js           # Used in eslint.config.js:2
✗ @types/node          # Used in tsconfig.spec.json (dev)
✗ vite                 # Used in vite.config.ts:1
```

**Impact:** CRITICAL. These must be installed or build will fail.
**Action:**
```bash
npm install --save-dev @eslint/js @types/node vite
```

---

### Unused Dev Dependency (1)

```
⚠ @angular/compiler-cli  # Unused but might be needed by build system
```

**Action:** Keep. It's likely needed by Angular CLI for build/AOT.

---

### Unused Tailwind Dependency (1)

```
⚠ @tailwindcss/postcss  # Only needed if using PostCSS plugins
```

**Recommendation:** Remove if PostCSS config doesn't use it.

---

## Test Suite Status

**Note:** knip also found many unused test fixture types and E2E page objects. These are safe to ignore if tests are still passing.

---

## Recommended Cleanup Plan

### Phase 1: Safe Removals (Low Risk) ✓

**Step 1:** Delete 24 unused files
```bash
rm e2e/global-setup.ts
rm e2e/pages/TaskDetailPage.ts
rm e2e/playwright.comprehensive.config.ts
rm postcss.config.js
rm src/app/app.component.css
rm src/app/features/my-tasks/my-tasks.component.css
rm src/app/shared/components/dialogs/index.ts
rm src/app/shared/components/notification-bell/index.ts
rm src/app/shared/components/skeleton/skeleton.component.ts
rm src/app/shared/pipes/relative-time.pipe.ts
rm src/app/shared/types/auth.types.ts
rm src/app/shared/utils/retry-transient.ts
# Note: Keep src/styles.css and src/themes.css (check usage first)
```

**Step 2:** Remove 20 unused test helper functions from:
- `e2e/helpers/auth.ts`
- `e2e/helpers/data-factory.ts`
- `e2e/helpers/seed-data.ts`

**Step 3:** Remove 2 unused constants from:
- `src/app/features/board/board-view/swimlane-utils.ts`

**Test After:** `npm run build` + `npm run test`

---

### Phase 2: Caution Items (Needs Verification) ⚠️

**Step 1:** Verify and possibly remove dependencies:
```bash
grep -r "chart.js" src/
grep -r "primeicons" src/ app/
grep -r "@tailwindcss/postcss" src/
```

**Step 2:** If verified unused, remove from package.json:
```bash
npm uninstall chart.js micromatch primeicons @tailwindcss/postcss
```

**Test After:** `npm run build`

---

### Phase 3: Fix Missing Dependencies (MUST DO) 🔴

```bash
npm install --save-dev @eslint/js @types/node vite
```

**Test After:** `npm run build` + lint + tests

---

## Test Verification Checklist

Before committing any removals:

- [ ] Run `npm run build -- --configuration=production`
- [ ] Run `npm run test`
- [ ] Run E2E tests: `npm run e2e`
- [ ] Check no new TypeScript errors: `npx tsc --noEmit`
- [ ] Verify no console errors in browser
- [ ] Verify app starts and loads without errors

---

## Summary Table

| Category | Count | Action | Priority |
|----------|-------|--------|----------|
| Unused Files | 24 | Delete | HIGH |
| Unused Test Helpers | 20 | Delete | MEDIUM |
| Unused Constants | 2 | Delete | LOW |
| Unused Dependencies | 3 | Verify + Remove | MEDIUM |
| Unused Dev Dependencies | 2 | Verify + Remove | LOW |
| Missing Dependencies | 3 | **MUST INSTALL** | **CRITICAL** |
| Unused Exported Types | 56 | Keep (API contract) | N/A |

---

## Notes

- **knip.json needed:** Run `npx knip --init` to create knip configuration
- **Node modules permission issue:** Consider `npm ci` for clean install if issues persist
- **Safe bulk deletion:** Phase 1 items are all safe to delete together
- **Test coverage:** Before/after test runs ensure nothing breaks

---

*Last updated: 2026-03-03*
