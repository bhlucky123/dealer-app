const fs = require('fs');
const action = process.argv[2];
if (action === 'version') {
  const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  const code = Math.floor(Date.now() / 1000);
  if (code > 2100000000) throw new Error('Version code epoch needs migration');
  app.expo.android.versionCode = code;
  app.expo.version = `1.${new Date().getUTCFullYear()}.${process.env.GITHUB_RUN_NUMBER || 0}`;
  fs.writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');
} else if (action === 'signing') {
  for (const key of ['ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD', 'ANDROID_DISTRIBUTED_CERT_SHA256']) {
    if (!process.env[key]) throw new Error(`Missing persistent signing configuration: ${key}`);
  }
  if (!/^[a-f0-9]{64}$/i.test(process.env.ANDROID_DISTRIBUTED_CERT_SHA256)) throw new Error('Pin the SHA-256 certificate from a currently distributed APK');
  fs.writeFileSync('android/app/release.keystore', Buffer.from(process.env.ANDROID_KEYSTORE_BASE64, 'base64'), { mode: 0o600 });
  fs.appendFileSync('android/app/build.gradle', `
android {
  signingConfigs {
    release {
      storeFile file('release.keystore')
      storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
      keyAlias System.getenv('ANDROID_KEY_ALIAS')
      keyPassword System.getenv('ANDROID_KEY_PASSWORD')
    }
  }
  buildTypes { release { signingConfig signingConfigs.release } }
}
`);
} else throw new Error('Expected version or signing');
