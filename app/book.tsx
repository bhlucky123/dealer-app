import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { getThemeColors } from "@/utils/color";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Clipboard } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View
} from "react-native";
import { ALERT_TYPE, Dialog } from "react-native-alert-notification";
import { Dropdown } from 'react-native-element-dropdown';
import { SafeAreaView } from "react-native-safe-area-context";

type BookingDetail = {
  lsk: string;
  number: string;
  count: number;
  amount: number;
  d_amount: number;
  c_amount: number;
  type: string;
  sub_type: string;
};

type Totals = {
  count: number;
  d_amount: number;
  c_amount: number;
};

type DrawSessionResponse = {
  id: number;
  session: {
    active: boolean;
    reason: string;
    active_session_id: number | null;
  };
  name: string;
  valid_from: string;
  valid_till: string;
  cut_off_time: string;
  draw_time: string;
  color_theme: string;
  non_single_digit_price: number;
  single_digit_number_price: number;
};

const RangeOptions = [
  { label: "Book", value: "Book" },
  { label: "Range", value: "Range" },
  { label: "Set", value: "Set" },
  { label: "Different", value: "Different" },
];

const BookingScreen: React.FC = () => {
  const [customerName, setCustomerName] = useState<string>("");
  const [drawSession, setDrawSession] = useState<string>("3");
  const [selectedRange, setSelectedRange] = useState<"Book" | "Set" | "Range" | "Different">(
    "Book"
  );
  const [numberInput, setNumberInput] = useState<string>("");
  const [endNumberInput, setEndNumberInput] = useState<string>("");
  const [countInput, setCountInput] = useState<string>("");
  const [bCountInput, setBCountInput] = useState<string>("");
  const [differenceInput, setDifferenceInput] = useState<string>("");
  const [bookingDetails, setBookingDetails] = useState<BookingDetail[]>([]);
  const [rangeOptions, setRangeOptions] = useState(RangeOptions);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editingEntry, setEditingEntry] = useState<BookingDetail | null>(null);

  // Error state for draw session
  const [drawSessionError, setDrawSessionError] = useState<string | null>(null);

  const { selectedDraw, setSelectedDraw } = useDrawStore();

  const colorTheme = selectedDraw?.color_theme;
  const themeColors = getThemeColors(colorTheme);
  const { user } = useAuthStore();

  const countInputRef = useRef<TextInput>(null);
  const numInputRef = useRef<TextInput>(null);
  const endNumInputRef = useRef<TextInput>(null);
  const differenceInputRef = useRef<TextInput>(null);

  const buttonsMap: Record<string, string[]> = {
    "1": ["A", "B", "C", "ALL"],
    "2": ["AB", "BC", "AC", "ALL"],
    "3": ["SUPER", "BOX", "BOTH"],
  };

  const {
    data: DrawSessionDetails,
    error,
    isError,
  } = useQuery<DrawSessionResponse>({
    queryKey: ["/draw/get-session/", selectedDraw?.id],
    queryFn: async () => {
      const response = await api.get(`/draw/get-session/${selectedDraw?.id}/`);
      return response.data;
    },
    enabled: !!selectedDraw?.id,
    select: (response) => response,
    refetchOnMount: true,
  });

  // Show error message if draw session is not active or error occurs
  useEffect(() => {
    if (isError || error || (DrawSessionDetails && !DrawSessionDetails.session?.active)) {
      setDrawSessionError("You're not allowed to book the number now. Try later");
    } else {
      setDrawSessionError(null);
    }
  }, [isError, error, DrawSessionDetails]);

  const { mutate } = useMutation({
    mutationFn: async (data: any) => api.post("/draw-booking/create/", data),
    onSuccess: () => {
      ToastAndroid.show("Booking submitted.", 300)
      setBookingDetails([]);
      clearInputs();
      setEditIndex(null);
      setCustomerName("")
    },
    onError: (error: any) => {
      let errorMessage = "Failed to submit.";
      if (error?.message) {
        if (typeof error.message === "string") {
          errorMessage = error.message;
        } else if (typeof error.message === "object") {
          if (error.message.non_field_errors && Array.isArray(error.message.non_field_errors)) {
            errorMessage = error.message.non_field_errors.join("\n");
          } else if (error.message.detail) {
            errorMessage = error.message.detail;
          } else {
            errorMessage = JSON.stringify(error.message);
          }
        }
      }
      Dialog.show({
        type: ALERT_TYPE.DANGER,
        title: 'Error',
        textBody: errorMessage,
        button: 'Close',
      });
    },
  });

  type BookingType = "single_digit" | "double_digit" | "triple_digit" | "";

  const getBookingType = (): BookingType => {
    switch (drawSession) {
      case "1":
        return "single_digit";
      case "2":
        return "double_digit";
      case "3":
        return "triple_digit";
      default:
        return "";
    }
  };

  // Helper to check if a value is a valid number string (digits only, not empty)
  const isValidNumberString = (val: any) => typeof val === "string" && /^[0-9]+$/.test(val);

  // Helper to check if a value is a valid number (not NaN, finite, > 0)
  const isValidPositiveNumber = (val: any) => {
    const n = typeof val === "number" ? val : parseInt(val, 10);
    return !isNaN(n) && isFinite(n) && n > 0;
  };

  const addBooking = (
    subType: string,
    number?: string,
    count?: number,
    bCount?: number
  ) => {
    // ... (no change to addBooking)
    // [Omitted for brevity, same as original]
    // --- SNIP ---
    // --- BEGIN original addBooking code ---
    // ... (rest of addBooking unchanged)
    // --- END original addBooking code ---
  };

  const handleSubmit = () => {
    if (!bookingDetails?.length) {
      Alert.alert("No bookings", "Please add at least one booking before submitting.");
      return;
    }
    if (DrawSessionDetails?.session?.active_session_id) {
      const data = {
        customer_name: customerName,
        draw_session: DrawSessionDetails?.session?.active_session_id,
        booked_agent: Number(user?.id),
        booking_details: bookingDetails.map(
          ({ number, count, type, sub_type }) => ({
            number,
            count,
            type,
            sub_type,
          })
        ),
      };
      mutate(data);
    }
  };

  const handleEdit = (index: number) => {
    const entry = bookingDetails[index];
    setEditingEntry({ ...entry });
    setEditIndex(index);
    setEditModalVisible(true);
  };

  const saveEdit = () => {
    // ... (no change to saveEdit)
    // [Omitted for brevity, same as original]
  };

  const handleDelete = (index: number) => {
    setBookingDetails((prev) => prev.filter((_, idx) => idx !== index));
    if (editIndex === index) {
      setEditModalVisible(false);
      setEditIndex(null);
    }
  };

  const totals: Totals = bookingDetails.reduce<Totals>(
    (acc, entry) => {
      acc.count += entry.count;
      acc.d_amount += entry.d_amount;
      acc.c_amount += entry.c_amount;
      return acc;
    },
    { count: 0, d_amount: 0, c_amount: 0 }
  );

  const clearInputs = () => {
    setCountInput("");
    setNumberInput("");
    setBCountInput("");
    setDifferenceInput("");
    numInputRef.current?.focus();
  };

  const handleDrawSession = (num: string) => {
    clearInputs();
    if (num === "3") {
      setRangeOptions(RangeOptions);
    }
    if (num !== "3") {
      setRangeOptions(RangeOptions.filter((option) => option.value !== "Set" && option.value !== "Different"));
      if (selectedRange === "Set" || selectedRange === "Different") {
        setSelectedRange("Book");
      }
    }
    setDrawSession(num.toString());
  };

  // --- REWRITE handlePastBookings ---
  const handlePastBookings = async () => {
    // ... (no change to handlePastBookings)
    // [Omitted for brevity, same as original]
  };

  const handleBackClick = () => {
    setSelectedDraw(null)
    router.push("/(tabs)");
  }

  return (
    <SafeAreaView className="flex-1">
      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding"
        keyboardVerticalOffset={80}
      >
        {/* Show error message as overlay if error exists */}
        {drawSessionError && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 100,
              backgroundColor: "rgba(255,255,255,0.95)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View className="bg-red-100 border border-red-500 rounded-2xl px-8 py-6 shadow-lg min-w-[300px] max-w-[350px] items-center">
              <Text className="text-red-800 text-lg font-bold text-center mb-3">
                {drawSessionError}
              </Text>
              <TouchableOpacity
                onPress={handleBackClick}
                className="mt-4 bg-red-600 px-6 py-2 rounded-lg min-w-[120px] active:opacity-85"
                activeOpacity={0.85}
              >
                <Text className="text-white text-center font-bold text-base tracking-wide">
                  Go Back
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View className="p-4 flex-1 mb-10" pointerEvents={drawSessionError ? "none" : "auto"} style={drawSessionError ? { opacity: 0.5 } : undefined}>
          <View className="flex-row items-center mb-4 gap-2">
            <TextInput
              placeholder="Customer Name"
              value={customerName}
              onChangeText={setCustomerName}
              className="flex-1 border border-gray-400 rounded px-3 py-2 bg-white text-base"
              placeholderTextColor="#9ca3af"
              editable={!drawSessionError}
            />
            <TouchableOpacity
              onPress={handlePastBookings}
              className="ml-2 p-2 bg-gray-100 rounded border border-gray-300 active:bg-gray-200"
              accessibilityLabel="Paste from clipboard"
              disabled={!!drawSessionError}
            >
              <Clipboard width={24} height={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center mb-4 gap-2">
            {[1, 2, 3].map((num) => (
              <TouchableOpacity
                key={num}
                onPress={() => handleDrawSession(num.toString())}
                className={`px-4 py-1 rounded-full border ${drawSession === num.toString() ? "bg-black" : "border-gray-400"
                  }`}
                disabled={!!drawSessionError}
              >
                <Text
                  className={`${drawSession === num.toString() ? "text-white" : "text-black"
                    }`}
                >
                  {num}
                </Text>
              </TouchableOpacity>
            ))}
            <View className="flex-1 ml-2">
              <Dropdown
                data={rangeOptions}
                labelField="label"
                valueField="value"
                value={selectedRange}
                onChange={item => setSelectedRange(item.value)}
                placeholder="Select Type"
                style={{
                  borderColor: "#9ca3af",
                  borderWidth: 1,
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  padding: 10
                }}
                containerStyle={{
                  borderRadius: 6,
                }}
                itemTextStyle={{
                  color: "#000",
                }}
                selectedTextStyle={{
                  color: "#000",
                }}
                disable={!!drawSessionError}
              />
            </View>
          </View>

          {/* Inputs for Book, Range, Set, Different */}
          <View className="flex-row gap-2 mb-3">
            {/* Start/Number input */}
            <TextInput
              ref={numInputRef}
              value={numberInput}
              onChangeText={(text) => {
                const formatted = text.replace(/[^0-9]/g, "");
                setNumberInput(formatted);

                const requiredLength = parseInt(drawSession);
                if (formatted.length >= requiredLength) {
                  if (selectedRange === "Range" || selectedRange === "Different") {
                    endNumInputRef.current?.focus();
                  } else {
                    countInputRef.current?.focus();
                  }
                }
              }}
              maxLength={3}
              keyboardType="numeric"
              placeholder={
                selectedRange === "Range" || selectedRange === "Different"
                  ? "Start"
                  : "Number"
              }
              className="flex-1 border border-gray-400 px-3 py-2 rounded"
              placeholderTextColor="#9ca3af"
              editable={!drawSessionError}
            />

            {/* End input for Range and Different */}
            {(selectedRange === "Range" || selectedRange === "Different") && (
              <TextInput
                ref={endNumInputRef}
                value={endNumberInput}
                onChangeText={(text) => {
                  const formatted = text.replace(/[^0-9]/g, "");
                  setEndNumberInput(formatted);

                  const requiredLength = parseInt(drawSession);
                  if (formatted.length >= requiredLength) {
                    if (selectedRange === "Different") {
                      differenceInputRef.current?.focus();
                    } else {
                      countInputRef.current?.focus();
                    }
                  }
                }}
                maxLength={3}
                keyboardType="numeric"
                placeholder="End"
                className="flex-1 border border-gray-400 px-3 py-2 rounded"
                placeholderTextColor="#9ca3af"
                editable={!drawSessionError}
              />
            )}

            {/* Difference input for Different */}
            {selectedRange === "Different" && (
              <TextInput
                ref={differenceInputRef}
                value={differenceInput}
                onChangeText={(text) => {
                  const formatted = text.replace(/[^0-9]/g, "");
                  setDifferenceInput(formatted);
                }}
                maxLength={3}
                keyboardType="numeric"
                placeholder="Difference"
                className="flex-1 border border-gray-400 px-3 py-2 rounded"
                placeholderTextColor="#9ca3af"
                editable={!drawSessionError}
              />
            )}

            {/* Count input */}
            <TextInput
              ref={countInputRef}
              value={countInput}
              onChangeText={setCountInput}
              keyboardType="numeric"
              placeholder="Count"
              className="flex-1 border border-gray-400 px-3 py-2 rounded"
              placeholderTextColor="#9ca3af"
              editable={!drawSessionError}
            />

            {/* B.Count input for 3-digit only */}
            {drawSession === "3" && (
              <TextInput
                value={bCountInput}
                onChangeText={setBCountInput}
                keyboardType="numeric"
                placeholder="B.Count"
                className="flex-1 border border-gray-400 px-3 py-2 rounded"
                placeholderTextColor="#9ca3af"
                editable={!drawSessionError}
              />
            )}
          </View>

          <View className="flex-row flex-wrap mb-3 gap-2">
            {buttonsMap[drawSession]?.map((btn) => (
              <TouchableOpacity
                key={btn}
                onPress={() => addBooking(btn)}
                className="bg-green-700 py-2 rounded items-center"
                style={{ flexGrow: 1, margin: 4 }}
                disabled={!!drawSessionError}
              >
                <Text className="text-white font-semibold">{btn}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Table Header */}
          <View className="border border-gray-400 rounded overflow-hidden flex-1">
            <View className="flex-row bg-gray-200 border-gray-400 py-2 items-center">
              <Text className="w-[12%] text-xs font-bold text-center">LSK</Text>
              <Text className="w-[16%] text-xs font-bold text-center">
                NUMBER
              </Text>
              <Text className="w-[12%] text-xs font-bold text-center">COUNT</Text>
              <Text className="w-[20%] text-xs font-bold text-center">
                AMOUNT
              </Text>
              <Text className="w-[20%] text-xs font-bold text-center">
                D.AMOUNT
              </Text>
              <Text className="w-[18%] text-xs font-bold text-center">
                C.AMOUNT
              </Text>
              {/* <Text className="w-[8%] text-xs font-bold text-center"></Text> */}
            </View>
            <FlatList
              data={bookingDetails || []}
              keyExtractor={(_, index) => index.toString()}
              initialNumToRender={20}
              maxToRenderPerBatch={20}
              windowSize={10}
              removeClippedSubviews={true}
              renderItem={({ item: entry, index }) => (
                <View
                  className="flex-row border-t border-gray-400 py-2 items-center"
                >
                  <Text className="w-[12%] text-xs text-center">{entry.lsk}</Text>
                  <Text className="w-[16%] text-xs text-center">
                    {entry.number}
                  </Text>
                  <Text className="w-[12%] text-xs text-center">
                    {entry.count}
                  </Text>
                  <Text className="w-[20%] text-xs text-center">
                    ₹ {entry.amount}
                  </Text>
                  <Text className="w-[20%] text-xs text-center">
                    ₹ {entry.d_amount}
                  </Text>
                  <Text className="w-[12%] text-xs text-center">
                    ₹ {entry.c_amount}
                  </Text>
                  <View className="w-[8%] flex-row justify-center items-center">
                    <TouchableOpacity
                      onPress={() => setEditIndex(index)}
                      style={{ padding: 4 }}
                      disabled={!!drawSessionError}
                    >
                      <Text style={{ fontSize: 18 }}>⋮</Text>
                    </TouchableOpacity>
                    {editIndex === index && (
                      <Modal
                        transparent
                        visible={editIndex === index}
                        animationType="fade"
                        onRequestClose={() => setEditIndex(null)}
                      >
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            backgroundColor: "rgba(0,0,0,0.2)",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                          activeOpacity={1}
                          onPressOut={() => setEditIndex(null)}
                        >
                          <View
                            style={{
                              backgroundColor: "white",
                              borderRadius: 8,
                              paddingVertical: 8,
                              paddingHorizontal: 20,
                              minWidth: 120,
                              elevation: 5,
                              shadowColor: "#000",
                              shadowOpacity: 0.1,
                              shadowRadius: 10,
                              shadowOffset: { width: 0, height: 2 },
                            }}
                          >
                            <TouchableOpacity
                              onPress={() => {
                                setEditIndex(null);
                                handleEdit(index);
                              }}
                              style={{ paddingVertical: 10 }}
                              disabled={!!drawSessionError}
                            >
                              <Text style={{ color: "blue", fontWeight: "bold" }}>
                                Edit
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                setEditIndex(null);
                                handleDelete(index);
                              }}
                              style={{ paddingVertical: 10 }}
                              disabled={!!drawSessionError}
                            >
                              <Text style={{ color: "red", fontWeight: "bold" }}>
                                Delete
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      </Modal>
                    )}
                  </View>
                </View>
              )}
              contentContainerStyle={{ flexGrow: 1 }}
            />
          </View>
        </View>

        {/* Fixed footer for totals and submit */}
        <View className="bg-gray-200 p-2 flex-row justify-between items-center" style={drawSessionError ? { opacity: 0.5 } : undefined} pointerEvents={drawSessionError ? "none" : "auto"}>
          <View>
            <Text className="font-semibold text-xs">COUNT</Text>
            <Text className="font-semibold text-xs text-center mt-1">
              {totals.count}
            </Text>
          </View>
          <View>
            <Text className="font-semibold text-xs">D.AMOUNT</Text>
            <Text className="font-semibold text-xs text-center mt-1">
              ₹ {totals.d_amount}
            </Text>
          </View>
          <View>
            <Text className="font-semibold text-xs">C.AMOUNT</Text>
            <Text className="font-semibold text-xs text-center mt-1">
              ₹ {totals.c_amount}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleSubmit}
            className="bg-green-800 rounded px-3 py-2"
            disabled={!!drawSessionError}
          >
            <Text className="text-white text-center font-bold text-lg">
              SUBMIT
            </Text>
          </TouchableOpacity>
        </View>

        {/* Modal for editing */}
        <Modal visible={editModalVisible} transparent animationType="fade">
          <View className="flex-1 justify-center items-center bg-black/50 px-4">
            <View className="bg-white p-6 rounded-2xl w-full max-w-md shadow-lg">
              <Text className="text-xl font-bold mb-4 text-center text-green-800">
                Edit Booking
              </Text>

              <View className="mb-3">
                <Text className="mb-1 font-semibold text-gray-700">Number</Text>
                <TextInput
                  placeholder="Number"
                  keyboardType="numeric"
                  value={editingEntry?.number?.toString() || ""}
                  onChangeText={(text) =>
                    setEditingEntry(
                      (prev) =>
                        prev && { ...prev, number: text.replace(/[^0-9]/g, "") }
                    )
                  }
                  className="border border-gray-300 px-4 py-2 rounded-lg bg-gray-50 text-base"
                  autoFocus
                  returnKeyType="next"
                  placeholderTextColor="#9ca3af"
                  editable={!drawSessionError}
                />
              </View>

              <View className="mb-3">
                <Text className="mb-1 font-semibold text-gray-700">Count</Text>
                <TextInput
                  placeholder="Count"
                  keyboardType="numeric"
                  value={editingEntry?.count?.toString() || ""}
                  onChangeText={(text) =>
                    setEditingEntry(
                      (prev) => prev && { ...prev, count: parseInt(text) || 0 }
                    )
                  }
                  className="border border-gray-300 px-4 py-2 rounded-lg bg-gray-50 text-base"
                  returnKeyType="next"
                  placeholderTextColor="#9ca3af"
                  editable={!drawSessionError}
                />
              </View>

              <View className="mb-3">
                <Text className="mb-1 font-semibold text-gray-700">Sub Type</Text>
                <View className="flex-row gap-4 mt-2">
                  {["SUPER", "BOX"].map((type) => (
                    <TouchableOpacity
                      key={type}
                      className="flex-row items-center"
                      onPress={() =>
                        setEditingEntry(
                          (prev) => prev && { ...prev, sub_type: type, lsk: type }
                        )
                      }
                      disabled={!!drawSessionError}
                    >
                      <View
                        style={{
                          height: 20,
                          width: 20,
                          borderRadius: 10,
                          borderWidth: 2,
                          borderColor: "#059669",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 8,
                        }}
                      >
                        {editingEntry?.sub_type === type && (
                          <View
                            style={{
                              height: 10,
                              width: 10,
                              borderRadius: 5,
                              backgroundColor: "#059669",
                            }}
                          />
                        )}
                      </View>
                      <Text className="text-base">{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View className="flex-row justify-end mt-6 gap-3">
                <TouchableOpacity
                  onPress={() => setEditModalVisible(false)}
                  className="px-5 py-2 rounded-lg bg-gray-100 border border-gray-300"
                  disabled={!!drawSessionError}
                >
                  <Text className="text-gray-700 font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveEdit}
                  className="px-5 py-2 rounded-lg bg-green-700"
                  disabled={!!drawSessionError}
                >
                  <Text className="text-white font-semibold">Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default BookingScreen;
