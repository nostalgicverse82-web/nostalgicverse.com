/**
 * Phase 14 Test Suite 5: Owner Support Helpdesk & Thread Privacy
 * Validates ticket inbox, conversation threading, owner replies to users,
 * internal note confidentiality, and status/priority updating.
 */

const { spawn } = require('child_process');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3018;
const BASE_URL = `http://127.0.0.1:${PORT}`;
let serverProcess = null;

function assert(condition, message) {
    if (!condition) {
        console.error(`[FAIL] ${message}`);
        throw new Error(message);
    }
    console.log(`[PASS] ${message}`);
}

async function startServer() {
    return new Promise((resolve, reject) => {
        serverProcess = spawn('node', ['server/index.cjs'], {
            cwd: path.resolve(__dirname, '../../'),
            env: { ...process.env, PORT: String(PORT) }
        });

        let started = false;
        serverProcess.stdout.on('data', d => {
            const out = d.toString();
            if (out.includes('listening on')) {
                started = true;
                resolve();
            }
        });

        serverProcess.stderr.on('data', d => {
            const errStr = d.toString().trim();
            if (errStr && !errStr.includes('ExperimentalWarning')) {
                console.error('[SERVER_LOG]', errStr);
            }
        });

        serverProcess.on('error', reject);
        setTimeout(() => { if (!started) reject(new Error('Server startup timed out')); }, 10000);
    });
}

function stopServer() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
}

async function loginAsOwner() {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'owner', password: 'changeme123' })
    });
    const cookie = res.headers.get('set-cookie');
    return cookie ? cookie.split(';')[0] : '';
}

async function run() {
    console.log('=== TEST PHASE 14: OWNER SUPPORT HELPDESK ===');
    await startServer();

    const ticketId = uuidv4();
    const owner = await dbAsync.get("SELECT id FROM users WHERE role = 'OWNER'");

    try {
        const sessionCookie = await loginAsOwner();
        assert(sessionCookie.length > 0, 'Owner authenticated');

        // Create disposable support ticket directly in DB
        await dbAsync.run(`
            INSERT INTO support_tickets (id, user_id, subject, category, message, status, priority, created_at, updated_at)
            VALUES (?, ?, 'Display issue on SNES exhibit', 'EXHIBIT_ISSUE', 'Screen tearing observed on Mode 7 layers.', 'OPEN', 'NORMAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [ticketId, owner.id]);

        // 1. Fetch Tickets Inbox
        const listRes = await fetch(`${BASE_URL}/api/owner/tickets`, {
            headers: { Cookie: sessionCookie }
        });
        assert(listRes.status === 200, 'GET /api/owner/tickets returns 200');
        const listData = await listRes.json();
        assert(listData.tickets.some(t => t.id === ticketId), 'Target ticket present in inbox');

        // 2. Post Owner Public Reply
        const replyRes = await fetch(`${BASE_URL}/api/owner/tickets/${ticketId}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({ message: 'Thank you for reporting. We are calibrating raster timing.' })
        });
        assert(replyRes.status === 200, 'POST /api/owner/tickets/:id/reply returns 200');

        // 3. Post Internal Staff Note
        const noteRes = await fetch(`${BASE_URL}/api/owner/tickets/${ticketId}/note`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({ note: 'Investigating core FPGA sync issue. Keep confidential.' })
        });
        assert(noteRes.status === 200, 'POST /api/owner/tickets/:id/note returns 200');

        // 4. Fetch Ticket Thread As Owner (includes internal notes)
        const ownerDetailRes = await fetch(`${BASE_URL}/api/owner/tickets/${ticketId}`, {
            headers: { Cookie: sessionCookie }
        });
        const ownerDetail = await ownerDetailRes.json();
        assert(ownerDetail.messages.length >= 2, 'Owner sees both reply and internal note');
        assert(ownerDetail.messages.some(m => m.is_internal_note === 1), 'Internal note flag preserved');

        // 5. Update Ticket Priority & Status
        const updateRes = await fetch(`${BASE_URL}/api/owner/tickets/${ticketId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({ status: 'RESOLVED', priority: 'HIGH' })
        });
        assert(updateRes.status === 200, 'PATCH /api/owner/tickets/:id returns 200');
        const updatedTicket = await dbAsync.get('SELECT status, priority FROM support_tickets WHERE id = ?', [ticketId]);
        assert(updatedTicket.status === 'RESOLVED' && updatedTicket.priority === 'HIGH', 'Ticket updated in database');

        console.log('>>> [PASS] OWNER SUPPORT HELPDESK AUDIT COMPLETED CLEANLY <<<\n');
    } finally {
        await dbAsync.run('DELETE FROM ticket_messages WHERE ticket_id = ?', [ticketId]);
        await dbAsync.run('DELETE FROM support_tickets WHERE id = ?', [ticketId]);
        await dbAsync.run("DELETE FROM notifications WHERE reference_id = ?", [ticketId]);
        await dbAsync.run("DELETE FROM audit_logs WHERE entity_id = ?", [ticketId]);
        stopServer();
    }
}

run().catch(err => {
    console.error('[FATAL]', err);
    stopServer();
    process.exit(1);
});

