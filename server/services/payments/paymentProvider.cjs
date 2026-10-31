/**
 * NostalgicVerse — Phase 18 Payment Provider Interface
 * ======================================================
 * Abstract base class standardizing billing operations across
 * mock/sandbox, Stripe, Razorpay, and future compliant providers.
 */

'use strict';

class PaymentProvider {
    constructor(name) {
        if (new.target === PaymentProvider) {
            throw new TypeError('Cannot construct PaymentProvider abstract instances directly.');
        }
        this.name = name;
    }

    /**
     * Initializes a checkout session or payment intent
     * @param {Object} opts - { amountMinorUnits, currency, customerId, metadata, idempotencyKey }
     * @returns {Promise<Object>} - { providerPaymentId, clientSecret, checkoutUrl, status }
     */
    async createPaymentIntent(opts) {
        throw new Error('createPaymentIntent must be implemented by payment provider.');
    }

    /**
     * Verifies the cryptographic webhook signature from the payment gateway
     * @param {string|Buffer} rawPayload - Raw incoming request body
     * @param {string} signatureHeader - Signature from header
     * @param {string} secret - Signing secret
     * @returns {boolean} - true if signature is authentic
     */
    verifyWebhookSignature(rawPayload, signatureHeader, secret) {
        throw new Error('verifyWebhookSignature must be implemented by payment provider.');
    }

    /**
     * Parses and normalizes webhook event payload into standard internal structure
     * @param {Object|string} rawPayload
     * @returns {Object} - { eventId, eventType, paymentId, orderId, amountMinorUnits, currency, status, metadata }
     */
    parseWebhookEvent(rawPayload) {
        throw new Error('parseWebhookEvent must be implemented by payment provider.');
    }

    /**
     * Executes a refund for a previously captured transaction
     * @param {string} providerPaymentId
     * @param {number} amountMinorUnits
     * @param {string} reason
     * @returns {Promise<Object>} - { success, refundId, status }
     */
    async refundPayment(providerPaymentId, amountMinorUnits, reason) {
        throw new Error('refundPayment must be implemented by payment provider.');
    }

    /**
     * Cancels an active recurring subscription at provider level
     * @param {string} providerSubscriptionId
     * @returns {Promise<Object>} - { success, status }
     */
    async cancelSubscription(providerSubscriptionId) {
        throw new Error('cancelSubscription must be implemented by payment provider.');
    }

    /**
     * Health check verifying provider readiness and credentials validity
     * @returns {Promise<Object>} - { healthy: boolean, provider: string, mode: 'test'|'live', message: string }
     */
    async getHealth() {
        return {
            healthy: true,
            provider: this.name,
            mode: 'test',
            message: 'Provider interface operational'
        };
    }
}

module.exports = { PaymentProvider };
