import { useCalculator } from "@/hooks/use-calculator";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

const Calculator = () => {
  const {
    display,
    handleNumberInput,
    handleOperator,
    handleClear,
    handleEqual,
    handleDelete,
    pinInput,
  } = useCalculator();

  return (
    <View className="flex-1 bg-gray-900 p-4 justify-end mb-12">
      <View className="mb-6">
        <Text className="text-white text-right text-5xl font-bold">
          {display || pinInput}
        </Text>
      </View>

      <View className="flex-row mb-4">
        <TouchableOpacity
          className="flex-1 bg-gray-700 rounded-full p-6 items-center justify-center mr-2"
          onPress={handleClear}
        >
          <Text className="text-white text-2xl font-bold">C</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-700 rounded-full p-6 items-center justify-center mr-2"
          onPress={handleDelete}
        >
          <Text className="text-white text-2xl font-bold">⌫</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-700 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleOperator("%")}
        >
          <Text className="text-white text-2xl font-bold">%</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-accent-500 rounded-full p-6 items-center justify-center"
          onPress={() => handleOperator("/")}
        >
          <Text className="text-white text-2xl font-bold">÷</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row mb-4">
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("7")}
        >
          <Text className="text-white text-2xl font-bold">7</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("8")}
        >
          <Text className="text-white text-2xl font-bold">8</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("9")}
        >
          <Text className="text-white text-2xl font-bold">9</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-accent-500 rounded-full p-6 items-center justify-center"
          onPress={() => handleOperator("*")}
        >
          <Text className="text-white text-2xl font-bold">×</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row mb-4">
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("4")}
        >
          <Text className="text-white text-2xl font-bold">4</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("5")}
        >
          <Text className="text-white text-2xl font-bold">5</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("6")}
        >
          <Text className="text-white text-2xl font-bold">6</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-accent-500 rounded-full p-6 items-center justify-center"
          onPress={() => handleOperator("-")}
        >
          <Text className="text-white text-2xl font-bold">−</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row mb-4">
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("1")}
        >
          <Text className="text-white text-2xl font-bold">1</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("2")}
        >
          <Text className="text-white text-2xl font-bold">2</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("3")}
        >
          <Text className="text-white text-2xl font-bold">3</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-accent-500 rounded-full p-6 items-center justify-center"
          onPress={() => handleOperator("+")}
        >
          <Text className="text-white text-2xl font-bold">+</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row">
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("0")}
        >
          <Text className="text-white text-2xl font-bold">0</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput(".")}
        >
          <Text className="text-white text-2xl font-bold">.</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-2 bg-primary-500 rounded-full p-6 items-center justify-center"
          style={{ flex: 2 }}
          onPress={handleEqual}
        >
          <Text className="text-white text-2xl font-bold">=</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Calculator;
