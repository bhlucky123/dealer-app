import useDraw from "@/hooks/use-draw";
import { useAuthStore } from "@/store/auth";
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

// Helper for color contrast
function getContrastYIQ(hexcolor: string) {
  hexcolor = hexcolor.replace("#", "");
  if (hexcolor.length === 3) {
    hexcolor = hexcolor
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(hexcolor.substr(0, 2), 16);
  const g = parseInt(hexcolor.substr(2, 2), 16);
  const b = parseInt(hexcolor.substr(4, 2), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#222" : "#fff";
}

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
      await createDraw.mutateAsync(data);
      await queryClient.invalidateQueries({ queryKey: ["/draw/list/"] });
    }
    onClose();
  };

  // Color palette for color_theme selection
  const colorPalette = [
    "#8B5CF6", // indigo
    "#F59E42", // orange
    "#F43F5E", // rose
    "#10B981", // emerald
    "#3B82F6", // blue
    "#FBBF24", // yellow
    "#6366F1", // indigo-500
    "#A21CAF", // purple
    "#F472B6", // pink
    "#22D3EE", // cyan
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 32, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity className="mb-6 flex-row items-center" onPress={onClose}>
          <AntDesign name="arrowleft" size={24} color="#6366F1" />
          <Text className="ml-2 text-lg font-semibold text-indigo-700">Back</Text>
        </TouchableOpacity>

        <Text className="text-3xl font-extrabold mb-8 text-indigo-700 tracking-tight">
          {isEdit ? "Edit" : "Create"} Draw
        </Text>

        {/* Name */}
        <View className="mb-5">
          <Text className="text-base font-semibold mb-2 text-gray-700">Draw Name</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-base"
            placeholder="Enter draw name"
            value={form.name}
            onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
          />
        </View>

        {/* Color Theme */}
        <View className="mb-5">
          <Text className="text-base font-semibold mb-2 text-gray-700">Color Theme</Text>
          <View className="flex-row flex-wrap gap-2">
            {colorPalette.map((color) => (
              <TouchableOpacity
                key={color}
                onPress={() => setForm((prev) => ({ ...prev, color_theme: color }))}
                style={{
                  backgroundColor: color,
                  borderWidth: form.color_theme === color ? 3 : 1,
                  borderColor: form.color_theme === color ? "#6366F1" : "#e5e7eb",
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  marginRight: 10,
                  marginBottom: 10,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                activeOpacity={0.7}
              >
                {form.color_theme === color && (
                  <AntDesign name="check" size={20} color={getContrastYIQ(color)} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Prices */}
        <View className="mb-5 flex-row gap-4">
          <View style={{ flex: 1 }}>
            <Text className="text-base font-semibold mb-2 text-gray-700">Non-Single Digit Price</Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-base"
              placeholder="0"
              keyboardType="numeric"
              value={form.non_single_digit_price.toString()}
              onChangeText={(text) =>
                setForm((prev) => ({
                  ...prev,
                  non_single_digit_price: Number(text.replace(/[^0-9.]/g, "")),
                }))
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text className="text-base font-semibold mb-2 text-gray-700">Single Digit Price</Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-base"
              placeholder="0"
              keyboardType="numeric"
              value={form.single_digit_number_price.toString()}
              onChangeText={(text) =>
                setForm((prev) => ({
                  ...prev,
                  single_digit_number_price: Number(text.replace(/[^0-9.]/g, "")),
                }))
              }
            />
          </View>
        </View>

        {/* Dates & Times */}
        <View className="mb-5">
          <Text className="text-base font-semibold mb-2 text-gray-700">Valid From</Text>
          <TouchableOpacity
            className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 mb-3"
            onPress={() => setShowDatePicker("valid_from")}
          >
            <Text className="text-gray-800 text-base">
              {form.valid_from.toLocaleDateString()}
            </Text>
          </TouchableOpacity>

          <Text className="text-base font-semibold mb-2 text-gray-700">Valid Till</Text>
          <TouchableOpacity
            className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 mb-3"
            onPress={() => setShowDatePicker("valid_till")}
          >
            <Text className="text-gray-800 text-base">
              {form.valid_till.toLocaleDateString()}
            </Text>
          </TouchableOpacity>

          <Text className="text-base font-semibold mb-2 text-gray-700">Cut Off Time</Text>
          <TouchableOpacity
            className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 mb-3"
            onPress={() => setShowDatePicker("cut_off_time")}
          >
            <Text className="text-gray-800 text-base">
              {form.cut_off_time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
            </Text>
          </TouchableOpacity>

          <Text className="text-base font-semibold mb-2 text-gray-700">Draw Time</Text>
          <TouchableOpacity
            className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50"
            onPress={() => setShowDatePicker("draw_time")}
          >
            <Text className="text-gray-800 text-base">
              {form.draw_time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginBottom: 32 }}>
          <TouchableOpacity
            onPress={handleSubmit}
            activeOpacity={0.85}
            style={{
              marginTop: 24,
              marginBottom: 32,
              borderRadius: 16,
              backgroundColor: "#4f46e5", // indigo-600
              shadowColor: "#6366f1", // indigo-500
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.22,
              shadowRadius: 12,
              elevation: 8,
              paddingVertical: 18,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontWeight: "bold",
                fontSize: 18,
                letterSpacing: 1,
                textAlign: "center",
                textTransform: "uppercase",
              }}
            >
              {isEdit ? "Update" : "Create"} Draw
            </Text>
          </TouchableOpacity>
        </View>

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
    </View>
  );
};

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const { setSelectedDraw } = useDrawStore();
  const [showForm, setShowForm] = useState(false);
  const [editDraw, setEditDraw] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const { user } = useAuthStore()

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
    <View className="flex-1 bg-[#f5f7fa] px-2 pt-6 relative" style={{ paddingBottom: 32 }}>
      {/* HEADER */}
      <View className="flex-row items-center justify-between mb-6 mt-4">
        {/* title */}
        <Text className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
          🎲 Draws
        </Text>

        {/* add‑button */}
        {
          user?.user_type === "ADMIN" && (
            <TouchableOpacity
              onPress={() => {
                setEditDraw(null);
                setShowForm(true);
              }}
              accessibilityLabel="Add new draw"
              activeOpacity={0.85}
              className="
      w-12 h-12 rounded-full bg-blue-600
      items-center justify-center
      shadow-md
      border-2 border-white
      ios:shadow-lg android:elevation-4
    "
            >
              <AntDesign name="plus" size={26} color="#fff" />
            </TouchableOpacity>
          )
        }
      </View>

      {(isLoading || isFetching) && (
        <View className="mb-4 flex-row items-center justify-center">
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text className="text-gray-500 ml-3 text-base">Loading draws...</Text>
        </View>
      )}

      {error && (
        <View className="mb-4 bg-red-100 border border-red-300 rounded-xl p-4">
          <Text className="text-red-700 font-bold text-lg">Failed to load draws.</Text>
          <Text className="text-red-500 text-xs mt-1">{error?.message || "Unknown error"}</Text>
          <TouchableOpacity
            className="mt-3 bg-red-200 px-4 py-2 rounded-lg"
            onPress={() => refetch()}
          >
            <Text className="text-red-800 font-semibold text-center">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={draws}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          const textColor = getContrastYIQ(item.color_theme || "#8B5CF6");
          return (
            <View className="mb-4">
              <TouchableOpacity
                onPress={() => {
                  setSelectedDraw(item);
                  router.push(`/options`);
                }}
                activeOpacity={0.9}
                className="bg-[#{item.color_theme || '#8B5CF6'}] rounded-lg px-4 py-4 border border-gray-200 flex-col min-h-[70px] justify-center"
                style={{
                  backgroundColor: item.color_theme || "#8B5CF6",
                }}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-bold" style={{ color: textColor }}>
                    {item.name}
                  </Text>
                  {user?.user_type === "ADMIN" && (
                    <TouchableOpacity
                      onPress={() => {
                        setEditDraw(item);
                        setShowForm(true);
                      }}
                      className="p-1 rounded bg-transparent"
                    >
                      <Feather name="edit" size={18} color={textColor} />
                    </TouchableOpacity>
                  )}
                </View>
                <View className="flex-row items-center mt-1">
                  <Text className="text-xs text-opacity-80" style={{ color: textColor }}>
                    {item.valid_from} - {item.valid_till}
                  </Text>
                  <Text className="text-xs ml-3 text-opacity-80" style={{ color: textColor }}>
                    {item.draw_time}
                  </Text>
                </View>
                <View className="flex-row items-center mt-1">
                  <Text className="text-xs text-opacity-70" style={{ color: textColor }}>
                    Non-Single: <Text className="font-bold" style={{ color: textColor }}>₹{item.non_single_digit_price}</Text>
                  </Text>
                  <Text className="text-xs ml-2 text-opacity-70" style={{ color: textColor }}>
                    Single: <Text className="font-bold" style={{ color: textColor }}>₹{item.single_digit_number_price}</Text>
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          !isLoading && !error ? (
            <Text className="text-gray-400 text-center mt-20 text-lg">No draws available.</Text>
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
        contentContainerStyle={{
          ...(draws.length === 0 && !isLoading && !error
            ? { flex: 1, justifyContent: "center" }
            : {}),
          paddingBottom: 40, // Add extra bottom padding for navbar
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}