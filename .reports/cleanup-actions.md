# Dead Code Cleanup - Action Plan

**Status:** Phase 1 - Safe Removals In Progress
**Date:** 2026-03-03

---

## ✅ Completed Deletions

### Files Removed (12/24)
- ✅ e2e/global-setup.ts
- ✅ e2e/pages/TaskDetailPage.ts
- ✅ e2e/playwright.comprehensive.config.ts
- ✅ postcss.config.js
- ✅ src/app/app.component.css
- ✅ src/app/features/my-tasks/my-tasks.component.css
- ✅ src/app/shared/components/dialogs/index.ts
- ✅ src/app/shared/components/notification-bell/index.ts
- ✅ src/app/shared/components/skeleton/skeleton.component.ts
- ✅ src/app/shared/pipes/relative-time.pipe.ts
- ✅ src/app/shared/types/auth.types.ts
- ✅ src/app/shared/utils/retry-transient.ts

---

## ⏭️ Remaining Deletions (Phase 1)

### Test Artifact Files (12 files)
```
playwright-report-comprehensive/trace/*.* (cache artifacts)
```

### Unused E2E Test Helpers

**File:** `e2e/helpers/data-factory.ts`
Remove functions (NOT used in any test):
```
- createBoardViaAPI()
- apiSignIn()
- apiCreateWorkspace()
- apiInviteUser()
- apiAcceptInvitation()
- apiAddWorkspaceMember()
- apiCreateTask()
- apiCreateLabel()
- apiAssignTask()
- apiAddLabelToTask()
- apiUpdateTask()
- apiGetWorkspaceMembers()
- assignTaskViaAPI()
- moveTaskToColumnViaAPI()
- updateTaskViaAPI()
- createLabelViaAPI()
- getBoardsViaAPI()
- getBoardDetailViaAPI()
```

Keep functions (ARE used in tests):
```
✓ getFirstWorkspaceId()
✓ navigateToFirstBoard()   <- Used in multiple tests
✓ createTaskViaUI()         <- Used in multiple tests
```

**File:** `e2e/helpers/auth.ts`
Keep functions (ARE used):
```
✓ signUpAndOnboard()        <- Used in multiple tests
✓ TEST_NAME                 <- Constant used in tests
```

Remove functions:
```
- completeOnboarding()
```

**File:** `e2e/helpers/seed-data.ts`
Remove functions:
```
- saveSeedData()
- getSeedDataPath()
```

---

## 🟡 Items NOT Removed (For Good Reason)

### Constants in swimlane-utils.ts
- `PRIORITY_ORDER` (line 6) - **USED** on line 23 in buildSwimlaneGroups()
- `PRIORITY_CONFIG` (line 8) - **USED** on lines 25-26 and 117

✓ Correctly kept - knip's report was inaccurate here

---

## ⚠️ Deferred to Phase 2

### Unused Dependencies (needs verification)
```
⚠️ chart.js
⚠️ micromatch
⚠️ primeicons
⚠️ @tailwindcss/postcss
```

**Status:** Need to verify with grep before removal

---

## 🔴 Critical (Must Fix)

### Missing Dependencies
```
⚠️ @eslint/js
⚠️ @types/node
⚠️ vite
```

**Action:** Install with `npm install --save-dev @eslint/js @types/node vite`

---

## Summary

- **Files deleted:** 12/24 ✅
- **Test helpers pending:** 20 functions
- **Dependencies pending:** 5 items
- **Critical issues:** 3 missing deps ⚠️

**Next Steps:**
1. Remove 20 unused test helper functions
2. Run tests to verify no breakage
3. Address critical missing dependencies
4. Verify + remove unused npm packages

---

*Refactor-Clean Status: In Progress*
