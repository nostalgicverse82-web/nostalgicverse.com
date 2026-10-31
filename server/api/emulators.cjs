const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db/index.cjs');
const { requireAuth } = require('../middleware/authMiddleware.cjs');
const { broadcastToOwner } = require('../realtime/websocket.cjs');

const router = express.Router();

router.post('/sessions', requireAuth, async (req, res) => {
    const { gameId, emulatorCore } = req.body;
    try {
        const sessionId = uuidv4();
        await dbAsync.run(`
            INSERT OR IGNORE INTO emulator_devices (id, user_id, platform)
            VALUES (?, ?, ?)
        `, ['web-player', req.user.id, 'Web']);
        
        await dbAsync.run(`
            INSERT INTO emulator_sessions (id, user_id, device_id, game_id, emulator, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [sessionId, req.user.id, 'web-player', gameId, emulatorCore, 'PLAYING']);
        
        broadcastToOwner({
            type: 'EMULATOR_SESSION_START',
            sessionId,
            userId: req.user.id,
            gameId
        });
        
        res.json({ success: true, sessionId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/sessions/:id/end', requireAuth, async (req, res) => {
    try {
        await dbAsync.run(`
            UPDATE emulator_sessions
            SET status = 'COMPLETED', ended_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `, [req.params.id, req.user.id]);
        
        broadcastToOwner({
            type: 'EMULATOR_SESSION_END',
            sessionId: req.params.id
        });
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
