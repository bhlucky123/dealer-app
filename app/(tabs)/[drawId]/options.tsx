import useDrawStore from "@/store/draw";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

const OptionsPage = () => {
  const { drawId } = useLocalSearchParams();
  const { selectedDraw } = useDrawStore();

  const menuItems = [
    "Book Ticket",
    "Sales Report",
    "Daily Report",
    "Winnings",
    "Last Sale",
    "Result",
  ];

  return (
    <View className="flex-1 bg-white px-6 py-8">
      <Text className="text-xl font-semibold text-center mb-6 text-black">
        {selectedDraw?.name || "Draw Options"}
      </Text>

      {menuItems.map((item, index) => (
        <TouchableOpacity
          key={index}
          className="bg-gray-100 rounded-lg py-4 px-4 mb-3"
          activeOpacity={0.7}
          onPress={() => console.log(item)}
        >
          <Text className="text-center text-base text-black">{item}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default OptionsPage;
