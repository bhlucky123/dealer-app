package com.luckybh.updates;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.facebook.react.bridge.*;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

public class ApkUpdateModule extends ReactContextBaseJavaModule {
  private final AtomicBoolean busy = new AtomicBoolean(false);
  private volatile boolean cancelled = false;
  private Promise installPromise;
  private static final int INSTALL = 4712;

  public ApkUpdateModule(ReactApplicationContext context) {
    super(context);
    context.addActivityEventListener(new BaseActivityEventListener() {
      @Override public void onActivityResult(Activity activity, int request, int result, Intent data) {
        if (request == INSTALL && installPromise != null) {
          Promise promise = installPromise; installPromise = null;
          if (result == Activity.RESULT_OK) promise.resolve("installed");
          else if (result == Activity.RESULT_CANCELED) promise.reject("CANCELLED", "Installation cancelled. You can retry.");
          else promise.reject("INSTALL_FAILED", "Android could not install this update. Check available storage and try again.");
        }
      }
    });
  }
  @Override public String getName() { return "ApkUpdate"; }
  @ReactMethod public void addListener(String event) {}
  @ReactMethod public void removeListeners(double count) {}

  private long code(PackageInfo info) { return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode; }
  private int signatureFlags() { return Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES; }
  private Set<String> signatures(PackageInfo info) {
    Signature[] values = Build.VERSION.SDK_INT >= 28 ? info.signingInfo.getApkContentsSigners() : info.signatures;
    Set<String> out = new HashSet<>();
    for (Signature value : values) out.add(value.toCharsString());
    return out;
  }
  private File apk() { return new File(getReactApplicationContext().getCacheDir(), "updates/update.apk"); }
  private String sha(File file) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    try (InputStream input = new FileInputStream(file)) {
      byte[] buffer = new byte[65536]; int n;
      while ((n = input.read(buffer)) != -1) digest.update(buffer, 0, n);
    }
    StringBuilder hash = new StringBuilder();
    for (byte b : digest.digest()) hash.append(String.format(Locale.ROOT, "%02x", b & 255));
    return hash.toString();
  }
  private void validate(File file, ReadableMap release) throws Exception {
    ReactApplicationContext context = getReactApplicationContext();
    if (file.length() != (long) release.getDouble("size") || !sha(file).equalsIgnoreCase(release.getString("sha256"))) throw new IOException("Checksum verification failed. Download again.");
    PackageManager pm = context.getPackageManager();
    PackageInfo incoming = pm.getPackageArchiveInfo(file.getAbsolutePath(), signatureFlags());
    PackageInfo installed = pm.getPackageInfo(context.getPackageName(), signatureFlags());
    if (incoming == null || !incoming.packageName.equals(context.getPackageName()) || !incoming.packageName.equals(release.getString("package_id")) || code(incoming) != (long)release.getDouble("version_code") || code(incoming) <= code(installed) || !signatures(incoming).equals(signatures(installed))) throw new IOException("This APK does not match the installed app, version or signing certificate.");
  }
  @ReactMethod public void installed(Promise promise) {
    try {
      ReactApplicationContext context = getReactApplicationContext();
      PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
      WritableMap out = Arguments.createMap();
      out.putString("package_id", context.getPackageName()); out.putString("version_name", info.versionName); out.putDouble("version_code", code(info));
      promise.resolve(out);
    } catch (Exception e) { promise.reject("VERSION", e.getMessage()); }
  }
  @ReactMethod public void cancelDownload() { cancelled = true; }
  @ReactMethod public void download(ReadableMap release, Promise promise) {
    if (!busy.compareAndSet(false, true)) { promise.reject("BUSY", "A download is already running."); return; }
    cancelled = false;
    new Thread(() -> {
      File target = apk(); File partial = new File(target.getParentFile(), "download.part");
      HttpURLConnection connection = null;
      try {
        target.getParentFile().mkdirs();
        long expected = (long)release.getDouble("size");
        if (expected <= 0 || target.getParentFile().getUsableSpace() < expected * 2 + 50L * 1024 * 1024) throw new IOException("Insufficient storage. Free space and retry.");
        URL url = new URL(release.getString("download_url"));
        if (!url.getProtocol().equals("https")) throw new IOException("Updates require HTTPS.");
        connection = (HttpURLConnection)url.openConnection();
        connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(20000); connection.setReadTimeout(30000);
        if (connection.getResponseCode() != 200) throw new IOException("Download unavailable. Please retry.");
        long total = 0, last = 0;
        try (InputStream input = connection.getInputStream(); OutputStream output = new FileOutputStream(partial)) {
          byte[] buffer = new byte[65536]; int n;
          while ((n = input.read(buffer)) != -1) {
            if (cancelled) throw new InterruptedIOException("Download cancelled. Tap Download to retry.");
            total += n;
            if (total > expected) throw new IOException("Unexpected APK size.");
            output.write(buffer, 0, n);
            if (System.currentTimeMillis() - last > 200) {
              WritableMap progress = Arguments.createMap(); progress.putDouble("progress", (double)total / expected);
              getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("ApkUpdateProgress", progress);
              last = System.currentTimeMillis();
            }
          }
        }
        validate(partial, release);
        if (target.exists() && !target.delete()) throw new IOException("Cannot replace cached update.");
        if (!partial.renameTo(target)) throw new IOException("Cannot save update. Check storage.");
        promise.resolve(true);
      } catch (Exception e) { partial.delete(); promise.reject(cancelled ? "CANCELLED" : "DOWNLOAD", e.getMessage()); }
      finally { if (connection != null) connection.disconnect(); busy.set(false); }
    }, "apk-download").start();
  }
  @ReactMethod public void install(ReadableMap release, Promise promise) {
    if (installPromise != null) { promise.reject("BUSY", "Installation already open."); return; }
    new Thread(() -> {
      try {
        validate(apk(), release);
        Activity activity = getCurrentActivity();
        if (activity == null) throw new IOException("Open the app to install the update.");
        activity.runOnUiThread(() -> {
          try {
            if (Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) {
              activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName())));
              promise.reject("PERMISSION", "Allow installation from this app, return here and tap Install again."); return;
            }
            Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".updates", apk());
            Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE).setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION); intent.putExtra(Intent.EXTRA_RETURN_RESULT, true);
            installPromise = promise; activity.startActivityForResult(intent, INSTALL);
          } catch (Exception e) { installPromise = null; promise.reject("INSTALL", e.getMessage()); }
        });
      } catch (Exception e) { promise.reject("VERIFY", e.getMessage()); }
    }, "apk-verify").start();
  }
}
