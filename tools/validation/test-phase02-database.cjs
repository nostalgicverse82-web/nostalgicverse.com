const { dbAsync } = require('../../server/db/connection.cjs');
const { v4: uuidv4 } = require('uuid');
const { normalize } = require('../../server/services/authService.cjs');

async function testDatabase() {
    let passed = 0;
    let failed = 0;

    function check(cond, msg) {
        if (cond) {
            console.log(`  ✓ PASS: ${msg}`);
            passed++;
        } else {
            console.error(`  ✗ FAIL: ${msg}`);
            failed++;
        }
    }

    try {
        console.log('--- Phase 02 Database Validation ---');
        
        // 1. Foreign keys
        const fk = await dbAsync.get('PRAGMA foreign_keys');
        check(fk.foreign_keys === 1, 'Foreign keys are enabled');

        const mode = await dbAsync.get('PRAGMA journal_mode');
        check(mode.journal_mode.toUpperCase() === 'WAL', 'WAL mode is enabled');

        // 2. Migrations table
        const mig = await dbAsync.get("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'");
        check(!!mig, 'schema_migrations table exists');

        // 3. Required Tables
        const requiredTables = ['users', 'user_profiles', 'sessions', 'content_relationships', 'content_sources', 'media_metadata', 'submissions', 'support_tickets', 'ticket_messages', 'ticket_attachments', 'audit_logs', 'rate_limits'];
        for (const tbl of requiredTables) {
            const exists = await dbAsync.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tbl]);
            check(!!exists, `Table ${tbl} exists`);
        }

        // 4. Required Indexes
        const requiredIndexes = ['idx_users_username_normalized', 'idx_users_email_normalized', 'idx_sessions_user_id', 'idx_support_tickets_status', 'idx_ticket_messages_ticket_id'];
        for (const idx of requiredIndexes) {
            const exists = await dbAsync.get("SELECT name FROM sqlite_master WHERE type='index' AND name=?", [idx]);
            check(!!exists, `Index ${idx} exists`);
        }

        // 5. Username Matrix Tests
        await dbAsync.run('BEGIN TRANSACTION');
        try {
            const id1 = uuidv4();
            const u1 = 'user123';
            const u1Norm = normalize(u1);
            
            await dbAsync.run(
                'INSERT INTO users (id, email, email_normalized, username, username_normalized, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
                [id1, 'u1@test.com', 'u1@test.com', u1, u1Norm, 'hash']
            );
            check(true, 'Inserted original user123');

            // Attempt duplicate case variants
            const duplicates = ['User123', 'USER123', 'UsEr123'];
            for (const dup of duplicates) {
                let errThrown = false;
                try {
                    await dbAsync.run(
                        'INSERT INTO users (id, email, email_normalized, username, username_normalized, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
                        [uuidv4(), `${dup}@test.com`, normalize(`${dup}@test.com`), dup, normalize(dup), 'hash']
                    );
                } catch (e) {
                    errThrown = true;
                }
                check(errThrown, `Duplicate case variant ${dup} was rejected`);
            }

            // Attempt similar but distinct
            const similars = ['user1234', 'user123x'];
            for (const sim of similars) {
                let errThrown = false;
                try {
                    await dbAsync.run(
                        'INSERT INTO users (id, email, email_normalized, username, username_normalized, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
                        [uuidv4(), `${sim}@test.com`, normalize(`${sim}@test.com`), sim, normalize(sim), 'hash']
                    );
                } catch (e) {
                    errThrown = true;
                }
                check(!errThrown, `Distinct similar variant ${sim} was accepted`);
            }

            // Test owner reservation logic (API level, but let's test manually)
            const ownerVariants = ['Sufiyan_memon17', 'sufiyan_memon17', 'SUFIYAN_MEMON17'];
            for (const owner of ownerVariants) {
                const norm = normalize(owner);
                check(norm.includes('sufiyan') && norm.includes('memon'), `Owner variant ${owner} is detectable for reservation`);
            }

            // 6. Support / Ticket Tests
            const tId = uuidv4();
            await dbAsync.run(
                'INSERT INTO support_tickets (id, user_id, subject, category, message, status) VALUES (?, ?, ?, ?, ?, ?)',
                [tId, id1, 'Test Subject', 'WEBSITE_ISSUE', 'Test Message', 'OPEN']
            );
            check(true, 'Support ticket created');
            
            const mId = uuidv4();
            await dbAsync.run(
                'INSERT INTO ticket_messages (id, ticket_id, sender_user_id, message, is_internal_note) VALUES (?, ?, ?, ?, ?)',
                [mId, tId, id1, 'Test Reply', 0]
            );
            check(true, 'Ticket message added');

            const ticket = await dbAsync.get('SELECT * FROM support_tickets WHERE id = ?', [tId]);
            check(ticket.status === 'OPEN', 'Ticket status persists');

        } finally {
            await dbAsync.run('ROLLBACK');
        }

    } catch (e) {
        console.error('Validation crashed:', e);
        failed++;
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
}

testDatabase();

