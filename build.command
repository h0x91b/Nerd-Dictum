#!/bin/bash
# Build script for Nerd Dictum
# Double-click to open in Terminal

cd "$(dirname "$0")"

echo "=== Installing fnm and Node.js ==="
eval "$(fnm env)"
fnm install --lts
fnm use --lts

echo ""
echo "=== Installing dependencies ==="
bun install

echo ""
echo "=== Building and packaging ==="
bun run dist

echo ""
echo "=== Done! ==="
echo "Check the 'release' folder for the built app."
open release

echo ""
read -p "Press Enter to close..."
