import { useEffect, useState } from "react";
import { ActivityIndicator, NativeEventEmitter, NativeModules, Platform, Pressable, Text, View } from "react-native";
import { config } from "@/utils/config";

type Version = { package_id: string; version_name: string; version_code: number };
type Release = Version & { download_url: string; size: number; sha256: string };
const updater = NativeModules.ApkUpdate;
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
      const response = await fetch(`${config.apiBaseUrl}/app-releases/${encodeURIComponent(current.package_id)}/latest/`, { signal: AbortSignal.timeout(20000) });
      if (response.status === 404) { setMessage("No update has been published yet."); return; }
      if (!response.ok) throw new Error("Could not check for updates. Please retry.");
      const next: Release = await response.json();
      if (next.package_id !== current.package_id || !Number.isSafeInteger(next.version_code) || next.size <= 0 || !/^[a-f0-9]{64}$/i.test(next.sha256) || !next.download_url.startsWith(`${config.apiBaseUrl}/app-releases/`)) throw new Error("Invalid update metadata.");
      if (next.version_code <= current.version_code) setMessage("Already up to date.");
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
  if (Platform.OS !== "android" || !updater) return <Text style={{ padding: 24 }}>Updates are available in the Android build. Install the first supported build through your usual distribution link.</Text>;
  return <View style={{ flex: 1, padding: 24, gap: 18 }}>
    <Text style={{ fontSize: 24, fontWeight: "600" }}>Check for updates</Text>
    {installed && <Text>Current version: {installed.version_name} ({installed.version_code})</Text>}
    {release && <Text>Available: {release.version_name} ({release.version_code}) · {(release.size / 1048576).toFixed(1)} MB</Text>}
    {!!message && <Text accessibilityRole="alert">{message}</Text>}
    {state !== "idle" && <ActivityIndicator />}
    {state === "downloading" && <><Text>{Math.round(progress * 100)}% downloaded</Text><Pressable onPress={() => updater.cancelDownload()}><Text style={{ padding: 12 }}>Cancel download</Text></Pressable></>}
    <Pressable disabled={state !== "idle"} onPress={check}><Text style={{ padding: 14, color: "#0369a1" }}>Check for updates</Text></Pressable>
    {release && <Pressable disabled={state !== "idle"} onPress={ready ? install : download}><Text style={{ padding: 14, color: "#0369a1" }}>{ready ? "Install update" : "Download update / Retry"}</Text></Pressable>}
  </View>;
}
