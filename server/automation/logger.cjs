/**
 * NostalgicVerse — Structured Server & Automation Logger
 * =======================================================
 * Production-ready structured logger with severity levels,
 * timestamping, and audit event tracking.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  AUDIT: 2,
  WARN: 3,
  ERROR: 4
};

class Logger {
  constructor(options = {}) {
    this.minLevel = LOG_LEVELS[options.level || 'INFO'] ?? LOG_LEVELS.INFO;
    this.logFile = options.logFile || null;
    this.serviceName = options.serviceName || 'nostalgicverse-server';
  }

  _format(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      service: this.serviceName,
      level,
      message,
      ...meta
    };
  }

  _output(level, message, meta = {}) {
    meta = meta || {};
    if (LOG_LEVELS[level] < this.minLevel) return;

    const payload = this._format(level, message, meta);
    const jsonStr = JSON.stringify(payload);

    if (level === 'ERROR') {
      console.error(`[${payload.timestamp}] [${level}] ${message}`, Object.keys(meta).length ? meta : '');
    } else if (level === 'WARN') {
      console.warn(`[${payload.timestamp}] [${level}] ${message}`, Object.keys(meta).length ? meta : '');
    } else {
      console.log(`[${payload.timestamp}] [${level}] ${message}`, Object.keys(meta).length ? meta : '');
    }

    if (this.logFile) {
      try {
        fs.appendFileSync(this.logFile, jsonStr + '\n', 'utf8');
      } catch (err) {
        console.error('Failed to append to log file:', err.message);
      }
    }

    return payload;
  }

  debug(msg, meta) { return this._output('DEBUG', msg, meta); }
  info(msg, meta) { return this._output('INFO', msg, meta); }
  audit(action, meta) { return this._output('AUDIT', `AUDIT: ${action}`, meta); }
  warn(msg, meta) { return this._output('WARN', msg, meta); }
  error(msg, meta) { return this._output('ERROR', msg, meta); }
}

const defaultLogger = new Logger();

module.exports = {
  Logger,
  defaultLogger,
  LOG_LEVELS
};
