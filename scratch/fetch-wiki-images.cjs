const fs = require('fs');
const https = require('https');

const games = JSON.parse(fs.readFileSync('data/games.json', 'utf8')).games || [];

function fetchWikiImagesBatch(titles) {
  return new Promise((resolve, reject) => {
    // Wikipedia API limits titles to 50
    const titlesStr = titles.map(t => encodeURIComponent(t)).join('|');
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${titlesStr}&prop=pageimages&pithumbsize=500&format=json`;
    
    https.get(url, { headers: { 'User-Agent': 'NostalgicVerse/1.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch(e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  const titles = games.slice(0, 10).map(g => g.title); // just test 10
  console.log("Querying for:", titles);
  try {
    const result = await fetchWikiImagesBatch(titles);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e);
  }
})();

