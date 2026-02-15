#!/bin/bash
#
# Tuition - Robust Automated Installer
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

INSTALL_DIR="${HOME}/.local/bin"
APP_DIR="${HOME}/.tuition/app"
REPO_URL="https://github.com/traefikturkey/tuition"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║         Tuition - Homelab Manager                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Check Node.js
echo -e "${BLUE}[1/4]${NC} Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗${NC} Node.js not found. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/ or run: nvm install 20"
    exit 1
fi
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗${NC} Node.js 18+ required. Found: $(node --version)"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $(node --version)"

# Step 2: Setup PATH
echo ""
echo -e "${BLUE}[2/4]${NC} Setting up PATH..."
mkdir -p "$INSTALL_DIR"
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    SHELL_CONFIG="${HOME}/.bashrc"
    [ -f "${HOME}/.zshrc" ] && SHELL_CONFIG="${HOME}/.zshrc"
    echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$SHELL_CONFIG"
    echo -e "${YELLOW}!${NC} Added $INSTALL_DIR to PATH in $SHELL_CONFIG"
    echo "   Run: source $SHELL_CONFIG (or restart terminal)"
fi

# Step 3: Download
echo ""
echo -e "${BLUE}[3/4]${NC} Downloading Tuition..."

# Clean and create
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR"

# Clone with better error handling
if ! command -v git &> /dev/null; then
    echo -e "${RED}✗${NC} Git not found. Install git: sudo apt install git"
    exit 1
fi

echo "   Cloning from $REPO_URL..."
if git clone --depth 1 --branch feature/initial-implementation "$REPO_URL" "$APP_DIR" 2>&1 | grep -v "^remote:"; then
    echo -e "${GREEN}✓${NC} Downloaded successfully"
else
    echo -e "${YELLOW}!${NC} Shallow clone failed, trying full clone..."
    rm -rf "$APP_DIR"
    if git clone "$REPO_URL" "$APP_DIR" 2>&1 | grep -v "^remote:"; then
        cd "$APP_DIR"
        git checkout feature/initial-implementation 2>&1 || true
        echo -e "${GREEN}✓${NC} Downloaded (full clone)"
    else
        echo -e "${RED}✗${NC} Git clone failed. Check network connectivity."
        exit 1
    fi
fi

# Verify files were downloaded
if [ ! -f "$APP_DIR/package.json" ]; then
    echo -e "${RED}✗${NC} Download failed - package.json not found"
    ls -la "$APP_DIR/"
    exit 1
fi

# Step 4: Install dependencies
echo ""
echo -e "${BLUE}[4/4]${NC} Installing dependencies..."
cd "$APP_DIR"

# Show npm output
if npm install 2>&1; then
    echo -e "${GREEN}✓${NC} Dependencies installed"
else
    echo -e "${YELLOW}!${NC} Standard install failed, trying with --legacy-peer-deps..."
    if npm install --legacy-peer-deps 2>&1; then
        echo -e "${GREEN}✓${NC} Dependencies installed (with --legacy-peer-deps)"
    else
        echo -e "${RED}✗${NC} npm install failed"
        echo "   Check: $APP_DIR"
        exit 1
    fi
fi

# Create wrapper
echo ""
echo -e "${BLUE}[Post]${NC} Creating tuition command..."
cat > "$INSTALL_DIR/tuition" << 'EOF'
#!/bin/bash
APP_DIR="${HOME}/.tuition/app"
if [ ! -d "$APP_DIR" ]; then
    echo "Error: Tuition not found. Please reinstall."
    exit 1
fi
cd "$APP_DIR" && exec npx tsx index.ts "$@"
EOF
chmod +x "$INSTALL_DIR/tuition"

# Verify
if [ -f "$INSTALL_DIR/tuition" ]; then
    echo -e "${GREEN}✓${NC} Tuition command created"
else
    echo -e "${RED}✗${NC} Failed to create tuition command"
    exit 1
fi

# Success
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║            Installation Complete! ✓                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Tuition is installed at: $INSTALL_DIR/tuition"
echo "Application files: $APP_DIR"
echo ""

# Show next steps
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo -e "${YELLOW}IMPORTANT:${NC} Run this to activate:"
    SHELL_CONFIG="${HOME}/.bashrc"
    [ -f "${HOME}/.zshrc" ] && SHELL_CONFIG="${HOME}/.zshrc"
    echo "  source $SHELL_CONFIG"
    echo ""
fi

echo "Next step: tuition init"
echo ""
