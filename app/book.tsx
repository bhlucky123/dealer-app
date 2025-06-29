import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SelectList } from "react-native-dropdown-select-list";

type BookingDetail = {
  lsk: string;
  number: number;
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
  { key: "1", value: "Book" },
  { key: "2", value: "Range" },
  { key: "3", value: "Set" },
];

const BookingScreen: React.FC = () => {
  const [customerName, setCustomerName] = useState<string>("");
  const [drawSession, setDrawSession] = useState<string>("3");
  const [selectedRange, setSelectedRange] = useState<string>("");
  const [numberInput, setNumberInput] = useState<string>("");
  const [countInput, setCountInput] = useState<string>("");
  const [bCountInput, setBCountInput] = useState<string>("");
  const [bookingDetails, setBookingDetails] = useState<BookingDetail[]>([]);
  const [rangeOptions, setRangeOptions] = useState(RangeOptions);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editingEntry, setEditingEntry] = useState<BookingDetail | null>(null);

  const { selectedDraw } = useDrawStore();
  const { user } = useAuthStore();

  const countInputRef = useRef<TextInput>(null);
  const numInputRef = useRef<TextInput>(null);

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
  });

  if (isError || error || !DrawSessionDetails?.session?.active) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <View className="bg-red-100 border border-red-400 rounded-lg px-6 py-4 shadow-md">
          <Text className="text-red-700 text-base font-semibold text-center">
            You're not allowed to book the number now. Try later
          </Text>
          <TouchableOpacity
            onPress={() => {
              router.push("/(tabs)");
            }}
            className="mt-4 bg-red-600 px-4 py-2 rounded"
          >
            <Text className="text-white text-center font-semibold">
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { mutate } = useMutation({
    mutationFn: async (data: any) => api.post("/draw-booking/create/", data),
    onSuccess: () => {
      Alert.alert("Success", "Booking submitted.");
      setBookingDetails([]);
      clearInputs();
      setEditIndex(null);
    },
    onError: (error) => {
      console.log("error", error);
      Alert.alert("Error", "Failed to submit.");
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

  const addBooking = (subType: string): void => {
    if (!numberInput) {
      Alert.alert("Missing fields", "Enter number.");
      return;
    }

    if (!countInput && (subType !== "BOX" && subType !== "BOTH")) {
      Alert.alert("Missing fields", "Enter number and count.");
      return;
    }

    if ((subType === "BOX" || subType === "BOTH") && !bCountInput) {
      Alert.alert("Missing fields", "Enter B.Count.");
      return;
    }

    const bookingType = getBookingType();
    const number = parseInt(numberInput);
    const count = parseInt(countInput);
    const bCount = parseInt(bCountInput);

    // Get price and commission based on booking type
    const isSingle = bookingType === "single_digit";
    const price = isSingle
      ? DrawSessionDetails.single_digit_number_price
      : DrawSessionDetails.non_single_digit_price;
    const commission = isSingle
      ? user?.single_digit_number_commission ?? 0
      : user?.commission ?? 0;

    if (subType === "BOTH") {
      // Add SUPER
      const amountSuper = count * price;
      const d_amountSuper = parseFloat((amountSuper - commission).toFixed(2));
      const c_amountSuper = amountSuper;
      const superEntry: BookingDetail = {
        lsk: "SUPER",
        number,
        count,
        amount: amountSuper,
        d_amount: d_amountSuper,
        c_amount: c_amountSuper,
        type: bookingType,
        sub_type: "SUPER",
      };
      // Add BOX
      const amountBox = bCount * price;
      const d_amountBox = parseFloat((amountBox - commission).toFixed(2));
      const c_amountBox = amountBox;
      const boxEntry: BookingDetail = {
        lsk: "BOX",
        number,
        count: bCount,
        amount: amountBox,
        d_amount: d_amountBox,
        c_amount: c_amountBox,
        type: bookingType,
        sub_type: "BOX",
      };
      setBookingDetails((prev) => [...prev, superEntry, boxEntry]);
      clearInputs();
      setBCountInput("");
      return;
    }

    if (subType === "BOX") {
      const amount = bCount * price;
      const d_amount = parseFloat((amount - commission).toFixed(2));
      const c_amount = amount;
      const newEntry: BookingDetail = {
        lsk: subType,
        number,
        count: bCount,
        amount,
        d_amount,
        c_amount,
        type: bookingType,
        sub_type: subType,
      };
      setBookingDetails((prev) => [...prev, newEntry]);
      clearInputs();
      setBCountInput("");
      return;
    }

    // Default (SUPER or others)
    const amount = count * price;
    const d_amount = parseFloat((amount - commission).toFixed(2));
    const c_amount = amount;

    const newEntry: BookingDetail = {
      lsk: subType,
      number,
      count,
      amount,
      d_amount,
      c_amount,
      type: bookingType,
      sub_type: subType,
    };

    setBookingDetails((prev) => [...prev, newEntry]);
    clearInputs();
  };

  const handleSubmit = () => {
    const data = {
      customer_name: customerName,
      draw_session: parseInt(drawSession),
      booked_agent: 3,
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
  };

  const handleEdit = (index: number) => {
    const entry = bookingDetails[index];
    setEditingEntry({ ...entry });
    setEditIndex(index);
    setEditModalVisible(true);
  };

  const saveEdit = () => {
    if (editingEntry && editIndex !== null) {
      const updated = [...bookingDetails];
      const amount = editingEntry.count * 5;
      updated[editIndex] = {
        ...editingEntry,
        amount,
        d_amount: parseFloat((amount * 1.8).toFixed(2)),
        c_amount: amount * 2,
      };
      setBookingDetails(updated);
      setEditModalVisible(false);
      setEditIndex(null);
      setEditingEntry(null);
    }
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
    setBCountInput("")
    numInputRef.current?.focus();
  };

  const handleDrawSession = (num: string) => {
    clearInputs();
    if (num === "3") {
      setRangeOptions(RangeOptions);
    }
    if (num !== "3") {
      setRangeOptions([
        { key: "1", value: "Book" },
        { key: "2", value: "Range" },
      ]);
      if (selectedRange === "3") {
        setSelectedRange("1");
      }
    }
    setDrawSession(num.toString());
  };

  return (
    <KeyboardAvoidingView className="p-4 bg-white flex-1">
      <TextInput
        placeholder="Customer Name"
        value={customerName}
        onChangeText={setCustomerName}
        className="border border-gray-400 rounded px-3 py-2 mb-4"
      />

      <View className="flex-row items-center mb-4 gap-2">
        {[1, 2, 3].map((num) => (
          <TouchableOpacity
            key={num}
            onPress={() => handleDrawSession(num.toString())}
            className={`px-4 py-1 rounded-full border ${
              drawSession === num.toString() ? "bg-black" : "border-gray-400"
            }`}
          >
            <Text
              className={`${
                drawSession === num.toString() ? "text-white" : "text-black"
              }`}
            >
              {num}
            </Text>
          </TouchableOpacity>
        ))}
        <View className="flex-1 ml-2">
          <SelectList
            setSelected={setSelectedRange}
            data={rangeOptions}
            save="value"
            placeholder="Book"
            search={false}
            boxStyles={{
              borderColor: "#9ca3af",
              borderWidth: 1,
              borderRadius: 6,
              paddingHorizontal: 10,
            }}
            dropdownStyles={{ borderColor: "#9ca3af" }}
          />
        </View>
      </View>

      <View className="flex-row gap-2 mb-3">
        <TextInput
          ref={numInputRef}
          value={numberInput}
          onChangeText={(text) => {
            const formatted = text.replace(/[^0-9]/g, "");
            setNumberInput(formatted);

            const requiredLength = parseInt(drawSession);
            if (formatted.length >= requiredLength) {
              countInputRef.current?.focus();
            }
          }}
          maxLength={3}
          keyboardType="numeric"
          placeholder="Number"
          className="flex-1 border border-gray-400 px-3 py-2 rounded"
        />

        <TextInput
          ref={countInputRef}
          value={countInput}
          onChangeText={setCountInput}
          keyboardType="numeric"
          placeholder="Count"
          className="flex-1 border border-gray-400 px-3 py-2 rounded"
        />

        {drawSession === "3" && (
          <TextInput
            value={bCountInput}
            onChangeText={setBCountInput}
            keyboardType="numeric"
            placeholder="B.Count"
            className="flex-1 border border-gray-400 px-3 py-2 rounded"
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
          >
            <Text className="text-white font-semibold">{btn}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Table Header */}
      <View className="border border-gray-400 rounded overflow-hidden">
        <View className="flex-row bg-gray-200 border-gray-400 py-2 items-center">
          <Text className="w-[12%] text-xs font-bold text-center">LSK</Text>
          <Text className="w-[16%] text-xs font-bold text-center">NUMBER</Text>
          <Text className="w-[12%] text-xs font-bold text-center">COUNT</Text>
          <Text className="w-[20%] text-xs font-bold text-center">AMOUNT</Text>
          <Text className="w-[20%] text-xs font-bold text-center">
            D.AMOUNT
          </Text>
          <Text className="w-[10%] text-xs font-bold text-center">
            C.AMOUNT
          </Text>
          <Text className="w-[10%] text-xs font-bold text-center">ACTION</Text>
        </View>

        {bookingDetails.map((entry, index) => (
          <View
            key={index}
            className="flex-row border-t border-gray-400 py-2 items-center"
          >
            <Text className="w-[12%] text-xs text-center">{entry.lsk}</Text>
            <Text className="w-[16%] text-xs text-center">{entry.number}</Text>
            <Text className="w-[12%] text-xs text-center">{entry.count}</Text>
            <Text className="w-[20%] text-xs text-center">
              ₹ {entry.amount}
            </Text>
            <Text className="w-[20%] text-xs text-center">
              ₹ {entry.d_amount}
            </Text>
            <Text className="w-[10%] text-xs text-center">
              ₹ {entry.c_amount}
            </Text>
            <View className="w-[10%] flex-row justify-center items-center">
              <TouchableOpacity onPress={() => handleEdit(index)}>
                <Text style={{ color: "blue", marginRight: 8 }}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(index)}>
                <Text style={{ color: "red" }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <View className="flex-row justify-between mt-4 bg-gray-200 p-2 items-center">
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
                    (prev) => prev && { ...prev, number: parseInt(text) || 0 }
                  )
                }
                className="border border-gray-300 px-4 py-2 rounded-lg bg-gray-50 text-base"
                autoFocus
                returnKeyType="next"
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
              />
            </View>

            <View className="mb-3">
              <Text className="mb-1 font-semibold text-gray-700">Sub Type</Text>
              <TextInput
                placeholder="Sub Type"
                value={editingEntry?.sub_type || ""}
                onChangeText={(text) =>
                  setEditingEntry(
                    (prev) => prev && { ...prev, sub_type: text, lsk: text }
                  )
                }
                className="border border-gray-300 px-4 py-2 rounded-lg bg-gray-50 text-base"
              />
            </View>

            <View className="flex-row justify-end mt-6 gap-3">
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                className="px-5 py-2 rounded-lg bg-gray-100 border border-gray-300"
              >
                <Text className="text-gray-700 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveEdit}
                className="px-5 py-2 rounded-lg bg-green-700"
              >
                <Text className="text-white font-semibold">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default BookingScreen;
