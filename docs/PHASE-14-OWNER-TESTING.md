# Phase 14: Validation Suite & Testing Architecture

## 1. Test Suite Matrix
Phase 14 includes 12 automated validation suites located in `tools/validation/`:
1. `test-phase14-owner-dashboard.cjs`: Tests metrics, counts, real-time counters, and zero-synthetic-data rule.
2. `test-phase14-owner-users.cjs`: Tests user listing, role upgrades, bans, unbans, and session termination.
3. `test-phase14-owner-content.cjs`: Tests content CRUD, slug collision rejection, and version snapshot creation.
4. `test-phase14-owner-submissions.cjs`: Tests community exhibit submissions and promotion to live catalog.
5. `test-phase14-owner-support.cjs`: Tests support tickets, public replies, internal staff notes, and status transitions.
6. `test-phase14-owner-moderation.cjs`: Tests user reports, comment moderation, soft-deletes, and restorations.
7. `test-phase14-owner-media.cjs`: Tests media registry, image updates, and core asset protection guards.
8. `test-phase14-owner-seo.cjs`: Tests sitemap generation, search index health, and robots.txt integrity.
9. `test-phase14-owner-jobs.cjs`: Tests job runner, allowlist enforcement, and worker execution.
10. `test-phase14-owner-security.cjs`: Tests unauthenticated 401, regular user 403, owner 200, SQLi resilience, and session auditing.
11. `test-phase14-owner-backups.cjs`: Tests snapshot creation, PRAGMA verification, and backup listing.
12. `test-phase14-owner-e2e.cjs`: Tests full end-to-end owner journey across all operational domains.

## 2. Test Execution
- Master runner: `node tools/validation/run-all-phase14-tests.cjs`
- Zero mocked data. All tests operate on real ephemeral or isolated entities and clean up their test state upon completion.
