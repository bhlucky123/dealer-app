import useDrawStore from "@/store/draw";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

const OptionsPage = () => {
  const { drawId } = useLocalSearchParams();
  const { selectedDraw } = useDrawStore();

  // Define menu items with their corresponding routes
  const menuItems = [
    {
      label: "Sales Report",
      route: `/sales-report`,
    },
    {
      label: "Daily Report",
      route: `/daily-report/${drawId}`,
    },
    {
      label: "Winnings",
      route: `/winnings/${drawId}`,
    },
    {
      label: "Last Sale",
      route: `/last-sale/${drawId}`,
    },
    {
      label: "Result",
      route: `/result`,
    },
  ];

  return (
    <View className="flex-1 bg-white px-6 py-8">
      <Text className="text-xl font-semibold text-center mb-6 text-black">
        {selectedDraw?.name || "Draw Options"}
      </Text>

      <TouchableOpacity
        className="bg-gray-100 rounded-lg py-4 px-4 mb-3"
        activeOpacity={0.7}
        onPress={() => {
          router.push("/book");
        }}
      >
        <Text className="text-center text-base text-black">Book Ticket</Text>
      </TouchableOpacity>

      {menuItems.map((item, index) => (
        <TouchableOpacity
          key={index}
          className="bg-gray-100 rounded-lg py-4 px-4 mb-3"
          activeOpacity={0.7}
          onPress={() => {
            router.push(item.route);
          }}
        >
          <Text className="text-center text-base text-black">{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default OptionsPage;
