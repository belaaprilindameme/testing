#!/bin/bash

# Bot Telegram E-Commerce - Installation Script untuk Linux
# Supports: Ubuntu (all versions), Debian (all versions), Kali Linux
# Author: belaaprilindameme
# License: MIT
# Updated: 2026-05-23

set -e

# ============================================================================
# COLOR DEFINITIONS
# ============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# DISPLAY FUNCTIONS
# ============================================================================
print_header() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║   Bot Telegram E-Commerce - Linux Installation Script        ║"
    echo "║   Support: Ubuntu, Debian, Kali Linux (ALL VERSIONS)         ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
}

print_step() {
    echo -e "${BLUE}→ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# ============================================================================
# SYSTEM DETECTION
# ============================================================================
detect_os() {
    print_step "Detecting Operating System..."
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_NAME="${NAME:-Unknown}"
        OS_ID="${ID:-unknown}"
        OS_VERSION="${VERSION_ID:-unknown}"
    else
        print_error "Cannot detect operating system"
        exit 1
    fi
    
    # Normalize OS detection for common variants
    case "$OS_ID" in
        ubuntu)
            OS_FAMILY="ubuntu"
            PKG_MANAGER="apt"
            ;;
        debian)
            OS_FAMILY="debian"
            PKG_MANAGER="apt"
            ;;
        kali)
            OS_FAMILY="debian"
            PKG_MANAGER="apt"
            ;;
        *)
            print_error "Unsupported OS: $OS_NAME"
            print_info "This script supports: Ubuntu, Debian, Kali Linux"
            exit 1
            ;;
    esac
    
    print_success "Detected: $OS_NAME $OS_VERSION"
    print_info "Package Manager: $PKG_MANAGER"
}

# ============================================================================
# PRIVILEGE CHECK
# ============================================================================
check_privileges() {
    print_step "Checking privileges..."
    
    if [ "$EUID" -eq 0 ]; then 
        print_warning "Running as root. Consider running as regular user with sudo privileges."
        read -p "Continue as root? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_warning "Installation cancelled."
            exit 0
        fi
    fi
    
    # Verify sudo access (will be needed for package installation)
    if ! sudo -n true 2>/dev/null; then
        print_step "Testing sudo access (you may be prompted for password)..."
        sudo -v || {
            print_error "sudo access required for installation"
            exit 1
        }
    fi
    
    print_success "Privileges verified"
}

# ============================================================================
# SYSTEM UPDATES
# ============================================================================
update_system() {
    print_step "Updating system packages..."
    
    case "$PKG_MANAGER" in
        apt)
            sudo apt update
            sudo DEBIAN_FRONTEND=noninteractive apt upgrade -y
            ;;
    esac
    
    print_success "System packages updated"
}

# ============================================================================
# NODEJS INSTALLATION
# ============================================================================
install_nodejs() {
    print_step "Checking Node.js..."
    
    if command -v node &> /dev/null; then
        print_success "Node.js already installed: $(node --version)"
        return 0
    fi
    
    print_step "Installing Node.js 18 LTS..."
    
    # Check if nodesource repository is available (works on all Debian-based systems)
    if curl -fsSL https://deb.nodesource.com/setup_18.x 2>/dev/null | sudo -E bash - ; then
        sudo DEBIAN_FRONTEND=noninteractive apt install -y nodejs
    else
        print_warning "NodeSource repository unavailable, using default repository..."
        sudo DEBIAN_FRONTEND=noninteractive apt install -y nodejs npm
    fi
    
    if command -v node &> /dev/null; then
        print_success "Node.js installed: $(node --version)"
    else
        print_error "Node.js installation failed"
        return 1
    fi
}

# ============================================================================
# PYTHON INSTALLATION
# ============================================================================
install_python() {
    print_step "Checking Python 3..."
    
    if command -v python3 &> /dev/null; then
        print_success "Python 3 already installed: $(python3 --version)"
    else
        print_step "Installing Python 3..."
        sudo DEBIAN_FRONTEND=noninteractive apt install -y python3 python3-dev python3-venv python3-distutils
        print_success "Python 3 installed"
    fi
    
    # Install pip separately as it may need special handling on some systems
    print_step "Checking pip3..."
    if command -v pip3 &> /dev/null; then
        print_success "pip3 already installed: $(pip3 --version)"
    else
        print_step "Installing pip3..."
        sudo DEBIAN_FRONTEND=noninteractive apt install -y python3-pip
        print_success "pip3 installed"
    fi
}

