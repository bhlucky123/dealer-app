import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import "react-native-reanimated";
import "../global.css";

import { useColorScheme } from "@/hooks/useColorScheme";
import ReactQueryProvider from "@/providers/react-query-provider";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ReactQueryProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="options"
          options={{
            headerShown: true,
            title: "Draw Options",
            headerStyle: { backgroundColor: "#e0e7ff" }, // Changed to indigo-100
            headerTitleStyle: { color: "#3730a3", fontWeight: "bold", fontSize: 22 }, // Indigo-800, bolder, larger
            headerTintColor: "#6366f1", // Indigo-500
            headerShadowVisible: false,
          }}
        />

        <Stack.Screen
          name="book"
          options={{
            headerShown: true,
            title: "Book Ticket",
            headerStyle: { backgroundColor: "#e0e7ff" }, // Changed to indigo-100
            headerTitleStyle: { color: "#3730a3", fontWeight: "bold", fontSize: 22 }, // Indigo-800, bolder, larger
            headerTintColor: "#6366f1", // Indigo-500
            headerShadowVisible: false,
          }}
        />

        <Stack.Screen
          name="sales-report"
          options={{
            headerShown: true,
            title: "Sales Report",
            headerStyle: { backgroundColor: "#e0e7ff" }, // Changed to indigo-100
            headerTitleStyle: { color: "#3730a3", fontWeight: "bold", fontSize: 22 }, // Indigo-800, bolder, larger
            headerTintColor: "#6366f1", // Indigo-500
            headerShadowVisible: false,
          }}
        />

        <Stack.Screen
          name="daily-report"
          options={{
            headerShown: true,
            title: "Daily Report",
            headerStyle: { backgroundColor: "#e0e7ff" }, // Changed to indigo-100
            headerTitleStyle: { color: "#3730a3", fontWeight: "bold", fontSize: 22 }, // Indigo-800, bolder, larger
            headerTintColor: "#6366f1", // Indigo-500
            headerShadowVisible: false,
          }}
        />

        <Stack.Screen
          name="winnings"
          options={{
            headerShown: true,
            title: "Winnings",
            headerStyle: { backgroundColor: "#e0e7ff" }, // Changed to indigo-100
            headerTitleStyle: { color: "#3730a3", fontWeight: "bold", fontSize: 22 }, // Indigo-800, bolder, larger
            headerTintColor: "#6366f1", // Indigo-500
            headerShadowVisible: false,
          }}
        />

        <Stack.Screen
          name="last-sale"
          options={{
            headerShown: true,
            title: "Last Sale",
            headerStyle: { backgroundColor: "#e0e7ff" }, // Changed to indigo-100
            headerTitleStyle: { color: "#3730a3", fontWeight: "bold", fontSize: 22 }, // Indigo-800, bolder, larger
            headerTintColor: "#6366f1", // Indigo-500
            headerShadowVisible: false,
          }}
        />

        <Stack.Screen
          name="result"
          options={{
            headerShown: true,
            title: "Result",
            headerStyle: { backgroundColor: "#e0e7ff" }, // Changed to indigo-100
            headerTitleStyle: { color: "#3730a3", fontWeight: "bold", fontSize: 22 }, // Indigo-800, bolder, larger
            headerTintColor: "#6366f1", // Indigo-500
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
    </ReactQueryProvider>
  );
}
