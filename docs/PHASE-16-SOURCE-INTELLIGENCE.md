# NostalgicVerse — Phase 16 Source Verification & Intelligence Pipeline

## 1. Overview & Source Discovery

The Source Intelligence Pipeline (`server/services/sourceFetchService.cjs`) discovers, fetches, fingerprints, and extracts historical text from authoritative third-party archives (e.g., Internet Archive, museum records, developer interviews, press retrospectives).

---

## 2. Ingestion & Hardening Workflow

```
Candidate URL Ingestion
        │
        ▼
URL Canonicalization (Strip UTM, tracking params, anchor tags)
        │
        ▼
SSRF & Protocol Filter (Block private IP ranges, cloud metadata, file://)
        │
        ▼
Domain Rate Limiter (Enforce per-domain spacing >= 1000ms)
        │
        ▼
Streaming Fetch with 2MB Size Cap
        │
        ▼
MIME Verification (text/html, application/xhtml+xml)
        │
        ▼
Content Hash Generation (SHA-256)
        │
        ├── [Identical Hash] ──► Deduplicated, skip re-parsing
        │
        ▼
HTML Extraction (Title, Author, Published Date, Sanitized Body)
        │
        ▼
Persist Snapshot (source_snapshots table)
```

---

## 3. Cryptographic Fingerprinting & Snapshots

Every fetched resource is permanently stamped with a SHA-256 fingerprint:

```javascript
function computeContentHash(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}
```

- **Integrity**: If an external page changes, a new snapshot is created under `source_snapshots` while preserving the historical evidence of prior runs.
- **Deduplication**: Identical snapshots avoid unnecessary downstream AI synthesis or claim re-extraction.

---

## 4. HTML Extraction Engine

The zero-dependency extraction engine strips script tags, styles, ads, and navigation chrome, isolating the core historical prose:
- Metadata extraction: `<meta name="author">`, `<meta property="article:published_time">`, `<title>`
- Article body isolation: `<article>`, `<main>`, or clean fallback text
- Output stored with timestamp and snapshot ID in `source_snapshots`.
