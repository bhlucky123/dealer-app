import { Image } from 'expo-image';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-white p-4 items-center justify-center">
    <Text>Home</Text>
    </View>
  );
}