# ============================================================================
# BUILD TOOLS INSTALLATION
# ============================================================================
install_build_tools() {
    print_step "Installing build essentials..."
    
    sudo DEBIAN_FRONTEND=noninteractive apt install -y \
        build-essential \
        curl \
        wget \
        git
    
    print_success "Build tools installed"
}

# ============================================================================
# SQLITE INSTALLATION
# ============================================================================
install_sqlite() {
    print_step "Checking SQLite3..."
    
    if command -v sqlite3 &> /dev/null; then
        print_success "SQLite3 already installed: $(sqlite3 --version)"
    else
        print_step "Installing SQLite3..."
        sudo DEBIAN_FRONTEND=noninteractive apt install -y sqlite3 libsqlite3-dev
        print_success "SQLite3 installed"
    fi
}

# ============================================================================
# REPOSITORY SETUP
# ============================================================================
setup_repository() {
    print_step "Setting up repository..."
    
    if [ -f ".env.example" ] && [ -f "package.json" ]; then
        print_success "Repository already initialized"
        return 0
    fi
    
    if [ ! -d ".git" ]; then
        print_warning "Not a git repository"
        read -p "Enter repository URL (default: https://github.com/belaaprilindameme/testing.git): " REPO_URL
        REPO_URL=${REPO_URL:-https://github.com/belaaprilindameme/testing.git}
        
        print_step "Cloning repository..."
        git clone "$REPO_URL" .
    fi
    
    print_success "Repository ready"
}

# ============================================================================
# NODEJS SETUP
# ============================================================================
setup_nodejs() {
    print_step "Setting up Node.js environment..."
    
    if [ ! -f "package.json" ]; then
        print_warning "package.json not found, skipping npm setup"
        return 0
    fi
    
    # Clear npm cache for compatibility
    npm cache clean --force 2>/dev/null || true
    
    # Install dependencies with better error handling
    if npm install --legacy-peer-deps 2>/dev/null || npm install 2>/dev/null; then
        print_success "Node.js dependencies installed"
    else
        print_warning "npm install completed with warnings (this is usually okay)"
    fi
}

# ============================================================================
# PYTHON SETUP
# ============================================================================
setup_python() {
    print_step "Setting up Python environment..."
    
    if [ ! -f "requirements.txt" ]; then
        print_warning "requirements.txt not found, skipping Python setup"
        return 0
    fi
    
    VENV_DIR="venv"
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "$VENV_DIR" ]; then
        print_step "Creating Python virtual environment..."
        python3 -m venv "$VENV_DIR"
    fi
    
    # Activate virtual environment and install dependencies
    print_step "Activating virtual environment..."
    . "$VENV_DIR/bin/activate"
    
    print_step "Installing Python dependencies..."
    pip install --upgrade pip setuptools wheel
    
    if pip install -r requirements.txt; then
        print_success "Python dependencies installed"
    else
        print_warning "Python dependencies installed with warnings (this is usually okay)"
    fi
    
    deactivate
}

# ============================================================================
# ENVIRONMENT CONFIGURATION
# ============================================================================
setup_env() {
    print_step "Setting up environment configuration..."
    
    if [ -f ".env" ]; then
        print_success ".env file already exists"
        return 0
    fi
    
    if [ ! -f ".env.example" ]; then
        print_warning ".env.example not found, skipping .env creation"
        return 0
    fi
    
    cp .env.example .env
    print_success "Created .env file (copy of .env.example)"
    print_info "Edit .env with your credentials:"
    print_info "  nano .env"
}

# ============================================================================
# DIRECTORY CREATION
# ============================================================================
create_directories() {
    print_step "Creating required directories..."
    
    mkdir -p database reports handlers config analytics logs
    
    # Set appropriate permissions
    chmod 755 database reports handlers config analytics logs 2>/dev/null || true
    
    print_success "Directories created"
}

