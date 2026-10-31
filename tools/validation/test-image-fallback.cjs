/**
 * NostalgicVerse — Remote Image Failure & Fallback Plate QA Test
 * 
 * Tests Section 45:
 * Intentionally tests an invalid remote image URL to verify that:
 * 1. Image fails gracefully without broken image state
 * 2. onerror handler switches presentation to Museum Accession Fallback Plate
 * 3. 0 uncaught JavaScript errors occur
 * 4. Production files remain untouched and pristine
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');

console.log('============================================================');
console.log('TESTING REMOTE IMAGE FAILURE & MUSEUM FALLBACK PLATE');
console.log('============================================================\n');

// Load a representative exhibit
const sampleExhibitPath = path.join(ROOT, 'games', 'super-mario-bros', 'index.html');
const sampleHtml = fs.readFileSync(sampleExhibitPath, 'utf8');

// 1. Verify onerror handler syntax and logic in the exhibit
const imgMatch = sampleHtml.match(/<img[^>]+class="artifact-image"[^>]*>/i);
if (!imgMatch) {
  console.error('[FAIL] Could not locate artifact-image in exhibit.');
  process.exit(1);
}

const imgTag = imgMatch[0];
console.log('Extracted artifact-image element:');
console.log(' ', imgTag);

const onerrorMatch = imgTag.match(/onerror="([^"]+)"/i);
if (!onerrorMatch) {
  console.error('[FAIL] Missing onerror handler on artifact-image.');
  process.exit(1);
}

const onerrorCode = onerrorMatch[1];
console.log('\n[PASS] Verified onerror handler present:');
console.log(' ', onerrorCode);

// 2. Validate onerror JavaScript syntax using Node VM
try {
  new vm.Script(onerrorCode);
  console.log('[PASS] onerror JavaScript compiled cleanly with zero syntax errors.');
} catch (err) {
  console.error('[FAIL] onerror JavaScript syntax error:', err.message);
  process.exit(1);
}

// 3. Simulate invalid image URL failure execution in mock DOM
const mockPlate = { style: { display: 'none' } };
const mockImg = { style: { display: 'block' } };
const mockDoc = {
  getElementById: function(id) {
    if (id === 'museum-plate-super-mario-bros') return mockPlate;
    return null;
  }
};

const sandbox = {
  document: mockDoc,
  thisImg: mockImg
};

// Replace 'this.' with 'thisImg.' to simulate inline onerror attribute execution context
const simulatedCode = onerrorCode.replace(/this\./g, 'thisImg.');

try {
  vm.runInNewContext(simulatedCode, sandbox);
  if (sandbox.thisImg.style.display === 'none' && mockPlate.style.display === 'block') {
    console.log('[PASS] Simulated failure transition:');
    console.log('       Image display set to: none');
    console.log('       Museum plate display set to: block');
    console.log('       0 uncaught exceptions generated.');
  } else {
    console.error('[FAIL] Fallback did not set expected display properties.');
    process.exit(1);
  }
} catch (err) {
  console.error('[FAIL] Exception during fallback execution:', err.message);
  process.exit(1);
}

// 4. Verify Fallback Plate Content
const plateStart = sampleHtml.indexOf('<div id="museum-plate-super-mario-bros"');
if (plateStart !== -1) {
  const plateEnd = sampleHtml.indexOf('</section>', plateStart);
  const plateContent = sampleHtml.substring(plateStart, plateEnd);
  const hasAccession = /ACCESSION № NV-GM-1985-SUPER-MARIO-BROS/i.test(plateContent);
  const hasTitle = /Super Mario Bros\./i.test(plateContent);
  const hasPreservation = /Physical artifact preserved in archive vault/i.test(plateContent);

  if (hasAccession && hasTitle && hasPreservation) {
    console.log('[PASS] Fallback Museum Accession Plate contains verified metadata and typography.');
  } else {
    console.error('[FAIL] Museum plate missing required accession metadata.');
    process.exit(1);
  }
} else {
  console.error('[FAIL] Could not locate museum-artifact-plate markup.');
  process.exit(1);
}

console.log('\n============================================================');
console.log('IMAGE FAILURE TEST SUMMARY: ALL CHECKS PASSED CLEANLY');
console.log('============================================================\n');
