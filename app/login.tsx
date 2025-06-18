import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View
} from 'react-native';

export default function HomeScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Mutation for login
  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('https://threedln-be.onrender.com/dealer/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Type': 'DEALER',
        },
        body: JSON.stringify({ username, password }),
      });


      console.log("response", response);
      if (!response.ok) {
        const text = await response.text(); // fallback if not JSON
        console.error('Non-OK response:', text);
        throw new Error(`Login failed: ${response.status}`);
      }


      const data = await response.json();
      console.log("data", data);
      return data;
    },
    onSuccess: (data) => {
      console.log('Login successful:', data);
      router.push('/(tabs)');
    },
    onError: (err: Error) => {
      console.log("err", err);
      setError(err.message);
    },
  });

  const handleLogin = () => {
    setError('');
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }

    loginMutation.mutate();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 bg-white p-4 items-center justify-center">
          <View className="w-full max-w-sm space-y-4">
            <Text className="text-black text-2xl font-bold mb-6 text-center">Login</Text>

            {error ? (
              <Text className="text-red-600 text-sm text-center">{error}</Text>
            ) : null}

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
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white text-center font-semibold">Login</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
