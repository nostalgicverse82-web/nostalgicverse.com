/**
 * NostalgicVerse — Automation Task Scheduler
 * ===========================================
 * Orchestrates periodic background jobs (anniversary discovery,
 * image health checks, content integrity verification).
 */

'use strict';

const { defaultLogger: logger } = require('./logger.cjs');

class TaskScheduler {
  constructor() {
    this.jobs = new Map();
    this.timers = new Map();
    this.isRunning = false;
  }

  registerJob(name, intervalMs, taskFn) {
    if (this.jobs.has(name)) {
      this.unregisterJob(name);
    }
    this.jobs.set(name, {
      name,
      intervalMs,
      taskFn,
      lastRun: null,
      runCount: 0,
      lastError: null
    });
    logger.info(`Registered background job: "${name}" (interval: ${intervalMs}ms)`);
  }

  unregisterJob(name) {
    if (this.timers.has(name)) {
      clearInterval(this.timers.get(name));
      this.timers.delete(name);
    }
    this.jobs.delete(name);
  }

  async runJobNow(name) {
    const job = this.jobs.get(name);
    if (!job) throw new Error(`Job "${name}" is not registered`);

    logger.info(`Executing job manually: "${name}"`);
    try {
      job.lastRun = new Date().toISOString();
      job.runCount++;
      const result = await job.taskFn();
      job.lastError = null;
      return { success: true, result };
    } catch (err) {
      job.lastError = err.message;
      logger.error(`Error in scheduled job "${name}":`, { error: err.message });
      return { success: false, error: err.message };
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('Started background task scheduler');

    for (const [name, job] of this.jobs.entries()) {
      const timer = setInterval(async () => {
        try {
          job.lastRun = new Date().toISOString();
          job.runCount++;
          await job.taskFn();
          job.lastError = null;
        } catch (err) {
          job.lastError = err.message;
          logger.error(`Error in scheduled job "${name}":`, { error: err.message });
        }
      }, job.intervalMs);

      this.timers.set(name, timer);
    }
  }

  stop() {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
    this.isRunning = false;
    logger.info('Stopped background task scheduler');
  }

  getStatus() {
    const status = [];
    for (const [name, job] of this.jobs.entries()) {
      status.push({
        name,
        intervalMs: job.intervalMs,
        lastRun: job.lastRun,
        runCount: job.runCount,
        lastError: job.lastError
      });
    }
    return {
      isRunning: this.isRunning,
      activeJobs: status
    };
  }
}

const defaultScheduler = new TaskScheduler();

module.exports = {
  TaskScheduler,
  defaultScheduler
};

