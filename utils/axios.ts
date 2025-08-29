import { useAuthStore } from "@/store/auth";
import axios from "axios";
import { router } from "expo-router";
import { config } from "./config";

const api = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 20000,
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

      if (status === 503) {
        console.log("naivigating due to inative", status);
        router.push("..")
        return
      }


      if (status === 401) {
        router.push("/login")
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
