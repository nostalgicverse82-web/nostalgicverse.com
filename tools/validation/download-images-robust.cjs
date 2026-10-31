const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');

const gamesData = JSON.parse(fs.readFileSync('data/games.json', 'utf8'));
const gamesMap = {};
gamesData.games.forEach(g => {
    const slug = g.slug || g.id.replace('game-', '');
    gamesMap[slug] = g;
});

const remoteImagesFile = 'data/remote-game-images.json';
const remoteData = JSON.parse(fs.readFileSync(remoteImagesFile, 'utf8'));

const assetsDir = path.join(__dirname, '../../assets/images/games');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

function downloadImage(url, destPath) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 NostalgicVerse/1.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(downloadImage(res.headers.location, destPath));
            }
            if (res.statusCode !== 200) {
                res.resume();
                return resolve(false);
            }
            
            const file = fs.createWriteStream(destPath);
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(true);
            });
            file.on('error', (err) => {
                fs.unlink(destPath, () => {});
                resolve(false);
            });
        }).on('error', () => {
            resolve(false);
        });
    });
}

async function searchSteam(title) {
    return new Promise((resolve) => {
        const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&l=english&cc=US`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', c => data+=c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.items && json.items.length > 0) {
                        const img = json.items[0].tiny_image;
                        if (img) {
                            return resolve(img.replace('capsule_231x87.jpg', 'header.jpg'));
                        }
                    }
                    resolve(null);
                } catch(e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

async function run() {
    const keys = Object.keys(remoteData.games);
    console.log(`Checking ${keys.length} games for fallbacks...`);
    
    for (let i = 0; i < keys.length; i++) {
        const slug = keys[i];
        const entry = remoteData.games[slug];
        
        if (entry.verificationStatus === 'fallback' || entry.imageType === 'fallback') {
            const game = gamesMap[slug];
            if (!game) continue;
            
            let success = false;
            const destPath = path.join(assetsDir, `${slug}.jpg`);
            const localUrl = `/assets/images/games/${slug}.jpg`;
            
            // Try proxying original Wikipedia URL first (avoids 429)
            if (game.image && game.image.includes('wikimedia')) {
                const proxyUrl = `https://wsrv.nl/?url=${game.image.replace(/^https?:\/\//, '')}`;
                success = await downloadImage(proxyUrl, destPath);
            }
            
            // If failed (e.g. 404), search Steam
            if (!success) {
                console.log(`${slug}: Wiki proxy failed, trying Steam...`);
                const steamUrl = await searchSteam(game.title);
                if (steamUrl) {
                    success = await downloadImage(steamUrl, destPath);
                }
            }
            
            if (success) {
                console.log(`[SUCCESS] Downloaded real image for ${slug}`);
                
                // Update entry!
                entry.status = 'local-verified';
                entry.imageType = 'local';
                entry.localPath = localUrl;
                entry.sourceDomain = 'local';
                entry.verificationStatus = 'verified';
                entry.verificationNotes = 'Downloaded verified real artwork.';
                
                // Keep counts accurate
                remoteData.counts.fallback--;
                remoteData.counts.localVerified++;
            } else {
                console.log(`[FAILED] Could not find real image for ${slug}. Remaining fallback.`);
            }
            
            // Sleep to avoid rate limits on wsrv.nl and steam
            await new Promise(r => setTimeout(r, 50));
        }
    }
    
    fs.writeFileSync(remoteImagesFile, JSON.stringify(remoteData, null, 2));
    console.log("Done upgrading fallbacks to real local images!");
}

run();

