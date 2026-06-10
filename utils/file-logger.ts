import * as FileSystem from "expo-file-system";

const LOG_DIR = `${FileSystem.documentDirectory}logs/`;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_THRESHOLD = 20;

function datePart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

let ensured = false;
let buffer: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function ensureDir() {
  if (ensured) return;
  const info = await FileSystem.getInfoAsync(LOG_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(LOG_DIR, { intermediates: true });
  }
  ensured = true;
}

async function flush() {
  if (buffer.length === 0) return;
  const batch = buffer.join("");
  buffer = [];
  try {
    await ensureDir();
    const path = LOG_DIR + datePart() + ".log";
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      const existing = await FileSystem.readAsStringAsync(path);
      await FileSystem.writeAsStringAsync(path, existing + batch);
    } else {
      await FileSystem.writeAsStringAsync(path, batch);
    }
  } catch {
    // never let logging crash the app
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

export function writeLog(line: string) {
  buffer.push(`[${new Date().toISOString()}] ${line}\n`);
  if (buffer.length >= FLUSH_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
  }
}

export async function purgeOldLogs() {
  try {
    await ensureDir();
    const files = await FileSystem.readDirectoryAsync(LOG_DIR);
    const now = Date.now();
    for (const file of files) {
      if (!file.endsWith(".log")) continue;
      const filePath = LOG_DIR + file;
      const info = await FileSystem.getInfoAsync(filePath);
      if (info.exists && info.modificationTime) {
        if (now - info.modificationTime * 1000 > MAX_AGE_MS) {
          await FileSystem.deleteAsync(filePath, { idempotent: true });
        }
      }
    }
  } catch {
    // silent
  }
}

export async function getLogFilePaths(): Promise<string[]> {
  try {
    await ensureDir();
    const files = await FileSystem.readDirectoryAsync(LOG_DIR);
    return files
      .filter((f) => f.endsWith(".log"))
      .sort()
      .map((f) => LOG_DIR + f);
  } catch {
    return [];
  }
}
