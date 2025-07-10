import useDraw from "@/hooks/use-draw";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { AntDesign, Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const DrawForm = ({ initialData, onClose }: { initialData?: any; onClose: () => void }) => {
  const isEdit = !!initialData;
  const [form, setForm] = useState(
    initialData
      ? {
          ...initialData,
          valid_from: new Date(initialData.valid_from),
          valid_till: new Date(initialData.valid_till),
          cut_off_time: new Date(`1970-01-01T${initialData.cut_off_time}`),
          draw_time: new Date(`1970-01-01T${initialData.draw_time}`),
        }
      : {
          name: "",
          valid_from: new Date(),
          valid_till: new Date(),
          cut_off_time: new Date(),
          draw_time: new Date(),
          color_theme: "#8B5CF6",
          non_single_digit_price: 0,
          single_digit_number_price: 0,
        }
  );
  const [showDatePicker, setShowDatePicker] = useState<null | string>(null);
  const { createDraw, updateDraw } = useDraw();
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    // Format cut_off_time and draw_time as "hh:mm:ss"
    const formatTime = (date: Date) => {
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    };

    const data = {
      name: form.name,
      valid_from: form.valid_from.toISOString().split("T")[0],
      valid_till: form.valid_till.toISOString().split("T")[0],
      cut_off_time: formatTime(form.cut_off_time),
      draw_time: formatTime(form.draw_time),
      color_theme: form.color_theme,
      non_single_digit_price: form.non_single_digit_price,
      single_digit_number_price: form.single_digit_number_price,
    };

    if (isEdit) {
      const updated = await updateDraw.mutateAsync({ ...data, id: initialData.id });
      queryClient.setQueryData(["/draw/list/"], (old: any) =>
        old.map((d: any) => (d.id === updated.id ? updated : d))
      );
    } else {
      // Only refetch the list instead of manually adding to avoid duplicates
      await createDraw.mutateAsync(data);
      await queryClient.invalidateQueries({ queryKey: ["/draw/list/"] });
    }
    onClose();
  };

  return (
    <ScrollView className="flex-1 bg-white p-6">
      <TouchableOpacity className="mb-4" onPress={onClose}>
        <AntDesign name="arrowleft" size={24} color="black" />
      </TouchableOpacity>

      <Text className="text-xl font-bold mb-4">{isEdit ? "Edit" : "Create"} Draw</Text>

      {["name", "color_theme", "non_single_digit_price", "single_digit_number_price"].map((key) => (
        <View key={key} className="mb-2">
          <Text className="text-sm font-medium mb-1">
            {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
          </Text>
          <TextInput
            className="border border-gray-300 rounded-xl p-2"
            placeholder={key.replace(/_/g, " ")}
            keyboardType={key.includes("price") ? "numeric" : "default"}
            value={form[key].toString()}
            onChangeText={(text) =>
              setForm((prev: typeof form) => ({
                ...prev,
                [key]: key.includes("price") ? Number(text) : text,
              }))
            }
          />
        </View>
      ))}

      {["valid_from", "valid_till", "cut_off_time", "draw_time"].map((key) => (
        <TouchableOpacity
          key={key}
          className="border border-gray-300 rounded-xl p-3 mb-2"
          onPress={() => setShowDatePicker(key)}
        >
          <Text className="text-gray-800 text-sm font-medium">
            {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}:{" "}
            {key.includes("time")
              ? form[key].toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
              : form[key].toLocaleDateString()}
          </Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        className="bg-primary py-3 rounded-xl mt-2"
        onPress={handleSubmit}
      >
        <Text className="text-white text-center font-bold">
          {isEdit ? "Update" : "Create"} Draw
        </Text>
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          mode={showDatePicker.includes("time") ? "time" : "date"}
          value={form[showDatePicker]}
          display={Platform.OS === "android" ? "default" : "spinner"}
          onChange={(event, date) => {
            if (date) setForm((prev: typeof form) => ({ ...prev, [showDatePicker]: date }));
            setShowDatePicker(null);
          }}
        />
      )}
    </ScrollView>
  );
};

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const { setSelectedDraw } = useDrawStore();
  const [showForm, setShowForm] = useState(false);
  const [editDraw, setEditDraw] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const {
    data,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["/draw/list/"],
    queryFn: async () => {
      const res = await api.get("/draw/list/");
      return res?.data || [];
    },
  });

  const draws = data || [];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (showForm) {
    return <DrawForm initialData={editDraw} onClose={() => setShowForm(false)} />;
  }

  return (
    <View className="flex-1 bg-light p-4 mt-3">
      <Text className="text-2xl font-bold text-dark mb-4">🎯 Draw List</Text>

      {(isLoading || isFetching) && (
        <View className="mb-4 flex-row items-center">
          <ActivityIndicator size="small" color="#8B5CF6" />
          <Text className="text-gray-500 ml-2">Loading...</Text>
        </View>
      )}

      {error && (
        <View className="mb-4 bg-red-100 border border-red-300 rounded-lg p-3">
          <Text className="text-red-700 font-semibold">Failed to load draws.</Text>
          <Text className="text-red-500 text-xs mt-1">{error?.message || "Unknown error"}</Text>
          <TouchableOpacity
            className="mt-2 bg-red-200 px-3 py-1 rounded"
            onPress={() => refetch()}
          >
            <Text className="text-red-800 font-medium">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={draws}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => {
              setSelectedDraw(item);
              router.push(`/${item.id}/options`);
            }}
            className="mb-4 rounded-2xl overflow-hidden shadow-md"
          >
            <View
              className="p-5 rounded-2xl"
              style={{ backgroundColor: item.color_theme || "#8B5CF6" }}
            >
              <View className="flex-row justify-between items-center">
                <Text className="text-white text-lg font-bold">{item.name}</Text>
                <TouchableOpacity onPress={() => { setEditDraw(item); setShowForm(true); }}>
                  <Feather name="edit" size={18} color="white" />
                </TouchableOpacity>
              </View>
              <Text className="text-white mt-1 text-sm">
                🗓 Valid: {item.valid_from} - {item.valid_till}
              </Text>
              <Text className="text-white text-sm">⏰ Draw Time: {item.draw_time}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !isLoading && !error ? (
            <Text className="text-gray-400 text-center mt-20">No draws available.</Text>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isFetching}
            onRefresh={handleRefresh}
            colors={["#8B5CF6"]}
            tintColor="#8B5CF6"
          />
        }
        contentContainerStyle={draws.length === 0 && !isLoading && !error ? { flex: 1, justifyContent: "center" } : undefined}
      />

      <TouchableOpacity
        onPress={() => { setEditDraw(null); setShowForm(true); }}
        className="absolute bottom-8 right-8 bg-primary p-4 rounded-full shadow-lg"
      >
        <AntDesign name="plus" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}