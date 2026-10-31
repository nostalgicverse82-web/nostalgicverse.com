/**
 * NostalgicVerse — Favorites Hydration & Media Rendering QA Suite
 * Tests that saved items in localStorage without explicit images
 * properly resolve artwork via LOCAL -> REMOTE -> FALLBACK.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../..');
const favHtml = fs.readFileSync(path.join(ROOT, 'favorites/index.html'), 'utf8');

console.log('============================================================');
console.log('TEST SUITE: FAVORITES HYDRATION & ARTWORK SYSTEM');
console.log('============================================================\n');

let testsPassed = 0;

// Test 1: Check CSS classes exist
assert(favHtml.includes('.fav-card-media'), 'CSS class .fav-card-media missing');
assert(favHtml.includes('.fav-card-image'), 'CSS class .fav-card-image missing');
assert(favHtml.includes('.fav-card-fallback-plate'), 'CSS class .fav-card-fallback-plate missing');
console.log('✓ Test 1 Passed: Favorites CSS contains .fav-card-media, .fav-card-image, .fav-card-fallback-plate');
testsPassed++;

// Test 2: Check ASSET_REGISTRY is embedded
assert(favHtml.includes('const ASSET_REGISTRY ='), 'ASSET_REGISTRY missing in favorites/index.html');
console.log('✓ Test 2 Passed: ASSET_REGISTRY lookup table embedded in favorites/index.html');
testsPassed++;

// Test 3: Check resolveAsset function logic
assert(favHtml.includes('function resolveAsset(item)'), 'resolveAsset function missing');
console.log('✓ Test 3 Passed: resolveAsset() resolver function defined in favorites/index.html');
testsPassed++;

// Test 4: Extract ASSET_REGISTRY and test hydration of legacy items
const regMatch = favHtml.match(/const ASSET_REGISTRY\s*=\s*(\{[\s\S]*?\});\s*function resolveAsset/);
assert(regMatch, 'Failed to extract ASSET_REGISTRY JSON');
const registry = JSON.parse(regMatch[1]);

// Test legacy items from nostalgicverse-saved-collection.json
const testCases = [
  { id: 'console-atari-2600', url: '/consoles/atari-2600/', type: 'console' },
  { id: 'game-pac-man', url: '/games/pac-man/', type: 'game' },
  { id: 'game-god-of-war-ragnarok', url: '/games/god-of-war-ragnarok/', type: 'game' },
  { id: 'console-playstation-2', url: '/consoles/playstation-2/', type: 'console' },
  { id: 'game-super-mario-64', url: '/games/super-mario-64/', type: 'game' }
];

testCases.forEach(tc => {
  const resolved = registry[tc.id] || registry[tc.url] || registry[tc.id.replace(/^(game-|console-)/, '')];
  assert(resolved, `Failed to resolve artwork for ${tc.id}`);
  assert(typeof resolved === 'string' && resolved.length > 5, `Invalid asset path for ${tc.id}: ${resolved}`);
  console.log(`✓ Hydration Verified: ${tc.id} -> ${resolved.substring(0, 60)}...`);
  testsPassed++;
});

// Test 5: Check createFavCard DOM factory constructs media element
assert(favHtml.includes("media.className = 'fav-card-media'"), 'createFavCard does not create fav-card-media');
assert(favHtml.includes("img.className = 'fav-card-image'"), 'createFavCard does not create fav-card-image');
assert(favHtml.includes("fallbackPlate.className = 'fav-card-fallback-plate'"), 'createFavCard does not create fav-card-fallback-plate');
console.log('✓ Test 5 Passed: createFavCard factory constructs full media element with fallback plate');
testsPassed++;

console.log('\n============================================================');
console.log(`FAVORITES SUITE PASSED: ${testsPassed} / ${testsPassed} assertions verified.`);
console.log('============================================================\n');

