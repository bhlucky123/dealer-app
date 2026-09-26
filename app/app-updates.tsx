import { useEffect, useState } from "react";
import { ActivityIndicator, NativeEventEmitter, NativeModules, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { CheckCircle2, Download, RefreshCw, ShieldCheck, Smartphone, X } from "lucide-react-native";
import { config } from "@/utils/config";

type Version = { package_id: string; version_name: string; version_code: number };
type Release = Version & { download_url: string; size: number; sha256: string };
const updater = NativeModules.ApkUpdate;

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = typeof AbortController === "undefined" ? undefined : new AbortController();
  const timeout = setTimeout(() => controller?.abort(), timeoutMs);

  try {
    return await fetch(url, controller ? { signal: controller.signal } : undefined);
  } catch (error) {
    if (controller?.signal.aborted) throw new Error("Update check timed out. Please retry.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export default function AppUpdates() {
  const [installed, setInstalled] = useState<Version | null>(null);
  const [release, setRelease] = useState<Release | null>(null);
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!updater) return;
    const sub = new NativeEventEmitter(updater).addListener("ApkUpdateProgress", event => setProgress(event.progress));
    return () => { sub.remove(); updater.cancelDownload(); };
  }, []);

  const check = async () => {
    setState("checking"); setMessage(""); setReady(false); setRelease(null);
    try {
      const current: Version = await updater.installed(); setInstalled(current);
      const response = await fetchWithTimeout(`${config.apiBaseUrl}/app-releases/${encodeURIComponent(current.package_id)}/latest/`, 20000);
      if (response.status === 404) { setMessage("No update has been published yet."); return; }
      if (!response.ok) throw new Error("Could not check for updates. Please retry.");
      const next: Release = await response.json();
      if (next.package_id !== current.package_id || !Number.isSafeInteger(next.version_code) || next.size <= 0 || !/^[a-f0-9]{64}$/i.test(next.sha256) || !next.download_url.startsWith(`${config.apiBaseUrl}/app-releases/`)) throw new Error("Invalid update metadata.");
      if (next.version_code <= current.version_code) setMessage("You are already using the latest version.");
      else setRelease(next);
    } catch (error: any) { setMessage(error.message || "Update check failed. Please retry."); }
    finally { setState("idle"); }
  };
  const download = async () => {
    setState("downloading"); setMessage(""); setProgress(0);
    try { await updater.download(release); setReady(true); setMessage("Download verified. Ready to install."); }
    catch (error: any) { setReady(false); setMessage(error.message || "Download interrupted. Please retry."); }
    finally { setState("idle"); }
  };
  const install = async () => {
    setState("installing"); setMessage("");
    try { await updater.install(release); }
    catch (error: any) { setMessage(error.message || "Installation cancelled. You can retry."); if (error.code === "VERIFY") setReady(false); }
    finally { setState("idle"); }
  };

  if (Platform.OS !== "android" || !updater) return <View style={styles.unsupported}><Smartphone size={32} color="#4f46e5" /><Text style={styles.unsupportedTitle}>Android update required</Text><Text style={styles.unsupportedText}>Use an Android build to check for and install app updates.</Text></View>;
  const busy = state !== "idle";
  return <View style={styles.screen}>
    <View style={styles.hero}><View style={styles.heroIcon}><RefreshCw size={27} color="#fff" /></View><View style={{ flex: 1 }}><Text style={styles.eyebrow}>APP MAINTENANCE</Text><Text style={styles.heroTitle}>Keep Lucky BH up to date</Text><Text style={styles.heroCopy}>Get the latest fixes and improvements securely.</Text></View></View>
    <View style={styles.card}>
      <View style={styles.row}><View style={styles.cardIcon}><Smartphone size={21} color="#4f46e5" /></View><View style={{ flex: 1 }}><Text style={styles.label}>INSTALLED VERSION</Text><Text style={styles.value}>{installed ? `v${installed.version_name} · Build ${installed.version_code}` : "Check to view your version"}</Text></View></View>
      {release && <View style={styles.available}><Download size={19} color="#047857" /><View><Text style={styles.availableLabel}>UPDATE AVAILABLE</Text><Text style={styles.availableText}>v{release.version_name} · {(release.size / 1048576).toFixed(1)} MB</Text></View></View>}
    </View>
    {!!message && <View accessibilityRole="alert" style={styles.notice}><CheckCircle2 size={19} color="#4338ca" /><Text style={styles.noticeText}>{message}</Text></View>}
    {state === "downloading" && <View style={styles.progressCard}><View style={styles.progressHead}><Text style={styles.progressText}>Downloading update</Text><Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} /></View><Pressable onPress={() => updater.cancelDownload()} style={styles.cancel}><X size={16} color="#b91c1c" /><Text style={styles.cancelText}>Cancel download</Text></Pressable></View>}
    <Pressable accessibilityRole="button" disabled={busy} onPress={check} style={[styles.primary, busy && styles.disabled]}><View style={styles.buttonContent}>{state === "checking" ? <ActivityIndicator color="#fff" /> : <RefreshCw size={20} color="#fff" />}<Text style={styles.primaryText}>{state === "checking" ? "Checking for updates…" : "Check for updates"}</Text></View></Pressable>
    {release && <Pressable accessibilityRole="button" disabled={busy} onPress={ready ? install : download} style={[styles.secondary, busy && styles.disabled]}><View style={styles.buttonContent}>{ready ? <ShieldCheck size={20} color="#4338ca" /> : <Download size={20} color="#4338ca" />}<Text style={styles.secondaryText}>{ready ? "Install verified update" : "Download update"}</Text></View></Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc", padding: 20, gap: 14 }, hero: { flexDirection: "row", alignItems: "center", gap: 14, padding: 20, borderRadius: 24, backgroundColor: "#312e81" }, heroIcon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#6366f1" }, eyebrow: { color: "#c7d2fe", fontSize: 11, fontWeight: "700", letterSpacing: 1 }, heroTitle: { color: "#fff", fontSize: 19, fontWeight: "700", marginTop: 3 }, heroCopy: { color: "#e0e7ff", fontSize: 13, marginTop: 3 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#e2e8f0", gap: 14 }, row: { flexDirection: "row", alignItems: "center", gap: 12 }, cardIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#eef2ff" }, label: { color: "#64748b", fontSize: 11, fontWeight: "700", letterSpacing: 0.6 }, value: { color: "#0f172a", fontSize: 15, fontWeight: "700", marginTop: 3 }, available: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#ecfdf5", borderRadius: 14, padding: 12 }, availableLabel: { color: "#047857", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }, availableText: { color: "#065f46", fontSize: 14, fontWeight: "600", marginTop: 2 },
  notice: { flexDirection: "row", alignItems: "center", gap: 9, padding: 13, borderRadius: 14, backgroundColor: "#eef2ff" }, noticeText: { flex: 1, color: "#3730a3", fontSize: 13, fontWeight: "500" }, progressCard: { backgroundColor: "#fff", borderRadius: 16, padding: 15, borderWidth: 1, borderColor: "#e2e8f0" }, progressHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 9 }, progressText: { color: "#334155", fontWeight: "600" }, progressPercent: { color: "#4f46e5", fontWeight: "700" }, track: { height: 8, backgroundColor: "#e2e8f0", borderRadius: 999, overflow: "hidden" }, fill: { height: "100%", backgroundColor: "#4f46e5", borderRadius: 999 }, cancel: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 12 }, cancelText: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },
  primary: { borderRadius: 16, backgroundColor: "#4f46e5", paddingVertical: 16, alignItems: "center" }, secondary: { borderRadius: 16, backgroundColor: "#eef2ff", borderWidth: 1, borderColor: "#c7d2fe", paddingVertical: 16, alignItems: "center" }, disabled: { opacity: 0.65 }, buttonContent: { flexDirection: "row", alignItems: "center", gap: 9 }, primaryText: { color: "#fff", fontSize: 15, fontWeight: "700" }, secondaryText: { color: "#4338ca", fontSize: 15, fontWeight: "700" },
  unsupported: { flex: 1, backgroundColor: "#f8fafc", alignItems: "center", justifyContent: "center", padding: 28, gap: 10 }, unsupportedTitle: { color: "#0f172a", fontSize: 19, fontWeight: "700" }, unsupportedText: { color: "#64748b", textAlign: "center", lineHeight: 20 },
});
