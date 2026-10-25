#!/usr/bin/env bash
# Install a .desktop entry + icon so Waybar (and other launchers) show the
# Audio Bench logo and group the window correctly, even in `tauri dev`.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICON_SRC="$REPO_ROOT/apps/backend/icons/icon.png"
APP_ID="com.karumelabs.AudioBench"

SHARE="$HOME/.local/share"
ICON_DIR="$SHARE/icons/hicolor/256x256/apps"
DESKTOP_DIR="$SHARE/applications"

mkdir -p "$ICON_DIR" "$DESKTOP_DIR"
cp "$ICON_SRC" "$ICON_DIR/audio-bench.png"

cat > "$DESKTOP_DIR/audio-bench.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Audio Bench
Comment=Split long voice recordings into named clips
Exec=$REPO_ROOT/target/debug/audio-bench-backend
Icon=audio-bench
Terminal=false
Categories=Audio;AudioVideo;
StartupWMClass=$APP_ID
EOF

# Refresh icon cache if available.
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t "$SHARE/icons/hicolor" 2>/dev/null || true
fi

echo "Installed. Restart Waybar (or log out/in) to pick up the icon."
echo "  desktop: $DESKTOP_DIR/audio-bench.desktop"
echo "  icon:    $ICON_DIR/audio-bench.png"