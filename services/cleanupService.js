require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const adminNotifyService = require('./adminNotifyService');

class CleanupService {
  constructor() {
    this.started = false;
    this.timer = null;
    this.running = false;
  }

  isEnabled() {
    return String(process.env.CLEANUP_AUTO_ENABLED || 'true').toLowerCase() === 'true';
  }

  getConfig() {
    return {
      intervalMs: Number(process.env.CLEANUP_INTERVAL_MS || 6 * 60 * 60 * 1000),
      qrisDays: Number(process.env.CLEANUP_QRIS_DAYS || 7),
      errorLogDays: Number(process.env.CLEANUP_ERROR_LOG_DAYS || 30),
      auditLogDays: Number(process.env.CLEANUP_AUDIT_LOG_DAYS || 180),
      deliveryLogDays: Number(process.env.CLEANUP_DELIVERY_LOG_DAYS || 180),
      notificationDays: Number(process.env.CLEANUP_NOTIFICATION_DAYS || 30),
      cartDays: Number(process.env.CLEANUP_CART_DAYS || 14),
      reportDays: Number(process.env.CLEANUP_REPORT_DAYS || 30),
      localBackupDays: Number(process.env.BACKUP_KEEP_LOCAL || process.env.CLEANUP_BACKUP_DAYS || 14),
      notifyAdmin: String(process.env.CLEANUP_NOTIFY_ADMIN || 'false').toLowerCase() === 'true'
    };
  }

  async start(bot) {
    if (this.started || !this.isEnabled()) return;
    this.started = true;
    const cfg = this.getConfig();
    console.log(`🧹 Auto-cleanup enabled. Interval: ${cfg.intervalMs}ms`);

    setTimeout(() => this.run(bot, 'startup').catch((err) => console.error('Cleanup startup error:', err)), 15000);
    this.timer = setInterval(() => {
      this.run(bot, 'scheduled').catch((err) => console.error('Cleanup scheduled error:', err));
    }, cfg.intervalMs);
  }

  async run(bot, trigger = 'manual') {
    if (this.running) return { skipped: true, reason: 'already_running' };
    this.running = true;
    try {
      const cfg = this.getConfig();
      const dbResult = await db.cleanupOldData(cfg);
      const fileResult = await this.cleanupFiles(cfg);
      const result = { trigger, database: dbResult, files: fileResult, at: new Date().toISOString() };
      await db.setSetting('last_cleanup_at', result.at).catch(() => {});
      await db.setSetting('last_cleanup_result', JSON.stringify(result)).catch(() => {});

      if (bot && cfg.notifyAdmin && trigger !== 'startup') {
        await adminNotifyService.notifyAll(bot.telegram, this.formatResult(result)).catch(() => {});
      }
      return result;
    } finally {
      this.running = false;
    }
  }

  cleanupFiles(cfg) {
    const result = { reports: 0, backups: 0, logs: 0 };
    result.reports = this.deleteOldFiles(path.join(process.cwd(), 'reports'), cfg.reportDays, ['.csv', '.json', '.txt', '.png']);
    result.backups = this.deleteOldFiles(path.join(process.cwd(), 'backups'), cfg.localBackupDays, ['.gz', '.zip', '.tar']);
    result.logs = this.deleteOldFiles(path.join(process.cwd(), 'logs'), cfg.errorLogDays, ['.log', '.txt']);
    return result;
  }

  deleteOldFiles(dir, days, allowedExts) {
    if (!fs.existsSync(dir)) return 0;
    const cutoff = Date.now() - (Number(days || 0) * 24 * 60 * 60 * 1000);
    if (!days || days <= 0) return 0;
    let count = 0;
    for (const name of fs.readdirSync(dir)) {
      const filePath = path.join(dir, name);
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;
        const ext = path.extname(name).toLowerCase();
        if (allowedExts.length && !allowedExts.includes(ext) && !name.endsWith('.tar.gz')) continue;
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
          count += 1;
        }
      } catch (error) {
        console.error('Cleanup file error:', filePath, error.message);
      }
    }
    return count;
  }

  formatResult(result) {
    const dbCounts = result.database || {};
    const files = result.files || {};
    return `🧹 CLEANUP SELESAI\n\n` +
      `Trigger: ${result.trigger}\n` +
      `Waktu: ${result.at}\n\n` +
      `Database:\n` +
      `- QRIS lama: ${dbCounts.qris || 0}\n` +
      `- Cart lama: ${dbCounts.cart || 0}\n` +
      `- Error log: ${dbCounts.errorLogs || 0}\n` +
      `- Audit log: ${dbCounts.auditLogs || 0}\n` +
      `- Delivery log: ${dbCounts.deliveryLogs || 0}\n` +
      `- Notifikasi: ${dbCounts.notifications || 0}\n` +
      `- Preorder log: ${dbCounts.preOrderLogs || 0}\n\n` +
      `File lokal:\n` +
      `- Reports: ${files.reports || 0}\n` +
      `- Backups: ${files.backups || 0}\n` +
      `- Logs: ${files.logs || 0}`;
  }
}

module.exports = new CleanupService();
