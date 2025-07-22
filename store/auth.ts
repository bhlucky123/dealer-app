import { config } from "@/utils/config";
import { router } from "expo-router";
import { create } from "zustand";

interface User {
  id: string;
  username: string;
  user_type: "DEALER" | "AGENT" | "ADMIN";
  commission: number;
  single_digit_number_commission: number;
  cap_amount: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AdminToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzU1MzQwMzgyLCJpYXQiOjE3NTI3NDgzODIsImp0aSI6IjcyZTVlMjM3ZmNkODQ2NzdhNzllMTlmZmNiMzk2Zjk0IiwidXNlcl9pZCI6MSwidXNlcl90eXBlIjoiQURNSU4ifQ.fEkJv75g8jrH5MBZNHE698nijW1NVK5v78-prexPMOM";
const DealerToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzU1NTk2MjE3LCJpYXQiOjE3NTMwMDQyMTcsImp0aSI6IjcyYTM1ZmIzNjk0MDQzYTliYzZhZjBmYzM4MzIwODI2IiwidXNlcl9pZCI6MiwidXNlcl90eXBlIjoiREVBTEVSIn0.uIXiozc7E2V7K-FwBbE29b1f8_RgvkHoroRnce96Nls";
const AgentToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzU1NzA5MzQzLCJpYXQiOjE3NTMxMTczNDMsImp0aSI6IjJhMjdhYWE2YzlmODQ2NjQ4ZDI3ZmM2YjAxZGY4OWI2IiwidXNlcl9pZCI6MywidXNlcl90eXBlIjoiQUdFTlQifQ.pyrnzOupIxjZT7gUHX8CyC11cpdRH1PzlUexmv2mZAI";

// Dummy users for all roles
const DummyDealer: User = {
  id: "1",
  username: "Dealer User",
  cap_amount: 10000,
  commission: 10,
  single_digit_number_commission: 20,
  user_type: "DEALER",
};

const DummyAdmin: User = {
  id: "2",
  username: "Admin User",
  cap_amount: 999999,
  commission: 100,
  single_digit_number_commission: 100,
  user_type: "ADMIN",
};

const DummyAgent: User = {
  id: "3",
  username: "Agent User",
  cap_amount: 5000,
  commission: 5,
  single_digit_number_commission: 10,
  user_type: "AGENT",
};

// Helper to get default user/token based on config.userType
function getDefaultAuth() {
  switch (config.userType) {
    case "ADMIN":
      return { user: DummyAdmin, token: AdminToken };
    case "AGENT":
      return { user: DummyAgent, token: AgentToken };
    case "DEALER":
    default:
      return { user: DummyDealer, token: DealerToken };
  }
}

export const useAuthStore = create<AuthState>((set) => {
  const { user, token } = getDefaultAuth();

  return {
    user,
    token,
    loading: false,
    error: null,

    login: async (username, password) => {
      set({ loading: true, error: null });
      try {
        // Determine login endpoint and user-type header based on config.userType
        let loginUrl = "";
        let userTypeHeader = config.userType;

        switch (config.userType) {
          case "ADMIN":
            loginUrl = `${config.apiBaseUrl}/administrator/login/`;
            break;
          case "AGENT":
            loginUrl = `${config.apiBaseUrl}/agent/login/`;
            break;
          case "DEALER":
          default:
            loginUrl = `${config.apiBaseUrl}/dealer/login/`;
            break;
        }

        const response = await fetch(
          loginUrl,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Type": userTypeHeader,
            },
            body: JSON.stringify({ username, password }),
          }
        );

        if (!response.ok) {
          const text = await response.text();
          set({
            error: text || `Login failed: ${response.status}`,
            loading: false,
          });
          return;
        }

        const data = await response.json();
        console.log("data", data);
        set({
          user: data.user_details,
          token: data.access,
          loading: false,
          error: null,
        });
        router.push("/(tabs)");
      } catch (err: any) {
        console.log("err", err);
        set({ error: err.message || "Login failed", loading: false });
      }
    },

    logout: () => {
      set({ user: null, token: null });
    },

    setUser: (user) => set({ user }),
  };
});
