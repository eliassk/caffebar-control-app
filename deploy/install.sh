#!/bin/bash
# CoffeeBar install script for Ubuntu
# Run: sudo ./deploy/install.sh (from project root, or use --dir)
# Options: --dir PATH, --port PORT, --user USER, --no-start

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${INSTALL_DIR:-$(dirname "$SCRIPT_DIR")}"
PORT="${PORT:-3001}"
SERVICE_USER="${SERVICE_USER:-coffeebar}"
DO_START=1
NODE_PATH=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --user)
      SERVICE_USER="$2"
      shift 2
      ;;
    --no-start)
      DO_START=0
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Resolve absolute path
INSTALL_DIR="$(cd "$INSTALL_DIR" && pwd)"

echo "=== CoffeeBar install ==="
echo "Install dir: $INSTALL_DIR"
echo "Port: $PORT"
echo "User: $SERVICE_USER"
echo ""

# Must run as root
if [[ $(id -u) -ne 0 ]]; then
  echo "Error: run with sudo"
  exit 1
fi

# Check we're in the project
if [[ ! -d "$INSTALL_DIR/backend" ]] || [[ ! -d "$INSTALL_DIR/frontend" ]]; then
  echo "Error: run from project root (must contain backend/ and frontend/)"
  exit 1
fi

# Node.js 18+
if ! command -v node &>/dev/null; then
  echo "Error: Node.js not found. Install with:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "  sudo apt install -y nodejs"
  exit 1
fi

NODE_VER=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [[ -z "$NODE_VER" ]] || [[ "$NODE_VER" -lt 18 ]]; then
  echo "Error: Node.js 18+ required (found: $(node -v 2>/dev/null || echo 'unknown'))"
  echo "Install Node 20: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
  exit 1
fi

NODE_PATH="$(command -v node)"
echo "Node: $NODE_PATH ($(node -v))"

# Create service user
if ! id "$SERVICE_USER" &>/dev/null; then
  echo "Creating user $SERVICE_USER..."
  useradd -r -s /bin/false "$SERVICE_USER"
fi

# Install deps and build
echo ""
echo "Installing dependencies..."
cd "$INSTALL_DIR"
npm install

echo ""
echo "Building..."
npm run build

# Config from examples if missing
for f in allowlist lightGroups entityNames scenes; do
  if [[ ! -f "$INSTALL_DIR/config/${f}.json" ]]; then
    if [[ -f "$INSTALL_DIR/config/${f}.json.example" ]]; then
      echo "Creating config/${f}.json from example"
      cp "$INSTALL_DIR/config/${f}.json.example" "$INSTALL_DIR/config/${f}.json"
    fi
  fi
done

# .env from example if missing
if [[ ! -f "$INSTALL_DIR/backend/.env" ]]; then
  echo "Creating backend/.env from example"
  cp "$INSTALL_DIR/backend/.env.example" "$INSTALL_DIR/backend/.env"
  # Set port
  sed -i "s/^PORT=.*/PORT=$PORT/" "$INSTALL_DIR/backend/.env"
  echo "  Edit backend/.env: set HA_BASE_URL, HA_TOKEN, ALLOWED_ORIGINS"
fi

# Ensure data dir exists
mkdir -p "$INSTALL_DIR/data"

# Permissions
echo ""
echo "Setting permissions..."
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# Systemd service
SERVICE_FILE="/etc/systemd/system/coffeebar.service"
echo ""
echo "Installing systemd service..."

cat > "$SERVICE_FILE" << EOF
[Unit]
Description=CoffeeBar Control Panel
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/backend/.env
ExecStart=$NODE_PATH $INSTALL_DIR/backend/dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

if [[ $DO_START -eq 1 ]]; then
  echo "Enabling and starting coffeebar..."
  systemctl enable coffeebar
  systemctl restart coffeebar
  sleep 1
  if systemctl is-active --quiet coffeebar; then
    echo ""
    echo "=== CoffeeBar installed and running ==="
    echo "  URL: http://$(hostname -I | awk '{print $1}'):$PORT"
    echo "  Health: curl http://localhost:$PORT/health"
    echo ""
    echo "  Edit backend/.env for HA_BASE_URL, HA_TOKEN, ALLOWED_ORIGINS"
    echo "  Edit config/*.json for your entities"
    echo "  Restart: sudo systemctl restart coffeebar"
  else
    echo "Warning: service may have failed. Check: sudo journalctl -u coffeebar -n 20"
  fi
else
  echo "Skipping start (--no-start). Enable manually: sudo systemctl enable --now coffeebar"
fi
