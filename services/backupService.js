const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const axios = require('axios');
const dotenv = require('dotenv');
const db = require('../config/database');
const adminNotifyService = require('./adminNotifyService');

dotenv.config();

class BackupService {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.backupDir = path.join(this.projectRoot, 'backups');
    this.restoreDir = path.join(this.projectRoot, 'restore_tmp');
    this.lastAutoBackupDate = null;
    this.interval = null;
  }

  ensureDirs() {
    fs.mkdirSync(this.backupDir, { recursive: true });
    fs.mkdirSync(this.restoreDir, { recursive: true });
  }

  runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(`${command} exited with code ${code}: ${stderr || stdout}`));
      });
    });
  }

  timestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  getLocalDate(timeZone = process.env.BACKUP_TIMEZONE || 'Asia/Jakarta') {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }

  getLocalHourMinute(timeZone = process.env.BACKUP_TIMEZONE || 'Asia/Jakarta') {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(new Date());
    const hour = parts.find((p) => p.type === 'hour')?.value || '00';
    const minute = parts.find((p) => p.type === 'minute')?.value || '00';
    return `${hour}:${minute}`;
  }

  async createBackup(reason = 'manual') {
    this.ensureDirs();
    await db.ready;

    const dbPath = db.getDatabasePath();
    const stamp = this.timestamp();
    const backupName = `backup-${reason}-${stamp}.tar.gz`;
    const backupPath = path.join(this.backupDir, backupName);
    const stageDir = path.join(os.tmpdir(), `bot-backup-${stamp}-${process.pid}`);

    fs.rmSync(stageDir, { recursive: true, force: true });
    fs.mkdirSync(stageDir, { recursive: true });
    fs.mkdirSync(path.join(stageDir, 'database'), { recursive: true });
    fs.mkdirSync(path.join(stageDir, 'meta'), { recursive: true });

    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, path.join(stageDir, 'database', path.basename(dbPath)));
    }

    const includeEnv = String(process.env.BACKUP_INCLUDE_ENV || 'true').toLowerCase() !== 'false';
    const envPath = path.join(this.projectRoot, '.env');
    if (includeEnv && fs.existsSync(envPath)) {
      fs.copyFileSync(envPath, path.join(stageDir, '.env'));
    }

    for (const folder of ['reports', 'logs']) {
      const src = path.join(this.projectRoot, folder);
      if (fs.existsSync(src)) {
        await this.runCommand('cp', ['-a', src, path.join(stageDir, folder)]);
      }
    }

    const manifest = {
      app: 'telegram-ecommerce-bot',
      version: '1.0.1',
      created_at: new Date().toISOString(),
      reason,
      contains_database: fs.existsSync(dbPath),
      contains_env: includeEnv && fs.existsSync(envPath),
      warning: 'File backup berisi data sensitif. Jangan bagikan ke orang lain.'
    };
    fs.writeFileSync(path.join(stageDir, 'meta', 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(stageDir, 'README-RESTORE.txt'), 'Upload file .tar.gz ini ke bot melalui menu /admin > Restore Backup. File ini rahasia karena bisa berisi database dan .env. Setelah restore .env, restart bot agar token/API key terbaru aktif.\n');

    await this.runCommand('tar', ['-czf', backupPath, '-C', stageDir, '.']);
    fs.rmSync(stageDir, { recursive: true, force: true });
    this.cleanupOldBackups();
    await db.setSetting('last_backup_at', new Date().toISOString()).catch(() => {});
    return { path: backupPath, name: backupName };
  }

  cleanupOldBackups() {
    const keep = Number(process.env.BACKUP_KEEP_LOCAL || 14);
    if (!Number.isFinite(keep) || keep <= 0) return;
    const files = fs.readdirSync(this.backupDir)
      .filter((f) => f.endsWith('.tar.gz'))
      .map((f) => ({ name: f, full: path.join(this.backupDir, f), mtime: fs.statSync(path.join(this.backupDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    files.slice(keep).forEach((file) => fs.rmSync(file.full, { force: true }));
  }

  async sendBackupToAdmin(bot, backup, caption) {
    await adminNotifyService.sendDocumentToAdmins(bot.telegram, { source: backup.path, filename: backup.name }, { caption });
    return true;
  }

  startAutoBackup(bot) {
    if (this.interval) clearInterval(this.interval);
    const enabled = String(process.env.BACKUP_AUTO_ENABLED || 'true').toLowerCase() !== 'false';
    if (!enabled) return;

    const time = process.env.BACKUP_TIME || '00:00';
    const timeZone = process.env.BACKUP_TIMEZONE || 'Asia/Jakarta';
    this.interval = setInterval(async () => {
      try {
        const nowTime = this.getLocalHourMinute(timeZone);
        const nowDate = this.getLocalDate(timeZone);
        if (nowTime === time && this.lastAutoBackupDate !== nowDate) {
          this.lastAutoBackupDate = nowDate;
          const backup = await this.createBackup('auto');
          const caption = `✅ Backup otomatis berhasil\nTanggal: ${nowDate}\nJam: ${time} ${timeZone}\n\n⚠️ File ini rahasia. Simpan baik-baik untuk restore data bot.`;
          await this.sendBackupToAdmin(bot, backup, caption).catch((err) => console.error('Send auto backup error:', err));
        }
      } catch (error) {
        console.error('Auto backup error:', error);
      }
    }, 30 * 1000);
  }

  async downloadTelegramFile(bot, fileId, destination) {
    const link = await bot.telegram.getFileLink(fileId);
    const response = await axios.get(link.href, { responseType: 'stream' });
    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(destination);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  async restoreFromTelegramDocument(bot, document) {
    this.ensureDirs();
    if (!document?.file_id) throw new Error('File backup tidak valid');
    const filename = document.file_name || '';
    if (!filename.endsWith('.tar.gz')) throw new Error('Format backup harus .tar.gz dari bot ini');

    const stamp = this.timestamp();
    const restoreFile = path.join(this.restoreDir, `restore-${stamp}.tar.gz`);
    const extractDir = path.join(this.restoreDir, `extract-${stamp}`);
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });

    await this.downloadTelegramFile(bot, document.file_id, restoreFile);
    await this.runCommand('tar', ['-xzf', restoreFile, '-C', extractDir]);

    const manifestPath = path.join(extractDir, 'meta', 'manifest.json');
    if (!fs.existsSync(manifestPath)) throw new Error('Manifest backup tidak ditemukan. File mungkin bukan backup dari bot ini.');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.app !== 'telegram-ecommerce-bot') throw new Error('Manifest tidak cocok dengan aplikasi bot ini.');

    const currentBackup = await this.createBackup('before-restore');

    const extractedDbDir = path.join(extractDir, 'database');
    if (fs.existsSync(extractedDbDir)) {
      const dbFiles = fs.readdirSync(extractedDbDir).filter((f) => f.endsWith('.db'));
      if (dbFiles.length > 0) {
        const targetDb = db.getDatabasePath();
        fs.mkdirSync(path.dirname(targetDb), { recursive: true });
        await db.close();
        fs.copyFileSync(path.join(extractedDbDir, dbFiles[0]), targetDb);
        await db.reconnect();
      }
    }

    const extractedEnv = path.join(extractDir, '.env');
    if (fs.existsSync(extractedEnv)) {
      fs.copyFileSync(extractedEnv, path.join(this.projectRoot, '.env'));
      const parsed = dotenv.parse(fs.readFileSync(extractedEnv));
      Object.assign(process.env, parsed);
    }

    for (const folder of ['reports', 'logs']) {
      const src = path.join(extractDir, folder);
      if (fs.existsSync(src)) {
        fs.rmSync(path.join(this.projectRoot, folder), { recursive: true, force: true });
        await this.runCommand('cp', ['-a', src, path.join(this.projectRoot, folder)]);
      }
    }

    fs.rmSync(extractDir, { recursive: true, force: true });
    return { manifest, safetyBackup: currentBackup };
  }
}

module.exports = new BackupService();
