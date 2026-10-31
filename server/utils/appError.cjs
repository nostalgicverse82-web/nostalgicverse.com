/**
 * NostalgicVerse — Standardized Structured Error System (Section 32)
 * ==================================================================
 * Replaces generic failures with structured, machine-parseable and human-readable errors.
 */

'use strict';

class AppError extends Error {
    constructor(message, {
        code = 'INTERNAL_ERROR',
        subsystem = 'CORE',
        statusCode = 500,
        recoverable = false,
        details = null
    } = {}) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.subsystem = subsystem;
        this.statusCode = statusCode;
        this.recoverable = recoverable;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Format a structured error JSON response
 */
function formatErrorResponse(err, defaultSubsystem = 'API', req = null) {
    const isAppError = err instanceof AppError;
    const statusCode = err.statusCode || (err.status && Number.isInteger(err.status) ? err.status : 500);
    const code = isAppError ? err.code : (err.code || 'INTERNAL_ERROR');
    const subsystem = isAppError ? err.subsystem : (err.subsystem || defaultSubsystem);
    const recoverable = isAppError ? err.recoverable : false;
    const requestId = req?.headers?.['x-request-id'] || req?.id || null;

    return {
        statusCode,
        body: {
            success: false,
            error: {
                code,
                message: err.message || 'An unexpected internal error occurred.',
                subsystem,
                requestId,
                timestamp: new Date().toISOString(),
                recoverable,
                details: process.env.NODE_ENV === 'development' ? err.details || err.stack : undefined
            }
        }
    };
}

module.exports = {
    AppError,
    formatErrorResponse
};
