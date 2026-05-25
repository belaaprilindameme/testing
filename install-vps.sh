#!/usr/bin/env bash
set -Eeuo pipefail

# ============================================================
#   TELEGRAM E-COMMERCE BOT - AUTO INSTALLER
#   Supports: Ubuntu / Debian / Kali Linux
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

APP_NAME_DEFAULT="ecommerce-bot"
REPO_URL="${REPO_URL:-https://github.com/belaaprilindameme/testing.git}"
APP_DIR="${APP_DIR:-$HOME/testing-bot}"
NODE_MAJOR="${NODE_MAJOR:-20}"
AUTO_UPGRADE="${AUTO_UPGRADE:-0}"
AUTO_PM2="${AUTO_PM2:-1}"
SCRIPT_FILE="${BASH_SOURCE[0]:-}"

log()  { echo -e "${BLUE}→ $*${NC}"; }
ok()   { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
err()  { echo -e "${RED}❌ $*${NC}"; }
info() { echo -e "${CYAN}ℹ️  $*${NC}"; }
bold() { echo -e "${BOLD}$*${NC}"; }
div()  { echo -e "${BLUE}──────────────────────────────────────────────────${NC}"; }

if [ "${EUID:-$(id -u)}" -eq 0 ]; then IS_ROOT=1; else IS_ROOT=0; fi

run_root(){
  if [ "$IS_ROOT" -eq 1 ]; then "$@"; else sudo "$@"; fi
}

run_root_env(){
  if [ "$IS_ROOT" -eq 1 ]; then env DEBIAN_FRONTEND=noninteractive "$@"
  else sudo env DEBIAN_FRONTEND=noninteractive "$@"; fi
}

trap 'err "Install gagal di baris $LINENO. Cek log di atas."; exit 1' ERR

# ============================================================
# HEADER
# ============================================================
header(){
  clear
  echo ""
  echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${BLUE}║        🤖  TELEGRAM E-COMMERCE BOT - AUTO INSTALLER         ║${NC}"
  echo -e "${BOLD}${BLUE}║     Otomatis install, konfigurasi, dan jalankan bot          ║${NC}"
  echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  info "Script ini akan:"
  echo "   1. Install semua dependency sistem & Node.js"
  echo "   2. Clone / update repository bot"
  echo "   3. Minta konfigurasi API Key bot dari kamu"
  echo "   4. Tulis .env otomatis"
  echo "   5. Install npm & Python dependencies"
  echo "   6. Jalankan bot via PM2 — langsung aktif!"
  echo ""
}

need_cmd(){ command -v "$1" >/dev/null 2>&1; }

# ============================================================
# OS CHECK
# ============================================================
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

# ============================================================
# SYSTEM PACKAGES
# ============================================================
apt_install_all(){
  div
  log "Menjalankan apt update..."
  run_root_env apt-get update -y

  if [ "$AUTO_UPGRADE" = "1" ]; then
    log "Menjalankan apt upgrade (AUTO_UPGRADE=1)..."
    run_root_env apt-get upgrade -y
  fi

  log "Menginstall dependency sistem..."
  run_root_env apt-get install -y \
    ca-certificates curl wget gnupg git unzip build-essential \
    python3 python3-pip python3-venv python3-dev \
    sqlite3 libsqlite3-dev
  ok "Dependency sistem selesai."
}

# ============================================================
# NODE.JS
# ============================================================
install_nodejs(){
  local current_major=""
  if need_cmd node; then current_major="$(node -v | sed 's/v//' | cut -d. -f1)"; fi
  if [ -n "$current_major" ] && [ "$current_major" -ge 18 ]; then
    ok "Node.js sudah tersedia: $(node -v)"; return 0
  fi
  log "Menginstall Node.js ${NODE_MAJOR}.x..."
  local tmp="/tmp/nodesource_setup_${NODE_MAJOR}.x.sh"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" -o "$tmp"
  run_root bash "$tmp"; rm -f "$tmp"
  run_root_env apt-get install -y nodejs
  ok "Node.js aktif: $(node -v) | npm: $(npm -v)"
}

# ============================================================
# REPOSITORY
# ============================================================
setup_repository(){
  div
  log "Menyiapkan folder project..."
  if [ -f "package.json" ] && [ -f "index.js" ]; then
    ok "Dijalankan dari folder project: $(pwd)"; return 0
  fi
  mkdir -p "$APP_DIR"; cd "$APP_DIR"
  if [ -d .git ]; then
    log "Repository sudah ada, melakukan git pull..."
    git pull --ff-only || warn "git pull gagal/dilewati."
  elif [ -f package.json ]; then
    ok "File project sudah ada di $APP_DIR"
  else
    if [ -n "$(ls -A . 2>/dev/null)" ]; then
      warn "Folder tidak kosong. Membuat folder baru bertimestamp."
      APP_DIR="$HOME/testing-bot-$(date +%Y%m%d%H%M%S)"
      mkdir -p "$APP_DIR"; cd "$APP_DIR"
    fi
    log "Clone repository: $REPO_URL"
    git clone "$REPO_URL" .
  fi
  ok "Project siap di: $(pwd)"
}

# ============================================================
# FUNGSI INPUT
# ============================================================

# prompt_required VAR_NAME "Label"
# Terus tanya sampai user isi (tidak boleh kosong).
# Input selalu TAMPIL di layar — sengaja agar bisa dicek tidak ada typo.
prompt_required(){
  local var_name="$1" label="$2" value=""
  local existing="${!var_name:-}"
  if [ -n "$existing" ]; then
    printf -v "$var_name" '%s' "$existing"; return 0
  fi
  while true; do
    read -r -p "$(echo -e "${BOLD}${label}${NC}: ")" value || true
    value="$(echo "$value" | xargs)"   # trim whitespace
    if [ -n "$value" ]; then break; fi
    warn "Field ini wajib diisi, tidak boleh kosong."
  done
  printf -v "$var_name" '%s' "$value"
}

# prompt_optional VAR_NAME "Label" "default"
prompt_optional(){
  local var_name="$1" label="$2" default_value="${3:-}" value=""
  local existing="${!var_name:-}"
  if [ -n "$existing" ]; then
    printf -v "$var_name" '%s' "$existing"; return 0
  fi
  read -r -p "$(echo -e "${label}${default_value:+ [default: ${CYAN}${default_value}${NC}]}: ")" value || true
  value="$(echo "${value:-$default_value}" | xargs)"
  printf -v "$var_name" '%s' "${value:-$default_value}"
}

# ============================================================
# KONFIGURASI INTERAKTIF
# ============================================================
collect_config(){
  echo ""
  echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${BLUE}║              ⚙️   KONFIGURASI BOT                            ║${NC}"
  echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  info "Isi semua konfigurasi di bawah ini. Field bertanda [WAJIB] tidak boleh kosong."
  info "Tekan Enter pada field opsional untuk memakai nilai default."
  echo ""

  # ── SECTION 1: TELEGRAM ─────────────────────────────────────
  div
  bold "📱 TELEGRAM BOT"
  echo ""
  info "Dapatkan token dari @BotFather di Telegram → /newbot"
  prompt_required TELEGRAM_BOT_TOKEN "[WAJIB] Bot Token (@BotFather)"

  echo ""
  info "Cara cari ID Telegram kamu: kirim pesan ke @userinfobot"
  prompt_required ADMIN_ID "[WAJIB] ID Telegram Admin Utama (angka)"

  echo ""
  info "Opsional: tambah ID admin lain yang bisa akses menu /admin"
  prompt_optional ADMIN_IDS "[opsional] ID Admin Tambahan (pisahkan koma, kosongkan jika tidak ada)" ""

  # ── SECTION 2: PEMBAYARAN ────────────────────────────────────
  echo ""
  div
  bold "💳 PEMBAYARAN QRIS / GOPAY"
  echo ""
  info "API Key dari dashboard autogopay.site atau merchant QRIS kamu"
  prompt_required GOPAY_KEY "[WAJIB] API Key GoPay / Merchant QRIS"

  echo ""
  prompt_optional QRIS_EXPIRED_MINUTES "[opsional] Expired QRIS (menit)" "10"

  # ── SECTION 3: KONTAK ADMIN ──────────────────────────────────
  echo ""
  div
  bold "☎️  KONTAK ADMIN (tampil di tombol 'Hubungi Admin')"
  echo ""
  info "Username Telegram kamu (tanpa @). Biarkan kosong jika tidak pakai username."
  prompt_optional ADMIN_USERNAME "[opsional] Username Telegram Admin (tanpa @)" ""

  info "Nama tampilan di tombol kontak. Contoh: Admin Toko Saya"
  prompt_optional ADMIN_DISPLAY_NAME "[opsional] Nama Tampilan Admin" ""

  info "URL kontak custom (misal: wa.me/628xxx). Kosongkan jika pakai username Telegram."
  prompt_optional ADMIN_CONTACT_URL "[opsional] URL Kontak Custom" ""

  # ── SECTION 4: PENGATURAN OPSIONAL ──────────────────────────
  echo ""
  div
  bold "⚙️  PENGATURAN OPSIONAL"
  echo ""
  prompt_optional PREORDER_PRICE "[opsional] Harga default Pre Order (Rp)" "50000"
  prompt_optional PORT "[opsional] Port web server bot" "3000"

  # ── VALIDASI ─────────────────────────────────────────────────
  echo ""
  div
  echo ""

  # Validasi ADMIN_ID harus angka
  if ! [[ "$ADMIN_ID" =~ ^[0-9]+$ ]]; then
    warn "ADMIN_ID '$ADMIN_ID' bukan angka. Bot mungkin tidak bisa kirim notifikasi ke admin."
  fi

  # RINGKASAN KONFIGURASI
  echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${GREEN}║             📋  RINGKASAN KONFIGURASI                        ║${NC}"
  echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  🤖 Bot Token       : ${CYAN}${TELEGRAM_BOT_TOKEN}${NC}"
  echo -e "  👤 Admin ID        : ${CYAN}${ADMIN_ID}${NC}"
  echo -e "  👥 Admin Tambahan  : ${CYAN}${ADMIN_IDS:-( tidak ada )}${NC}"
  echo -e "  💳 GoPay Key       : ${CYAN}${GOPAY_KEY}${NC}"
  echo -e "  ⏱️  QRIS Expired    : ${CYAN}${QRIS_EXPIRED_MINUTES} menit${NC}"
  echo -e "  ☎️  Username Admin  : ${CYAN}${ADMIN_USERNAME:-( tidak diisi )}${NC}"
  echo -e "  🏷️  Nama Admin      : ${CYAN}${ADMIN_DISPLAY_NAME:-( tidak diisi )}${NC}"
  echo -e "  🔗 URL Kontak      : ${CYAN}${ADMIN_CONTACT_URL:-( auto dari username )}${NC}"
  echo -e "  💰 Harga PreOrder  : ${CYAN}Rp ${PREORDER_PRICE}${NC}"
  echo -e "  🌐 Port Server     : ${CYAN}${PORT}${NC}"
  echo ""

  # Konfirmasi lanjut
  local confirm=""
  while true; do
    read -r -p "$(echo -e "${BOLD}Lanjutkan instalasi dengan konfigurasi di atas? [y/n]: ${NC}")" confirm || true
    confirm="$(echo "$confirm" | tr '[:upper:]' '[:lower:]' | xargs)"
    case "$confirm" in
      y|yes) echo ""; ok "Konfigurasi dikonfirmasi. Melanjutkan instalasi..."; break ;;
      n|no)
        echo ""
        warn "Instalasi dibatalkan. Jalankan script lagi untuk mengisi ulang konfigurasi."
        exit 0
        ;;
      *) warn "Ketik 'y' untuk lanjut atau 'n' untuk batal." ;;
    esac
  done
}

