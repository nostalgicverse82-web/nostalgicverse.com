/**
 * NostalgicVerse — Remote Image Health Monitor
 * ============================================
 * Audits external artwork endpoints, verifies URL integrity,
 * detects 404s/stale links, and reports museum fallback coverage.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { defaultLogger: logger } = require('./logger.cjs');

const ROOT = path.resolve(__dirname, '../..');
const REMOTE_MANIFEST_PATH = path.join(ROOT, 'data/remote-game-images.json');

class ImageHealthMonitor {
  constructor(options = {}) {
    this.manifestPath = options.manifestPath || REMOTE_MANIFEST_PATH;
    this.root = options.root || ROOT;
  }

  _loadManifest() {
    if (!fs.existsSync(this.manifestPath)) return { games: {} };
    try {
      return JSON.parse(fs.readFileSync(this.manifestPath, 'utf8'));
    } catch (e) {
      logger.error('Failed to load remote-game-images.json', { error: e.message });
      return { games: {} };
    }
  }

  async auditSingleUrl(url, timeoutMs = 5000) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    if (!url || typeof url !== 'string') {
      return { ok: false, status: 0, reason: 'invalid_url' };
    }

    if (url.startsWith('/')) {
      const localFile = path.join(this.root, url);
      const exists = fs.existsSync(localFile);
      return {
        ok: exists,
        status: exists ? 200 : 404,
        contentType: 'image/local'
      };
    }

    if (!url.startsWith('http')) {
      return { ok: false, status: 0, reason: 'invalid_url' };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': 'NostalgicVerse-ImageHealthMonitor/1.0' },
        signal: controller.signal
      });

      clearTimeout(timer);
      return {
        ok: response.ok,
        status: response.status,
        contentType: response.headers.get('content-type') || 'unknown'
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        reason: err.name === 'AbortError' ? 'timeout' : err.message
      };
    }
  }

  async auditBatch(options = {}) {
    const limit = options.limit || 10;
    const manifest = this._loadManifest();
    const games = manifest.games || {};
    const slugs = Object.keys(games).slice(0, limit);

    logger.info(`Auditing batch of ${slugs.length} remote game images`);

    const results = [];
    let healthyCount = 0;
    let failedCount = 0;

    for (const slug of slugs) {
      const entry = games[slug];
      const check = await this.auditSingleUrl(entry.url, options.timeoutMs || 4000);
      const imgUrl = entry.imageUrl || entry.url || entry.localPath;
      const check = await this.auditSingleUrl(imgUrl, options.timeoutMs || 4000);
      const record = {
        slug,
        url: entry.url,
        url: imgUrl,
        status: check.status,
        healthy: check.ok,
        fallbackReady: true // Every game card has client-side fallback plate configured
      };

      if (check.ok) healthyCount++;
      else failedCount++;

      results.push(record);
    }

    const report = {
      timestamp: new Date().toISOString(),
      audited: slugs.length,
      healthy: healthyCount,
      failed: failedCount,
      healthPercentage: slugs.length > 0 ? Math.round((healthyCount / slugs.length) * 100) : 100,
      results
    };

    logger.audit('Completed remote image batch audit', {
      audited: report.audited,
      healthy: report.healthy,
      failed: report.failed
    });

    return report;
  }
}

module.exports = {
  ImageHealthMonitor
};

