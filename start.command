#!/bin/bash
cd "$(dirname "$0")"
clear

echo ""
echo "  ╭─────────────────────────────────╮"
echo "  │   🟣  Starting EBP-SLP          │"
echo "  ╰─────────────────────────────────╯"
echo ""

# Check Node is installed
if ! command -v node &> /dev/null; then
    echo "  ❌ Node.js is not installed on this Mac."
    echo ""
    echo "  Please install Node.js from: https://nodejs.org"
    echo "  Download the LTS version, run the installer,"
    echo "  then double-click this file again."
    echo ""
    read -n 1 -s -r -p "  Press any key to close..."
    exit 1
fi

NODE_VERSION=$(node --version)
echo "  ✓ Node.js $NODE_VERSION detected"
echo ""

# Compute a hash of package.json to detect new dependencies
PKG_HASH=$(md5 -q package.json 2>/dev/null || md5sum package.json 2>/dev/null | awk '{print $1}')
HASH_FILE=".pkg_hash"
STORED_HASH=""
if [ -f "$HASH_FILE" ]; then
    STORED_HASH=$(cat "$HASH_FILE")
fi

NEEDS_INSTALL=false
if [ ! -d "node_modules" ]; then
    NEEDS_INSTALL=true
elif [ "$PKG_HASH" != "$STORED_HASH" ]; then
    echo "  📦 New dependencies detected — doing clean reinstall..."
    echo ""
    rm -rf node_modules
    rm -f "$HASH_FILE"
    NEEDS_INSTALL=true
fi

if [ "$NEEDS_INSTALL" = true ]; then
    echo "  📦 Installing dependencies (1–3 min)..."
    echo ""
    npm install --legacy-peer-deps
    INSTALL_RESULT=$?
    if [ $INSTALL_RESULT -ne 0 ]; then
        echo ""
        echo "  ❌ Install failed. Take a screenshot and send to Claude."
        echo ""
        read -n 1 -s -r -p "  Press any key to close..."
        exit 1
    fi
    echo "$PKG_HASH" > "$HASH_FILE"
    echo ""
    echo "  ✅ Dependencies installed!"
    echo ""
else
    echo "  ✓ Dependencies up to date"
    echo ""
fi

# Start Expo
echo "  🚀 Starting the development server..."
echo ""
echo "  ───────────────────────────────────────────────"
echo "  When the QR code appears below:"
echo "    1. Open the Camera app on your iPhone"
echo "    2. Point it at the QR code"
echo "    3. Tap the yellow notification"
echo "  ───────────────────────────────────────────────"
echo ""
echo "  To stop later: press Ctrl+C in this window"
echo ""

npx expo start --tunnel --clear
