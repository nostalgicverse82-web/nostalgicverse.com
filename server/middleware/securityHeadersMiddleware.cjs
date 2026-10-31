/**
 * Phase 13 Enterprise Security Headers & Cache-Control Middleware
 * Injects defensive HTTP headers, strict Content-Security-Policy,
 * clickjacking protection, and private API cache prevention.
 */
'use strict';

function securityHeadersMiddleware(req, res, next) {
    // 1. Basic Defensive Headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');

    // 2. Clickjacking / Frame Protection
    const isProtectedArea = req.path.startsWith('/owner') || 
                            req.path.startsWith('/account') || 
                            req.path.startsWith('/api/owner') || 
                            req.path.startsWith('/api/account');
    if (isProtectedArea) {
        res.setHeader('X-Frame-Options', 'DENY');
    } else {
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    }

    // 3. Content Security Policy (Compatible with museum design and WebSocket transport)
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' ws: wss:",
        "font-src 'self' data:",
        "frame-ancestors 'self'",
        "object-src 'none'",
        "base-uri 'self'"
    ].join('; ');
    res.setHeader('Content-Security-Policy', csp);

    // 4. Strict Cache-Control on Private / Authenticated Endpoints
    const isPrivateApi = req.path.startsWith('/api/account') ||
                         req.path.startsWith('/api/chat') ||
                         req.path.startsWith('/api/calls') ||
                         req.path.startsWith('/api/conversations') ||
                         req.path.startsWith('/api/owner') ||
                         req.path.startsWith('/api/support') ||
                         req.path.startsWith('/api/users/notifications') ||
                         req.path.startsWith('/api/users/counts') ||
                         req.path.startsWith('/api/users/friends');

    if (isPrivateApi) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }

    next();
}

module.exports = {
    securityHeadersMiddleware
};

