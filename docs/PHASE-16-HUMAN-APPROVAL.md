# NostalgicVerse — Phase 16 Human Approval Gates & Curatorial Review

## 1. Zero Autonomous Publishing Guarantee

A fundamental tenet of NostalgicVerse is that machine learning models cannot guarantee factual accuracy, historical nuance, or ethical curation. Therefore, **AI output is never permitted to write directly to public-facing museum tables without explicit human approval**.

---

## 2. Review Gate Architecture

```
AI Job Completes
       │
       ▼
Persist Draft in ai_outputs (Status: AWAITING_OWNER)
       │
       ▼
Real-time SSE Notification to Owner Command Center
       │
       ▼
Owner Reviews Side-by-Side Diff:
  • Original Entity Data vs Proposed AI Enrichment
  • Source Citation URLs & Snapshot Evidence
  • Conflict Alerts (if divergent claims exist)
       │
       ├── Reject Draft ──► ai_outputs status = REJECTED
       │                    Audit logged in ai_audit
       │                    No canonical DB changes made
       │
       └── Approve Draft ─► Atomically apply changes to canonical tables
                            ai_outputs status = APPROVED
                            Record reviewer ID & timestamp
                            Log mutation in ai_audit
```

---

## 3. Owner Review API Endpoints

Privileged endpoints protected by the `ownerAuth` middleware:

- `POST /api/owner/ai/jobs/:id/approve`: Commits draft content directly to target entity (`games`, `news_articles`, etc.).
- `POST /api/owner/ai/jobs/:id/reject`: Discards draft content, archiving owner's curatorial reason in `review_notes`.
- `POST /api/owner/news-candidates/:id/publish`: Promotes vetted news candidate to `news_articles`.
- `POST /api/owner/game-candidates/:id/publish`: Promotes vetted game candidate to `games` and `game_images`.
- `POST /api/owner/release-monitor/:id/approve`: Approves detected release date revision and notifies followers.
