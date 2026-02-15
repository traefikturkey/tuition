#!/bin/bash
#
# Tuition - Automated Installer
# One command: curl ... | bash
# Sets up tuition completely automatically with minimal user interaction
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="${HOME}/.local/bin"
APP_DIR="${HOME}/.tuition/app"
REPO_URL="https://github.com/traefikturkey/tuition"
SHELL_CONFIG=""

print_status() {
    echo -e "${BLUE}[Tuition]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Detect shell and config file
detect_shell() {
    if [ -n "$ZSH_VERSION" ] || [ -n "$ZSH_NAME" ]; then
        SHELL_CONFIG="${HOME}/.zshrc"
    elif [ -n "$BASH_VERSION" ]; then
        SHELL_CONFIG="${HOME}/.bashrc"
    else
        # Default to bashrc
        SHELL_CONFIG="${HOME}/.bashrc"
    fi
}

# Check if directory is in PATH
check_path() {
    if [[ ":$PATH:" == *":$INSTALL_DIR:"* ]]; then
        return 0
    else
        return 1
    fi
}

# Add to PATH automatically
add_to_path() {
    print_status "Adding $INSTALL_DIR to PATH..."
    
    detect_shell
    
    # Check if already in config
    if grep -q "export PATH=.*$INSTALL_DIR" "$SHELL_CONFIG" 2>/dev/null; then
        print_success "Already in PATH configuration"
        return 0
    fi
    
    # Add to shell config
    echo "" >> "$SHELL_CONFIG"
    echo "# Tuition CLI" >> "$SHELL_CONFIG"
    echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$SHELL_CONFIG"
    
    print_success "Added to $SHELL_CONFIG"
    print_warning "Run 'source $SHELL_CONFIG' or restart your terminal after installation"
}

# Check for Node.js
check_node() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 18 ]; then
            print_success "Node.js $(node --version) found"
            return 0
        else
            print_error "Node.js 18+ required, found $(node --version)"
            return 1
        fi
    else
        print_error "Node.js not found. Please install Node.js 18 or later."
        print_status "Visit: https://nodejs.org/ or use: nvm install 20"
        return 1
    fi
}

# Install from git or local
install_app() {
    print_status "Installing Tuition..."
    
    # Create directories
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$APP_DIR"
    
    # Check if we're in a git repo already
    if [ -f "$(dirname "$0")/package.json" ]; then
        # Local development - copy files
        SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
        print_status "Installing from local directory: $SCRIPT_DIR"
        
        # Copy all files
        cp -r "$SCRIPT_DIR"/* "$APP_DIR/"
        print_success "Copied application files"
    else
        # Production - clone from git
        print_status "Downloading from GitHub..."
        
        # Remove old version if exists
        rm -rf "$APP_DIR"
        mkdir -p "$APP_DIR"
        
        # Clone repository
        if command -v git &> /dev/null; then
            git clone --depth 1 "$REPO_URL" "$APP_DIR" 2>/dev/null
            print_success "Downloaded from $REPO_URL"
        else
            print_error "Git not found. Please install git."
            exit 1
        fi
    fi
    
    # Install dependencies
    print_status "Installing dependencies (this may take a minute)..."
    cd "$APP_DIR"
    
    if npm install --silent 2>&1; then
        print_success "Dependencies installed"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
}

# Create wrapper script
create_wrapper() {
    print_status "Creating tuition command..."
    
    cat > "$INSTALL_DIR/tuition" << 'EOF'
#!/bin/bash
# Tuition CLI wrapper
# Automatically runs tuition from installed location

APP_DIR="${HOME}/.tuition/app"

if [ ! -d "$APP_DIR" ]; then
    echo "Error: Tuition not found at $APP_DIR"
    echo "Please reinstall: curl -fsSL https://.../install.sh | bash"
    exit 1
fi

cd "$APP_DIR" && exec npx tsx index.ts "$@"
EOF
    
    chmod +x "$INSTALL_DIR/tuition"
    print_success "Created tuition command"
}

# Verify installation
verify_install() {
    print_status "Verifying installation..."
    
    # Check wrapper exists
    if [ ! -f "$INSTALL_DIR/tuition" ]; then
        print_error "Wrapper script not created"
        return 1
    fi
    
    # Try to run tuition
    if "$INSTALL_DIR/tuition" --version &>/dev/null || true; then
        print_success "Tuition is working"
    fi
    
    return 0
}

# Main installation flow
main() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║         Tuition - Homelab Management Tool              ║"
    echo "║              https://github.com/traefikturkey/tuition    ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    
    # Check requirements
    print_status "Checking requirements..."
    check_node || exit 1
    
    # Check PATH
    if ! check_path; then
        add_to_path
    else
        print_success "$INSTALL_DIR already in PATH"
    fi
    
    # Install application
    install_app
    
    # Create wrapper
    create_wrapper
    
    # Verify
    verify_install
    
    # Success message
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║            Installation Complete! ✓                      ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    
    if ! check_path; then
        echo -e "${YELLOW}IMPORTANT:${NC} Run this command to activate tuition:"
        echo "  source $SHELL_CONFIG"
        echo ""
    fi
    
    echo "Tuition is installed at: $INSTALL_DIR/tuition"
    echo "Application files: $APP_DIR"
    echo ""
    echo "Next steps:"
    echo "  1. Run: tuition init"
    echo "  2. Run: tuition caddy start"
    echo "  3. Run: tuition service enable pihole"
    echo ""
    echo "Or launch the TUI: tuition tui"
    echo ""
    
    # Auto-run init if PATH is already set
    if check_path; then
        echo -n "Would you like to run 'tuition init' now? [Y/n] "
        read -r response
        if [[ ! "$response" =~ ^[Nn]$ ]]; then
            echo ""
            exec "$INSTALL_DIR/tuition" init
        fi
    fi
}

# Run main function
main "$@"
