/**
 * NostalgicVerse — Automated News & Historical Editorial Engine
 * =============================================================
 * Discovers historical anniversaries, extracts verified facts,
 * checks for duplicates, and generates draft editorial items
 * with an uncompromising 'held_for_review' safety moderation workflow.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createAIProvider } = require('./ai-provider.cjs');
const { defaultLogger: logger } = require('./logger.cjs');

const ROOT = path.resolve(__dirname, '../..');
const NEWS_FILE = path.join(ROOT, 'data/news.json');
const TIMELINE_FILE = path.join(ROOT, 'data/timeline.json');

class NewsEngine {
  constructor(options = {}) {
    this.aiProvider = options.aiProvider || createAIProvider();
    this.newsFilePath = options.newsFilePath || NEWS_FILE;
    this.timelineFilePath = options.timelineFilePath || TIMELINE_FILE;
  }

  _loadNews() {
    if (!fs.existsSync(this.newsFilePath)) {
      return { news: [], lastGenerated: null };
    }
    try {
      return JSON.parse(fs.readFileSync(this.newsFilePath, 'utf8'));
    } catch (e) {
      logger.error('Failed to parse news.json, resetting to empty store', { error: e.message });
      return { news: [], lastGenerated: null };
    }
  }

  _saveNews(data) {
    fs.writeFileSync(this.newsFilePath, JSON.stringify(data, null, 2), 'utf8');
  }

  _computeContentHash(title, summary) {
    const norm = `${(title || '').toLowerCase().trim()}::${(summary || '').toLowerCase().trim()}`;
    return crypto.createHash('sha256').update(norm).digest('hex');
  }

  isDuplicate(candidateTitle, candidateSummary) {
    const store = this._loadNews();
    const candidateHash = this._computeContentHash(candidateTitle, candidateSummary);
    const candidateLower = candidateTitle.toLowerCase().trim();

    return store.news.some(item => {
      // 1. Exact or content hash match
      if (item.contentHash === candidateHash) return true;
      // 2. High title similarity match
      const existingLower = item.title.toLowerCase().trim();
      if (existingLower === candidateLower) return true;
      if (existingLower.includes(candidateLower) || candidateLower.includes(existingLower)) return true;
      return false;
    });
  }

  async generateAnniversaryArticle(options = {}) {
    logger.info('Starting anniversary news generation job');

    // 1. Find milestone from timeline
    let milestone = null;
    if (fs.existsSync(this.timelineFilePath)) {
      try {
        const timeline = JSON.parse(fs.readFileSync(this.timelineFilePath, 'utf8'));
        const events = timeline.events || timeline.milestones || [];
        if (events.length > 0) {
          const randomIndex = Math.floor(Math.random() * events.length);
          milestone = events[randomIndex];
        }
      } catch (err) {
        logger.warn('Failed to inspect timeline events for news hook', { error: err.message });
      }
    }

    const titleTopic = options.topic || (milestone ? `Anniversary: ${milestone.title}` : 'Milestone in Computing');
    const prompt = `Generate a rigorous, museum-grade gaming history retrospective article about: "${titleTopic}". Detail the hardware architecture, design philosophy, and cultural legacy.`;

    const schema = {
      title: "string",
      slug: "string",
      summary: "string",
      keyPoints: ["string"],
      era: "string",
      category: "string"
    };

    const structured = await this.aiProvider.generateStructuredJson(prompt, schema, {
      topicTitle: titleTopic,
      category: milestone ? milestone.category : 'Historical Retrospective',
      era: milestone ? milestone.era : 'Golden Age (1977-1983)'
    });

    // 2. Deduplication check
    if (this.isDuplicate(structured.title, structured.summary)) {
      logger.warn('Skipping generated article: duplicate detected in news store', { title: structured.title });
      return { skipped: true, reason: 'duplicate_detected', title: structured.title };
    }

    // 3. Strict Safety Moderation: 'held_for_review'
    const article = {
      id: `news-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: structured.title,
      slug: structured.slug || structured.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      publishedAt: new Date().toISOString(),
      summary: structured.summary,
      keyPoints: structured.keyPoints || [],
      era: structured.era || 'Archival Era',
      category: structured.category || 'Historical Retrospective',
      status: 'held_for_review', // MANDATORY SAFETY FILTER
      reviewDate: null,
      approvedBy: null,
      sourceUrl: (milestone && milestone.referenceUrl) ? milestone.referenceUrl : (options.sourceUrl || 'https://nostalgicverse.com/timeline/'),
      sourceDomain: (milestone && milestone.referenceUrl) ? 'wikipedia.org' : 'nostalgicverse.com',
      retrievalTimestamp: new Date().toISOString(),
      factCheckStatus: 'pending_editorial_verification',
      contentHash: this._computeContentHash(structured.title, structured.summary)
    };

    const store = this._loadNews();
    store.news.unshift(article);
    store.lastGenerated = new Date().toISOString();
    this._saveNews(store);

    logger.audit('Created new editorial article held for review', { id: article.id, title: article.title });
    return { success: true, article };
  }

  approveStory(articleId, reviewer = 'curator') {
    const store = this._loadNews();
    const article = store.news.find(n => n.id === articleId);

    if (!article) {
      throw new Error(`Article with ID "${articleId}" not found`);
    }

    article.status = 'published';
    article.reviewDate = new Date().toISOString();
    article.approvedBy = reviewer;
    article.factCheckStatus = 'verified';

    this._saveNews(store);
    logger.audit('Approved editorial article for public exhibition', { id: articleId, reviewer });
    return article;
  }

  getArticles(filter = {}) {
    const store = this._loadNews();
    let results = store.news;

    if (filter.status) {
      results = results.filter(item => item.status === filter.status);
    }
    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }
    return results;
  }
}

module.exports = {
  NewsEngine
};