# ============================================================
# set_env & setup_env
# ============================================================
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
  div
  log "Menulis konfigurasi ke .env..."
  if [ -f .env ]; then
    cp .env ".env.backup-$(date +%Y%m%d%H%M%S)"
    log "Backup .env lama disimpan."
  elif [ -f .env.example ]; then
    cp .env.example .env
  else
    touch .env
  fi

  # Wajib
  set_env TELEGRAM_BOT_TOKEN "$TELEGRAM_BOT_TOKEN"
  set_env ADMIN_ID           "$ADMIN_ID"
  set_env ADMIN_IDS          "$ADMIN_IDS"
  set_env GOPAY_KEY          "$GOPAY_KEY"

  # Kontak admin
  set_env ADMIN_USERNAME     "$ADMIN_USERNAME"
  set_env ADMIN_DISPLAY_NAME "$ADMIN_DISPLAY_NAME"
  set_env ADMIN_CONTACT_URL  "$ADMIN_CONTACT_URL"
  set_env ADMIN_CONTACT_TEXT "Silakan hubungi admin untuk bantuan pembayaran, kendala produk, atau pertanyaan sebelum membeli."

  # Sistem
  set_env DATABASE_PATH  "./database/ecommerce.db"
  set_env PORT           "$PORT"
  set_env NODE_ENV       "production"

  # Pembayaran
  set_env PAYMENT                   "GOPAY"
  set_env GOPAY_QRIS_GENERATE_URL   "https://v1-gateway.autogopay.site/qris/generate"
  set_env GOPAY_QRIS_STATUS_URL     "https://v1-gateway.autogopay.site/qris/status"
  set_env QRIS_EXPIRED_MINUTES      "$QRIS_EXPIRED_MINUTES"
  set_env QRIS_CHECK_INTERVAL_MS    "5000"
  set_env PAYMENT_REQUEST_TIMEOUT   "10000"
  set_env PAYMENT_NOTE              "Scan QRIS, bayar sesuai nominal, lalu tunggu bot memverifikasi pembayaran otomatis."
  set_env QRIS_EXPIRED_ACTION       "edit"
  set_env PAYMENT_REMINDER_AFTER_MINUTES "5"
  set_env PAYMENT_REMINDER_INTERVAL_MS   "120000"

  # Backup
  set_env BACKUP_AUTO_ENABLED "true"
  set_env BACKUP_TIME         "00:00"
  set_env BACKUP_TIMEZONE     "Asia/Jakarta"
  set_env BACKUP_KEEP_LOCAL   "14"
  set_env BACKUP_INCLUDE_ENV  "true"

  # Tampilan & fitur
  set_env MAINTENANCE_MODE  "off"
  set_env PRODUCT_PAGE_SIZE "6"
  set_env BROADCAST_DELAY_MS "80"

  # Pre Order
  set_env PREORDER_PRICE                "$PREORDER_PRICE"
  set_env PREORDER_MIN_TEXT_LENGTH      "20"
  set_env PREORDER_MAX_REVISION         "1"
  set_env PREORDER_QUOTE_EXPIRED_HOURS  "24"
  set_env PREORDER_QUOTE_EXPIRE_CHECK_MS "300000"

  # Auto-cleanup
  set_env CLEANUP_AUTO_ENABLED       "true"
  set_env CLEANUP_INTERVAL_MS        "21600000"
  set_env CLEANUP_QRIS_DAYS          "7"
  set_env CLEANUP_CART_DAYS          "14"
  set_env CLEANUP_ERROR_LOG_DAYS     "30"
  set_env CLEANUP_AUDIT_LOG_DAYS     "180"
  set_env CLEANUP_DELIVERY_LOG_DAYS  "180"
  set_env CLEANUP_NOTIFICATION_DAYS  "30"
  set_env CLEANUP_REPORT_DAYS        "30"
  set_env CLEANUP_NOTIFY_ADMIN       "false"

  # PM2
  set_env PM2_APP_NAME "$APP_NAME_DEFAULT"

  chmod 600 .env || true
  ok ".env berhasil ditulis dan dikunci (chmod 600)."
}

