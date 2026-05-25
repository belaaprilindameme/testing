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

# FIX: Track script file path BEFORE any cd so verify_syntax can self-check
# Works whether run via `bash install-linux.sh` or `curl ... | bash` (BASH_SOURCE empty → skip check)
SCRIPT_FILE="${BASH_SOURCE[0]:-}"

log(){ echo -e "${BLUE}→ $*${NC}"; }
ok(){ echo -e "${GREEN}✅ $*${NC}"; }
warn(){ echo -e "${YELLOW}⚠️  $*${NC}"; }
err(){ echo -e "${RED}❌ $*${NC}"; }

if [ "${EUID:-$(id -u)}" -eq 0 ]; then IS_ROOT=1; else IS_ROOT=0; fi

run_root(){
  if [ "$IS_ROOT" -eq 1 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

run_root_env(){
  if [ "$IS_ROOT" -eq 1 ]; then
    env DEBIAN_FRONTEND=noninteractive "$@"
  else
    sudo env DEBIAN_FRONTEND=noninteractive "$@"
  fi
}

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
  if [ "$IS_ROOT" -ne 1 ]; then
    log "Memeriksa akses sudo..."
    sudo -v
  fi
}

apt_install_all(){
  log "Menjalankan apt update otomatis..."
  run_root_env apt-get update -y

  if [ "$AUTO_UPGRADE" = "1" ]; then
    log "Menjalankan apt upgrade otomatis karena AUTO_UPGRADE=1..."
    run_root_env apt-get upgrade -y
  else
    warn "apt upgrade dilewati. Installer hanya menjalankan apt update agar aman untuk VPS."
  fi

  log "Menginstall dependency sistem..."
  run_root_env apt-get install -y \
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
  local nodesource_setup="/tmp/nodesource_setup_${NODE_MAJOR}.x.sh"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" -o "$nodesource_setup"
  run_root bash "$nodesource_setup"
  rm -f "$nodesource_setup"
  run_root_env apt-get install -y nodejs
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
  set_env QRIS_EXPIRED_ACTION "edit"
  # Hubungi Admin (kosong by default, bisa diisi via /admin)
  set_env ADMIN_DISPLAY_NAME ""
  set_env ADMIN_USERNAME ""
  set_env ADMIN_CONTACT_URL ""
  set_env ADMIN_CONTACT_TEXT "Silakan hubungi admin untuk bantuan pembayaran, kendala produk, atau pertanyaan sebelum membeli."
  # Backup otomatis
  set_env BACKUP_AUTO_ENABLED "true"
  set_env BACKUP_TIME "00:00"
  set_env BACKUP_TIMEZONE "Asia/Jakarta"
  set_env BACKUP_KEEP_LOCAL "14"
  set_env BACKUP_INCLUDE_ENV "true"
  # Maintenance & UI
  set_env MAINTENANCE_MODE "off"
  set_env PRODUCT_PAGE_SIZE "6"
  # Payment reminder
  set_env PAYMENT_REMINDER_AFTER_MINUTES "5"
  set_env PAYMENT_REMINDER_INTERVAL_MS "120000"
  # Broadcast
  set_env BROADCAST_DELAY_MS "80"
  # Pre Order
  set_env PREORDER_PRICE "$PREORDER_PRICE"
  set_env PREORDER_MIN_TEXT_LENGTH "20"
  set_env PREORDER_MAX_REVISION "1"
  set_env PREORDER_QUOTE_EXPIRED_HOURS "24"
  set_env PREORDER_QUOTE_EXPIRE_CHECK_MS "300000"
  # Auto-cleanup
  set_env CLEANUP_AUTO_ENABLED "true"
  set_env CLEANUP_INTERVAL_MS "21600000"
  set_env CLEANUP_QRIS_DAYS "7"
  set_env CLEANUP_CART_DAYS "14"
  set_env CLEANUP_ERROR_LOG_DAYS "30"
  set_env CLEANUP_AUDIT_LOG_DAYS "180"
  set_env CLEANUP_DELIVERY_LOG_DAYS "180"
  set_env CLEANUP_NOTIFICATION_DAYS "30"
  set_env CLEANUP_REPORT_DAYS "30"
  set_env CLEANUP_NOTIFY_ADMIN "false"
  # PM2
  set_env PM2_APP_NAME "$APP_NAME_DEFAULT"
  chmod 600 .env || true
  ok ".env selesai dibuat/diperbarui."
}

install_project_dependencies(){
  log "Membuat folder yang dibutuhkan..."
  mkdir -p database reports logs backups analytics config handlers services

  log "Install dependency Node.js..."
  # FIX: npm cache clean can fail in some envs; redirect stderr too
  npm cache clean --force 2>/dev/null || true
  # FIX: try --legacy-peer-deps first, fallback to plain install
  npm install --legacy-peer-deps 2>&1 || npm install 2>&1 || {
    warn "npm install gagal. Coba jalankan ulang atau cek koneksi internet."
    return 1
  }

  if [ -f requirements.txt ] && [ -s requirements.txt ]; then
    log "Menyiapkan Python venv dan dependency analytics..."
    python3 -m venv venv
    # FIX: use full path to activate in case subshell has different PATH
    # shellcheck source=/dev/null
    source "$(pwd)/venv/bin/activate"
    pip install --upgrade pip setuptools wheel
    pip install -r requirements.txt || warn "Sebagian dependency Python gagal, analytics masih bisa dicek manual."
    deactivate
  fi
  ok "Dependency project selesai."
}

verify_syntax(){
  log "Mengecek syntax project..."
  # FIX: npm run test checks all JS files listed in package.json scripts.test
  if npm run test 2>&1; then ok "Syntax JavaScript aman."; else warn "npm run test gagal. Cek output di atas."; fi
  # Python syntax check
  if [ -d analytics ] && ls analytics/*.py >/dev/null 2>&1; then
    if python3 -m py_compile analytics/*.py 2>/dev/null; then
      ok "Syntax Python aman."
    else
      warn "Cek analytics Python jika diperlukan."
    fi
  fi
  # FIX: bash -n only if script was run as a file (not piped from curl)
  if [ -n "$SCRIPT_FILE" ] && [ -f "$SCRIPT_FILE" ]; then
    bash -n "$SCRIPT_FILE" && ok "Syntax installer aman."
  else
    warn "Installer dijalankan via pipe, lewati pengecekan syntax bash."
  fi
}

setup_pm2(){
  if [ "$AUTO_PM2" != "1" ]; then warn "PM2 dilewati karena AUTO_PM2=0."; return 0; fi
  log "Install dan menjalankan PM2 otomatis..."
  run_root npm install -g pm2

  # FIX: load .env for PM2_APP_NAME sebelum delete/start
  # shellcheck source=.env
  [ -f .env ] && set -o allexport && source .env && set +o allexport || true
  local app_name="${PM2_APP_NAME:-$APP_NAME_DEFAULT}"

  pm2 delete "$app_name" >/dev/null 2>&1 || true
  if [ -f ecosystem.config.js ]; then
    pm2 start ecosystem.config.js --env production
  else
    pm2 start index.js --name "$app_name"
  fi
  pm2 save

  if [ "$IS_ROOT" -eq 1 ]; then
    pm2 startup systemd -u "$(whoami)" --hp "$HOME" || warn "pm2 startup perlu dijalankan manual jika auto-start reboot belum aktif."
  else
    sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" || warn "pm2 startup perlu dijalankan manual jika auto-start reboot belum aktif."
  fi
  ok "Bot sudah dijalankan dengan PM2."
}

summary(){
  local app_name="${PM2_APP_NAME:-$APP_NAME_DEFAULT}"
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║                    INSTALL SELESAI ✅                        ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  ok "Project: $(pwd)"
  echo ""
  echo "Command penting:"
  echo "  pm2 status"
  echo "  pm2 logs $app_name"
  echo "  pm2 restart $app_name"
  echo "  nano .env"
  echo ""
  warn "URL Generate QRIS dan URL Status QRIS sudah otomatis memakai default, tidak perlu diisi manual."
  echo ""
  ok "Bot siap digunakan! Pastikan TELEGRAM_BOT_TOKEN dan ADMIN_ID di .env sudah terisi."
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
