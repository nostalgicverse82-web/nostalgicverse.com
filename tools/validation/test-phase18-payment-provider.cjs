#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 18 Test Suite 4: Payment Provider Abstraction & Webhook Idempotency
 */

'use strict';

const { paymentManager } = require('../../server/services/payments/paymentManager.cjs');
const { PaymentProvider } = require('../../server/services/payments/paymentProvider.cjs');
const { dbAsync } = require('../../server/db/connection.cjs');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  [PASS] ${message}`);
        passed++;
    } else {
        console.error(`  [FAIL] ${message}`);
        failed++;
    }
}

async function run() {
    console.log('======================================================================');
    console.log('TEST SUITE 4: Phase 18 Payment Provider Abstraction & Webhooks');
    console.log('======================================================================\n');

    // 1. PaymentProvider Interface Conformance
    console.log('--- Test 1: PaymentProvider Abstract Class Interface ---');
    let threwDirect = false;
    try {
        new PaymentProvider('test');
    } catch (e) {
        threwDirect = true;
    }
    assert(threwDirect, 'Direct instantiation of abstract PaymentProvider throws error');

    class ConcreteTestProvider extends PaymentProvider {
        constructor() { super('test-provider'); }
    }
    const baseProvider = new ConcreteTestProvider();
    assert(baseProvider.name === 'test-provider', 'Subclass provider name initialized');

    let threwAbstract = false;
    try {
        await baseProvider.createPaymentIntent({});
    } catch (e) {
        threwAbstract = true;
    }
    assert(threwAbstract, 'Unimplemented abstract method throws exception');

    // 2. Gateway Status & Registered Providers
    console.log('\n--- Test 2: PaymentManager Gateway Status ---');
    const gateways = paymentManager.getGatewayStatus();
    assert(Array.isArray(gateways), 'Gateway status returned as list');
    const mockGw = gateways.find(g => g.name === 'mock');
    assert(mockGw && mockGw.configured === true, 'Mock sandbox provider is configured and available');

    const providerInstance = paymentManager.getProvider('mock');
    assert(providerInstance && typeof providerInstance.createCheckoutSession === 'function', 'Mock provider retrieved');

    // 3. Creating Checkout Session via Sandbox Provider
    console.log('\n--- Test 3: Sandbox Checkout Session Creation ---');
    const session = await providerInstance.createCheckoutSession({
        amountMinorUnits: 399,
        currency: 'USD',
        planId: 'plan-supporter',
        userId: 'test-user-provider',
        userEmail: 'supporter@example.com',
        returnUrl: 'https://nostalgicverse.com/membership/?success=1',
        cancelUrl: 'https://nostalgicverse.com/membership/?canceled=1'
    });

    assert(session && session.id.startsWith('mock_sess_'), 'Mock session ID generated');
    assert(session.amountMinorUnits === 399, 'Amount minor units preserved');
    assert(session.checkoutUrl.includes(session.id), 'Checkout URL contains session ID');

    // 4. Webhook Ingestion & Signature Verification
    console.log('\n--- Test 4: Webhook Processing & Verification ---');
    const testEventId = 'mock_evt_' + Date.now();
    const webhookPayload = {
        id: testEventId,
        type: 'checkout.session.completed',
        data: {
            id: session.id,
            amountMinorUnits: 399,
            currency: 'USD',
            paymentId: 'pay-test-123',
            metadata: {
                paymentId: 'pay-test-123',
                userId: 'test-user-provider'
            }
        }
    };

    // First attempt: should succeed and record payment_events entry
    const sig = providerInstance.generateTestSignature(webhookPayload);
    const result1 = await paymentManager.processWebhook('mock', webhookPayload, sig);
    assert(result1.success === true, 'Webhook successfully ingested');
    assert(result1.eventId === testEventId, 'Event ID matches payload');

    // Verify stored in payment_events table
    const storedEvent = await dbAsync.get('SELECT * FROM payment_events WHERE provider_event_id = ?', [testEventId]);
    assert(storedEvent && storedEvent.provider === 'mock', 'Event stored in payment_events table');

    // 5. Webhook Idempotency (Prevent Duplicate Replays)
    console.log('\n--- Test 5: Webhook Idempotency Guard ---');
    const result2 = await paymentManager.processWebhook('mock', webhookPayload, sig);
    assert(result2.success === true, 'Second webhook acknowledged HTTP 200');
    assert(result2.duplicate === true, 'Second identical webhook identified as duplicate');

    // 6. Test Error Handling & Fail Triggers
    console.log('\n--- Test 6: Simulated Payment Failures in Sandbox ---');
    let failThrew = false;
    try {
        await providerInstance.createCheckoutSession({
            amountMinorUnits: 99999, // Trigger amount configured in mock provider
            currency: 'USD',
            returnUrl: 'https://nostalgicverse.com/',
            cancelUrl: 'https://nostalgicverse.com/'
        });
    } catch (e) {
        failThrew = true;
    }
    assert(failThrew, 'Simulated failure trigger (amount 99999) throws appropriate error');

    // Cleanup
    await dbAsync.run('DELETE FROM payment_events WHERE provider_event_id = ?', [testEventId]);

    console.log(`\nPayment Provider Results: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
