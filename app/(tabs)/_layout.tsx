import { useAuthStore } from '@/store/auth';
import { Tabs } from 'expo-router';
import { CreditCard, Home, MoreHorizontal, Users } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

export default function TabLayout() {
  const { user } = useAuthStore()
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#8B5CF6', // A nice purple
          tabBarInactiveTintColor: '#A1A1AA', // Subtle gray
          tabBarStyle: {
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: '#fff',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            overflow: 'hidden',
            borderTopWidth: 0,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 8,
          },
          headerShown: false,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 13,
            fontWeight: '600',
            marginBottom: 8,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <Home size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="agent"
          options={{
            title: 'Agent',
            tabBarIcon: ({ color }) => <Users size={24} color={color} />,
            tabBarItemStyle: { display: user?.user_type === "DEALER" ? 'flex' : "none" }
          }}
        />
        <Tabs.Screen
          name="dealer"
          options={{
            title: 'Dealer',
            tabBarIcon: ({ color }) => <Users size={24} color={color} />,
            tabBarItemStyle: { display: user?.user_type === "ADMIN" ? 'flex' : "none" }
          }}
        />
        <Tabs.Screen
          name="payement"
          options={{
            title: 'Payment',
            tabBarIcon: ({ color }) => <CreditCard size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color }) => <MoreHorizontal size={24} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}