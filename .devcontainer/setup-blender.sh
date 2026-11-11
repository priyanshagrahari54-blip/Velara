#!/usr/bin/env bash
# ============================================================================
# VELARA asset-factory: headless Blender install (codespace, idempotent).
# Runs as devcontainer postCreateCommand. No GUI needed — pure CPU.
# Official tarball ( licences: GPL, source blender.org ) — self-contained.
# ============================================================================
set -euo pipefail

VERSION="4.5.16"   # verified on https://download.blender.org/release/Blender4.5/
MAJOR="${VERSION%.*}"   # 4.5

# Already installed? -> fast exit (makes rebuild/re-run cheap)
if command -v blender >/dev/null 2>&1 && blender --version 2>/dev/null | head -1 | grep -q "$VERSION"; then
  echo "[blender] $VERSION already installed"
  blender --version | head -1
  exit 0
fi

echo "[blender] installing $VERSION (official tarball) ..."

# Runtime libs Blender needs even in --background mode (Debian bookworm names)
sudo apt-get update -qq
sudo apt-get install -y -qq libx11-6 libxi6 libxxf86vm1 libxfixes3 libxrender1 \
  libgl1 libxkbcommon0 libsm6 libice6 xz-utils >/dev/null

cd /tmp
curl -fsSL --retry 3 -o blender.tar.xz \
  "https://download.blender.org/release/Blender${MAJOR}/blender-${VERSION}-linux-x64.tar.xz"
sudo mkdir -p /opt/blender
sudo tar -xJf blender.tar.xz -C /opt/blender --strip-components=1
sudo ln -sf /opt/blender/blender /usr/local/bin/blender
rm -f blender.tar.xz

blender --version | head -1
echo "[blender] install done"
