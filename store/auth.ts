import { config, UserType } from "@/utils/config";
import { router } from "expo-router";
import { create } from "zustand";

interface User {
  id: string;
  username: string;
  user_type: "DEALER" | "AGENT" | "ADMIN";
  commission: number;
  single_digit_number_commission: number;
  cap_amount: number;
  superuser?: boolean
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  preLoginToken: string | null;
  preLoginUserType: UserType | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  setPreLogin: (token: string, userType: UserType) => void;
  application_status: boolean;
  setApplicationStatus: (status: boolean) => void;
}

const LOGIN_URLS: Record<UserType, string> = {
  ADMIN: `${config.apiBaseUrl}/administrator/login/`,
  DEALER: `${config.apiBaseUrl}/dealer/login/`,
  AGENT: `${config.apiBaseUrl}/agent/login/`,
};

export const useAuthStore = create<AuthState>((set, get) => {
  return {
    user: null,
    token: null,
    loading: false,
    error: null,
    preLoginToken: null,
    preLoginUserType: null,
    application_status: true,

    setPreLogin: (token, userType) => set({ preLoginToken: token, preLoginUserType: userType }),

    login: async (username, password) => {
      const { preLoginToken, preLoginUserType } = get();

      if (!preLoginToken || !preLoginUserType) {
        set({ error: "Session expired. Please verify again.", loading: false });
        setTimeout(() => set({ error: "" }), 3000);
        return;
      }

      set({ loading: true, error: null });
      try {
        const loginUrl = LOGIN_URLS[preLoginUserType];

        const response = await fetch(loginUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Type": preLoginUserType,
          },
          body: JSON.stringify({
            username,
            password,
            pre_login_token: preLoginToken,
          }),
        });

        if (!response.ok) {
          let errorMsg = `Login failed: ${response.status}`;
          try {
            const text = await response.text();
            let parsed;
            try {
              parsed = JSON.parse(text);
            } catch {
              // Not JSON, fallback to text
            }
            if (parsed && typeof parsed === "object") {
              if (parsed.non_field_errors && Array.isArray(parsed.non_field_errors) && parsed.non_field_errors.length > 0) {
                errorMsg = parsed.non_field_errors[0];
              } else if (parsed.error) {
                errorMsg = parsed.error;
              } else if (parsed.detail) {
                errorMsg = parsed.detail;
              } else {
                errorMsg = text;
              }
            } else if (text) {
              errorMsg = text;
            }
          } catch (e) {
            // fallback to default errorMsg
          }

          // If token expired/invalid, clear pre-login state so user goes back to calculator
          if (errorMsg.includes("token")) {
            set({ preLoginToken: null, preLoginUserType: null });
          }

          set({
            error: errorMsg,
            loading: false,
          });

          setTimeout(() => {
            set({ error: "" });
          }, 3000);

          return;
        }

        const data = await response.json();
        console.log("data", data);
        set({
          user: {
            id: data.user_details?.user_id,
            user_type: preLoginUserType,
            superuser: data?.user_details?.superuser || false,
            ...data?.user_details
          },
          token: data.access,
          loading: false,
          error: null,
          preLoginToken: null,
          preLoginUserType: null,
        });
        router.push("/(tabs)");
      } catch (err: any) {
        console.log("err", err);
        set({ error: err.message || "Login failed", loading: false });
      }
    },

    logout: () => {
      set({ user: null, token: null, preLoginToken: null, preLoginUserType: null });
    },

    setUser: (user) => set({ user }),

    setApplicationStatus: (status: boolean) => set({ application_status: status })
  };
});
