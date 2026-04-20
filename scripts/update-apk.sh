#!/bin/bash
# Rebuild and publish latest APK
set -e
cd /home/ankur/projects/taskflow/frontend

export ANDROID_HOME=~/android-sdk
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH

echo "Building Angular..."
npm run build -- --configuration=production 2>&1 | tail -3

echo "Syncing to Android..."
npx cap sync android 2>&1 | tail -3

echo "Building APK..."
cd android && ./gradlew assembleDebug 2>&1 | tail -3

echo "Publishing APK..."
sudo cp app/build/outputs/apk/debug/app-debug.apk /var/www/taskflow-downloads/taskbolt.apk
sudo chown www-data:www-data /var/www/taskflow-downloads/taskbolt.apk

SIZE=$(du -h /var/www/taskflow-downloads/taskbolt.apk | cut -f1)
echo "Done. APK published: $SIZE → https://taskflow.paraslace.in/download/taskbolt.apk"
