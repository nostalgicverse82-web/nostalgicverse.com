# NOSTALGICVERSE — PHASE 15 AI CONTENT ENRICHMENT BOUNDARY

**System:** Server-Side Artificial Intelligence Control & Curatorial Gatekeeping  
**Version:** 2026.1.0  
**Authority:** NostalgicVerse Editorial & Archival Ethics Board  

---

## 1. Core Principle: Human-in-the-Loop

In a historical preservation museum, **truth and factual provenance are paramount**. AI models frequently hallucinate release dates, misattribute developers, or conflate regional ports. 

Therefore, NostalgicVerse enforces a strict architectural boundary:
```
SOURCE DOCUMENTATION
        ↓
SERVER-SIDE AI ENGINE (`server/automation/ai-engine.cjs`)
        ↓
STRUCTURED DRAFT MARKED AS `AI_DRAFT`
        ↓
OWNER / CURATOR REVIEW QUEUE (`/owner/ai-center`)
        ↓ [APPROVED by Human Operator]
CANONICAL PUBLISHED DATABASE
```

**AI NEVER publishes directly to the public website.**

---

## 2. Permitted AI Roles vs Strictly Prohibited Actions

### Permitted AI Tasks
- Generating high-level introductory summaries from verified curatorial notes.
- Suggesting genre tags or platform keywords based on established exhibit descriptions.
- Drafting SEO meta descriptions within recommended character counts.
- Identifying potential image candidates for human review.

### Strictly Prohibited Actions
- Manufacturing release dates, sales figures, or historical events not corroborated by sources.
- Overwriting existing verified historical facts without human authorization.
- Resolving conflicting historical sources automatically (conflicts must be flagged for curatorial review).
- Bypassing the owner approval gate.

---

## 3. Contradiction & Source Disagreement Handling

When historical sources report conflicting dates or credits (e.g., Japanese vs North American release windows):
- The system flags the entity with `SOURCE_CONFLICT`.
- Both source citations are preserved in `content_sources`.
- The draft remains in `REVIEW` state until a human curatorial operator confirms the consensus or documents the regional variance.

