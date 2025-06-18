import { useAuthStore } from "@/store/auth";
import { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

export default function HomeScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const { login, loading, error } = useAuthStore();

  const handleLogin = () => {
    setErrorMsg("");
    if (!username || !password) {
      setErrorMsg("Please enter both username and password.");
      return;
    }

    login(username, password);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 bg-white p-4 items-center justify-center">
          <View className="w-full max-w-sm space-y-4">
            <Text className="text-black text-2xl font-bold mb-6 text-center">
              Login
            </Text>

            {error && (
              <Text className="text-red-600 text-sm text-center">{error}</Text>
            )}

            {errorMsg && (
              <Text className="text-red-600 text-sm text-center">
                {errorMsg}
              </Text>
            )}

            <View className="space-y-2">
              <Text className="text-black text-sm">Username</Text>
              <TextInput
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Enter username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>

            <View className="space-y-2">
              <Text className="text-black text-sm">Password</Text>
              <TextInput
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Enter password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity
              className="w-full bg-blue-500 p-3 rounded-md mt-4 flex items-center justify-center"
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white text-center font-semibold">
                  Login
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
