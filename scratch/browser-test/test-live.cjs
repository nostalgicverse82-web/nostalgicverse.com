const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  console.log('Navigating to http://localhost:3000/ ...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });

  // Let's add some console listeners to see if there are JS errors
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  console.log('Observing discovery grid for changes over 60 seconds...');
  
  // Function to get current item names
  const getItems = async () => {
    return await page.evaluate(() => {
      const cards = document.querySelectorAll('#discovery-grid .discovery-card');
      const items = [];
      cards.forEach(card => {
        const titleEl = card.querySelector('h3.discovery-title');
        if (titleEl) items.push(titleEl.innerText.trim());
      });
      return { count: cards.length, items };
    });
  };

  let previousState = await getItems();
  console.log(`00s -> Found ${previousState.count} cards: ` + previousState.items.join(', '));

  let transitionCount = 0;
  for (let i = 1; i <= 6; i++) {
    // wait for 10 seconds (rotation is 9 seconds)
    await new Promise(r => setTimeout(r, 10000));
    const currentState = await getItems();
    
    // Check if items changed
    if (JSON.stringify(currentState.items) !== JSON.stringify(previousState.items)) {
      transitionCount++;
      console.log(`${(i * 10).toString().padStart(2, '0')}s -> Found ${currentState.count} cards: ` + currentState.items.join(', '));
      previousState = currentState;
    } else {
      console.log(`${(i * 10).toString().padStart(2, '0')}s -> (No change detected!) Count is ${currentState.count}`);
    }
  }

  console.log(`\nObserved ${transitionCount} transitions in 60 seconds.`);
  await browser.close();
})();

