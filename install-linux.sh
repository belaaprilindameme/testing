#!/bin/bash

# Bot Telegram E-Commerce - Installation Script untuk Linux
# Supports: Ubuntu, Debian, Kali Linux
# Author: belaaprilindameme
# License: MIT

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   Bot Telegram E-Commerce - Linux Installation Script        ║"
echo "║   Support: Ubuntu, Debian, Kali Linux                        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${YELLOW}⚠️  Warning: Running as root. It's recommended to run as normal user.${NC}"
   echo ""
fi

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VERSION=$VERSION_ID
    else
        echo -e "${RED}❌ Cannot detect OS${NC}"
        exit 1
    fi
}

# Update system
update_system() {
    echo -e "${BLUE}📦 Updating system packages...${NC}"
    if command -v apt &> /dev/null; then
        sudo apt update
        sudo apt upgrade -y
    else
        echo -e "${RED}❌ apt not found${NC}"
        exit 1
    fi
}

# Install Node.js
install_nodejs() {
    echo -e "${BLUE}📦 Checking Node.js...${NC}"
    
    if ! command -v node &> /dev/null; then
        echo -e "${YELLOW}⏳ Node.js not found. Installing...${NC}"
        
        # Install Node.js 18 (LTS)
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt install -y nodejs
        
        echo -e "${GREEN}✅ Node.js installed${NC}"
        echo "   Version: $(node --version)"
    else
        echo -e "${GREEN}✅ Node.js already installed${NC}"
        echo "   Version: $(node --version)"
    fi
}

# Install Python
install_python() {
    echo -e "${BLUE}📦 Checking Python...${NC}"
    
    if ! command -v python3 &> /dev/null; then
        echo -e "${YELLOW}⏳ Python3 not found. Installing...${NC}"
        sudo apt install -y python3 python3-pip python3-venv
        
        echo -e "${GREEN}✅ Python3 installed${NC}"
        echo "   Version: $(python3 --version)"
    else
        echo -e "${GREEN}✅ Python3 already installed${NC}"
        echo "   Version: $(python3 --version)"
    fi
    
    # Check pip
    if ! command -v pip3 &> /dev/null; then
        echo -e "${YELLOW}⏳ pip3 not found. Installing...${NC}"
        sudo apt install -y python3-pip
        echo -e "${GREEN}✅ pip3 installed${NC}"
    else
        echo -e "${GREEN}✅ pip3 already installed${NC}"
        echo "   Version: $(pip3 --version)"
    fi
}

# Install Git
install_git() {
    echo -e "${BLUE}📦 Checking Git...${NC}"
    
    if ! command -v git &> /dev/null; then
        echo -e "${YELLOW}⏳ Git not found. Installing...${NC}"
        sudo apt install -y git
        
        echo -e "${GREEN}✅ Git installed${NC}"
        echo "   Version: $(git --version)"
    else
        echo -e "${GREEN}✅ Git already installed${NC}"
        echo "   Version: $(git --version)"
    fi
}

# Install SQLite
install_sqlite() {
    echo -e "${BLUE}📦 Checking SQLite3...${NC}"
    
    if ! command -v sqlite3 &> /dev/null; then
        echo -e "${YELLOW}⏳ SQLite3 not found. Installing...${NC}"
        sudo apt install -y sqlite3 libsqlite3-dev
        
        echo -e "${GREEN}✅ SQLite3 installed${NC}"
        echo "   Version: $(sqlite3 --version)"
    else
        echo -e "${GREEN}✅ SQLite3 already installed${NC}"
        echo "   Version: $(sqlite3 --version)"
    fi
}

# Install build tools
install_build_tools() {
    echo -e "${BLUE}📦 Installing build tools...${NC}"
    
    sudo apt install -y build-essential
    
    echo -e "${GREEN}✅ Build tools installed${NC}"
}

