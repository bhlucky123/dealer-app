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
const AgentToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzU1MTA1NTU1LCJpYXQiOjE3NTI1MTM1NTUsImp0aSI6Ijk4N2U5N2Y4OGM3MzRjYjM5M2MyNzBiMDI3MmNhNGQ3IiwidXNlcl9pZCI6OCwidXNlcl90eXBlIjoiQUdFTlQifQ.tvvBnWvpSvzoHnK1BU5UUYA-otfmT9ea6YqymW0ESTU";

// Dummy users for all roles
const DummyDealer = {
  id: "1",
  username: "Dealer User",
  cap_amount: 10000,
  commission: 10,
  single_digit_number_commission: 20,
  user_type: "DEALER" as const,
};

const DummyAdmin = {
  id: "2",
  username: "Admin User",
  cap_amount: 999999,
  commission: 100,
  single_digit_number_commission: 100,
  user_type: "ADMIN" as const,
};

const DummyAgent = {
  id: "3",
  username: "Agent User",
  cap_amount: 5000,
  commission: 5,
  single_digit_number_commission: 10,
  user_type: "AGENT" as const,
};

export const useAuthStore = create<AuthState>((set) => ({
  // Set the default user and token here. Change as needed for testing.
  // user: DummyDealer,
  // token: DealerToken,
  // To test as admin, uncomment below and comment above:
  user: DummyAdmin,
  token: AdminToken,
  // To test as agent, uncomment below and comment above:
  // user: DummyAgent,
  // token: AgentToken,
  loading: false,
  error: null,

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/dealer/login/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Type": config.userType,
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
}));
