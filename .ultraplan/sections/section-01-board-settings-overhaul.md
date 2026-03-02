# Section 01: Board Settings Overhaul

> Project: TaskFlow World-Class Upgrade
> Batch: 1 | Tasks: 7 | Risk: GREEN
> PRD Features: P0 - Wire Orphaned Features, Tabbed Board Settings, Workspace Export UI

---

## Overview

This section is the single highest-impact improvement in the entire plan. 7 fully-built features are currently unreachable from the UI because they have no navigation paths. This section:

1. Converts the board settings page from a long scrolling page into organized PrimeNG Tabs
2. Wires 7 orphaned components into appropriate tabs
3. Builds the missing workspace export frontend
4. Adds a "More" menu to the board header for quick access to board-level features

After this section, every backend feature has a discoverable frontend home.

---

## Risk

| Aspect | Value |
|--------|-------|
| Color | GREEN |
| Summary | Wiring existing components with minimal new code |
| Explanation | All 7 components already exist and are tested. The work is routing and imports, not building from scratch. |

### Risk Factors
- Complexity: 1 (standard component wiring)
- Novelty: 1 (PrimeNG Tabs already used in workspace settings)
- Dependencies: 1 (no external dependencies)
- Integration: 1 (internal components only)
- Data sensitivity: 1 (no new data handling)
- **Total: 5 → GREEN**

### Mitigation
- Test each tab individually after wiring
- Check that existing component unit tests still pass

---

## Dependencies

| Type | Section | Description |
|------|---------|-------------|
| None | - | This section has no dependencies |
| Blocks | Section 08 | Feature discovery needs features to be wired first |
| Blocks | Section 09 | Visual polish needs stable layout |

**Batch:** 1
**Parallel siblings:** Section 02, 03, 04

---

## TDD Test Stubs

> Write these tests BEFORE implementing the tasks.

1. `BoardSettingsComponent should render tabbed navigation with correct tab labels`
2. `BoardSettingsComponent should lazy-load AutomationRulesComponent when Automations tab is selected`
3. `BoardSettingsComponent should lazy-load WebhookSettingsComponent when Integrations tab is selected`
4. `BoardSettingsComponent should show ShareSettings, ImportDialog, ExportDialog in Integrations tab`
5. `BoardSettingsComponent should lazy-load CustomFieldsManager when Custom Fields tab is selected`
6. `BoardSettingsComponent should lazy-load MilestoneList when Milestones tab is selected`
7. `BoardHeaderComponent should show "More" menu with links to Settings, Import, Export, Share`
8. `WorkspaceExportComponent should call workspace export endpoint and download file`

---

## Files Touched

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/app/features/board/board-settings/board-settings.component.ts` | MODIFY | Convert to tabbed layout with PrimeNG Tabs |
| `frontend/src/app/features/board/board-view/board-header.component.ts` | MODIFY | Add "More" menu with board actions |
| `frontend/src/app/features/workspace/workspace-settings/workspace-export.component.ts` | CREATE | New component for workspace export |
| `frontend/src/app/core/services/workspace.service.ts` | MODIFY | Add exportWorkspace() method |
| `frontend/src/app/app.routes.ts` | MODIFY | Add workspace export route if needed |

---

## Tasks

### Task 1: Convert Board Settings to Tabbed Layout
**Files:** `board-settings.component.ts`
**Steps:**
1. Import PrimeNG `TabsModule` (Tab, TabList, TabPanels, TabPanel)
2. Wrap existing General/Columns/Members content in tab panels
3. Add new tabs: Automations, Integrations, Custom Fields, Milestones
4. Each new tab lazy-loads its component with `@defer`
5. Preserve existing URL-based tab selection if applicable
**Done when:** Board settings shows tabs and existing content renders correctly

### Task 2: Wire Automation Components
**Files:** `board-settings.component.ts`
**Steps:**
1. Import `AutomationRulesComponent` in the Automations tab panel
2. Pass board ID and workspace ID as inputs
3. Verify automation CRUD operations work end-to-end
**Done when:** User can create, edit, delete automation rules from board settings

### Task 3: Wire Integration Components (Share + Webhooks + Import/Export)
**Files:** `board-settings.component.ts`
**Steps:**
1. Create "Integrations" tab panel
2. Add sub-sections: Sharing, Webhooks, Import/Export
3. Import `ShareSettingsComponent`, `WebhookSettingsComponent`, `ImportDialogComponent`, `ExportDialogComponent`
4. Wire board ID inputs to each component
**Done when:** User can manage sharing, webhooks, import, and export from board settings

### Task 4: Wire Custom Fields Manager
**Files:** `board-settings.component.ts`
**Steps:**
1. Import `CustomFieldsManagerComponent` in Custom Fields tab
2. Pass board ID as input
3. Verify custom field CRUD works (create text/number/date/dropdown/checkbox fields)
**Done when:** User can manage custom field definitions from board settings

### Task 5: Wire Milestone List
**Files:** `board-settings.component.ts`
**Steps:**
1. Import `MilestoneListComponent` in Milestones tab
2. Pass board ID as input
3. Verify milestone CRUD works
**Done when:** User can create, edit, delete milestones from board settings

### Task 6: Add Board Header "More" Menu
**Files:** `board-header.component.ts`
**Steps:**
1. Add PrimeNG Menu component with board-level quick actions
2. Menu items: Settings, Import, Export, Share Board, Webhooks
3. Settings navigates to board settings page
4. Import/Export/Share open dialogs directly (avoid navigating to settings)
**Done when:** Board header has a "..." or "More" button that opens a menu with quick access to all board features

### Task 7: Build Workspace Export Frontend
**Files:** `workspace-export.component.ts`, `workspace.service.ts`
**Steps:**
1. Add `exportWorkspace(workspaceId: string)` method to workspace service
2. Create `WorkspaceExportComponent` with export button and format selector
3. Wire into workspace settings (add tab or button)
4. Handle file download (blob response → download trigger)
**Done when:** User can export entire workspace data from workspace settings

---

## Section Completion Criteria

- [ ] Board settings shows tabbed navigation with 7 tabs
- [ ] All 7 orphaned components are accessible and functional
- [ ] Board header has "More" menu with quick actions
- [ ] Workspace export works end-to-end
- [ ] All existing board settings tests still pass
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No console errors in browser

---

## Notes

### Recommended Paradigm
**Primary:** Declarative - Angular template composition with existing standalone components
**Secondary:** Reactive - Signal-based state for tab selection
**Rationale:** This is primarily component composition work. No complex logic needed.

### Gotchas
- PrimeNG Tabs component uses `Tab`, `TabList`, `TabPanels`, `TabPanel` (not the older `TabView`)
- Use `@defer` for lazy-loading tab content to avoid initial bundle impact
- Board settings URL may need updating to support deep-linking to specific tabs (e.g., `/settings?tab=automations`)
- The existing board-settings component uses inline template - keep that pattern consistent
