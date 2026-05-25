const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(process.cwd(), '.env');

function upsertEnvValue(key, value) {
  if (!value) return;
  let content = '';
  if (fs.existsSync(ENV_PATH)) {
    content = fs.readFileSync(ENV_PATH, 'utf8');
  }

  const safeValue = String(value).replace(/\r?\n/g, ' ').trim();
  const line = `${key}=${safeValue}`;
  const regex = new RegExp(`^${key}=.*$`, 'm');

  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    if (content && !content.endsWith('\n')) content += '\n';
    content += `${line}\n`;
  }

  fs.writeFileSync(ENV_PATH, content, 'utf8');
  process.env[key] = safeValue;
}

function buildDisplayName(chat = {}) {
  const parts = [chat.first_name, chat.last_name].filter(Boolean);
  return parts.join(' ').trim() || chat.title || 'Admin';
}

async function syncAdminContact(telegram) {
  const adminId = String(process.env.ADMIN_ID || '').trim();
  if (!/^\d+$/.test(adminId)) {
    return {
      ok: false,
      reason: 'ADMIN_ID belum valid. Isi ADMIN_ID dengan ID Telegram admin berupa angka.'
    };
  }

  try {
    const chat = await telegram.getChat(Number(adminId));
    const username = (chat.username || '').replace('@', '').trim();
    const displayName = buildDisplayName(chat);

    upsertEnvValue('ADMIN_DISPLAY_NAME', displayName);

    if (username) {
      upsertEnvValue('ADMIN_USERNAME', username);
      upsertEnvValue('ADMIN_CONTACT_URL', `https://t.me/${username}`);
      return {
        ok: true,
        hasUsername: true,
        adminId,
        username,
        displayName,
        contactUrl: `https://t.me/${username}`
      };
    }

    // Fallback ketika admin tidak punya username publik.
    const fallbackUrl = `tg://user?id=${adminId}`;
    upsertEnvValue('ADMIN_USERNAME', '');
    upsertEnvValue('ADMIN_CONTACT_URL', fallbackUrl);
    return {
      ok: true,
      hasUsername: false,
      adminId,
      username: '',
      displayName,
      contactUrl: fallbackUrl,
      reason: 'Akun admin tidak memiliki username publik. Bot memakai fallback tg://user?id=ADMIN_ID.'
    };
  } catch (error) {
    return {
      ok: false,
      adminId,
      reason: 'Bot belum bisa membaca data admin. Pastikan admin sudah pernah klik /start ke bot ini.',
      error: error.message
    };
  }
}

module.exports = { syncAdminContact };
