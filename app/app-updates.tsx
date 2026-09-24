import { useEffect, useState } from "react";
import { ActivityIndicator, NativeEventEmitter, NativeModules, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { config } from "@/utils/config";

type Version = { package_id: string; version_name: string; version_code: number };
type Release = Version & { download_url: string; size: number; sha256: string };
const updater = NativeModules.ApkUpdate;
const updaterReady = Platform.OS === "android" && typeof updater?.installed === "function" && typeof updater?.download === "function" && typeof updater?.install === "function";
export default function AppUpdates() {
  const [installed, setInstalled] = useState<Version | null>(null);
  const [release, setRelease] = useState<Release | null>(null);
  const [state, setState] = useState<"idle" | "checking" | "downloading" | "installing">("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!updaterReady) return;
    const sub = new NativeEventEmitter(updater).addListener("ApkUpdateProgress", event => setProgress(event.progress));
    return () => { sub.remove(); updater.cancelDownload?.(); };
  }, []);
  const check = async () => {
    setState("checking"); setMessage(""); setReady(false); setRelease(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const current: Version = await updater.installed(); setInstalled(current);
      const response = await fetch(`${config.apiBaseUrl}/app-releases/${encodeURIComponent(current.package_id)}/latest/`, { signal: controller.signal });
      if (response.status === 404) { setMessage("No update has been published yet."); return; }
      if (!response.ok) throw new Error("Could not check for updates. Please retry.");
      const next: Release = await response.json();
      if (next.package_id !== current.package_id || !Number.isSafeInteger(next.version_code) || next.size <= 0 || !/^[a-f0-9]{64}$/i.test(next.sha256) || !next.download_url.startsWith(`${config.apiBaseUrl}/app-releases/`)) throw new Error("Invalid update metadata.");
      if (next.version_code <= current.version_code) setMessage("Already up to date.");
      else setRelease(next);
    } catch (error: any) { setMessage(error?.name === "AbortError" ? "The update check timed out. Please try again." : error?.message || "Update check failed. Please retry."); }
    finally { clearTimeout(timeout); setState("idle"); }
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
  if (!updaterReady) return <SafeAreaView className="flex-1 bg-gray-100 items-center justify-center p-6" edges={["bottom"]}><View className="bg-white border border-gray-200 rounded-2xl p-6 items-center w-full max-w-md"><View className="w-14 h-14 rounded-2xl bg-blue-50 items-center justify-center"><Ionicons name="phone-portrait-outline" size={28} color="#2563eb" /></View><Text className="text-gray-800 text-lg font-bold mt-4">Updates unavailable in this build</Text><Text className="text-gray-500 text-sm text-center leading-5 mt-2">Install the latest Android build from your usual distribution link, then check again.</Text></View></SafeAreaView>;
  const busy = state !== "idle";
  return <SafeAreaView className="flex-1 bg-gray-100" edges={["bottom"]}><View className="flex-1 p-4 justify-center" style={{ maxWidth: 520, width: "100%", alignSelf: "center" }}><View className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
    <View className="w-12 h-12 rounded-xl bg-blue-50 items-center justify-center"><Ionicons name="cloud-download-outline" size={25} color="#2563eb" /></View>
    <Text className="text-gray-900 text-xl font-bold mt-4">Keep your app current</Text>
    <Text className="text-gray-500 text-sm leading-5 mt-1">Check for the latest approved Android version and install it when you are ready.</Text>
    {installed && <View className="bg-gray-50 rounded-xl p-3 mt-5"><Text className="text-gray-500 text-xs font-semibold uppercase">Current version</Text><Text className="text-gray-800 font-bold mt-1">{installed.version_name} <Text className="text-gray-500 font-normal">({installed.version_code})</Text></Text></View>}
    {release && <Text>Available: {release.version_name} ({release.version_code}) · {(release.size / 1048576).toFixed(1)} MB</Text>}
    {!!message && <View accessibilityRole="alert" className="flex-row bg-blue-50 border border-blue-100 rounded-xl p-3 mt-4"><Ionicons name="information-circle-outline" size={20} color="#2563eb" /><Text className="flex-1 text-blue-800 text-sm leading-5 ml-2">{message}</Text></View>}
    {busy && <View className="flex-row items-center mt-5"><ActivityIndicator color="#2563eb" /><Text className="text-gray-600 text-sm ml-3">{state === "checking" ? "Checking for updates…" : state === "downloading" ? `Downloading ${Math.round(progress * 100)}%…` : "Opening installer…"}</Text></View>}
    <Pressable disabled={busy} onPress={check} className={`flex-row items-center justify-center rounded-xl py-3.5 mt-5 ${busy ? "bg-blue-300" : "bg-blue-600"}`}><Ionicons name="refresh-outline" size={19} color="#fff" /><Text className="text-white font-bold ml-2">Check for updates</Text></Pressable>
    {state === "downloading" && <Pressable onPress={() => updater.cancelDownload()} className="items-center py-3"><Text className="text-red-600 font-semibold">Cancel download</Text></Pressable>}
    {release && <Pressable disabled={busy} onPress={ready ? install : download} className={`flex-row items-center justify-center rounded-xl py-3.5 mt-3 border ${busy ? "bg-gray-100 border-gray-200" : "bg-white border-blue-200"}`}><Ionicons name="cloud-download-outline" size={19} color={busy ? "#94a3b8" : "#2563eb"} /><Text className={`font-bold ml-2 ${busy ? "text-gray-400" : "text-blue-700"}`}>{ready ? "Install update" : "Download update"}</Text></Pressable>}
  </View></View></SafeAreaView>;
}
