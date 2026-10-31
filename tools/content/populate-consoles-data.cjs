const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../');
const consolesHtml = path.join(root, 'consoles/index.html');
const content = fs.readFileSync(consolesHtml, 'utf8');
const match = content.match(/const CONSOLES_DATA = (\[[\s\S]*?\]);/);

if (!match) {
  console.error('Could not find CONSOLES_DATA in consoles/index.html');
  process.exit(1);
}

const consolesData = eval(match[1]);
console.log(`Loaded ${consolesData.length} consoles from consoles/index.html`);

const targetDir = path.join(root, 'data/consoles');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const masterConsoles = [];

consolesData.forEach(c => {
  const record = {
    "$schema": "https://nostalgicverse.com/schemas/console.schema.json",
    "id": c.id,
    "slug": c.slug,
    "name": c.name,
    "manufacturer": c.manufacturer,
    "generation": c.generation,
    "generationNumber": c.generationNumber || undefined,
    "originalReleaseYear": c.originalReleaseYear,
    "exactReleaseDate": c.originalReleaseDate || undefined,
    "mediaFormat": c.mediaFormat || undefined,
    "significance": c.historicalSignificance || undefined,
    "verifiedFactualData": {
      "cpu": c.cpu || undefined,
      "gpuOrVideoChip": c.gpu || undefined,
      "ram": c.memory || undefined,
      "powerSupply": c.powerSupply || undefined,
      "avOutputs": c.avOutputs || undefined
    },
    "editorialContent": {
      "overview": c.shortDescription || undefined,
      "marketLegacy": c.historicalSignificance || undefined,
      "controllerDesign": c.controller || undefined
    },
    "keyGames": c.notableGames || [],
    "assets": {
      "mainImage": `/assets/images/consoles/${c.slug}.png`,
      "heroImage": `/assets/images/consoles/${c.slug}-hero.png`,
      "hardwareImage": `/assets/images/consoles/${c.slug}-hardware.png`
    },
    "keywords": c.keywords || []
  };

  // Clean undefined properties
  const cleanJson = JSON.parse(JSON.stringify(record));
  const filePath = path.join(targetDir, `${c.slug}.json`);
  fs.writeFileSync(filePath, JSON.stringify(cleanJson, null, 2), 'utf8');
  masterConsoles.push(cleanJson);
});

// Update data/consoles.json
const masterPath = path.join(root, 'data/consoles.json');
const masterData = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "NostalgicVerse Consoles Master Dataset",
  "description": "Canonical structured source data for gaming hardware exhibits, specifications, and platform generations.",
  "lastUpdated": "2026-09-09",
  "totalConsoles": masterConsoles.length,
  "consoles": masterConsoles
};
fs.writeFileSync(masterPath, JSON.stringify(masterData, null, 2), 'utf8');

console.log(`Successfully generated ${masterConsoles.length} console JSON records in data/consoles/`);
console.log(`Successfully updated data/consoles.json`);

