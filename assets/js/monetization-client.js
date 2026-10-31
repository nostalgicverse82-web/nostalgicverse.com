/**
 * NostalgicVerse — Client Monetization & Ethical Ad Engine (Phase 18)
 * =================================================================
 * - Non-intrusive, museum-aesthetic ethical ad slot rendering.
 * - Suppresses immediately if user is a supporter or if ads are disabled.
 * - Ad-block graceful: zero error throws, zero broken images, zero layout shifts.
 * - Client-side helpers for checkout and voluntary donations.
 */

(function () {
    'use strict';

    const MonetizationClient = {
        async initAds() {
            const adSlots = document.querySelectorAll('.nv-ethical-ad');
            if (!adSlots || adSlots.length === 0) return;

            adSlots.forEach(async (slotEl) => {
                const slotId = slotEl.getAttribute('data-slot') || 'slot-home-strip';
                try {
                    const res = await fetch(`/api/business/ads?slot=${encodeURIComponent(slotId)}`, {
                        credentials: 'same-origin'
                    });
                    if (!res.ok) {
                        slotEl.style.display = 'none';
                        return;
                    }
                    const data = await res.json();
                    if (!data.ad || data.suppressed) {
                        slotEl.style.display = 'none';
                        return;
                    }

                    this.renderAd(slotEl, data.ad);
                } catch (e) {
                    // Fail silently and hide container to preserve page aesthetic
                    slotEl.style.display = 'none';
                }
            });
        },

        renderAd(container, ad) {
            container.innerHTML = `
                <div class="nv-ad-box" style="background:#111118; border:1px solid #1E1E2C; border-radius:6px; padding:12px 16px; margin:20px 0; display:flex; align-items:center; justify-content:space-between; gap:16px;">
                    <div style="display:flex; align-items:center; gap:12px; flex:1;">
                        ${ad.image_url ? `<img src="${ad.image_url}" alt="" style="width:44px; height:44px; border-radius:4px; object-fit:cover; border:1px solid #2A2A38;">` : ''}
                        <div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-family:ui-monospace, monospace; font-size:0.68rem; text-transform:uppercase; color:#FFB300; background:rgba(255,179,0,0.1); padding:2px 6px; border-radius:3px;">Preservation Sponsor</span>
                                <span style="font-size:0.92rem; font-weight:700; color:#F4F4F7;">${this.escapeHtml(ad.title)}</span>
                            </div>
                            <p style="margin:4px 0 0 0; font-size:0.82rem; color:#A7A7B5; line-height:1.4;">${this.escapeHtml(ad.copy_text || '')}</p>
                        </div>
                    </div>
                    ${ad.destination_url ? `
                        <a href="${this.escapeHtml(ad.destination_url)}" target="_blank" rel="noopener noreferrer sponsored" class="nv-ad-cta" data-adid="${ad.id}" style="font-family:ui-monospace, monospace; font-size:0.78rem; font-weight:700; color:#000; background:#00E5FF; padding:8px 16px; border-radius:4px; text-decoration:none; white-space:nowrap; transition:opacity 0.2s;">
                            Visit Partner &rarr;
                        </a>
                    ` : ''}
                </div>
            `;
            container.style.display = 'block';

            // Record impression
            fetch('/api/business/ads/impression', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adId: ad.id })
            }).catch(() => {});

            // Record click
            const cta = container.querySelector('.nv-ad-cta');
            if (cta) {
                cta.addEventListener('click', () => {
                    fetch('/api/business/ads/click', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ adId: ad.id })
                    }).catch(() => {});
                });
            }
        },

        async startCheckout(planId, interval = 'MONTHLY') {
            const res = await fetch('/api/business/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planId,
                    interval,
                    returnUrl: window.location.origin + '/membership/?success=1',
                    cancelUrl: window.location.origin + '/membership/?canceled=1'
                })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to start checkout session');
            }
            if (data.session && data.session.checkoutUrl) {
                window.location.href = data.session.checkoutUrl;
            }
            return data;
        },

        async submitDonation(donationData) {
            const res = await fetch('/api/business/donations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...donationData,
                    returnUrl: window.location.origin + '/donate/?thankyou=1',
                    cancelUrl: window.location.origin + '/donate/?canceled=1'
                })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to process voluntary donation');
            }
            if (data.session && data.session.checkoutUrl) {
                window.location.href = data.session.checkoutUrl;
            }
            return data;
        },

        escapeHtml(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
    };

    // Auto-initialize ethical ads when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => MonetizationClient.initAds());
    } else {
        MonetizationClient.initAds();
    }

    window.MonetizationClient = MonetizationClient;
})();
