const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db/index.cjs');
const { requireAuth, requireOwner } = require('../middleware/authMiddleware.cjs');

const router = express.Router();
router.use(requireAuth);
router.use(requireOwner);

const VALID_TYPES = ['games', 'consoles', 'stories', 'guides', 'news_articles', 'timeline_events', 'genres', 'releases', 'ideas', 'compatibility_records'];

router.get('/:type', async (req, res) => {
    const { type } = req.params;
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });
    
    try {
        let items = [];
        if (type === 'games') {
            items = await dbAsync.all(`SELECT id, title, slug, status, release_date FROM games ORDER BY title ASC`);
        } else if (type === 'consoles') {
            items = await dbAsync.all(`SELECT id, name as title, slug, status, release_year as release_date FROM consoles ORDER BY name ASC`);
        } else if (type === 'timeline_events') {
            items = await dbAsync.all(`SELECT id, title, year, status FROM timeline_events ORDER BY year DESC`);
        } else if (type === 'genres') {
            items = await dbAsync.all(`SELECT id, name as title, slug, status FROM genres ORDER BY name ASC`);
        } else if (type === 'compatibility_records') {
            items = await dbAsync.all(`SELECT id, system || ' compatibility' as title, game_id as slug, status FROM compatibility_records`);
        } else {
            items = await dbAsync.all(`SELECT id, title, slug, status FROM ${type} ORDER BY title ASC`);
        }
        res.json({ items });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });
    
    try {
        const item = await dbAsync.get(`SELECT * FROM ${type} WHERE id = ?`, [id]);
        if (!item) return res.status(404).json({ error: 'Not found' });
        res.json({ item });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:type', async (req, res) => {
    const { type } = req.params;
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });
    
    const id = uuidv4();
    const data = req.body;
    data.id = id;
    
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => data[k]);
    
    try {
        await dbAsync.run(`INSERT INTO ${type} (${keys.join(', ')}) VALUES (${placeholders})`, values);
        
        // Audit log
        await dbAsync.run(`INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, result) VALUES (?, ?, ?, ?, ?, ?)`, 
            [uuidv4(), req.user.id, 'CREATE_CONTENT', type, id, 'SUCCESS']);
            
        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });
    
    const data = req.body;
    delete data.id; // protect ID
    
    const keys = Object.keys(data);
    const assignments = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => data[k]);
    values.push(id);
    
    try {
        await dbAsync.run(`UPDATE ${type} SET ${assignments} WHERE id = ?`, values);
        
        // Audit log
        await dbAsync.run(`INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, result) VALUES (?, ?, ?, ?, ?, ?)`, 
            [uuidv4(), req.user.id, 'UPDATE_CONTENT', type, id, 'SUCCESS']);
            
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });
    
    try {
        await dbAsync.run(`DELETE FROM ${type} WHERE id = ?`, [id]);
        
        // Audit log
        await dbAsync.run(`INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, result) VALUES (?, ?, ?, ?, ?, ?)`, 
            [uuidv4(), req.user.id, 'DELETE_CONTENT', type, id, 'SUCCESS']);
            
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

