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
        <Stack.Screen name="(tabs)/[drawId]/options" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </ReactQueryProvider>
  );
}
