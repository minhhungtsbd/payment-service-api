#!/bin/bash

# Setup script for disk space monitoring
# This script sets up the disk monitor to run every 5 minutes

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Setting up disk space monitoring..."
echo "Project directory: $PROJECT_DIR"

# Make the monitor script executable
chmod +x "$SCRIPT_DIR/disk-monitor.js"

# Install js-yaml if not already installed (for config parsing)
cd "$PROJECT_DIR"
if [ ! -d "node_modules/js-yaml" ]; then
    echo "Installing js-yaml for config parsing..."
    npm install js-yaml --save-dev
fi

# Create cron job
CRON_JOB="*/5 * * * * cd $PROJECT_DIR && node scripts/disk-monitor.js >> /var/log/disk-monitor.log 2>&1"

# Add to crontab if not already present
(crontab -l 2>/dev/null | grep -v "disk-monitor.js"; echo "$CRON_JOB") | crontab -

echo "✅ Disk monitoring setup complete!"
echo "📊 Monitor runs every 5 minutes"
echo "📋 Logs are written to: /var/log/disk-monitor.log"
echo "⚠️  Alerts at: 80% (warning), 90% (critical)"
echo "🔧 Manual check: node scripts/disk-monitor.js"

# Test the monitor once
echo ""
echo "🧪 Running initial test..."
node "$SCRIPT_DIR/disk-monitor.js"

echo ""
echo "📅 Current crontab:"
crontab -l | grep disk-monitor
