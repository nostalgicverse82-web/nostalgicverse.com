const { dbAsync } = require('../../server/db/index.cjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const testDbPath = path.resolve(__dirname, '../../data/nostalgicverse_test.sqlite');
process.env.DB_PATH = testDbPath;

async function run() {
    console.log('Testing Phase 07 DB Operations...');
    
    // Create test user
    const userId = uuidv4();
    await dbAsync.run(`INSERT INTO users (id, username, username_normalized, email, email_normalized, password_hash) VALUES (?, ?, ?, ?, ?, ?)`, 
        [userId, 'dbtest', 'dbtest', 'dbtest@test.com', 'dbtest@test.com', 'hash']);
        
    // Insert game
    const gameId = uuidv4();
    await dbAsync.run(`INSERT INTO games (id, slug, title, release_year) VALUES (?, ?, ?, ?)`, 
        [gameId, 'test-game', 'Test Game', 2000]);
        
    // Insert comment
    const commentId = uuidv4();
    await dbAsync.run(`INSERT INTO comments (id, user_id, target_type, target_id, body) VALUES (?, ?, ?, ?, ?)`, 
        [commentId, userId, 'GAME', gameId, 'Great game!']);
        
    // Insert review
    const reviewId = uuidv4();
    await dbAsync.run(`INSERT INTO reviews (id, user_id, target_type, target_id, rating, title, body) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        [reviewId, userId, 'GAME', gameId, 9, 'Amazing', 'Played this for hours']);
        
    // Insert reaction
    await dbAsync.run(`INSERT INTO reactions (id, user_id, target_type, target_id, reaction_type) VALUES (?, ?, ?, ?, ?)`, 
        [uuidv4(), userId, 'GAME', gameId, 'LIKE']);
        
    // Verify
    const game = await dbAsync.get('SELECT * FROM games WHERE id = ?', [gameId]);
    if (game.title !== 'Test Game') throw new Error('Game missing');
    
    const comment = await dbAsync.get('SELECT * FROM comments WHERE id = ?', [commentId]);
    if (comment.body !== 'Great game!') throw new Error('Comment missing');
    
    const review = await dbAsync.get('SELECT * FROM reviews WHERE id = ?', [reviewId]);
    if (review.rating !== 9) throw new Error('Review missing');
    
    console.log('✅ Real DB operations successful');
}

run().catch(console.error);
