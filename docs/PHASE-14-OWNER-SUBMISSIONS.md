# NOSTALGICVERSE — PHASE 14 USER SUBMISSIONS & PROMOTION PIPELINE

## 1. Overview
Community members submit game ideas, missing exhibits, corrections, and compatibility reports through the `/ideas/` public portal. All contributions arrive in the `submissions` table under `PENDING_REVIEW` status.

---

## 2. Review & Triage Actions

The owner command center `/owner/` (Submissions tab) provides three primary workflows:

### A. Approve & Promote
- **API:** `POST /api/owner/submissions/:id/approve`
- **Action:** Promotes the submission into a canonical exhibit (e.g. creating a draft game in `games`).
- **Notification:** Automatically notifies the submitting user of the acceptance.
- **Audit:** Logs `APPROVE_SUBMISSION` in `audit_logs`.

### B. Request Enhancement
- **API:** `POST /api/owner/submissions/:id/enhance`
- **Action:** Transitions status to `NEEDS_ENHANCEMENT` and stores owner notes/feedback.
- **Notification:** Notifies the submitting user with instructions on what details, sources, or citations to improve.

### C. Reject
- **API:** `POST /api/owner/submissions/:id/reject`
- **Action:** Marks status as `REJECTED` with an optional rationale. Submissions are never silently deleted; full historical audit records remain intact.

---

## 3. Data Integrity & Authorization
- Only authenticated accounts with the `OWNER` role can review, approve, enhance, or reject submissions.
- Standard users are strictly barred from updating or mutating submission review statuses via endpoint RBAC checks.

