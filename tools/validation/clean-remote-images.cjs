const fs = require('fs');
const https = require('https');
const http = require('http');

const dataDir = __dirname + '/../../data';
const remoteImagesPath = dataDir + '/remote-game-images.json';
let manifest = JSON.parse(fs.readFileSync(remoteImagesPath, 'utf8'));
let games = manifest.games;

const checkUrl = (url) => {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }
    const parsed = new URL(url);
    const reqModule = parsed.protocol === 'https:' ? https : http;
    const req = reqModule.request(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 NostalgicVerse Image Validator'
      }
    }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.setTimeout(5000);
    req.end();
  });
};

(async () => {
  const keys = Object.keys(games);
  let verifiedCount = 0;
  let fallbackCount = 0;
  
  // We'll process sequentially to avoid 429s, maybe 5 at a time
  for (let i = 0; i < keys.length; i += 10) {
    const batch = keys.slice(i, i + 10);
    await Promise.all(batch.map(async (key) => {
      const entry = games[key];
      if (entry.imageType === 'local' && entry.localPath) {
        verifiedCount++;
        return; // local is fine
      }
      
      if (entry.imageUrl) {
        const ok = await checkUrl(entry.imageUrl);
        if (ok) {
          entry.verificationStatus = 'verified';
          verifiedCount++;
        } else {
          // If the head request fails, fallback to GET just in case (wikimedia blocks HEAD sometimes)
          const okGet = await new Promise((resGet) => {
             const getReq = https.get(entry.imageUrl, {
               headers: { 'User-Agent': 'Mozilla/5.0 NostalgicVerse/1.0' }
             }, (res) => {
               resGet(res.statusCode >= 200 && res.statusCode < 400);
               res.resume();
             });
             getReq.on('error', () => resGet(false));
             getReq.end();
          });
          
          if (okGet) {
            entry.verificationStatus = 'verified';
            verifiedCount++;
          } else {
            // Fails completely. Make it fallback.
            delete entry.imageUrl;
            delete entry.sourceUrl;
            entry.fallbackAvailable = true;
            entry.verificationStatus = 'fallback';
            entry.verificationNotes = 'URL was unreachable/404. Falling back to museum plate.';
            fallbackCount++;
          }
        }
      } else {
        entry.fallbackAvailable = true;
        entry.verificationStatus = 'fallback';
        fallbackCount++;
      }
    }));
    
    console.log(`Checked ${i + batch.length} / ${keys.length}`);
    // Wait a little to prevent rate limiting
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Update counts
  manifest.counts = {
    localVerified: Object.values(games).filter(g => g.imageType === 'local').length,
    remoteVerified: Object.values(games).filter(g => g.imageUrl).length,
    reviewRequired: 0,
    missing: 0,
    fallback: fallbackCount
  };
  
  fs.writeFileSync(remoteImagesPath, JSON.stringify(manifest, null, 2));
  console.log(`Cleaned remote-game-images.json. Verified: ${verifiedCount}, Fallback: ${fallbackCount}`);
})();

