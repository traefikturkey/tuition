#!/bin/bash
#
# Tuition Installation Script
# Simplifies setup to: curl ... | bash && tuition init
#

set -e

INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
REPO_URL="https://github.com/traefikturkey/tuition"
INSTALL_PATH="${INSTALL_DIR}/tuition"

echo "Installing Tuition..."

# Check if we're in a git repo (development mode)
if [ -f "$(dirname "$0")/../package.json" ]; then
    # Development mode - use local files
    SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
    echo "Development mode detected at: $SCRIPT_DIR"
    
    # Create wrapper script
    cat > "$INSTALL_PATH" << EOF
#!/bin/bash
# Tuition CLI wrapper
exec npx tsx "$SCRIPT_DIR/index.ts" "\$@"
EOF
    
else
    # Production mode - clone repo
    TEMP_DIR=$(mktemp -d)
    echo "Cloning repository..."
    git clone --depth 1 "$REPO_URL" "$TEMP_DIR/tuition" 2>/dev/null || {
        echo "Failed to clone repository. Please install manually."
        exit 1
    }
    
    # Move to permanent location
    INSTALL_DIR_PERMANENT="${HOME}/.tuition/app"
    mkdir -p "$INSTALL_DIR_PERMANENT"
    mv "$TEMP_DIR/tuition"/* "$INSTALL_DIR_PERMANENT/"
    rm -rf "$TEMP_DIR"
    
    # Create wrapper script
    cat > "$INSTALL_PATH" << EOF
#!/bin/bash
# Tuition CLI wrapper
exec npx tsx "$INSTALL_DIR_PERMANENT/index.ts" "\$@"
EOF
fi

# Make executable
chmod +x "$INSTALL_PATH"

# Check if install directory is in PATH
if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
    echo ""
    echo "WARNING: $INSTALL_DIR is not in your PATH"
    echo "Add this to your ~/.bashrc or ~/.zshrc:"
    echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
    echo ""
fi

echo "✓ Tuition installed to: $INSTALL_PATH"
echo ""
echo "Next steps:"
echo "  1. Ensure $INSTALL_DIR is in your PATH"
echo "  2. Run: tuition init"
echo ""
echo "Usage:"
echo "  tuition init              # Initialize configuration"
echo "  tuition config show         # Show configuration"
echo "  tuition service list        # List services"
echo "  tuition service enable <name>  # Enable a service"
echo "  tuition tui                 # Launch interactive UI"
