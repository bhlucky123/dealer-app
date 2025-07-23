import useDraw from "@/hooks/use-draw";
import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { AntDesign, Feather, MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
    paddingHorizontal: 8,
    paddingTop: 24,
    paddingBottom: 32,
    position: "relative",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    marginTop: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1f2937",
    letterSpacing: -0.5,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    borderWidth: 2,
    borderColor: "#fff",
    elevation: 4,
  },
  loadingRow: {
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#6b7280",
    marginLeft: 12,
    fontSize: 16,
  },
  errorBox: {
    marginBottom: 16,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 16,
    padding: 16,
  },
  errorTitle: {
    color: "#b91c1c",
    fontWeight: "bold",
    fontSize: 18,
  },
  errorMsg: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: "#fecaca",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retryBtnText: {
    color: "#991b1b",
    fontWeight: "600",
    textAlign: "center",
  },
  drawCard: {
    marginBottom: 16,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    minHeight: 70,
    justifyContent: "center",
  },
  drawCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  drawName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  adminActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: "transparent",
    marginRight: 4,
  },
  drawDatesRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  drawDateText: {
    fontSize: 12,
    opacity: 0.8,
  },
  drawTimeText: {
    fontSize: 12,
    marginLeft: 12,
    opacity: 0.8,
  },
  drawPricesRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  drawPriceText: {
    fontSize: 12,
    opacity: 0.7,
  },
  drawPriceBold: {
    fontWeight: "bold",
  },
  drawPriceSingle: {
    fontSize: 12,
    marginLeft: 8,
    opacity: 0.7,
  },
  emptyText: {
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 80,
    fontSize: 18,
  },
  // DrawForm styles
  formContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  formScroll: {
    flex: 1,
    backgroundColor: "#fff",
  },
  formContent: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    paddingBottom: 48,
  },
  backBtn: {
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  backBtnText: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: "600",
    color: "#6366F1",
  },
  formTitle: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 32,
    color: "#6366F1",
    letterSpacing: -0.5,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#374151",
  },
  formInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f3f4f6",
    fontSize: 16,
  },
  colorPaletteRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  priceRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 20,
  },
  priceCol: {
    flex: 1,
  },
  dateBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#f9fafb",
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateBtnText: {
    color: "#1f2937",
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    flex: 1,
  },
  timeBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: "#f9fafb",
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  timeBtnText: {
    color: "#1f2937",
    fontSize: 16,
    fontWeight: "500",
  },
  submitBtn: {
    marginTop: 24,
    marginBottom: 32,
    borderRadius: 16,
    backgroundColor: "#4f46e5",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
    letterSpacing: 1,
    textAlign: "center",
    textTransform: "uppercase",
  },
});

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
          non_single_digit_price: "",
          single_digit_number_price: "",
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
    <KeyboardAvoidingView style={styles.formContainer}>
      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backBtn} onPress={onClose}>
          <AntDesign name="arrowleft" size={24} color="#6366F1" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.formTitle}>
          {isEdit ? "Edit" : "Create"} Draw
        </Text>

        {/* Name */}
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.formLabel}>Draw Name</Text>
          <TextInput
            style={styles.formInput}
            placeholder="Enter draw name"
            value={form.name}
            onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Color Theme */}
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.formLabel}>Color Theme</Text>
          <View style={styles.colorPaletteRow}>
            {colorPalette.map((color) => (
              <TouchableOpacity
                key={color}
                onPress={() => setForm((prev) => ({ ...prev, color_theme: color }))}
                style={[
                  styles.colorCircle,
                  {
                    backgroundColor: color,
                    borderWidth: form.color_theme === color ? 3 : 1,
                    borderColor: form.color_theme === color ? "#6366F1" : "#e5e7eb",
                  },
                ]}
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
        <View style={styles.priceRow}>
          <View style={styles.priceCol}>
            <Text style={styles.formLabel}>Non-Single Digit Price</Text>
            <TextInput
              style={styles.formInput}
              placeholder="₹"
              keyboardType="numeric"
              value={form.non_single_digit_price.toString()}
              onChangeText={(text) =>
                setForm((prev) => ({
                  ...prev,
                  non_single_digit_price: Number(text.replace(/[^0-9.]/g, "")),
                }))
              }
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View style={styles.priceCol}>
            <Text style={styles.formLabel}>Single Digit Price</Text>
            <TextInput
              style={styles.formInput}
              placeholder="₹"
              keyboardType="numeric"
              value={form.single_digit_number_price.toString()}
              onChangeText={(text) =>
                setForm((prev) => ({
                  ...prev,
                  single_digit_number_price: Number(text.replace(/[^0-9.]/g, "")),
                }))
              }
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>

        {/* Dates & Times */}
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.formLabel}>Valid From</Text>
          <TouchableOpacity
            style={styles.dateBtn}
            activeOpacity={0.8}
            onPress={() => setShowDatePicker("valid_from")}
          >
            <Text style={styles.dateBtnText}>
              {`${form.valid_from.getDate().toString().padStart(2, "0")}/${(form.valid_from.getMonth() + 1)
                .toString()
                .padStart(2, "0")}/${form.valid_from.getFullYear()}`}
            </Text>
            <AntDesign name="calendar" size={20} color="#6366f1" style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          <Text style={styles.formLabel}>Valid Till</Text>
          <TouchableOpacity
            style={styles.dateBtn}
            activeOpacity={0.8}
            onPress={() => setShowDatePicker("valid_till")}
          >
            <Text style={styles.dateBtnText}>
              {`${form.valid_till.getDate().toString().padStart(2, "0")}/${(form.valid_till.getMonth() + 1)
                .toString()
                .padStart(2, "0")}/${form.valid_till.getFullYear()}`}
            </Text>
            <AntDesign name="calendar" size={20} color="#6366f1" style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>Cut Off Time</Text>
            <TouchableOpacity
              style={styles.timeBtn}
              activeOpacity={0.85}
              onPress={() => setShowDatePicker("cut_off_time")}
            >
              <Feather name="clock" size={18} color="#6366f1" style={{ marginRight: 6 }} />
              <Text style={styles.timeBtnText}>
                {form.cut_off_time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.timeRow, { marginBottom: 12 }]}>
            <Text style={styles.timeLabel}>Draw Time</Text>
            <TouchableOpacity
              style={styles.timeBtn}
              activeOpacity={0.85}
              onPress={() => setShowDatePicker("draw_time")}
            >
              <Feather name="clock" size={18} color="#6366f1" style={{ marginRight: 6 }} />
              <Text style={styles.timeBtnText}>
                {form.draw_time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginBottom: 32 }}>
          <TouchableOpacity
            onPress={handleSubmit}
            activeOpacity={0.85}
            style={styles.submitBtn}
          >
            <Text style={styles.submitBtnText}>
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
    </KeyboardAvoidingView>
  );
};

