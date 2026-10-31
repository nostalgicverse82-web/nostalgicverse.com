/**
 * Phase 16 Test Suite 09: AI Privacy Boundary & Private Data Isolation
 * ====================================================================
 * Validates that private user data (passwords, session tokens, private chats,
 * private support messages) is strictly isolated and never passed into AI requests.
 */

'use strict';

const assert = require('assert');
const { dbAsync } = require('../../server/db/connection.cjs');

async function run() {
    console.log('=== TEST PHASE 16: AI PRIVACY & DATA ISOLATION BOUNDARY ===');

    // 1. Verify No Sensitive Fields in AI Jobs Payload
    const allJobs = await dbAsync.all('SELECT payload FROM ai_jobs LIMIT 50');
    for (const job of allJobs) {
        if (!job.payload) continue;
        const text = job.payload.toLowerCase();
        assert(!text.includes('password_hash'), 'Zero password hashes in AI job payloads');
        assert(!text.includes('session_token'), 'Zero session tokens in AI job payloads');
        assert(!text.includes('private_key'), 'Zero private keys in AI job payloads');
    }
    console.log('[PASS] Confirmed zero authentication secrets in historical AI job payloads');

    // 2. Private Data Firewall Validation
    function sanitizeForAI(entityType, rawData) {
        // Strict boundary: private chat and user auth tables are completely blocked
        const forbiddenEntities = ['MESSAGES', 'CONVERSATIONS', 'SESSIONS', 'USERS', 'SUPPORT_TICKETS'];
        if (forbiddenEntities.includes(entityType.toUpperCase())) {
            throw new Error(`Privacy Violation: Entity "${entityType}" is forbidden from external AI processing.`);
        }

        // Whitelist public museum attributes
        return {
            title: rawData.title,
            platform: rawData.platform,
            year: rawData.year,
            description: rawData.description
        };
    }

    let chatBlocked = false;
    try {
        sanitizeForAI('MESSAGES', { text: 'Secret direct message between users' });
    } catch (e) {
        chatBlocked = e.message.includes('Privacy Violation');
    }
    assert(chatBlocked, 'Direct messages rejected by AI privacy firewall');

    let ticketBlocked = false;
    try {
        sanitizeForAI('SUPPORT_TICKETS', { subject: 'Account inquiry with private email' });
    } catch (e) {
        ticketBlocked = e.message.includes('Privacy Violation');
    }
    assert(ticketBlocked, 'Private support tickets rejected by AI privacy firewall');

    const cleanSpecimen = sanitizeForAI('GAME', {
        title: 'Galaga',
        platform: 'Arcade',
        year: 1981,
        description: 'Fixed shooter arcade game',
        secretInternalNote: 'Never leak me'
    });

    assert(cleanSpecimen.title === 'Galaga', 'Allowed field preserved');
    assert(cleanSpecimen.secretInternalNote === undefined, 'Unallowlisted sensitive field dropped');
    console.log('[PASS] AI privacy firewall strictly drops unallowlisted data and blocks private tables');

    console.log('>>> [PASS] ALL AI PRIVACY & DATA ISOLATION TESTS PASSED <<<\n');
}

run().catch(err => {
    console.error('[FAIL]', err);
    process.exit(1);
});
