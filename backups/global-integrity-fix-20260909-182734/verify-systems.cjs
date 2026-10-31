const fs = require('fs');
const path = require('path');

const root = 'd:/nostalgicverse1.com';
const corePages = [
  'guides/index.html',
  'blog/index.html',
  'search/index.html',
  'favorites/index.html',
  'random/index.html'
];
const existingPages = [
  'index.html',
  'games/index.html',
  'consoles/index.html',
  'timeline/index.html',
  'genres/index.html',
  'download/index.html'
];

let allPassed = true;

console.log('=== TEST 1: DOCUMENT STRUCTURE & SINGLE HTML ROOTS ===');
[...corePages, ...existingPages].forEach(p => {
  const content = fs.readFileSync(path.join(root, p), 'utf8');
  const doctypes = (content.match(/<!DOCTYPE html>/gi) || []).length;
  const htmlOpens = (content.match(/<html/gi) || []).length;
  const htmlCloses = (content.match(/<\/html>/gi) || []).length;
  const bodyOpens = (content.match(/<body/gi) || []).length;
  const bodyCloses = (content.match(/<\/body>/gi) || []).length;
  const markdownFences = (content.match(/^\`\`\`/gm) || []).length;

  const valid = doctypes === 1 && htmlOpens === 1 && htmlCloses === 1 && bodyOpens === 1 && bodyCloses === 1 && markdownFences === 0;
  if (!valid) {
    console.error(`FAIL ${p} -> doctypes:${doctypes} htmlOpens:${htmlOpens} htmlCloses:${htmlCloses} markdownFences:${markdownFences}`);
    allPassed = false;
  } else {
    console.log(`PASS ${p} -> Clean single HTML document.`);
  }
});

console.log('\n=== TEST 2: JAVASCRIPT SYNTAX IN SCRIPT TAGS ===');
corePages.forEach(p => {
  const content = fs.readFileSync(path.join(root, p), 'utf8');
  const scriptMatches = content.match(/<script(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/gi);
  if (!scriptMatches) {
    console.error(`No script found in ${p}`);
    allPassed = false;
  } else {
    scriptMatches.forEach((sm, i) => {
      const code = sm.replace(/<\/?script[^>]*>/gi, '');
      try {
        new Function(code);
        console.log(`PASS ${p} script[${i}] syntax valid.`);
      } catch (err) {
        console.error(`FAIL ${p} script[${i}] syntax error: ${err.message}`);
        allPassed = false;
      }
    });
  }
});

console.log('\n=== TEST 3: LOCALSTORAGE KEY COMPATIBILITY ===');
[...corePages, ...existingPages].forEach(p => {
  const content = fs.readFileSync(path.join(root, p), 'utf8');
  const usesFav = content.includes('nostalgicverse_favs');
  if (usesFav) {
    console.log(`PASS ${p} uses canonical nostalgicverse_favs key.`);
  } else {
    console.warn(`NOTE ${p} does not reference nostalgicverse_favs directly.`);
  }
});

console.log('\n=== TEST 4: NO EXTERNAL RUNTIME DEPENDENCIES ===');
[...corePages, ...existingPages].forEach(p => {
  const content = fs.readFileSync(path.join(root, p), 'utf8');
  const externalScripts = content.match(/<script[^>]+src=["']https?:\/\//gi);
  const externalStyles = content.match(/<link[^>]+href=["']https?:\/\/[^>]+rel=["']stylesheet["']/gi);
  if (externalScripts || externalStyles) {
    console.error(`FAIL ${p} contains external dependencies: ${externalScripts || externalStyles}`);
    allPassed = false;
  } else {
    console.log(`PASS ${p} is 100% self-contained with zero external runtime deps.`);
  }
});

console.log('\n=== TEST 5: CANONICAL URL & JSON-LD INTEGRITY ===');
corePages.forEach(p => {
  const content = fs.readFileSync(path.join(root, p), 'utf8');
  const canonicalMatch = content.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
  const jsonLdMatch = content.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (!canonicalMatch) {
    console.error(`FAIL ${p} missing canonical link`);
    allPassed = false;
  } else {
    console.log(`PASS ${p} canonical: ${canonicalMatch[1]}`);
  }
  if (!jsonLdMatch) {
    console.error(`FAIL ${p} missing JSON-LD structured data`);
    allPassed = false;
  } else {
    try {
      JSON.parse(jsonLdMatch[1]);
      console.log(`PASS ${p} JSON-LD valid.`);
    } catch (e) {
      console.error(`FAIL ${p} JSON-LD invalid: ${e.message}`);
      allPassed = false;
    }
  }
});

console.log('\nAll validation tests complete. Status: ' + (allPassed ? 'ALL PASSED' : 'SOME FAILED'));
process.exit(allPassed ? 0 : 1);

