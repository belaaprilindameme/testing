#!/usr/bin/env bash
set -Eeuo pipefail

# One-command auto installer for Telegram E-Commerce Bot
# Supports Ubuntu/Debian/Kali based VPS.

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
APP_NAME_DEFAULT="ecommerce-bot"
REPO_URL="${REPO_URL:-https://github.com/belaaprilindameme/testing.git}"
APP_DIR="${APP_DIR:-$HOME/testing-bot}"
NODE_MAJOR="${NODE_MAJOR:-20}"
AUTO_UPGRADE="${AUTO_UPGRADE:-0}"
AUTO_PM2="${AUTO_PM2:-1}"

log(){ echo -e "${BLUE}→ $*${NC}"; }
ok(){ echo -e "${GREEN}✅ $*${NC}"; }
warn(){ echo -e "${YELLOW}⚠️  $*${NC}"; }
err(){ echo -e "${RED}❌ $*${NC}"; }

if [ "${EUID:-$(id -u)}" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

trap 'err "Install gagal di baris $LINENO. Cek log di atas."; exit 1' ERR

header(){
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║        TELEGRAM E-COMMERCE BOT - AUTO INSTALLER             ║"
  echo "║        Satu script: update, dependency, env, PM2, start      ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
}

need_cmd(){ command -v "$1" >/dev/null 2>&1; }

require_supported_os(){
  log "Mendeteksi OS..."
  if [ ! -f /etc/os-release ]; then err "OS tidak terdeteksi."; exit 1; fi
  . /etc/os-release
  case "${ID:-}" in
    ubuntu|debian|kali) ok "OS didukung: ${NAME:-Linux} ${VERSION_ID:-}" ;;
    *) err "OS belum didukung: ${NAME:-unknown}. Gunakan Ubuntu/Debian/Kali."; exit 1 ;;
  esac
}

prepare_sudo(){
  if [ -n "$SUDO" ]; then
    log "Memeriksa akses sudo..."
    $SUDO -v
  fi
}

apt_install_all(){
  log "Menjalankan apt update otomatis..."
  $SUDO apt update -y

  if [ "$AUTO_UPGRADE" = "1" ]; then
    log "Menjalankan apt upgrade otomatis karena AUTO_UPGRADE=1..."
    $SUDO DEBIAN_FRONTEND=noninteractive apt upgrade -y
  else
    warn "apt upgrade dilewati. Installer hanya menjalankan apt update agar aman untuk VPS."
  fi

  log "Menginstall dependency sistem..."
  $SUDO DEBIAN_FRONTEND=noninteractive apt install -y \
    ca-certificates curl wget gnupg git unzip build-essential \
    python3 python3-pip python3-venv python3-dev \
    sqlite3 libsqlite3-dev
  ok "Dependency sistem selesai."
}

install_nodejs(){
  local current_major=""
  if need_cmd node; then current_major="$(node -v | sed 's/v//' | cut -d. -f1)"; fi
  if [ -n "$current_major" ] && [ "$current_major" -ge 18 ]; then
    ok "Node.js sudah tersedia: $(node -v)"
    return 0
  fi

  log "Menginstall Node.js ${NODE_MAJOR}.x otomatis..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | $SUDO -E bash -
  $SUDO DEBIAN_FRONTEND=noninteractive apt install -y nodejs
  ok "Node.js aktif: $(node -v), npm: $(npm -v)"
}

setup_repository(){
  log "Menyiapkan folder project..."

  if [ -f "package.json" ] && [ -f "index.js" ]; then
    ok "Installer dijalankan dari folder project: $(pwd)"
    return 0
  fi

  mkdir -p "$APP_DIR"
  cd "$APP_DIR"

  if [ -d .git ]; then
    log "Repository sudah ada, melakukan git pull..."
    git pull --ff-only || warn "git pull gagal/dilewati. Melanjutkan memakai file yang ada."
  elif [ -f package.json ]; then
    ok "File project sudah ada di $APP_DIR"
  else
    if [ -n "$(ls -A . 2>/dev/null)" ]; then
      warn "Folder $APP_DIR tidak kosong. Membuat folder baru bertimestamp."
      APP_DIR="$HOME/testing-bot-$(date +%Y%m%d%H%M%S)"
      mkdir -p "$APP_DIR"
      cd "$APP_DIR"
    fi
    log "Clone repository: $REPO_URL"
    git clone "$REPO_URL" .
  fi

  ok "Project siap di: $(pwd)"
}

prompt_value(){
  local var_name="$1" label="$2" default_value="${3:-}" secret="${4:-0}" value=""
  local existing="${!var_name:-}"
  if [ -n "$existing" ]; then printf -v "$var_name" '%s' "$existing"; return 0; fi

  if [ "$secret" = "1" ]; then
    read -r -s -p "$label${default_value:+ [$default_value]}: " value || true
    echo ""
  else
    read -r -p "$label${default_value:+ [$default_value]}: " value || true
  fi
  value="${value:-$default_value}"
  printf -v "$var_name" '%s' "$value"
}

collect_config(){
  echo ""
  log "Mengisi konfigurasi bot. Tekan Enter untuk memakai default jika tersedia."
  prompt_value TELEGRAM_BOT_TOKEN "Masukkan Token Bot Telegram dari @BotFather" "" 1
  prompt_value ADMIN_ID "Masukkan ID Telegram Admin utama" ""
  prompt_value GOPAY_KEY "Masukkan GoPay/QRIS API Key" "" 1
  prompt_value ADMIN_IDS "Masukkan ID admin tambahan, pisahkan koma (opsional)" ""
  prompt_value QRIS_EXPIRED_MINUTES "Expired QRIS dalam menit" "10"
  prompt_value PREORDER_PRICE "Harga default Pre Order" "50000"
  prompt_value PORT "Port web server bot" "3000"

  if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$ADMIN_ID" ] || [ -z "$GOPAY_KEY" ]; then
    warn "Token bot, ADMIN_ID, atau GOPAY_KEY masih kosong. .env tetap dibuat, tapi bot belum bisa dipakai penuh sampai dilengkapi."
  fi
}

