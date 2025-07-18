import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { getThemeColors } from "@/utils/color";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clipboard } from "lucide-react-native";
import React, { useRef, useState } from "react";
import * as RNClipboard from "react-native"; // For Clipboard.getString()
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import RNPickerSelect from "react-native-picker-select";

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
  // Add "Different" to the union type for selectedRange
  const [selectedRange, setSelectedRange] = useState<"Book" | "Set" | "Range" | "Different">(
    "Book"
  );
  const [numberInput, setNumberInput] = useState<string>("");
  const [endNumberInput, setEndNumberInput] = useState<string>("");
  const [countInput, setCountInput] = useState<string>("");
  const [bCountInput, setBCountInput] = useState<string>("");
  // New state for difference input
  const [differenceInput, setDifferenceInput] = useState<string>("");
  const [bookingDetails, setBookingDetails] = useState<BookingDetail[]>([]);
  const [rangeOptions, setRangeOptions] = useState(RangeOptions);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editingEntry, setEditingEntry] = useState<BookingDetail | null>(null);

  const { selectedDraw, setSelectedDraw } = useDrawStore();

  const colorTheme = selectedDraw?.color_theme;
  const themeColors = getThemeColors(colorTheme);
  const { user } = useAuthStore();

  const countInputRef = useRef<TextInput>(null);
  const numInputRef = useRef<TextInput>(null);
  const endNumInputRef = useRef<TextInput>(null);
  // New ref for difference input
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


  const { mutate } = useMutation({
    mutationFn: async (data: any) => api.post("/draw-booking/create/", data),
    onSuccess: () => {
      Alert.alert("Success", "Booking submitted.");
      setBookingDetails([]);
      clearInputs();
      setEditIndex(null);
    },
    onError: (error) => {
      if (error?.message) {
        console.error("Backend Message:", error.message);
      }
      //  else if (data?.detail) {
      //   console.error("Backend Detail:", data.detail);
      // } else {
      //   console.error("Unknown backend error format", data);
      // }
      console.log("error - while submitting booking", error);
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

  const addBooking = (subType: string, number?: string, count?: number, bCount?: number) => {
    // If number/count/bCount are provided, use them, else use state
    const digitsRequired = parseInt(drawSession);
    const bookingType = getBookingType();
    const isSingle = bookingType === "single_digit";
    const isDouble = bookingType === "double_digit";
    const parseNum = (val: string | undefined) => parseInt(val ?? "") || 0;
    const price = isSingle
      ? DrawSessionDetails?.single_digit_number_price
      : DrawSessionDetails?.non_single_digit_price;
    const commission = isSingle
      ? (user?.single_digit_number_commission ?? 0)
      : (user?.commission ?? 0);

    // Helper to create entries with custom lsk
    const createEntry = (number: string, count: number, lsk: string, subTypeOverride?: string) => {
      const amt = count * (price || 0);
      return {
        lsk,
        number,
        count,
        amount: amt,
        d_amount: parseFloat((amt - commission).toFixed(2)),
        c_amount: amt,
        type: bookingType,
        sub_type: subTypeOverride ?? lsk,
      };
    };

    // If called from handlePastBookings, number/count/bCount are provided
    if (number && typeof count === "number") {
      // For triple digit, if subType is BOTH, add both SUPER and BOX
      if (subType === "BOTH") {
        setBookingDetails((prev) => [
          ...prev,
          createEntry(number.padStart(digitsRequired, "0"), count, "SUPER"),
          createEntry(number.padStart(digitsRequired, "0"), bCount ?? count, "BOX"),
        ]);
      } else if (isDouble && subType === "ALL") {
        // For double digit and subType 'ALL', add AB, BC, AC
        const lskArr = ["AB", "BC", "AC"];
        setBookingDetails((prev) => [
          ...prev,
          ...lskArr.map(lsk =>
            createEntry(number.padStart(digitsRequired, "0"), count, lsk, "ALL")
          ),
        ]);
      } else if (isSingle && subType === "ALL") {
        // For single digit and subType 'ALL', add A, B, C
        const lskArr = ["A", "B", "C"];
        setBookingDetails((prev) => [
          ...prev,
          ...lskArr.map(lsk =>
            createEntry(number.padStart(digitsRequired, "0"), count, lsk, "ALL")
          ),
        ]);
      } else {
        setBookingDetails((prev) => [
          ...prev,
          createEntry(number.padStart(digitsRequired, "0"), count, subType),
        ]);
      }
      return;
    }

    // --- BEGIN original addBooking code ---
    console.log("on add booking", DrawSessionDetails);

    const numberLen = numberInput.length;
    const endLen = endNumberInput.length;

    if (!numberInput) {
      Alert.alert("Missing fields", "Enter number.");
      return;
    }

    if (numberLen !== digitsRequired) {
      Alert.alert(
        "Invalid input",
        `Please enter a ${drawSession}-digit number.`
      );
      return;
    }

    const countVal = parseNum(countInput);
    const bCountVal = parseNum(bCountInput);
    if (isSingle && countVal < 5) {
      Alert.alert(
        "Invalid input",
        "For single digit bookings, the minimum count is 5. Please enter a count of at least 5."
      );
      return;
    }

    // ---------- Range Booking ----------
    if (selectedRange === "Range") {
      if (!endNumberInput) {
        Alert.alert("Missing fields", "Enter end number.");
        return;
      }

      if (endLen !== digitsRequired) {
        Alert.alert(
          "Invalid input",
          `Please enter a ${drawSession}-digit number.`
        );
        return;
      }

      const start = parseNum(numberInput);
      const end = parseNum(endNumberInput);

      if (isNaN(start) || isNaN(end) || start > end) {
        Alert.alert(
          "Invalid Range",
          "Start should be less than or equal to end."
        );
        return;
      }

      const newEntries: BookingDetail[] = [];

      for (let i = start; i <= end; i++) {
        const paddedNum = i.toString().padStart(digitsRequired, "0");
        if (subType === "BOTH") {
          newEntries.push(createEntry(paddedNum, countVal, "SUPER"));
          newEntries.push(createEntry(paddedNum, bCountVal, "BOX"));
        } else if (isDouble && subType === "ALL") {
          // For double digit and subType 'ALL', add AB, BC, AC
          ["AB", "BC", "AC"].forEach(lsk => {
            newEntries.push(createEntry(paddedNum, countVal, lsk, "ALL"));
          });
        } else if (isSingle && subType === "ALL") {
          // For single digit and subType 'ALL', add A, B, C
          ["A", "B", "C"].forEach(lsk => {
            newEntries.push(createEntry(paddedNum, countVal, lsk, "ALL"));
          });
        } else {
          const actualCount = subType === "BOX" ? bCountVal : countVal;
          newEntries.push(createEntry(paddedNum, actualCount, subType));
        }
      }

      setBookingDetails((prev) => [...prev, ...newEntries]);
      clearInputs();
      setEndNumberInput("");
      setBCountInput("");
      return;
    }

    // ---------- Different Booking ----------
    if (selectedRange === "Different") {
      // Only for 3-digit numbers
      if (drawSession !== "3") {
        Alert.alert(
          "Invalid",
          "Different option is only available for 3-digit numbers."
        );
        return;
      }
      if (!endNumberInput) {
        Alert.alert("Missing fields", "Enter end number.");
        return;
      }
      if (!differenceInput) {
        Alert.alert("Missing fields", "Enter difference.");
        return;
      }
      if (endLen !== 3) {
        Alert.alert(
          "Invalid input",
          "Please enter a 3-digit end number."
        );
        return;
      }
      const start = parseNum(numberInput);
      const end = parseNum(endNumberInput);
      const diff = parseNum(differenceInput);

      if (isNaN(start) || isNaN(end) || isNaN(diff) || start > end) {
        Alert.alert(
          "Invalid Range",
          "Start should be less than or equal to end, and difference should be a valid number."
        );
        return;
      }
      if (diff <= 0) {
        Alert.alert("Invalid Difference", "Difference must be greater than 0.");
        return;
      }
      // If difference is greater than the range, no booking
      if (end - start < diff) {
        Alert.alert(
          "No bookings",
          "Difference is greater than the range. No bookings created."
        );
        return;
      }

      const newEntries: BookingDetail[] = [];
      let i = start;
      let addedAny = false;
      while (i <= end) {
        if (i > end) break;
        // Only add if in range
        if (i >= start && i <= end) {
          const paddedNum = i.toString().padStart(3, "0");
          if (subType === "BOTH") {
            newEntries.push(createEntry(paddedNum, countVal, "SUPER"));
            newEntries.push(createEntry(paddedNum, bCountVal, "BOX"));
          } else {
            // Only allow SUPER/BOX for 3-digit
            const actualCount = subType === "BOX" ? bCountVal : countVal;
            newEntries.push(createEntry(paddedNum, actualCount, subType));
          }
          addedAny = true;
        }
        i += diff;
      }
      // If the start == end and diff > 0, only one booking
      if (!addedAny) {
        Alert.alert(
          "No bookings",
          "No bookings created. Please check your start, end, and difference values."
        );
        return;
      }
      setBookingDetails((prev) => [...prev, ...newEntries]);
      clearInputs();
      setEndNumberInput("");
      setBCountInput("");
      setDifferenceInput("");
      return;
    }

    // ---------- Set Booking ----------
    if (selectedRange === "Set") {
      if (drawSession !== "3") {
        Alert.alert(
          "Invalid",
          "Set combinations only apply to 3-digit numbers."
        );
        return;
      }

      const padded = numberInput.padStart(3, "0");
      const digits = padded.split("");

      const generatePermutations = (arr: string[]) => {
        const result = new Set<string>();
        const permute = (path: string[], used: boolean[]) => {
          if (path.length === arr.length) {
            result.add(path.join(""));
            return;
          }
          for (let i = 0; i < arr.length; i++) {
            if (used[i]) continue;
            used[i] = true;
            permute([...path, arr[i]], [...used]);
            used[i] = false;
          }
        };
        permute([], Array(arr.length).fill(false));
        return Array.from(result).filter((num) => num.length === 3);
      };

      const permutations = generatePermutations(digits);
      const newEntries: BookingDetail[] = [];

      for (let perm of permutations) {
        const number = perm; // Keep as string with leading zeros
        if (subType === "BOTH") {
          newEntries.push(createEntry(number, countVal, "SUPER"));
          newEntries.push(createEntry(number, bCountVal, "BOX"));
        } else if (isDouble && subType === "ALL") {
          // For double digit and subType 'ALL', add AB, BC, AC
          ["AB", "BC", "AC"].forEach(lsk => {
            newEntries.push(createEntry(number, countVal, lsk, "ALL"));
          });
        } else if (isSingle && subType === "ALL") {
          // For single digit and subType 'ALL', add A, B, C
          ["A", "B", "C"].forEach(lsk => {
            newEntries.push(createEntry(number, countVal, lsk, "ALL"));
          });
        } else {
          const actualCount = subType === "BOX" ? bCountVal : countVal;
          newEntries.push(createEntry(number, actualCount, subType));
        }
      }

      setBookingDetails((prev) => [...prev, ...newEntries]);
      clearInputs();
      return;
    }

    // ---------- Normal Booking ----------
    if (subType === "BOTH") {
      if (!countInput || !bCountInput) {
        Alert.alert("Missing fields", "Enter Count and B.Count.");
        return;
      }

      const padded = numberInput.padStart(digitsRequired, "0");
      const entries = [
        createEntry(padded, countVal, "SUPER"),
        createEntry(padded, bCountVal, "BOX"),
      ];
      setBookingDetails((prev) => [...prev, ...entries]);
      clearInputs();
      setBCountInput("");
      return;
    }

    if (subType === "BOX") {
      if (!bCountInput) {
        Alert.alert("Missing fields", "Enter B.Count.");
        return;
      }

      const padded = numberInput.padStart(digitsRequired, "0");
      const entry = createEntry(padded, bCountVal, "BOX");
      setBookingDetails((prev) => [...prev, entry]);
      clearInputs();
      setBCountInput("");
      return;
    }

    if (subType === "ALL") {
      const padded = numberInput.padStart(digitsRequired, "0");
      if (isDouble) {
        // For double digit and subType 'ALL', add AB, BC, AC
        const lskArr = ["AB", "BC", "AC"];
        setBookingDetails((prev) => [
          ...prev,
          ...lskArr.map(lsk =>
            createEntry(padded, countVal, lsk, "ALL")
          ),
        ]);
        clearInputs();
        return;
      } else if (isSingle) {
        // For single digit and subType 'ALL', add A, B, C
        const lskArr = ["A", "B", "C"];
        setBookingDetails((prev) => [
          ...prev,
          ...lskArr.map(lsk =>
            createEntry(padded, countVal, lsk, "ALL")
          ),
        ]);
        clearInputs();
        return;
      }
      // If not single or double, fallback to default
    }

    // Default (e.g. SUPER only)
    if (!countInput) {
      Alert.alert("Missing fields", "Enter Count.");
      return;
    }

    const padded = numberInput.padStart(digitsRequired, "0");
    const entry = createEntry(padded, countVal, subType);
    setBookingDetails((prev) => [...prev, entry]);
    clearInputs();
    // --- END original addBooking code ---
  };

  const handleSubmit = () => {
    console.log("on sum=bmit", DrawSessionDetails?.session?.active_session_id);

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

      console.log("data", data);
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
    if (editingEntry && editIndex !== null) {
      const updated = [...bookingDetails];

      const bookingType = editingEntry.type;
      const isSingle = bookingType === "single_digit";

      const price = isSingle
        ? DrawSessionDetails?.single_digit_number_price
        : DrawSessionDetails?.non_single_digit_price;

      const commission = isSingle
        ? (user?.single_digit_number_commission ?? 0)
        : (user?.commission ?? 0);

      const amount = editingEntry.count * (price || 0);
      const d_amount = parseFloat((amount - commission).toFixed(2));
      const c_amount = amount;

      updated[editIndex] = {
        ...editingEntry,
        amount,
        d_amount,
        c_amount,
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

  // --- IMPLEMENTED handlePastBookings ---
  const handlePastBookings = async () => {
    try {
      // Use Clipboard API to get string
      let clipboardText: string = "";
      if (Platform.OS === "web") {
        // Web Clipboard API
        clipboardText = await navigator.clipboard.readText();
      } else if (RNClipboard?.Clipboard && RNClipboard.Clipboard.getString) {
        clipboardText = await RNClipboard.Clipboard.getString();
      } else if ((global as any).Clipboard && (global as any).Clipboard.getString) {
        clipboardText = await (global as any).Clipboard.getString();
      } else {
        // fallback for react-native-clipboard/clipboard
        try {
          const { getString } = require("@react-native-clipboard/clipboard");
          clipboardText = await getString();
        } catch (e) {
          Alert.alert("Clipboard Error", "Could not read clipboard.");
          return;
        }
      }

      if (!clipboardText || !clipboardText.trim()) {
        Alert.alert("Clipboard Empty", "No text found in clipboard.");
        return;
      }

      // Split by newlines, commas, or semicolons
      const lines = clipboardText
        .split(/[\n,;]+/)
        .map((l) => l.trim())
        .filter(Boolean);

      // Helper: parse a single line into {number, count, subType}
      function parseLine(line: string) {
        // Remove extra spaces, normalize
        let l = line.replace(/\s+/g, " ").trim();

        // Try to extract subType (box/set/ab/ac/bc/a/b/c/all/super/both)
        let subType = "";
        let subTypeMatch = l.match(/\b(box|set|super|both|ab|ac|bc|a|b|c|all)\b/i);
        if (subTypeMatch) {
          subType = subTypeMatch[1].toUpperCase();
          l = l.replace(subTypeMatch[0], "").trim();
        }

        // Find number and count
        // Accept separators: /, -, =, +, :, #, &, *, ., .., space
        let match = l.match(
          /^([0-9]{1,3})\s*([\/\-=\+:#&\*\.]{1,2})\s*([0-9]{1,3})$/i
        );
        if (!match) {
          // Try with space separator
          match = l.match(/^([0-9]{1,3})\s+([0-9]{1,3})$/);
        }
        if (!match) {
          // Try with number only (single digit, default count 5)
          match = l.match(/^([0-9]{1,3})$/);
          if (match) {
            return {
              number: match[1],
              count: 5,
              subType: subType || "SUPER",
            };
          }
          return null;
        }

        let number = match[1];
        let count = parseInt(match[3] || match[2] || "5");
        if (isNaN(count)) count = 5;

        // If subType is not set, infer from separator
        if (!subType) {
          if (match[2]) {
            const sep = match[2].replace(/\s/g, "");
            if (sep === "*" || sep === "#") subType = "BOX";
            else if (sep === "=" || sep === "+") subType = "SUPER";
            else if (sep === ":") subType = "SUPER";
            else if (sep === "-") subType = "SUPER";
            else if (sep === "/") subType = "SUPER";
            else if (sep === "&") subType = "SUPER";
            else if (sep === ".") subType = "SUPER";
            else if (sep === "..") subType = "SUPER";
          }
        }

        // If subType is still not set, default for 3-digit is SUPER, for 1/2-digit use ALL
        if (!subType) {
          if (number.length === 3) subType = "SUPER";
          else if (number.length === 2) subType = "ALL";
          else if (number.length === 1) subType = "ALL";
        }

        // Special: if subType is BOTH, treat as both SUPER and BOX
        if (subType === "BOTH") {
          return { number, count, subType: "BOTH" };
        }

        // Map AB/AC/BC/A/B/C/ALL to their respective subTypes
        if (
          ["AB", "AC", "BC", "A", "B", "C", "ALL"].includes(subType)
        ) {
          return { number, count, subType };
        }

        // For BOX/SUPER/SET
        if (["BOX", "SUPER", "SET"].includes(subType)) {
          return { number, count, subType };
        }

        // Fallback
        return { number, count, subType: "SUPER" };
      }

      // For each line, parse and add booking
      let added = 0;
      for (let line of lines) {
        const parsed = parseLine(line);
        if (!parsed) continue;

        // Determine drawSession based on number length
        let session = drawSession;
        if (parsed.number.length === 1) session = "1";
        else if (parsed.number.length === 2) session = "2";
        else if (parsed.number.length === 3) session = "3";

        // Set drawSession if different
        if (drawSession !== session) setDrawSession(session);

        // For triple digit, if subType is BOTH, add both
        if (session === "3" && parsed.subType === "BOTH") {
          addBooking("BOTH", parsed.number, parsed.count, parsed.count);
          added += 2;
        } else {
          addBooking(parsed.subType, parsed.number, parsed.count, parsed.count);
          added += 1;
        }
      }

      if (added === 0) {
        Alert.alert("No valid bookings found in clipboard.");
      } else {
        Alert.alert("Success", `Added ${added} booking${added > 1 ? "s" : ""} from clipboard.`);
      }
    } catch (err) {
      Alert.alert("Clipboard Error", "Could not read clipboard.");
    }
  };

  if (isError || error || !DrawSessionDetails?.session?.active) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <View className="bg-red-100 border border-red-500 rounded-2xl px-8 py-6 shadow-lg min-w-[300px] max-w-[350px] items-center">
          <Text className="text-red-800 text-lg font-bold text-center mb-3">
            You're not allowed to book the number now. Try later
          </Text>
          <TouchableOpacity
            onPress={() => {
              setSelectedDraw(null)
              router.push("/(tabs)");
            }}
            className="mt-4 bg-red-600 px-6 py-2 rounded-lg min-w-[120px] active:opacity-85"
            activeOpacity={0.85}
          >
            <Text className="text-white text-center font-bold text-base tracking-wide">
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior="padding"
      keyboardVerticalOffset={80}
    >
      <View className="p-4 bg-white flex-1 mb-10">
        <View className="flex-row items-center mb-4 gap-2">
          <TextInput
            placeholder="Customer Name"
            value={customerName}
            onChangeText={setCustomerName}
            className="flex-1 border border-gray-400 rounded px-3 py-2 bg-white text-base"
            placeholderTextColor="#9ca3af"
          />
          <TouchableOpacity
            onPress={handlePastBookings}
            className="ml-2 p-2 bg-gray-100 rounded border border-gray-300 active:bg-gray-200"
            accessibilityLabel="Paste from clipboard"
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
            <RNPickerSelect
              onValueChange={setSelectedRange}
              items={rangeOptions}
              value={selectedRange}
              style={{
                viewContainer: {
                  borderColor: "#9ca3af",
                  borderWidth: 1,
                  borderRadius: 6,
                },
              }}
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
                // Optionally, focus count after difference
                // countInputRef.current?.focus();
              }}
              maxLength={3}
              keyboardType="numeric"
              placeholder="Difference"
              className="flex-1 border border-gray-400 px-3 py-2 rounded"
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
          />

          {/* B.Count input for 3-digit only */}
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
            <Text className="w-[12%] text-xs font-bold text-center">
              C.AMOUNT
            </Text>
            <Text className="w-[8%] text-xs font-bold text-center"></Text>
          </View>
          <ScrollView>
            {bookingDetails.map((entry, index) => (
              <View
                key={index}
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
                  >
                    <Text style={{ fontSize: 18 }}>⋮</Text>
                  </TouchableOpacity>
                  {/* 3-dot menu modal */}
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
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Fixed footer for totals and submit */}
      <View className="bg-gray-200 p-2 flex-row justify-between items-center">
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
                    (prev) =>
                      prev && { ...prev, number: text.replace(/[^0-9]/g, "") }
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
              >
                <Text className="text-gray-700 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveEdit}
                className="px-5 py-2 rounded-lg bg-green-700"
              >
                <Text className="text-white font-semibold">Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default BookingScreen;
