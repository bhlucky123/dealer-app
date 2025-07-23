import { useAuthStore } from "@/store/auth";
import axios from "axios";
import { router } from "expo-router";
import { config } from "./config";

const api = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    // Grab token from Zustand store
    const token = useAuthStore.getState().token;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor (optional)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      console.log("❌ Axios Error:", status, data);

      if (status === 401) {
        console.log("navigating", status);

        router.push("/login")
        return
      }

      // Example: extracting common message formats
      // if (data?.message) {
      //   console.error("Backend Message:", data.message);
      // } else if (data?.detail) {
      //   console.error("Backend Detail:", data.detail);
      // } else {
      //   console.error("Unknown backend error format", data);
      // }
      return Promise.reject({ status: status || 500, message: data || "something went wrong" });

    } else {
      console.error("❌ Network or config error", error);
      return Promise.reject(error);
    }

  }
);

export default api;
