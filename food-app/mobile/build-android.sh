#!/usr/bin/env bash
# يبني تطبيق أندرويد (APK) لواجهة الزبائن أو لوحة التحكم.
# الاستخدام:  ./build-android.sh customer https://your-server.com
#             ./build-android.sh admin    https://your-server.com
# المتطلبات: Node.js 20+، Java 21، Android SDK (متغير ANDROID_HOME)
set -euo pipefail

APP="${1:?اكتب customer أو admin}"
SERVER_URL="${2:?اكتب رابط السيرفر مثل https://example.com}"
SERVER_URL="${SERVER_URL%/}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="${OUT_DIR:-$HERE/dist}"
VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-1.0.$VERSION_CODE}"

case "$APP" in
  customer) APP_ID="com.talabati.customer"; APP_NAME="${APP_NAME:-طلباتي}";      START_URL="$SERVER_URL/" ;;
  admin)    APP_ID="com.talabati.admin";    APP_NAME="${ADMIN_APP_NAME:-طلباتي - الإدارة}"; START_URL="$SERVER_URL/admin" ;;
  *) echo "التطبيق يجب أن يكون customer أو admin"; exit 1 ;;
esac

CLEARTEXT=false
[[ "$SERVER_URL" == http://* ]] && CLEARTEXT=true

WORK="$(mktemp -d)"
echo "📦 بناء تطبيق $APP في $WORK (السيرفر: $START_URL)"
cd "$WORK"

cat > package.json <<JSON
{ "name": "talabati-$APP", "version": "$VERSION_NAME", "private": true }
JSON
npm install --silent --no-audit --no-fund @capacitor/core@^8 @capacitor/cli@^8 @capacitor/android@^8

# صفحة احتياطية تظهر فقط إذا تعذر الوصول للسيرفر
mkdir -p www
cat > www/index.html <<HTML
<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>$APP_NAME</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px">
<h2>تعذر الاتصال بالسيرفر</h2><p>تحقق من الإنترنت ثم حاول مرة أخرى</p>
<button onclick="location.href='$START_URL'" style="padding:12px 24px;font-size:16px">إعادة المحاولة</button>
</body></html>
HTML

node -e '
const [appId, appName, url, cleartext] = process.argv.slice(1);
require("fs").writeFileSync("capacitor.config.json", JSON.stringify({
  appId, appName, webDir: "www",
  server: { url, cleartext: cleartext === "true", errorPath: "index.html" },
  android: { backgroundColor: "#ffffff" },
}, null, 2));
' "$APP_ID" "$APP_NAME" "$START_URL" "$CLEARTEXT"

npx cap add android
npx cap sync android

# الأيقونات
RES=android/app/src/main/res
rm -rf "$RES/mipmap-anydpi-v26"
for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  cp "$HERE/icons/$APP/$d.png" "$RES/mipmap-$d/ic_launcher.png"
  cp "$HERE/icons/$APP/$d.png" "$RES/mipmap-$d/ic_launcher_round.png"
  rm -f "$RES/mipmap-$d/ic_launcher_foreground.png"
done

# شاشة البداية: نسخة عالية الدقة فقط (أندرويد يصغّرها للشاشات الأخرى)
find "$RES" -name 'splash.png' -delete
mkdir -p "$RES/drawable-port-xxxhdpi" "$RES/drawable-land-xxxhdpi"
cp "$HERE/icons/$APP/splash-port.png" "$RES/drawable/splash.png"
cp "$HERE/icons/$APP/splash-port.png" "$RES/drawable-port-xxxhdpi/splash.png"
cp "$HERE/icons/$APP/splash-land.png" "$RES/drawable-land-xxxhdpi/splash.png"

# رقم الإصدار
sed -i "s/versionCode [0-9]*/versionCode $VERSION_CODE/; s/versionName \"[^\"]*\"/versionName \"$VERSION_NAME\"/" android/app/build.gradle

if [[ "${SKIP_GRADLE:-0}" == "1" ]]; then echo "تم تجهيز المشروع في $WORK/android"; exit 0; fi

cd android
chmod +x gradlew
./gradlew --no-daemon assembleDebug
mkdir -p "$OUT_DIR"
cp app/build/outputs/apk/debug/app-debug.apk "$OUT_DIR/talabati-$APP.apk"
echo "✅ تم: $OUT_DIR/talabati-$APP.apk"
