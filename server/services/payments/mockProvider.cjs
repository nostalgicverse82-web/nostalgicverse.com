/**
 * NostalgicVerse — Phase 18 Mock Sandbox Payment Provider
 * =========================================================
 * Fully deterministic offline sandbox provider for test environments,
 * local automated verification, and secure CI pipelines.
 * Never connects to live financial rails or transmits bank card data.
 */

'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { PaymentProvider } = require('./paymentProvider.cjs');

class MockPaymentProvider extends PaymentProvider {
    constructor() {
        super('mock');
        this.signingSecret = process.env.MOCK_WEBHOOK_SECRET || 'nv-mock-webhook-secret-2026';
    }

    async createPaymentIntent({ amountMinorUnits, currency = 'INR', customerId, metadata = {}, idempotencyKey }) {
        if (typeof amountMinorUnits !== 'number' || amountMinorUnits <= 0) {
            throw new Error(`Invalid payment amount: ${amountMinorUnits}. Must be a positive integer minor unit.`);
        }

        // Test failure trigger token: amounts ending in 99999 trigger simulated payment decline
        if (amountMinorUnits === 99999) {
            throw new Error('Simulated sandbox card decline (test token 99999)');
        }

        const providerPaymentId = `mock_sess_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
        const providerOrderId = `mock_ord_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

        return {
            id: providerPaymentId,
            provider: 'mock',
            providerPaymentId,
            providerOrderId,
            amountMinorUnits,
            currency: currency.toUpperCase(),
            status: 'PENDING',
            clientSecret: `mock_secret_${providerPaymentId}`,
            checkoutUrl: `/checkout/mock?pi=${providerPaymentId}`,
            metadata
        };
    }

    async createCheckoutSession(args) {
        return this.createPaymentIntent(args);
    }

    verifyWebhookSignature(rawPayload, signatureHeader, secret = this.signingSecret) {
        if (!signatureHeader || !rawPayload) return false;
        try {
            const payloadStr = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);
            const expectedSig = crypto
                .createHmac('sha256', secret)
                .update(payloadStr)
                .digest('hex');

            return crypto.timingSafeEqual(Buffer.from(signatureHeader, 'hex'), Buffer.from(expectedSig, 'hex'));
        } catch (_) {
            return false;
        }
    }

    generateTestSignature(payload, secret = this.signingSecret) {
        const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
        return crypto
            .createHmac('sha256', secret)
            .update(payloadStr)
            .digest('hex');
    }

    parseWebhookEvent(rawPayload) {
        const data = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
        return {
            eventId: data.id || `evt_mock_${uuidv4().slice(0, 8)}`,
            eventType: data.type || 'payment.succeeded',
            providerPaymentId: data.payment_id || (data.data && data.data.id) || null,
            providerOrderId: data.order_id || null,
            amountMinorUnits: data.amount || (data.data && data.data.amount) || 0,
            currency: (data.currency || 'INR').toUpperCase(),
            status: data.status || 'PAID',
            metadata: data.metadata || (data.data && data.data.metadata) || {}
        };
    }

    async refundPayment(providerPaymentId, amountMinorUnits, reason = 'Customer requested refund') {
        return {
            success: true,
            refundId: `mock_ref_${uuidv4().slice(0, 12)}`,
            providerPaymentId,
            amountMinorUnits,
            status: 'REFUNDED',
            reason
        };
    }

    async cancelSubscription(providerSubscriptionId) {
        return {
            success: true,
            providerSubscriptionId,
            status: 'CANCELLED',
            cancelledAt: new Date().toISOString()
        };
    }

    async getHealth() {
        return {
            healthy: true,
            provider: 'mock',
            mode: 'sandbox',
            message: 'Mock sandbox provider online and deterministic'
        };
    }
}

module.exports = { MockPaymentProvider };
