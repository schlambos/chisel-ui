#!/bin/bash
set -e

TARBALL_PATH=$1

if [ -z "$TARBALL_PATH" ]; then
  echo "Usage: $0 <tarball-path>"
  exit 1
fi

echo "========================================"
echo "Smoke test for web-cli tarball"
echo "========================================"
echo "Tarball: $TARBALL_PATH"

# 1. Extract tarball
echo ""
echo "1. Extracting tarball..."
TEMP_DIR=$(mktemp -d)
tar -xzf "$TARBALL_PATH" -C "$TEMP_DIR"

# 2. Verify directory structure
echo ""
echo "2. Verifying directory structure..."
if [ ! -d "$TEMP_DIR/aionui-web" ]; then
  echo "❌ Missing aionui-web directory"
  exit 1
fi

cd "$TEMP_DIR/aionui-web"

# New layout (bun compile standalone binary):
#   aionui-web/
#   ├── aionui-web           ← single compiled executable (no bin/, no dist/, no node_modules)
#   ├── package.json         ← for version lookup
#   ├── static/              ← SPA assets
#   └── bundled-aionui-backend/<plat-arch>/...
for dir in static bundled-aionui-backend; do
  if [ ! -d "$dir" ]; then
    echo "❌ Missing $dir directory"
    exit 1
  fi
  echo "✓ Found $dir/"
done

if [ ! -f "package.json" ]; then
  echo "❌ Missing package.json"
  exit 1
fi
echo "✓ Found package.json"

# 3. Check executable
echo ""
echo "3. Checking executable..."
if [ ! -x "aionui-web" ]; then
  echo "❌ aionui-web is not executable"
  exit 1
fi
echo "✓ aionui-web is executable"

# 4. Test version command
echo ""
echo "4. Testing version command..."
VERSION=$(./aionui-web version)
if [ -z "$VERSION" ]; then
  echo "❌ version command returned empty"
  exit 1
fi
echo "✓ Version: $VERSION"

# 5. Test backend binary (may be empty placeholder when ALLOW_MISSING=1)
echo ""
echo "5. Checking backend binary..."
BACKEND_DIR="bundled-aionui-backend/$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/aarch64/arm64/; s/x86_64/x64/')"
BACKEND_BINARY="$BACKEND_DIR/aionui-backend"
if [ -x "$BACKEND_BINARY" ]; then
  BACKEND_VERSION=$("$BACKEND_BINARY" --version 2>&1 || true)
  echo "✓ Backend version: $BACKEND_VERSION"
elif [ -f "$BACKEND_DIR/manifest.json" ]; then
  echo "⚠️ Backend not present (ALLOW_MISSING placeholder: $BACKEND_DIR/manifest.json)"
else
  echo "❌ Backend directory missing entirely: $BACKEND_DIR"
  exit 1
fi

# Cleanup
cd -
rm -rf "$TEMP_DIR"

echo ""
echo "========================================"
echo "✅ Smoke test passed!"
echo "========================================"
