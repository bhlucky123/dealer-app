import { router } from "expo-router";
import { create } from "zustand";

interface User {
  id: string;
  username: string;
  user_type: string;
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

export const useAuthStore = create<AuthState>((set) => ({
  user: {
    id: "3",
    username: "Dealer User",
    cap_amount: 10000,
    commission: 10,
    single_digit_number_commission: 20,
    user_type: "DEALER",
  },
  token:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzUzMTEzNTkwLCJpYXQiOjE3NTA1MjE1OTAsImp0aSI6IjAzMTk3MWZlN2E5ZjQxM2RiMzA2OWMxZTUzYzQzOTI5IiwidXNlcl9pZCI6Mn0.zo4lOisu95CykMeqcdNzqvy_w6pU7-UaCsktnyFIWRI",
  loading: false,
  error: null,

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(
        "https://threedln-be.onrender.com/dealer/login/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Type": "DEALER",
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