set_env(){
  local key="$1" value="$2" file=".env"
  value="${value//$'\n'/ }"
  if grep -qE "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value//|/\\|}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

setup_env(){
  log "Membuat/memperbarui .env otomatis..."
  if [ -f .env ]; then
    cp .env ".env.backup-$(date +%Y%m%d%H%M%S)"
  elif [ -f .env.example ]; then
    cp .env.example .env
  else
    touch .env
  fi

  set_env TELEGRAM_BOT_TOKEN "$TELEGRAM_BOT_TOKEN"
  set_env DATABASE_PATH "./database/ecommerce.db"
  set_env PORT "$PORT"
  set_env NODE_ENV "production"
  set_env ADMIN_ID "$ADMIN_ID"
  set_env ADMIN_IDS "$ADMIN_IDS"
  set_env PAYMENT "GOPAY"
  set_env GOPAY_KEY "$GOPAY_KEY"
  # URL QRIS otomatis, tidak ditanyakan ke user.
  set_env GOPAY_QRIS_GENERATE_URL "https://v1-gateway.autogopay.site/qris/generate"
  set_env GOPAY_QRIS_STATUS_URL "https://v1-gateway.autogopay.site/qris/status"
  set_env QRIS_EXPIRED_MINUTES "$QRIS_EXPIRED_MINUTES"
  set_env QRIS_CHECK_INTERVAL_MS "5000"
  set_env PAYMENT_REQUEST_TIMEOUT "10000"
  set_env PAYMENT_NOTE "Scan QRIS, bayar sesuai nominal, lalu tunggu bot memverifikasi pembayaran otomatis."
  set_env BACKUP_AUTO_ENABLED "true"
  set_env BACKUP_TIME "00:00"
  set_env BACKUP_TIMEZONE "Asia/Jakarta"
  set_env BACKUP_KEEP_LOCAL "14"
  set_env BACKUP_INCLUDE_ENV "true"
  set_env QRIS_EXPIRED_ACTION "edit"
  set_env MAINTENANCE_MODE "off"
  set_env PRODUCT_PAGE_SIZE "6"
  set_env PAYMENT_REMINDER_AFTER_MINUTES "5"
  set_env PAYMENT_REMINDER_INTERVAL_MS "120000"
  set_env PREORDER_PRICE "$PREORDER_PRICE"
  set_env PM2_APP_NAME "$APP_NAME_DEFAULT"
  chmod 600 .env || true
  ok ".env selesai dibuat/diperbarui."
}

install_project_dependencies(){
  log "Membuat folder yang dibutuhkan..."
  mkdir -p database reports logs backups analytics config handlers services

  log "Install dependency Node.js..."
  npm cache clean --force >/dev/null 2>&1 || true
  npm install --legacy-peer-deps || npm install

  if [ -f requirements.txt ] && [ -s requirements.txt ]; then
    log "Menyiapkan Python venv dan dependency analytics..."
    python3 -m venv venv
    . venv/bin/activate
    pip install --upgrade pip setuptools wheel
    pip install -r requirements.txt || warn "Sebagian dependency Python gagal, analytics masih bisa dicek manual."
    deactivate
  fi
  ok "Dependency project selesai."
}

verify_syntax(){
  log "Mengecek syntax project..."
  if npm run test; then ok "Syntax JavaScript aman."; else warn "npm run test gagal. Cek output di atas."; fi
  if [ -d analytics ]; then python3 -m py_compile analytics/*.py 2>/dev/null && ok "Syntax Python aman." || warn "Cek analytics Python jika diperlukan."; fi
  bash -n install-linux.sh && ok "Syntax installer aman."
}

setup_pm2(){
  if [ "$AUTO_PM2" != "1" ]; then warn "PM2 dilewati karena AUTO_PM2=0."; return 0; fi
  log "Install dan menjalankan PM2 otomatis..."
  npm install -g pm2

  pm2 delete "$APP_NAME_DEFAULT" >/dev/null 2>&1 || true
  if [ -f ecosystem.config.js ]; then
    pm2 start ecosystem.config.js --env production
  else
    pm2 start index.js --name "$APP_NAME_DEFAULT"
  fi
  pm2 save

  if [ -n "$SUDO" ]; then
    $SUDO env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" || warn "pm2 startup perlu dijalankan manual jika auto-start reboot belum aktif."
  else
    pm2 startup systemd -u "$(whoami)" --hp "$HOME" || warn "pm2 startup perlu dijalankan manual jika auto-start reboot belum aktif."
  fi
  ok "Bot sudah dijalankan dengan PM2."
}

summary(){
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║                    INSTALL SELESAI                           ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  ok "Project: $(pwd)"
  echo "Command penting:"
  echo "  pm2 status"
  echo "  pm2 logs $APP_NAME_DEFAULT"
  echo "  pm2 restart $APP_NAME_DEFAULT"
  echo "  nano .env"
  echo ""
  warn "URL Generate QRIS dan URL Status QRIS sudah otomatis memakai default, tidak perlu diisi manual."
}

main(){
  header
  require_supported_os
  prepare_sudo
  apt_install_all
  install_nodejs
  setup_repository
  collect_config
  setup_env
  install_project_dependencies
  verify_syntax
  setup_pm2
  summary
}

main "$@"