# Clone or setup repository
setup_repository() {
    echo -e "${BLUE}📂 Setting up repository...${NC}"
    
    if [ ! -d ".git" ]; then
        echo -e "${YELLOW}⏳ Not a git repository. Cloning...${NC}"
        read -p "Enter repository URL (default: https://github.com/belaaprilindameme/testing.git): " REPO_URL
        REPO_URL=${REPO_URL:-https://github.com/belaaprilindameme/testing.git}
        
        git clone "$REPO_URL" .
    fi
    
    echo -e "${GREEN}✅ Repository ready${NC}"
}

# Install Node.js dependencies
setup_nodejs() {
    echo -e "${BLUE}📦 Installing Node.js dependencies...${NC}"
    
    npm install
    
    echo -e "${GREEN}✅ Node.js dependencies installed${NC}"
}

# Setup Python virtual environment
setup_python() {
    echo -e "${BLUE}🐍 Setting up Python environment...${NC}"
    
    if [ ! -d "venv" ]; then
        echo -e "${YELLOW}⏳ Creating virtual environment...${NC}"
        python3 -m venv venv
    fi
    
    echo -e "${YELLOW}⏳ Activating virtual environment...${NC}"
    source venv/bin/activate
    
    echo -e "${YELLOW}⏳ Installing Python dependencies...${NC}"
    pip install --upgrade pip
    pip install -r requirements.txt
    
    echo -e "${GREEN}✅ Python environment ready${NC}"
}

# Setup environment configuration
setup_env() {
    echo -e "${BLUE}⚙️  Setting up environment configuration...${NC}"
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            echo -e "${GREEN}✅ Created .env file${NC}"
            echo -e "${YELLOW}⚠️  Edit .env with your credentials:${NC}"
            echo -e "   ${BLUE}nano .env${NC}"
        else
            echo -e "${RED}❌ .env.example not found${NC}"
        fi
    else
        echo -e "${GREEN}✅ .env file already exists${NC}"
    fi
}

# Create directories
create_directories() {
    echo -e "${BLUE}📁 Creating directories...${NC}"
    
    mkdir -p database
    mkdir -p reports
    mkdir -p handlers
    mkdir -p config
    mkdir -p analytics
    
    echo -e "${GREEN}✅ Directories created${NC}"
}

# Test installation
test_installation() {
    echo -e "${BLUE}🧪 Testing installation...${NC}"
    
    # Test Node.js
    echo -n "  Testing Node.js... "
    if node -v > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌${NC}"
    fi
    
    # Test npm
    echo -n "  Testing npm... "
    if npm -v > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌${NC}"
    fi
    
    # Test Python
    echo -n "  Testing Python3... "
    if python3 -v > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌${NC}"
    fi
    
    # Test pip
    echo -n "  Testing pip3... "
    if pip3 -v > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌${NC}"
    fi
    
    # Test Git
    echo -n "  Testing Git... "
    if git --version > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌${NC}"
    fi
    
    # Test SQLite
    echo -n "  Testing SQLite3... "
    if sqlite3 --version > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌${NC}"
    fi
}

# Main installation flow
main() {
    echo ""
    echo -e "${BLUE}🔍 Detecting OS...${NC}"
    detect_os
    echo -e "${GREEN}✅ Detected: $OS $VERSION${NC}"
    echo ""
    
    read -p "Continue installation? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Installation cancelled.${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    
    # Installation steps
    update_system
    echo ""
    
    install_git
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
    
    test_installation
    echo ""
    
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${GREEN}🎉 Installation Complete!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. Edit your configuration:"
    echo -e "     ${YELLOW}nano .env${NC}"
    echo ""
    echo "  2. Add your credentials:"
    echo -e "     - TELEGRAM_BOT_TOKEN (from @BotFather)"
    echo -e "     - MIDTRANS_SERVER_KEY & MIDTRANS_CLIENT_KEY"
    echo -e "     - ADMIN_ID (your Telegram user ID)"
    echo ""
    echo "  3. Start the bot:"
    echo -e "     ${YELLOW}npm start${NC}"
    echo ""
    echo "  4. Or development mode with auto-reload:"
    echo -e "     ${YELLOW}npm run dev${NC}"
    echo ""
    echo -e "${BLUE}For more info, read:${NC}"
    echo -e "  - ${YELLOW}SETUP_GUIDE.md${NC}"
    echo -e "  - ${YELLOW}README.md${NC}"
    echo -e "  - ${YELLOW}API_DOCS.md${NC}"
    echo ""
}

# Run main function
main
