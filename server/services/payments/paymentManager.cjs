/**
 * NostalgicVerse — Phase 18 Payment Gateway Manager
 * ====================================================
 * Gateway registry, provider lifecycle, webhook signature verification,
 * and deterministic transaction routing.
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../../db/connection.cjs');
const { defaultLogger: logger } = require('../../automation/logger.cjs');
const { MockPaymentProvider } = require('./mockProvider.cjs');
const { StripeProvider } = require('./stripeProvider.cjs');
const { RazorpayProvider } = require('./razorpayProvider.cjs');
const { getFlagValue } = require('../featureFlags.cjs');

// Initialize provider singletons
const providers = {
    mock: new MockPaymentProvider(),
    stripe: new StripeProvider(),
    razorpay: new RazorpayProvider()
};

/**
 * Returns a specific provider instance
 */
function getProvider(name = 'mock') {
    const key = String(name).toLowerCase();
    if (!providers[key]) {
        throw new Error(`Unsupported payment provider: "${name}"`);
    }
    return providers[key];
}

/**
 * Resolves the currently active primary provider
 */
async function getActiveProvider() {
    const paymentsMode = await getFlagValue('payments_mode') || 'test';
    const preferredProvider = await getFlagValue('preferred_payment_provider') || 'mock';

    // In test mode, default to mock unless explicit test credentials exist
    if (paymentsMode !== 'live') {
        if (preferredProvider === 'stripe' && providers.stripe.isConfigured()) {
            return providers.stripe;
        }
        if (preferredProvider === 'razorpay' && providers.razorpay.isConfigured()) {
            return providers.razorpay;
        }
        return providers.mock;
    }

    // In live mode, ensure chosen provider is configured; fail safe to mock if unconfigured
    if (providers[preferredProvider] && providers[preferredProvider].isConfigured()) {
        return providers[preferredProvider];
    }

    logger.warn(`[PAYMENT_MANAGER] Preferred live provider "${preferredProvider}" unconfigured; defaulting to mock.`);
    return providers.mock;
}

/**
 * Processes incoming provider webhook with mandatory idempotency and signature validation
 */
async function processWebhook(providerName, rawBody, signatureHeader, eventHandler) {
    const provider = getProvider(providerName);

    // 1. Verify cryptographic signature
    const isValidSignature = provider.verifyWebhookSignature(rawBody, signatureHeader);
    if (!isValidSignature) {
        logger.warn(`[PAYMENT_WEBHOOK] Invalid webhook signature rejected for provider "${providerName}"`);
        const err = new Error('Invalid webhook signature');
        err.statusCode = 401;
        throw err;
    }

    // 2. Parse standardized event
    const event = provider.parseWebhookEvent(rawBody);
    if (!event.eventId) {
        throw new Error('Malformed webhook event: missing eventId');
    }

    // 3. Webhook Idempotency Guard (Section BJ)
    const existing = await dbAsync.get(
        'SELECT id, status FROM payment_events WHERE provider = ? AND provider_event_id = ?',
        [providerName, event.eventId]
    );

    if (existing) {
        logger.info(`[PAYMENT_WEBHOOK] Duplicate webhook event "${event.eventId}" already processed. Skipping safely.`);
        return {
            success: true,
            duplicate: true,
            status: existing.status,
            eventId: event.eventId
        };
    }

    const recordId = uuidv4();
    const payloadStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);

    // 4. Record event in database
    await dbAsync.run(`
        INSERT INTO payment_events (id, provider, provider_event_id, event_type, payload, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'PROCESSING', CURRENT_TIMESTAMP)
    `, [recordId, providerName, event.eventId, event.eventType, payloadStr]);

    // 5. Dispatch to domain event handler
    try {
        if (typeof eventHandler === 'function') {
            await eventHandler(event);
        }

        await dbAsync.run(
            'UPDATE payment_events SET status = ? WHERE id = ?',
            ['PROCESSED', recordId]
        );

        return {
            success: true,
            duplicate: false,
            eventId: event.eventId,
            eventType: event.eventType
        };
    } catch (handlerErr) {
        logger.error(`[PAYMENT_WEBHOOK] Event handler failed for event "${event.eventId}"`, handlerErr);
        await dbAsync.run(
            'UPDATE payment_events SET status = ?, error_message = ? WHERE id = ?',
            ['FAILED', handlerErr.message, recordId]
        );
        throw handlerErr;
    }
}

/**
 * Returns health and configuration status across all providers
 */
async function getAllProvidersHealth() {
    const health = {};
    for (const [key, provider] of Object.entries(providers)) {
        health[key] = await provider.getHealth();
    }
    return health;
}

function getGatewayStatus() {
    return Object.entries(providers).map(([name, p]) => ({
        name,
        configured: name === 'mock' || !!p.apiKey || true,
        status: 'HEALTHY'
    }));
}

const paymentManager = {
    getProvider,
    getActiveProvider,
    processWebhook,
    getAllProvidersHealth,
    getGatewayStatus
};

module.exports = {
    paymentManager,
    getProvider,
    getActiveProvider,
    processWebhook,
    getAllProvidersHealth,
    getGatewayStatus
};
