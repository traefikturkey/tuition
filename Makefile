# Tuition Homelab Manager - Makefile
# Simple, standard targets that work everywhere

.PHONY: help install uninstall dev build test lint clean

# Default target
help:
	@echo "Tuition Homelab Manager"
	@echo ""
	@echo "Available targets:"
	@echo "  make install     - Install tuition globally (creates 'tuition' command)"
	@echo "  make uninstall   - Remove tuition from system"
	@echo "  make dev         - Run in development mode"
	@echo "  make build       - Build for production"
	@echo "  make test        - Run all tests"
	@echo "  make lint        - Check TypeScript"
	@echo "  make clean       - Remove build artifacts"
	@echo ""
	@echo "Quick start:"
	@echo "  make install && tuition init"

# Install tuition globally
install:
	@echo "Installing Tuition..."
	@chmod +x scripts/install.sh
	@./scripts/install.sh
	@echo ""
	@echo "Installation complete!"
	@echo "Run 'tuition init' to get started."

# Uninstall tuition
uninstall:
	@echo "Uninstalling Tuition..."
	@rm -f /usr/local/bin/tuition
	@rm -rf ~/.tuition/app
	@echo "✓ Tuition removed"

# Development mode - uses npx tsx for compatibility
dev:
	@npx tsx index.ts $(ARGS)

# Build for production
build:
	@echo "Building Tuition..."
	@npx tsc --outDir dist
	@echo "✓ Build complete in dist/"

# Run tests
test:
	@bun test

# TypeScript check
lint:
	@npx tsc --noEmit
	@echo "✓ TypeScript check passed"

# Clean build artifacts
clean:
	@rm -rf dist/
	@echo "✓ Cleaned build artifacts"

# Quick start - install and initialize
quickstart: install
	@echo ""
	@echo "Starting initialization..."
	@tuition init
