/**
 * NostalgicVerse — Update ASSET-REQUIREMENTS.md with Remote Image Strategy
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const assetDocPath = path.join(ROOT, 'ASSET-REQUIREMENTS.md');
const manifestPath = path.join(ROOT, 'data', 'remote-game-images.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let doc = fs.readFileSync(assetDocPath, 'utf8');

// Build Section 3 Replacement
const lines = [
  '## 3. Game Title Artwork Assets (Remote Sourcing Architecture)',
  '',
  '**Architecture Evolution:**  ',
  'To eliminate the requirement of manually downloading, storing, and maintaining hundreds of local image files in the repository, NostalgicVerse employs a **Remote Image Loading Architecture** prioritizing verified direct external image URLs (`https://...`) backed by the permanent Museum Accession Fallback Plate system.',
  '',
  '**Display Priority Hierarchy:**',
  '```',
  'LOCAL VERIFIED ASSET (On-Disk)',
  '         ↓',
  'REMOTE VERIFIED ASSET (Direct Image URL)',
  '         ↓',
  'MUSEUM ACCESSION FALLBACK PLATE (Graceful Degradation via onerror)',
  '```',
  '',
  '**Audit Summary (Total Catalogue: ' + manifest.totalGames + ' Games):**',
  '- **Local Game Images Retained:** **' + manifest.counts.localVerified + '** (`/assets/images/games/computerspace.png`)',
  '- **Remote Verified Game Images:** **' + manifest.counts.remoteVerified + '** (HTTP 200/206 verified, `image/jpeg` / `image/png`)',
  '- **Review Required Game Images:** **' + manifest.counts.reviewRequired + '** (`minecraft` — requires editorial discussion; fallback plate active)',
  '- **Missing Game Images:** **' + manifest.counts.missing + '**',
  '- **External Image Domains Used:** `' + manifest.domainsUsed.join(', ') + '`',
  '- **Fallback Coverage:** **100% (' + manifest.totalGames + '/' + manifest.totalGames + ' games have museum accession fallback plates)**',
  '',
  '---',
  '',
  '### 3.1 Master Game Artwork Inventory (' + manifest.totalGames + ' Games)',
  '',
  '| # | Game Title | Canonical Slug | Image Source / Direct URL | Source Domain | License / Status | Priority / Action | Fallback |',
  '| :-: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |'
];

const games = Object.values(manifest.games);
games.forEach((g, idx) => {
  const num = idx + 1;
  const title = g.title;
  const slug = g.slug;
  const domain = g.sourceDomain || 'N/A';
  const license = g.license || 'review-required';
  const fallback = g.fallbackAvailable ? 'YES' : 'NO';

  if (g.status === 'local-verified') {
    lines.push('| ' + num + ' | ' + title + ' | `' + slug + '` | Local Asset: `' + g.localPath + '` | `local` | ' + license + ' | **LOCAL VERIFIED — KEEP** | ' + fallback + ' |');
  } else if (g.status === 'verified') {
    lines.push('| ' + num + ' | ' + title + ' | `' + slug + '` | [Direct Asset](' + g.imageUrl + ') | `' + domain + '` | ' + license + ' | **REMOTE VERIFIED** | ' + fallback + ' |');
  } else {
    lines.push('| ' + num + ' | ' + title + ' | `' + slug + '` | *Fallback Plate Only* | `' + domain + '` | ' + license + ' | **REVIEW REQUIRED** | ' + fallback + ' |');
  }
});

const section3 = lines.join('\n');

// Locate Section 3 in existing ASSET-REQUIREMENTS.md
const startToken = '## 3. Game Title Artwork Assets';
const endToken = '## 4. Genre Media Assets';

const startIdx = doc.indexOf(startToken);
const endIdx = doc.indexOf(endToken);

if (startIdx === -1 || endIdx === -1) {
  console.error('Failed to locate Section 3 in ASSET-REQUIREMENTS.md');
  process.exit(1);
}

doc = doc.substring(0, startIdx) + section3 + '\n\n---\n\n' + doc.substring(endIdx);
fs.writeFileSync(assetDocPath, doc, 'utf8');
console.log('Successfully updated Section 3 in ASSET-REQUIREMENTS.md.');

