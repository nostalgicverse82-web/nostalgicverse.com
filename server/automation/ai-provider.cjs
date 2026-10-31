/**
 * NostalgicVerse — Private AI Provider Abstraction Layer
 * ========================================================
 * Abstracts multi-vendor AI APIs (Gemini, Anthropic, OpenAI, and Mock).
 * Keys are strictly confined to the server environment and never sent
 * or leaked to client browsers.
 */

'use strict';

const { defaultLogger: logger } = require('./logger.cjs');

class BaseAIProvider {
  constructor(name) {
    this.name = name;
  }

  async generateCompletion(prompt, options = {}) {
    throw new Error('generateCompletion() must be implemented by subclass');
  }

  async generateStructuredJson(prompt, schema, options = {}) {
    throw new Error('generateStructuredJson() must be implemented by subclass');
  }
}

/**
 * Mock / Offline Rule-Based Provider
 * Always available, 100% deterministic, zero network dependency.
 */
class MockAIProvider extends BaseAIProvider {
  constructor() {
    super('mock');
  }

  async generateCompletion(prompt, options = {}) {
    logger.info('Mock AI generating completion for prompt preview', { promptLength: prompt.length });
    return `[NostalgicVerse Archival Intelligence]: Preserving gaming history through meticulous documentation and authentic artifact curation. Query: "${prompt.slice(0, 60)}..."`;
  }

  async generateStructuredJson(prompt, schema = {}, options = {}) {
    logger.info('Mock AI generating structured schema JSON');

    // If requested to generate a news or archival story
    const currentYear = new Date().getFullYear();
    return {
      id: `story-anniversary-${Date.now()}`,
      title: options.topicTitle || 'Fifty Years of Interactive Microcomputing: Preserving the Foundation',
      slug: (options.topicTitle || 'fifty-years-interactive-microcomputing').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      date: new Date().toISOString().split('T')[0],
      category: options.category || 'Historical Retrospective',
      era: options.era || 'Golden Age (1977-1983)',
      summary: 'A curated historical examination into early architectural breakthroughs, coin-operated amusement engineering, and seminal home console foundations.',
      keyPoints: [
        'Breakthrough hardware constraints shaped early arcade game loops',
        'Custom audio synthesis and DAC sound architectures created iconic auditory branding',
        'Physical cartridge distribution models established retail video game economics'
      ],
      editorialNotes: 'Synthesized via NostalgicVerse Archival Fact Engine. Held for curator review prior to public exhibition.',
      status: 'held_for_review',
      reviewDate: null,
      approvedBy: null
    };
  }
}

/**
 * Google Gemini Provider
 */
class GeminiAIProvider extends BaseAIProvider {
  constructor(apiKey) {
    super('gemini');
    this.apiKey = apiKey;
  }

  async generateCompletion(prompt, options = {}) {
    const model = options.model || 'gemini-3.1-flash-lite';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.3,
          maxOutputTokens: options.maxTokens ?? 1024
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async generateStructuredJson(prompt, schema = {}, options = {}) {
    const enhancedPrompt = `${prompt}\n\nYou must respond ONLY with valid, minified JSON adhering strictly to this schema specification:\n${JSON.stringify(schema, null, 2)}`;
    const raw = await this.generateCompletion(enhancedPrompt, options);
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  }
}

/**
 * Anthropic Provider
 */
class AnthropicAIProvider extends BaseAIProvider {
  constructor(apiKey) {
    super('anthropic');
    this.apiKey = apiKey;
  }

  async generateCompletion(prompt, options = {}) {
    const model = options.model || 'claude-3-haiku-20240307';
    const endpoint = 'https://api.anthropic.com/v1/messages';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  async generateStructuredJson(prompt, schema = {}, options = {}) {
    const enhancedPrompt = `${prompt}\n\nRespond ONLY with a valid JSON object matching this schema. No preamble or markdown fences:\n${JSON.stringify(schema, null, 2)}`;
    const raw = await this.generateCompletion(enhancedPrompt, options);
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  }
}

/**
 * OpenAI Provider
 */
class OpenAIProvider extends BaseAIProvider {
  constructor(apiKey) {
    super('openai');
    this.apiKey = apiKey;
  }

  async generateCompletion(prompt, options = {}) {
    const model = options.model || 'gpt-4o-mini';
    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature ?? 0.3
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async generateStructuredJson(prompt, schema = {}, options = {}) {
    const enhancedPrompt = `${prompt}\n\nRespond ONLY with valid JSON matching:\n${JSON.stringify(schema, null, 2)}`;
    const raw = await this.generateCompletion(enhancedPrompt, options);
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  }
}

/**
 * Factory to instantiate active provider with automatic fallback
 */
function createAIProvider(config = {}) {
  const providerType = (config.provider || process.env.AI_PROVIDER || 'mock').toLowerCase();

  try {
    if (providerType === 'gemini' && (config.apiKey || process.env.GEMINI_API_KEY)) {
      logger.info('Initialized Gemini AI Provider');
      return new GeminiAIProvider(config.apiKey || process.env.GEMINI_API_KEY);
    }
    if (providerType === 'anthropic' && (config.apiKey || process.env.ANTHROPIC_API_KEY)) {
      logger.info('Initialized Anthropic AI Provider');
      return new AnthropicAIProvider(config.apiKey || process.env.ANTHROPIC_API_KEY);
    }
    if (providerType === 'openai' && (config.apiKey || process.env.OPENAI_API_KEY)) {
      logger.info('Initialized OpenAI AI Provider');
      return new OpenAIProvider(config.apiKey || process.env.OPENAI_API_KEY);
    }
  } catch (err) {
    logger.warn('Failed to initialize external AI provider, falling back to mock engine', { error: err.message });
  }

  logger.info('Initialized Offline/Mock Archival AI Provider');
  return new MockAIProvider();
}

module.exports = {
  BaseAIProvider,
  MockAIProvider,
  GeminiAIProvider,
  AnthropicAIProvider,
  OpenAIProvider,
  createAIProvider
};

