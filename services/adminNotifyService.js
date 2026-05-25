require('dotenv').config();

class AdminNotifyService {
  getAdminIds() {
    const ids = [];
    if (process.env.ADMIN_ID) ids.push(String(process.env.ADMIN_ID).trim());
    if (process.env.ADMIN_IDS) {
      process.env.ADMIN_IDS.split(',').map((id) => id.trim()).filter(Boolean).forEach((id) => ids.push(id));
    }
    return [...new Set(ids)].filter((id) => /^\d+$/.test(id));
  }

  isAdmin(telegramId) {
    return this.getAdminIds().includes(String(telegramId));
  }

  async sendToAdmins(telegramApi, message, extra = {}) {
    const ids = this.getAdminIds();
    for (const id of ids) {
      await telegramApi.sendMessage(id, message, extra).catch((err) => {
        console.error(`[ADMIN_NOTIFY] gagal kirim ke ${id}:`, err.message);
      });
    }
  }

  async sendDocumentToAdmins(telegramApi, document, extra = {}) {
    const ids = this.getAdminIds();
    for (const id of ids) {
      await telegramApi.sendDocument(id, document, extra).catch((err) => {
        console.error(`[ADMIN_NOTIFY] gagal kirim dokumen ke ${id}:`, err.message);
      });
    }
  }
}

module.exports = new AdminNotifyService();
