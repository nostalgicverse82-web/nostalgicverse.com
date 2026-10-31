# NostalgicVerse Tooling & Production Pipeline

## 1. Architecture Overview

NostalgicVerse is built as an uncompromising, high-performance static digital gaming museum and archival platform. All data processing, content curation, and HTML compilation occur **offline** at build/generation time. The public website requires:
- **Zero runtime databases**
- **Zero external CDNs or remote dependencies**
- **Zero third-party runtime frameworks (React, Vue, etc.)**
- **Zero runtime AI APIs or client-side keys**

### Core Policy on Artificial Intelligence
> **AI is strictly an offline content-generation assistant.**  
> **AI is NOT a runtime dependency.**  
> No client-facing script will ever invoke OpenAI, Anthropic, Gemini, or any other AI API. No API tokens, keys, or endpoints exist on public-facing pages. All text curation and code generation occur locally and offline, compiling into pure vanilla static HTML.

---

## 2. The 9-Stage Production Pipeline Workflow

Every exhibit, batch generation pass, or archival update strictly traverses this sequence:

```
    [1. VERIFIED DATA]
            ↓
      [2. RESEARCH]
            ↓
  [3. EDITORIAL CONTENT]
            ↓
     [4. VALIDATION]
            ↓
       [5. STORAGE]
            ↓
  [6. STATIC GENERATION]
            ↓
   [7. HTML VALIDATION]
            ↓
  [8. ASSET VALIDATION]
            ↓
       [9. PUBLISH]
```

1. **VERIFIED DATA**: Primary historical sources (hardware manuals, US patent filings, arcade schematics, contemporary trade publications) are verified for technical specifications.
2. **RESEARCH**: Curators research game design lineage, engineering architecture, and cultural reception.
3. **EDITORIAL CONTENT**: Detailed curatorial essays are authored following museum standards, separating facts from critical analysis.
4. **VALIDATION**: Records are validated against JSON Schemas in `/data/schemas/` to ensure structural conformance.
5. **STORAGE**: Validated exhibits are persisted permanently as individual JSON records in `/data/{collection}/{slug}.json`.
6. **STATIC GENERATION**: Clean, standalone HTML pages (`/{collection}/{slug}/index.html`) are compiled using `/tools/generation/generate-detail-page.cjs`.
7. **HTML VALIDATION**: Document syntax, single-root tags, canonical URLs, and zero-dependency compliance are audited via `/tools/validation/master-audit.cjs`.
8. **ASSET VALIDATION**: Real WebP and SVG media references are confirmed against `/data/asset-manifest.json` with zero placeholder fabrication.
9. **PUBLISH**: Zero-dependency static pages are pushed to production hosting.

---

## 3. Directory Structure & Tools Inventory

```
/tools/
├── generation/
│   ├── build-search-index.cjs     # Compiles 289+ items into /data/search-index.json
│   ├── build-search-page.cjs      # Generates static search engine route
│   ├── build-random-page.cjs      # Generates discovery engine route
│   └── generate-detail-page.cjs   # Batch static generator for exhibit pages
└── validation/
    ├── master-audit.cjs           # Comprehensive 189+ check validation suite
    ├── verify-systems.cjs         # Core systems & localStorage verification
    ├── test-queries.cjs           # Search engine query QA suite
    └── audit-nav.cjs              # Header navigation link verification
```

---

## 4. Batch Generation Protocol (CLI Usage)

```bash
# Generate single exhibit in dry-run mode
node tools/generation/generate-detail-page.cjs --collection games --slug pac-man --dry-run

# Generate single exhibit to disk
node tools/generation/generate-detail-page.cjs --collection games --slug pac-man

# Generate comma-separated list of exhibits
node tools/generation/generate-detail-page.cjs --collection games --list pac-man,space-invaders,tetris

# Run master validation across all public pages & datasets
node tools/validation/master-audit.cjs
```
