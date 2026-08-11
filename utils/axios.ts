import { queryClient } from "@/providers/react-query-provider";
import { useAuthStore } from "@/store/auth";
import axios from "axios";
import { router } from "expo-router";
import { config } from "./config";
import { writeLog } from "./file-logger";

const api = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor (logs time start)
api.interceptors.request.use(
  async (config) => {
    // Grab token from Zustand store
    const token = useAuthStore.getState().token;

    // Mark request start time
    (config as any).metadata = { startTime: Date.now() };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor (logs time taken)
api.interceptors.response.use(
  (response) => {
    // Calculate and log elapsed time
    const metadata = (response.config as any).metadata;
    if (metadata && metadata.startTime) {
      const duration = Date.now() - metadata.startTime;
      const msg = `${response.config.method?.toUpperCase()} ${response.config.url} ${response.status} ${duration}ms`;
      console.log(`[Axios] ${msg}`);
      writeLog(msg);
    }

    if (response.status === 204) {
      return { ...response, data: null };
    }
    return response;
  },
  (error) => {
    if (error.config && (error.config as any).metadata && (error.config as any).metadata.startTime) {
      const duration = Date.now() - (error.config as any).metadata.startTime;
      const status = error.response?.status || "NETWORK";
      const body = error.response?.data ? ` body=${JSON.stringify(error.response.data).slice(0, 500)}` : "";
      const msg = `${error.config.method?.toUpperCase()} ${error.config.url} ${status} ${duration}ms FAILED${body}`;
      console.log(`[Axios] ${msg}`);
      writeLog(msg);
    }

    if (
      error.request &&
      typeof error.request._response === "string" &&
      error.request._response.includes("HTTP 204 had non-zero Content-Length")
    ) {
      console.warn("⚠️ Fixing malformed 204 No Content response...");
      return Promise.resolve({
        status: 204,
        statusText: "No Content",
        data: null,
        headers: {},
        config: error.config,
      });
    }

    // React Native sometimes routes a fully successful response into the error
    // handler without building an `error.response` — the server completed the
    // request (e.g. creating a dealer returns 201 and the row is created) but the
    // client still surfaces a "Network Error". When the underlying XHR reports a
    // 2xx status, treat it as the success it actually was and recover the body.
    const xhrStatus = error.request?.status;
    if (
      !error.response &&
      typeof xhrStatus === "number" &&
      xhrStatus >= 200 &&
      xhrStatus < 300
    ) {
      console.warn("⚠️ Recovering 2xx response misreported as a network error...");
      let data: any = null;
      const raw = error.request?.responseText ?? error.request?._response;
      if (typeof raw === "string" && raw.length > 0) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = raw;
        }
      }
      return Promise.resolve({
        status: xhrStatus,
        statusText: "OK",
        data,
        headers: {},
        config: error.config,
      });
    }

    // Retry transient transport failures (no HTTP response received) — but only
    // for safe/idempotent methods (GET/HEAD/OPTIONS). This used to also retry
    // POST/PUT/PATCH, added for okhttp silently dropping stale keep-alive
    // HTTP/2 connections on Railway's old edge proxy. Now that the backend is
    // on DigitalOcean (no such edge), that no longer applies — and retrying a
    // non-idempotent request is actively dangerous: if the original request
    // was just slow (e.g. DB contention) rather than actually dropped, the
    // first attempt can still complete server-side while the client times out
    // and resends, creating a duplicate (this is exactly how a single slow
    // booking submit turned into several booked rows). A client-side timeout
    // (error.code === "ECONNABORTED") is never a dropped connection — it's a
    // slow server — so it's excluded here too even for safe methods, since
    // retrying immediately only adds more load onto an already-struggling
    // server.
    const retryCfg: any = error.config || {};
    const retryMethod = (retryCfg.method || "get").toLowerCase();
    const isRetryableMethod = ["get", "head", "options"].includes(retryMethod);
    const isTimeout = error.code === "ECONNABORTED";
    if (!error.response && !isTimeout && isRetryableMethod && (retryCfg.__retryCount || 0) < 2) {
      retryCfg.__retryCount = (retryCfg.__retryCount || 0) + 1;
      const backoff = 300 * retryCfg.__retryCount;
      console.log(
        `[Axios] retrying ${retryCfg.method?.toUpperCase()} ${retryCfg.url} (attempt ${retryCfg.__retryCount + 1}) after ${backoff}ms`
      );
      return new Promise((resolve) => setTimeout(resolve, backoff)).then(() =>
        api(retryCfg)
      );
    }

    if (error.request) {
      console.log("🚨 Raw response text:", error.request.responseText);
      console.log("🚨 Raw status:", error.request.status);
    }
    if (error.response) {
      const { status, data } = error.response;
      console.log("❌ Axios Error:", status, data);

      if (status === 503) {
        console.log("naivigating due to inative", status);
        router.push("..")
        return
      }

      if (status === 401) {
        queryClient.clear();
        router.push("/")
        return
      }
      return Promise.reject({ status: status || 500, message: data || "something went wrong" });

    } else {
      console.error("❌ Network or config error", error);
      return Promise.reject(error);
    }
  }
);

export default api;