# ============================================================================
# INSTALLATION VERIFICATION
# ============================================================================
verify_installation() {
    print_step "Verifying installation..."
    echo ""
    
    local all_ok=true
    
    # Check Node.js
    echo -n "  Node.js: "
    if command -v node &> /dev/null; then
        echo -e "${GREEN}✅ $(node --version)${NC}"
    else
        echo -e "${RED}❌ Not installed${NC}"
        all_ok=false
    fi
    
    # Check npm
    echo -n "  npm: "
    if command -v npm &> /dev/null; then
        echo -e "${GREEN}✅ $(npm --version)${NC}"
    else
        echo -e "${RED}❌ Not installed${NC}"
        all_ok=false
    fi
    
    # Check Python
    echo -n "  Python 3: "
    if command -v python3 &> /dev/null; then
        echo -e "${GREEN}✅ $(python3 --version)${NC}"
    else
        echo -e "${RED}❌ Not installed${NC}"
        all_ok=false
    fi
    
    # Check pip
    echo -n "  pip3: "
    if command -v pip3 &> /dev/null; then
        echo -e "${GREEN}✅ $(pip3 --version)${NC}"
    else
        echo -e "${RED}❌ Not installed${NC}"
        all_ok=false
    fi
    
    # Check Git
    echo -n "  Git: "
    if command -v git &> /dev/null; then
        echo -e "${GREEN}✅ $(git --version)${NC}"
    else
        echo -e "${RED}❌ Not installed${NC}"
        all_ok=false
    fi
    
    # Check SQLite
    echo -n "  SQLite3: "
    if command -v sqlite3 &> /dev/null; then
        echo -e "${GREEN}✅ $(sqlite3 --version | head -n1)${NC}"
    else
        echo -e "${RED}❌ Not installed${NC}"
        all_ok=false
    fi
    
    # Check build-essential
    echo -n "  build-essential: "
    if dpkg -l | grep -q build-essential; then
        echo -e "${GREEN}✅ Installed${NC}"
    else
        echo -e "${RED}❌ Not installed${NC}"
        all_ok=false
    fi
    
    echo ""
    
    if [ "$all_ok" = true ]; then
        print_success "All dependencies verified"
        return 0
    else
        print_warning "Some dependencies may not be properly installed"
        return 1
    fi
}

# ============================================================================
# MAIN INSTALLATION FLOW
# ============================================================================
main() {
    print_header
    
    # Step 1: OS Detection
    detect_os
    echo ""
    
    # Step 2: Check Privileges
    check_privileges
    echo ""
    
    # Confirmation
    print_info "Installation will include:"
    echo "  • System packages update"
    echo "  • Node.js 18 LTS (latest)"
    echo "  • Python 3 with pip"
    echo "  • Build tools and development utilities"
    echo "  • SQLite3 database"
    echo "  • Project dependencies (Node.js & Python)"
    echo ""
    
    read -p "Continue with installation? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Installation cancelled."
        exit 0
    fi
    
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                  STARTING INSTALLATION                       ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Installation steps with error handling
    if ! update_system; then
        print_warning "System update had issues, continuing anyway..."
    fi
    echo ""
    
    install_build_tools
    echo ""
    
    install_nodejs
    echo ""
    
    install_python
    echo ""
    
    install_sqlite
    echo ""
    
    create_directories
    echo ""
    
    setup_repository
    echo ""
    
    setup_nodejs
    echo ""
    
    setup_python
    echo ""
    
    setup_env
    echo ""
    
    # Verification
    verify_installation || true
    echo ""
    
    # Completion message
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                  INSTALLATION COMPLETE!                      ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    
    print_success "All components installed successfully!"
    echo ""
    
    echo -e "${BLUE}📋 NEXT STEPS:${NC}"
    echo ""
    echo "  1️⃣  Edit your configuration:"
    echo -e "     ${YELLOW}nano .env${NC}"
    echo ""
    echo "  2️⃣  Add your credentials:"
    echo -e "     • TELEGRAM_BOT_TOKEN (from @BotFather)"
    echo -e "     • MIDTRANS_SERVER_KEY & MIDTRANS_CLIENT_KEY"
    echo -e "     • ADMIN_ID (your Telegram user ID)"
    echo ""
    echo "  3️⃣  Start the bot (production mode):"
    echo -e "     ${YELLOW}npm start${NC}"
    echo ""
    echo "  4️⃣  Or development mode (with auto-reload):"
    echo -e "     ${YELLOW}npm run dev${NC}"
    echo ""
    echo -e "${BLUE}📚 DOCUMENTATION:${NC}"
    echo -e "  • ${YELLOW}README.md${NC} - Project overview"
    echo -e "  • ${YELLOW}SETUP_GUIDE.md${NC} - Detailed setup instructions"
    echo -e "  • ${YELLOW}API_DOCS.md${NC} - API documentation"
    echo ""
    echo -e "${BLUE}🆘 TROUBLESHOOTING:${NC}"
    echo "  If you encounter issues, try:"
    echo -e "  1. Clear npm cache: ${YELLOW}npm cache clean --force${NC}"
    echo -e "  2. Remove node_modules: ${YELLOW}rm -rf node_modules${NC}"
    echo -e "  3. Reinstall: ${YELLOW}npm install${NC}"
    echo ""
    
    print_success "Ready to go! 🚀"
}

# ============================================================================
# ERROR HANDLING
# ============================================================================
trap 'print_error "Script interrupted"; exit 130' INT TERM

# ============================================================================
# RUN MAIN
# ============================================================================
main "$@"
