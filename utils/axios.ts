import { useAuthStore } from "@/store/auth";
import axios from "axios";

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
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

      // Example: extracting common message formats
      // if (data?.message) {
      //   console.error("Backend Message:", data.message);
      // } else if (data?.detail) {
      //   console.error("Backend Detail:", data.detail);
      // } else {
      //   console.error("Unknown backend error format", data);
      // }
    } else {
      console.error("❌ Network or config error", error.message);
    }

    return Promise.reject(error);
  }
);

export default api;
