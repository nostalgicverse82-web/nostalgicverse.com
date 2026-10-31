const fs = require('fs');
const https = require('https');
const http = require('http');

const gamesData = JSON.parse(fs.readFileSync('data/games.json', 'utf8'));
const games = gamesData.games || [];

const output = {
  "$schema": "https://nostalgicverse.com/schemas/remote-images.schema.json",
  "description": "Verified direct remote image URLs for NostalgicVerse game exhibits.",
  "lastAudited": new Date().toISOString().split('T')[0],
  "totalGames": games.length,
  "counts": {
    "localVerified": 0,
    "remoteVerified": 0,
    "reviewRequired": 0,
    "missing": 0,
    "fallback": 0
  },
  "domainsUsed": [],
  "games": {}
};

function fetchUrlInfo(urlStr) {
  return new Promise((resolve) => {
    try {
      const url = new URL(urlStr);
      const mod = url.protocol === 'https:' ? https : http;
      
      const req = mod.get(urlStr, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 NostalgicVerse/1.0',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Connection': 'keep-alive'
        }
      }, (res) => {
        // Just checking headers is enough to verify if it's an image and 200 OK
        // But some sites might redirect
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // follow one redirect
          const redirectUrl = new URL(res.headers.location, urlStr).href;
          res.resume(); // consume response body
          return resolve(fetchUrlInfo(redirectUrl));
        }
        
        let contentType = res.headers['content-type'] || '';
        let length = res.headers['content-length'];
        
        res.resume(); // consume response body
        
        resolve({
          status: res.statusCode,
          mime: contentType,
          finalUrl: urlStr
        });
      });
      
      req.on('error', (err) => {
        resolve({ status: 0, error: err.message, finalUrl: urlStr });
      });
      
      req.setTimeout(5000, () => {
        req.destroy();
        resolve({ status: 408, error: 'Timeout', finalUrl: urlStr });
      });
    } catch (e) {
      resolve({ status: 0, error: e.message, finalUrl: urlStr });
    }
  });
}

const domains = new Set();

async function runAudit() {
  console.log(`Starting audit for ${games.length} games...`);
  
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const slug = game.slug || game.id.replace('game-', '');
    const entry = {
      slug: slug,
      title: game.title
    };
    
    // Default to the original image in games.json
    let candidateUrl = game.image;
    
    // If it has local AssetPath, use it
    if (game.localAssetPath) {
      entry.status = 'local-verified';
      entry.imageType = 'local';
      entry.localPath = game.localAssetPath;
      entry.sourceDomain = 'local';
      entry.verificationStatus = 'verified';
      output.counts.localVerified++;
    } else if (candidateUrl) {
      const result = await fetchUrlInfo(candidateUrl);
      
      if (result.status === 200 && result.mime.startsWith('image/')) {
        entry.status = 'verified';
        entry.imageUrl = result.finalUrl;
        
        try {
            const parsedUrl = new URL(result.finalUrl);
            entry.sourceDomain = parsedUrl.hostname;
            domains.add(parsedUrl.hostname);
        } catch (e) {
            entry.sourceDomain = 'unknown';
        }
        
        entry.mime = result.mime;
        entry.imageType = 'remote';
        entry.verificationStatus = 'verified';
        entry.verificationNotes = `Verified HTTP 200 [${result.mime}]`;
        output.counts.remoteVerified++;
      } else {
        console.log(`Failed ${game.title}: HTTP ${result.status} ${result.mime || result.error}`);
        // Cannot verify. We will search for a new one later if we want.
        // But for now, we will mark as fallback
        entry.status = 'review-required';
        entry.imageType = 'fallback';
        entry.verificationStatus = 'fallback';
        entry.verificationNotes = `URL failed: HTTP ${result.status}`;
        output.counts.fallback++;
      }
    } else {
      entry.status = 'review-required';
      entry.imageType = 'fallback';
      entry.verificationStatus = 'fallback';
      entry.verificationNotes = `No image URL in games.json`;
      output.counts.fallback++;
    }
    
    output.games[slug] = entry;
    
    // Throttle to avoid rate limits (especially Wikimedia)
    await new Promise(r => setTimeout(r, 150));
    
    if ((i + 1) % 50 === 0) {
      console.log(`Processed ${i + 1} / ${games.length}...`);
    }
  }
  
  output.domainsUsed = Array.from(domains);
  
  fs.writeFileSync('data/remote-game-images.json', JSON.stringify(output, null, 2));
  console.log(`Audit complete. Local: ${output.counts.localVerified}, Remote: ${output.counts.remoteVerified}, Fallback: ${output.counts.fallback}`);
}

runAudit();
