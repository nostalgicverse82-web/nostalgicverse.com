# Phase 18: Payment Provider Abstraction Layer

## 1. Overview & Provider Strategy

To support global museum patrons while maintaining platform independence, NostalgicVerse utilizes an extensible **Provider Abstraction Layer** located in `server/services/payments/`.

This abstraction allows NostalgicVerse to switch between payment gateways (Stripe, Razorpay, or Mock Sandbox) without changing a single line of business logic, checkout routing, or database schema.

---

## 2. The Abstract Interface (`PaymentProvider`)

Located in `server/services/payments/providerInterface.cjs`, the base class enforces standard method contracts across all payment implementations:

```javascript
class PaymentProvider {
    constructor(name) {
        this.name = name;
    }

    // Creates hosted checkout session for memberships or one-time transactions
    async createCheckoutSession({ userId, userEmail, plan, amountMinorUnits, currency, successUrl, cancelUrl, idempotencyKey, metadata }) {
        throw new Error('Not implemented');
    }

    // Creates payment intent for direct or client-side elements
    async createPaymentIntent({ amountMinorUnits, currency, customerId, idempotencyKey, metadata }) {
        throw new Error('Not implemented');
    }

    // Verifies cryptographic webhook signature (HMAC-SHA256)
    async verifyWebhookSignature(payload, signature, secret) {
        throw new Error('Not implemented');
    }

    // Cancels active gateway subscription
    async cancelSubscription(providerSubscriptionId) {
        throw new Error('Not implemented');
    }

    // Refunds a completed transaction
    async refundPayment(providerPaymentId, amountMinorUnits, reason) {
        throw new Error('Not implemented');
    }

    // Performs provider diagnostic health check
    async checkHealth() {
        return { ok: true, provider: this.name, mode: 'healthy' };
    }
}
```

---

## 3. Concrete Implementations

### 1. `MockPaymentProvider` (`mockProvider.cjs`)
- **Default Mode**: Used during local development, CI testing, and automated test execution.
- **Zero External Dependencies**: Operates completely offline without external network calls or private API credentials.
- **Deterministic Sandbox**: Generates mock checkout sessions (`session_mock_<id>`), payment intents (`pi_mock_<id>`), and simulated webhook events.
- **Self-Fulfillment**: Includes a `/test-fulfill` helper to simulate successful payment callbacks in testing environments.

### 2. `StripeProvider` (`stripeProvider.cjs`)
- **Global Patron Support**: Supports international credit/debit cards, Apple Pay, Google Pay, and SEPA.
- **Stripe Checkout Sessions**: Creates hosted checkout sessions with recurring subscription parameters (`mode: 'subscription'`).
- **Cryptographic Signature Verification**: Validates `stripe-signature` headers against `STRIPE_WEBHOOK_SECRET` using standard Stripe SDK methods.
- **Customer Portal**: Prepares links for patrons to self-manage payment cards and renewals.

### 3. `RazorpayProvider` (`razorpayProvider.cjs`)
- **Domestic (India) Patron Support**: Native support for UPI, RuPay cards, and Netbanking.
- **Orders API**: Creates server-side Razorpay orders for one-time donations.
- **Subscription Plans**: Integrates with Razorpay Subscriptions API for recurring museum tiers.
- **Signature Verification**: Validates `x-razorpay-signature` using HMAC-SHA256 digests over `razorpay_order_id + '|' + razorpay_payment_id`.

---

## 4. Gateway Registry & Payment Manager (`paymentManager.cjs`)

The `paymentManager.cjs` service acts as the central router and health monitor:

1. **Provider Resolution**:
   Resolves active provider based on `PAYMENT_PROVIDER_MODE` environment configuration (`mock`, `stripe`, or `razorpay`), defaulting to `mock` if credentials are not configured.
2. **Provider Health Monitoring**:
   Provides `getProvidersHealth()` for the Owner Command Center, verifying connectivity and credentials for each configured gateway.
3. **Webhook Dispatcher & Idempotency**:
   Receives webhook payloads from `/api/payments/webhook/:provider`:
   - Validates webhook signature via active provider.
   - Checks `payment_events` for existing `provider_event_id`. If already processed, returns HTTP `200 OK` with `{ status: 'already_processed' }`.
   - Dispatches events (`checkout.session.completed`, `payment_intent.succeeded`, `subscription.cancelled`) to `monetizationService`.
   - Inserts audit log record in `payment_events` with status `PROCESSED`.