export default function HomeScreen() {
  const { setSelectedDraw } = useDrawStore();
  const [showForm, setShowForm] = useState(false);
  const [editDraw, setEditDraw] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const { user } = useAuthStore();

  const queryClient = useQueryClient();

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

  // Delete handler for draw list
  const handleDeleteDraw = async (drawId: number) => {
    Alert.alert(
      "Delete Draw",
      "This will delete all the data related to this draw. Are you sure you want to continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/draw/${drawId}/`);
              await queryClient.invalidateQueries({ queryKey: ["/draw/list/"] });
            } catch (err) {
              Alert.alert("Error", "Failed to delete draw. Please try again.");
            }
          },
        },
      ]
    );
  };

  if (showForm) {
    return <DrawForm initialData={editDraw} onClose={() => setShowForm(false)} />;
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        {/* title */}
        <Text style={styles.title}>
          🎲 Draws
        </Text>

        {/* add‑button */}
        {user?.user_type === "ADMIN" && (
          <TouchableOpacity
            onPress={() => {
              setEditDraw(null);
              setShowForm(true);
            }}
            accessibilityLabel="Add new draw"
            activeOpacity={0.85}
            style={styles.addButton}
          >
            <AntDesign name="plus" size={26} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {(isLoading || isFetching) && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading draws...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Failed to load draws.</Text>
          <Text style={styles.errorMsg}>{error?.message || "Unknown error"}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => refetch()}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={draws || []}
        keyExtractor={(item) => item?.id?.toString()}
        renderItem={({ item }) => {
          const textColor = getContrastYIQ(item.color_theme || "#8B5CF6");
          return (
            <View>
              <TouchableOpacity
                onPress={() => {
                  setSelectedDraw(item);
                  router.push(`/options`);
                }}
                activeOpacity={0.9}
                style={[
                  styles.drawCard,
                  { backgroundColor: item.color_theme || "#8B5CF6" },
                ]}
              >
                <View style={styles.drawCardRow}>
                  <Text style={[styles.drawName, { color: textColor }]}>
                    {item.name}
                  </Text>
                  {user?.user_type === "ADMIN" && (
                    <View style={styles.adminActions}>
                      <TouchableOpacity
                        onPress={() => {
                          setEditDraw(item);
                          setShowForm(true);
                        }}
                        style={styles.actionBtn}
                      >
                        <Feather name="edit" size={18} color={textColor} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteDraw(item.id)}
                        style={styles.actionBtn}
                      >
                        <MaterialIcons name="delete" size={20} color={textColor} />
                      </TouchableOpacity>
                    </View>
                  )}

                  {(user?.user_type === "AGENT" || user?.user_type === "DEALER") && (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedDraw(item);
                        router.push("/book");
                      }}
                      style={{
                        marginLeft: 8,
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        backgroundColor: "#ffff",
                        flexDirection: "row",
                        alignItems: "center",
                        borderRadius:50,
                        opacity: 10,
                        elevation: 3,
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={{ fontWeight: "bold", fontSize: 13, color: "#000" }}>
                        Book Ticket
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.drawDatesRow}>
                  <Text style={[styles.drawDateText, { color: textColor }]}>
                    {/* Format valid_from and valid_till as dd/mm/yyyy */}
                    {item.valid_from
                      ? (() => {
                          const d = new Date(item.valid_from);
                          const day = d.getDate().toString().padStart(2, "0");
                          const month = (d.getMonth() + 1).toString().padStart(2, "0");
                          const year = d.getFullYear();
                          return `${day}/${month}/${year}`;
                        })()
                      : ""}
                    {" - "}
                    {item.valid_till
                      ? (() => {
                          const d = new Date(item.valid_till);
                          const day = d.getDate().toString().padStart(2, "0");
                          const month = (d.getMonth() + 1).toString().padStart(2, "0");
                          const year = d.getFullYear();
                          return `${day}/${month}/${year}`;
                        })()
                      : ""}
                  </Text>
                  <Text style={[styles.drawTimeText, { color: textColor }]}>
                    {/* Format draw_time as hh:mm AM/PM */}
                    {item.draw_time
                      ? (() => {
                          const [h, m, s] = item.draw_time.split(":");
                          const date = new Date();
                          date.setHours(Number(h), Number(m), Number(s || 0));
                          return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                        })()
                      : ""}
                  </Text>
                </View>
                <View style={styles.drawPricesRow}>
                  <Text style={[styles.drawPriceText, { color: textColor }]}>
                    Non-Single: <Text style={[styles.drawPriceBold, { color: textColor }]}>₹{item.non_single_digit_price}</Text>
                  </Text>
                  <Text style={[styles.drawPriceSingle, { color: textColor }]}>
                    Single: <Text style={[styles.drawPriceBold, { color: textColor }]}>₹{item.single_digit_number_price}</Text>
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          !isLoading && !error ? (
            <Text style={styles.emptyText}>No draws available.</Text>
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
          paddingBottom: 50, // Add extra bottom padding for navbar
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}