import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, Text, TouchableOpacity, View } from "react-native";

type Draw = {
  id: number;
  name: string;
  valid_from: string;
  valid_till: string;
  cut_off_time: string;
  draw_time: string;
  color_theme: string;
  non_single_digit_price: number;
  single_digit_number_price: number;
};

export default function HomeScreen() {
  const { data, error, isLoading } = useQuery<Draw[]>({
    queryKey: ["/draw/list/"],
    queryFn: async () => {
      const res = await api.get("/draw/list/");
      return res?.data || [];
    },
  });
  if (error) {
    console.error("Draws Errors:", error);
  }

  const { setSelectedDraw } = useDrawStore();

  return (
    <View className="flex-1 bg-white p-4">
      <Text className="text-xl font-bold mb-4">Draw List</Text>
      {isLoading && <Text>Loading...</Text>}

      <FlatList
        data={[
          {
            color_theme: "red",
            cut_off_time: "11:47:48",
            draw_time: "11:51:49",
            id: 1,
            name: "bh lucky",
            non_single_digit_price: 10,
            single_digit_number_price: 12,
            valid_from: "2025-06-10",
            valid_till: "2025-06-30",
          },
        ]}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => {
              setSelectedDraw(item);
              router.push(`/${item.id}/options`);
            }}
            className="mb-4 rounded-xl overflow-hidden"
          >
            <View
              className="p-4 border border-white/20 bg-white/10 rounded-xl shadow-md"
              style={{ backgroundColor: item.color_theme }}
            >
              <Text className="text-white font-semibold">{item.name}</Text>
              <Text className="text-white">
                Valid: {item.valid_from} - {item.valid_till}
              </Text>
              <Text className="text-white">Draw Time: {item.draw_time}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text className="text-gray-500">No draws available.</Text>
        }
      />
    </View>
  );
}
