const { dbAsync } = require('../../server/db/connection.cjs');
const { createSession } = require('../../server/services/authService.cjs');

async function testAIChatFlow() {
    console.log('--- Testing Complete AI Chat Request Flow ---');

    // 1. Get Owner
    const owner = await dbAsync.get("SELECT id, username FROM users WHERE role = 'OWNER'");
    if (!owner) throw new Error('No Owner found');
    console.log(`Authenticated as Owner: ${owner.username} (${owner.id})`);

    // 2. Create Session
    const { token } = await createSession(owner.id);

    // 3. Send AI Chat Command
    console.log('\nSending prompt to POST /api/owner/ai/chat ...');
    const prompt = 'Hello! Please summarize the NostalgicVerse project in one sentence.';
    const res = await fetch('http://localhost:3000/api/owner/ai/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-session-token': token
        },
        body: JSON.stringify({
            prompt,
            model: 'gemini-3.1-flash-lite',
            provider: 'GOOGLE',
            mode: 'plan_approve'
        })
    });

    console.log(`HTTP Status: ${res.status}`);
    const data = await res.json();
    console.log('\nResponse Data:');
    console.dir(data, { depth: 5 });

    if (!data.success) {
        throw new Error('AI Chat returned error: ' + (data.error || 'Unknown error'));
    }

    // 4. Verify ai_jobs record
    console.log('\n--- Verifying ai_jobs record created ---');
    const job = await dbAsync.get('SELECT * FROM ai_jobs ORDER BY created_at DESC LIMIT 1');
    console.log('Latest ai_jobs record:');
    console.log(`  - ID: ${job.id}`);
    console.log(`  - Job Type: ${job.job_type}`);
    console.log(`  - Status: ${job.status}`);
    console.log(`  - Provider: ${job.provider}`);
    console.log(`  - Model: ${job.model}`);
    console.log(`  - Prompt: "${job.prompt}"`);
    console.log(`  - Execution Mode: ${job.execution_mode}`);
    console.log(`  - Metadata: ${job.metadata}`);

    // 5. Verify conversation message
    console.log('\n--- Verifying ai_conversation_messages ---');
    const msgs = await dbAsync.all(
        'SELECT id, role, content, tokens_used, cost_estimate FROM ai_conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC',
        [data.conversationId]
    );
    for (const m of msgs) {
        console.log(`  [${m.role.toUpperCase()}] ${m.content.slice(0, 100)}... (tokens: ${m.tokens_used})`);
    }

    // 6. Verify frontend endpoint GET /api/owner/ai/conversations/:id
    console.log('\n--- Verifying GET /api/owner/ai/conversations/:id endpoint ---');
    const convRes = await fetch(`http://localhost:3000/api/owner/ai/conversations/${data.conversationId}`, {
        headers: { 'x-session-token': token }
    });
    const convData = await convRes.json();
    console.log(`Fetch Status: ${convRes.status}`);
    console.log(`Fetched messages count: ${convData.messages?.length}`);
    const lastMsg = convData.messages?.[convData.messages.length - 1];
    console.log(`Assistant Message Received: "${lastMsg?.content}"`);

    if (lastMsg?.role !== 'assistant' || !lastMsg?.content) {
        throw new Error('Frontend would not receive assistant message!');
    }

    console.log('\n========================================');
    console.log('SUCCESS: AI CHAT COMPLETED END-TO-END!');
    console.log('========================================');
}

testAIChatFlow().then(() => {
    // allow clean shutdown
    setTimeout(() => process.exit(0), 100);
}).catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
