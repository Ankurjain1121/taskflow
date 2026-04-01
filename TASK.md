# Deep Scan Fix List

## Objective
Fix all issues found by the deep scan (2026-04-01). Priority order by user impact.

## Tasks

### CRITICAL
- [ ] 1. Fix unprotected subscriptions in 15+ components (memory leaks)

### HIGH
- [ ] 2. Fix clippy raw string hashes (426 instances — mechanical)
- [ ] 3. Replace 28 hardcoded inline colors with CSS variables

### MEDIUM
- [ ] 4. Add LIMIT to `list_all_invitations()` query
- [ ] 5. Add aria-label to 20+ buttons
- [ ] 6. Investigate frontend bundle size (1.24 MB vs 800 KB budget)

### LOW
- [ ] 7. Fix type casting wraparound (9 instances)
- [ ] 8. Remove TODO in sample_board.rs
- [ ] 9. Fix empty CSS sub-selector warnings

## Progress Log
- 2026-04-01: Deep scan completed, 9 issues found, fix list created
