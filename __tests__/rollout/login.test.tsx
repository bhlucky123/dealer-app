import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import { useAuthStore } from "../../store/auth";
import Login from "../../app/login";

jest.mock("@/providers/react-query-provider", () => ({ queryClient: { clear: jest.fn() } }));
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), canGoBack: () => true, dismissAll: jest.fn(), replace: jest.fn() },
  useFocusEffect: (effect: any) => require("react").useEffect(effect, [effect]),
}));

beforeEach(() => { useAuthStore.getState().clearPreLogin(); jest.clearAllMocks(); });
test("visible back action returns to calculator and clears pending credentials on blur", () => {
  useAuthStore.getState().setPreLogin("pending", "ADMIN");
  const screen = render(<Login />);
  fireEvent.changeText(screen.getByPlaceholderText("Enter password"), "secret");
  fireEvent.press(screen.getByText("← Back to calculator"));
  expect(router.back).toHaveBeenCalled();
  screen.unmount();
  expect(useAuthStore.getState().preLoginToken).toBeNull();
});
test("login response arriving after back cannot open the authenticated app", async () => {
  let finish!: (value: any) => void;
  global.fetch = jest.fn(() => new Promise(resolve => { finish = resolve; })) as any;
  useAuthStore.getState().setPreLogin("pending", "ADMIN");
  const request = useAuthStore.getState().login("test", "test");
  useAuthStore.getState().clearPreLogin();
  finish({ ok: true, json: async () => ({ access: "token", user_details: {} }) });
  await request;
  expect(router.replace).not.toHaveBeenCalled();
});
test("successful login removes the unfinished login stack", async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ access: "token", user_details: {} }) })) as any;
  useAuthStore.getState().setPreLogin("pending", "ADMIN");
  await useAuthStore.getState().login("test", "test");
  expect(router.dismissAll).toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith("/(tabs)");
});
