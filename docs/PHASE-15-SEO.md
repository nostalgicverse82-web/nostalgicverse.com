# NOSTALGICVERSE — PHASE 15 SEO & SITEMAP ARCHITECTURE

**System:** Search Engine Optimization, Metadata Governance, and XML Sitemap Pipeline  
**Version:** 2026.1.0  
**Artifact:** `sitemap.xml`  

---

## 1. SEO Philosophy

NostalgicVerse approaches search engine discoverability from a preservation and archival perspective:
1. **One Canonical URL per Exhibit:** Every exhibit has a single canonical URL (`https://nostalgicverse.com/games/{slug}/`).
2. **Accurate Structured Metadata:** Structured data uses standard Schema.org entities (`VideoGame`, `Product`, `Article`, `BreadcrumbList`).
3. **No Private Route Pollution:** Administrative surfaces (`/owner/`), user private spaces (`/account/`), and backend API routes (`/api/`) are strictly excluded from sitemaps and search engine robots.

---

## 2. XML Sitemap Derivation

`tools/content/rebuild-sitemap.cjs` generates `sitemap.xml` directly from SQLite canonical records:
- **Base Domain:** `https://nostalgicverse.com`
- **Current Public URL Count:** **605 canonical URLs**
  - Core navigation hubs: 10 (`/`, `/games/`, `/consoles/`, `/timeline/`, `/genres/`, `/guides/`, `/blog/`, `/news/`, `/about/`, `/support/`)
  - Published Games: 530
  - Published Consoles: 65
- **XML Standards Compliance:** Conforms to `http://www.sitemaps.org/schemas/sitemap/0.9`.
- **Atomic Swap:** Writes to `sitemap.xml.tmp`, validates XML tags, and executes atomic `renameSync`.

---

## 3. Public Exhibit Metadata Standards

Every public game and console exhibit implements:
1. **Canonical Link Tag:**
   ```html
   <link rel="canonical" href="https://nostalgicverse.com/games/pac-man/" />
   ```
2. **Open Graph Protocol Tags:**
   - `og:type`: `website` / `article`
   - `og:title`: Curatorial exhibit title
   - `og:description`: Historical summary snippet
   - `og:image`: Verified exhibit image URL or Museum Accession Fallback Plate
   - `og:url`: Absolute canonical link
3. **Twitter Card Meta Tags:**
   - `twitter:card`: `summary_large_image`
   - `twitter:title` / `twitter:description` / `twitter:image`
4. **Structured Data (JSON-LD):**
   Archival exhibits embed Schema.org `VideoGame` or `Article` metadata with release dates, developer, publisher, and genre properties.