# ============================================================
# NPM & PYTHON DEPS
# ============================================================
install_project_dependencies(){
  div
  log "Membuat folder yang dibutuhkan..."
  mkdir -p database reports logs backups analytics config handlers services

  log "Install dependency Node.js..."
  npm cache clean --force 2>/dev/null || true
  npm install --legacy-peer-deps 2>&1 || npm install 2>&1 || {
    err "npm install gagal. Cek koneksi internet dan coba lagi."
    exit 1
  }

  if [ -f requirements.txt ] && [ -s requirements.txt ]; then
    log "Menyiapkan Python venv untuk analytics..."
    python3 -m venv venv
    # shellcheck source=/dev/null
    source "$(pwd)/venv/bin/activate"
    pip install --upgrade pip setuptools wheel -q
    pip install -r requirements.txt -q || warn "Sebagian dependency Python gagal. Analytics masih bisa dicek manual."
    deactivate
  fi
  ok "Semua dependency berhasil diinstall."
}

# ============================================================
# SYNTAX CHECK
# ============================================================
verify_syntax(){
  div
  log "Mengecek syntax project..."
  if npm run test 2>&1; then
    ok "Syntax JavaScript aman."
  else
    warn "npm run test gagal. Cek output di atas."
  fi
  if [ -d analytics ] && ls analytics/*.py >/dev/null 2>&1; then
    python3 -m py_compile analytics/*.py 2>/dev/null \
      && ok "Syntax Python aman." \
      || warn "Cek analytics Python jika diperlukan."
  fi
  if [ -n "$SCRIPT_FILE" ] && [ -f "$SCRIPT_FILE" ]; then
    bash -n "$SCRIPT_FILE" && ok "Syntax installer aman."
  else
    warn "Dijalankan via pipe, skip pengecekan bash syntax."
  fi
}

# ============================================================
# PM2
# ============================================================
setup_pm2(){
  if [ "$AUTO_PM2" != "1" ]; then
    warn "PM2 dilewati (AUTO_PM2=0)."; return 0
  fi
  div
  log "Menginstall dan menjalankan PM2..."
  run_root npm install -g pm2

  # Load .env agar PM2_APP_NAME terbaca
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
    pm2 startup systemd -u "$(whoami)" --hp "$HOME" \
      || warn "pm2 startup perlu dijalankan manual agar bot auto-start setelah reboot."
  else
    sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" \
      || warn "pm2 startup perlu dijalankan manual agar bot auto-start setelah reboot."
  fi
  ok "Bot berhasil dijalankan dengan PM2!"
}

# ============================================================
# SUMMARY
# ============================================================
summary(){
  # Load ulang .env untuk tampilkan PM2_APP_NAME yang benar
  [ -f .env ] && set -o allexport && source .env && set +o allexport || true
  local app_name="${PM2_APP_NAME:-$APP_NAME_DEFAULT}"

  echo ""
  echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${GREEN}║              🎉  INSTALASI SELESAI! BOT SUDAH AKTIF          ║${NC}"
  echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  ok "Project    : $(pwd)"
  ok "Bot Token  : ${TELEGRAM_BOT_TOKEN} ✅"
  ok "Admin ID   : ${ADMIN_ID} ✅"
  ok "GoPay Key  : ${GOPAY_KEY} ✅"
  echo ""
  div
  bold "📌 Command penting:"
  echo ""
  echo -e "  ${CYAN}pm2 status${NC}                   → cek status bot"
  echo -e "  ${CYAN}pm2 logs ${app_name}${NC}   → lihat log live"
  echo -e "  ${CYAN}pm2 restart ${app_name}${NC} → restart bot"
  echo -e "  ${CYAN}pm2 stop ${app_name}${NC}    → stop bot"
  echo -e "  ${CYAN}nano .env${NC}                    → edit konfigurasi manual"
  echo ""
  div
  bold "🔧 Jika ingin ubah konfigurasi:"
  echo ""
  echo "   nano .env         → edit langsung"
  echo "   pm2 restart $app_name → restart setelah edit"
  echo ""
  warn "URL Generate & Status QRIS sudah otomatis diset, tidak perlu diisi manual."
  echo ""
  ok "Bot Telegram E-Commerce kamu sudah berjalan! Coba kirim /start ke bot di Telegram."
  echo ""
}

# ============================================================
# MAIN
# ============================================================
main(){
  header
  require_supported_os
  prepare_sudo
  apt_install_all
  install_nodejs
  setup_repository
  collect_config        # ← input API key, validasi, konfirmasi
  setup_env             # ← tulis .env otomatis
  install_project_dependencies
  verify_syntax
  setup_pm2             # ← bot langsung jalan
  summary               # ← tampil ringkasan + commands
}

main "$@"
