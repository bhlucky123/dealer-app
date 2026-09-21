const { withAndroidManifest, withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withApkUpdates(config) {
  config = withAndroidManifest(config, config => {
    const manifest = config.modResults.manifest;
    manifest['uses-permission'] ||= [];
    if (!manifest['uses-permission'].some(p => p.$['android:name'] === 'android.permission.REQUEST_INSTALL_PACKAGES')) {
      manifest['uses-permission'].push({ $: { 'android:name': 'android.permission.REQUEST_INSTALL_PACKAGES' } });
    }
    const app = manifest.application[0];
    app.provider ||= [];
    if (!app.provider.some(p => p.$['android:authorities'] === '${applicationId}.updates')) {
      app.provider.push({ $: { 'android:name': 'androidx.core.content.FileProvider', 'android:authorities': '${applicationId}.updates', 'android:exported': 'false', 'android:grantUriPermissions': 'true' },
        'meta-data': [{ $: { 'android:name': 'android.support.FILE_PROVIDER_PATHS', 'android:resource': '@xml/update_paths' } }] });
    }
    return config;
  });
  config = withMainApplication(config, config => {
    if (!config.modResults.contents.includes('new com.luckybh.updates.ApkUpdatePackage()') && !config.modResults.contents.includes('add(com.luckybh.updates.ApkUpdatePackage())')) {
      const marker = 'PackageList(this).packages.apply {';
      if (config.modResults.contents.includes(marker)) {
        config.modResults.contents = config.modResults.contents.replace(marker, marker + '\n              add(com.luckybh.updates.ApkUpdatePackage())');
      } else if (config.modResults.contents.includes('val packages = PackageList(this).packages')) {
        config.modResults.contents = config.modResults.contents.replace('val packages = PackageList(this).packages', 'val packages = PackageList(this).packages\n            packages.add(com.luckybh.updates.ApkUpdatePackage())');
      } else throw new Error('Unsupported MainApplication: update package registration needs review');
    }
    return config;
  });
  return withDangerousMod(config, ['android', async config => {
    const root = config.modRequest.platformProjectRoot;
    const java = path.join(root, 'app/src/main/java/com/luckybh/updates');
    fs.mkdirSync(java, { recursive: true });
    for (const name of ['ApkUpdateModule.java', 'ApkUpdatePackage.java']) fs.copyFileSync(path.join(__dirname, 'native', name), path.join(java, name));
    const xml = path.join(root, 'app/src/main/res/xml');
    fs.mkdirSync(xml, { recursive: true });
    fs.writeFileSync(path.join(xml, 'update_paths.xml'), '<paths xmlns:android="http://schemas.android.com/apk/res/android"><cache-path name="updates" path="updates/" /></paths>');
    return config;
  }]);
};
