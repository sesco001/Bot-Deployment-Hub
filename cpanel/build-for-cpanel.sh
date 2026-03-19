#!/bin/bash
# ============================================================
# MaKames Digital Business Center - cPanel Build Script
# Run this from the root of the project:
#   bash cpanel/build-for-cpanel.sh
# ============================================================

set -e

echo "=========================================="
echo "  Building MaKames Center for cPanel"
echo "=========================================="

# 1. Build the React frontend with base path "/"
echo ""
echo "[1/3] Building React frontend..."
cd "$(dirname "$0")/.."

BASE_PATH="/" PORT=3000 pnpm --filter @workspace/business-center run build

echo "[1/3] Done."

# 2. Copy React build output into cpanel/
echo ""
echo "[2/3] Copying frontend build to cpanel/..."
rm -rf cpanel/public_files
mkdir -p cpanel/public_files
cp -r artifacts/business-center/dist/public/* cpanel/public_files/

echo "[2/3] Done."

# 3. Package everything into a zip
echo ""
echo "[3/3] Creating deployment zip..."
rm -f cpanel-deploy.zip

# Combine: frontend static files + PHP backend files
mkdir -p /tmp/cpanel-package
rm -rf /tmp/cpanel-package/*

# Copy PHP backend files
cp cpanel/.htaccess  /tmp/cpanel-package/
cp cpanel/install.sql /tmp/cpanel-package/
cp -r cpanel/api     /tmp/cpanel-package/
cp -r cpanel/config  /tmp/cpanel-package/

# Copy React frontend static files
cp -r cpanel/public_files/. /tmp/cpanel-package/

# Remove the public_files temp dir
rm -rf cpanel/public_files

tar -czf "$OLDPWD/cpanel-deploy.tar.gz" -C /tmp/cpanel-package .
cd "$OLDPWD"

rm -rf /tmp/cpanel-package

echo "[3/3] Done."
echo ""
echo "=========================================="
echo "  Build complete!"
echo "  Upload file: cpanel-deploy.tar.gz"
echo ""
echo "  Next steps:"
echo "  1. Create a MySQL database in cPanel"
echo "  2. Import install.sql into the database"
echo "  3. Edit config/db.php with your MySQL credentials"
echo "  4. Upload all files to your public_html folder"
echo "=========================================="
