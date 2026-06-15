#!/bin/bash
SERVICE="com.notecraft.server"
PLIST_DST="/Users/kanishkaran/Library/LaunchAgents/com.notecraft.server.plist"
GUI_DOMAIN="gui/$(id -u)"

launchctl bootout "$GUI_DOMAIN/$SERVICE" 2>/dev/null
rm -f "$PLIST_DST"
echo "Notecraft server stopped."
