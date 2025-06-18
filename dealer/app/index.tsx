import { router } from 'expo-router';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const handleLogin = () => {
    console.log('Login');
    router.push('/(tabs)');
  }
  return (
    <View className="flex-1 bg-white p-4 items-center justify-center">
      <View className="w-full max-w-sm space-y-4">
        <Text className="text-black text-2xl font-bold mb-6 text-center">Login</Text>

        <View className="space-y-2">
          <Text className="text-black text-sm">Username</Text>
          <TextInput
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="Enter username"
          />
        </View>

        <View className="space-y-2">
          <Text className="text-black text-sm">Passwords</Text>
          <TextInput
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="Enter password"
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          className="w-full bg-blue-500 p-3 rounded-md mt-4"
          onPress={handleLogin}
        >
          <Text className="text-white text-center font-semibold">Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
