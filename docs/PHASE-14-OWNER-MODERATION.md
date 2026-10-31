# NOSTALGICVERSE — PHASE 14 COMMUNITY MODERATION & REPORTS

## 1. Unified Moderation Queues
The owner moderation center provides triage for community infractions:
- **Flagged Comments:** Public comments reported by community members or automated keyword filters.
- **Flagged Reviews:** Reviews flagged for harassment, spoilers, or fake submissions.
- **User Reports:** Direct user reports targeting abusive behavior, spam, or security anomalies.

---

## 2. Moderation Actions
- **Hide / Restore Comment:** `POST /api/owner/comments/:id/hide` and `/restore`. Soft-deletion hides comments from public view without destroying conversational context or audit records.
- **Hide / Restore Review:** `POST /api/owner/reviews/:id/hide` and `/restore`. Preserves rating calculation integrity while protecting the public feed from spam.
- **Report Resolution:** `POST /api/owner/reports/:id/status` (Transitions state to `INVESTIGATING`, `RESOLVED`, or `DISMISSED` with curatorial notes).
- **User Sanctions:** Warnings, suspension, and account restoration handled directly with audit logging.

