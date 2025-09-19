import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { getThemeColors } from "@/utils/color";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Clipboard } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import * as RNClipboard from "react-native"; // For Clipboard.getString()
import {
  ActivityIndicator, Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
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

  // Modal for failed lines in paste
  const [failedPasteModalVisible, setFailedPasteModalVisible] = useState(false);
  const [failedPasteLines, setFailedPasteLines] = useState<string[]>([]);

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

  // Example: {"count": 5, "number": "356", "subType": "BOX"}
  // This function validates a parsed object like the example above.
  const isValidNumber = (parsed: any) => {
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.number !== "string" ||
      typeof parsed.subType !== "string" ||
      typeof parsed.count !== "number"
    ) {
      return false;
    }

    // Validate number is all digits and length is 1, 2, or 3
    if (!/^\d+$/.test(parsed.number)) return false;
    if (![1, 2, 3].includes(parsed.number.length)) return false;

    // For single digit, count must be at least 5
    if (parsed.number.length === 1) {
      if (!Number.isInteger(parsed.count) || parsed.count < 5) return false;
    }

    // Accept SET as a valid subType for any 3-digit number
    if (
      parsed.subType.toUpperCase() === "SET" &&
      parsed.number.length === 3
    ) {
      // Validate count is a positive integer
      if (!Number.isInteger(parsed.count) || parsed.count <= 0) return false;
      return true;
    }

    const allowedSubTypes = buttonsMap[String(parsed.number.length)];
    if (!allowedSubTypes || !allowedSubTypes.includes(parsed.subType.toUpperCase())) {
      return false;
    }

    // Validate count is a positive integer (and for single digit, already checked min 5 above)
    if (!Number.isInteger(parsed.count) || parsed.count <= 0) return false;

    return true;
  }

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

  const { mutate, isPending } = useMutation({
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

  // --- FIXED addBooking for BOX/bCount ---
  const addBooking = (
    subType: string,
    number?: string,
    count?: number,
    bCount?: number
  ) => {
    // Helper to determine booking type and price/commission for a given number length
    const getBookingTypeByLength = (len: number): BookingType => {
      switch (len) {
        case 1:
          return "single_digit";
        case 2:
          return "double_digit";
        case 3:
          return "triple_digit";
        default:
          return "";
      }
    };
    const getPriceByType = (type: BookingType) => {
      if (type === "single_digit") return DrawSessionDetails?.single_digit_number_price;
      return DrawSessionDetails?.non_single_digit_price;
    };
    const getCommissionByType = (type: BookingType) => {
      if (type === "single_digit") return user?.single_digit_number_commission ?? 0;
      return user?.commission ?? 0;
    };

    // Helper to create entries with custom lsk
    const createEntry = (
      number: string,
      count: number,
      lsk: string,
      subTypeOverride?: string,
      bookingTypeOverride?: BookingType
    ) => {
      const bookingType = bookingTypeOverride || getBookingTypeByLength(number.length);
      const price = getPriceByType(bookingType);
      const commission = getCommissionByType(bookingType);
      const amt = count * (price || 0);
      return {
        lsk,
        number,
        count,
        amount: price,
        d_amount: parseFloat((amt - count * commission).toFixed(2)),
        c_amount: amt,
        type: bookingType,
        sub_type: subTypeOverride ?? lsk,
      };
    };

    // --- ENFORCE count and bCount > 0 and number/count/bCount are valid numbers ---
    // If called from handlePastBookings, number/count/bCount are provided
    if (number && typeof count === "number") {
      // Accept multiple numbers separated by comma, space, or newline
      const numbers = number
        .split(/[\s,]+/)
        .map((n) => n.trim())
        .filter((n) => n.length > 0);

      let invalids: string[] = [];
      let newEntries: BookingDetail[] = [];

      numbers.forEach((num) => {
        if (!isValidNumberString(num) || ![1, 2, 3].includes(num.length)) {
          invalids.push(num);
          return;
        }
        const bookingType = getBookingTypeByLength(num.length);
        const isSingle = bookingType === "single_digit";
        const isDouble = bookingType === "double_digit";
        // --- Double digit strict validation ---
        if (
          (subType === "ALL" || subType === "AB" || subType === "BC" || subType === "AC") &&
          getBookingType() === "double_digit" &&
          num.length !== 2
        ) {
          invalids.push(num);
          return;
        }
        // Validate count
        if (!isValidPositiveNumber(count)) {
          invalids.push(num);
          return;
        }
        // Validate bCount if needed
        if (subType === "BOTH" && !isValidPositiveNumber(bCount)) {
          invalids.push(num);
          return;
        }
        // For BOX, only require bCount and must be 3-digit
        if (subType === "BOX") {
          if (num.length !== 3) {
            invalids.push(num);
            return;
          }
          if (!isValidPositiveNumber(bCount)) {
            invalids.push(num);
            return;
          }
          newEntries.push(createEntry(num, bCount ?? count, "BOX", undefined, bookingType));
          return;
        }
        if (subType === "SUPER" && !isValidPositiveNumber(count)) {
          invalids.push(num);
          return;
        }
        if (isSingle && count < 5) {
          invalids.push(num);
          return;
        }

        // For triple digit, if subType is BOTH, add both SUPER and BOX
        if (subType === "BOTH") {
          newEntries.push(createEntry(num, count, "SUPER", undefined, bookingType));
          newEntries.push(createEntry(num, bCount ?? count, "BOX", undefined, bookingType));
        } else if (isDouble && subType === "ALL") {
          const lskArr = ["AB", "BC", "AC"];
          lskArr.forEach((lsk) => {
            newEntries.push(createEntry(num, count, lsk, lsk, bookingType));
          });
        } else if (isSingle && subType === "ALL") {
          const lskArr = ["A", "B", "C"];
          lskArr.forEach((lsk) => {
            newEntries.push(createEntry(num, count, lsk, lsk, bookingType));
          });
        } else {
          newEntries.push(createEntry(num, count, subType, undefined, bookingType));
        }
      });

      console.log("invalids", invalids);

      if (invalids.length > 0) {
        Alert.alert(
          "Invalid input",
          `The following numbers are invalid or do not match allowed digit lengths (1, 2, or 3):\n${invalids.join(
            ", "
          )}`
        );
        return;
      }

      if (newEntries.length > 0) {
        setBookingDetails((prev) => [...newEntries, ...prev]);
      }
      return;
    }

    // --- BEGIN original addBooking code, but allow multiple numbers in numberInput ---
    // Accept multiple numbers separated by comma, space, or newline
    const numbers = numberInput
      .split(/[\s,]+/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    // If more than one number, treat as "mixed" mode (copy-paste), so do not enforce drawSession digit length
    const isMixedMode = numbers.length > 1;

    let invalids: string[] = [];
    let allEntries: BookingDetail[] = [];

    numbers.forEach((num) => {
      const numberLen = num.length;
      const digitsRequired = isMixedMode ? numberLen : parseInt(drawSession);
      const bookingType = getBookingTypeByLength(numberLen);
      const isSingle = bookingType === "single_digit";
      const isDouble = bookingType === "double_digit";
      const parseNum = (val: string | undefined) => parseInt(val ?? "") || 0;
      const countVal = parseNum(countInput);
      const bCountVal = parseNum(bCountInput);

      // Validate number is a valid number string
      if (!isValidNumberString(num)) {
        invalids.push(num);
        return;
      }

      // --- Double digit strict validation for UI input ---
      if (
        (subType === "ALL" || subType === "AB" || subType === "BC" || subType === "AC") &&
        getBookingType() === "double_digit" &&
        num.length !== 2
      ) {
        invalids.push(num);
        return;
      }

      // ---------- Range Booking ----------
      if (selectedRange === "Range" && !isMixedMode) {
        // Only process if this is the first number (range only makes sense for one number)
        if (numbers.length > 1) return;
        console.log("hai");

        const endLen = endNumberInput.length;
        if (!isValidNumberString(endNumberInput)) {
          Alert.alert("Invalid input", "End number must be a valid number.");
          return;
        }
        if (endLen !== digitsRequired) {
          Alert.alert(
            "Invalid input",
            `Please enter a ${digitsRequired}-digit number.`
          );
          return;
        }
        const start = parseNum(num);
        const end = parseNum(endNumberInput);

        console.log("start", start);
        console.log("end", end);
        console.log("subType", subType);
        console.log("isDouble", isDouble, "isSingle", isSingle);

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
          // Double digit strict validation for range
          if (
            (subType === "ALL" || subType === "AB" || subType === "BC" || subType === "AC") &&
            getBookingType() === "double_digit" &&
            paddedNum.length !== 2
          ) {
            continue;
          }
          if (subType === "BOTH") {
            if (countVal > 0) newEntries.push(createEntry(paddedNum, countVal, "SUPER", undefined, bookingType));
            if (bCountVal > 0) newEntries.push(createEntry(paddedNum, bCountVal, "BOX", undefined, bookingType));
          } else if (subType === "BOX") {
            // Fix: For BOX, add a booking for each number in the range
            if (paddedNum.length !== 3) continue;
            if (!bCountInput || !isValidNumberString(bCountInput) || !isValidPositiveNumber(bCountInput)) continue;
            newEntries.push(createEntry(paddedNum, bCountVal, "BOX", undefined, bookingType));
          } else if (isDouble && subType === "ALL") {
            ["AB", "BC", "AC"].forEach((lsk) => {
              if (countVal > 0) newEntries.push(createEntry(paddedNum, countVal, lsk, lsk, bookingType));
            });
          } else if (isSingle && subType === "ALL") {
            ["A", "B", "C"].forEach((lsk) => {
              if (countVal > 0) newEntries.push(createEntry(paddedNum, countVal, lsk, lsk, bookingType));
            });
          } else {
            const actualCount = subType === "BOX" ? bCountVal : countVal;
            if (actualCount > 0) newEntries.push(createEntry(paddedNum, actualCount, subType, undefined, bookingType));
          }
        }

        setBookingDetails((prev) => [...newEntries, ...prev]);
        clearInputs();
        setEndNumberInput("");
        setBCountInput("");
        return;
      }
      console.log("invalids1", invalids);

      // For BOX, only require bCount and must be 3-digit
      if (subType === "BOX") {
        if (num.length !== 3) {
          invalids.push(num);
          return;
        }
        if (!bCountInput || !isValidNumberString(bCountInput) || !isValidPositiveNumber(bCountInput)) {
          Alert.alert(
            "Invalid input",
            "Please enter a valid box count."
          );
          return;
        }
        const padded = num.padStart(3, "0");
        allEntries.push(createEntry(padded, bCountVal, "BOX", undefined, bookingType));
        return;
      }
      console.log("invalids2", invalids);

      // Validate countInput is a valid number
      if (!isValidNumberString(countInput) || !isValidPositiveNumber(countInput)) {
        Alert.alert(
          "Invalid input",
          "Please enter a valid count."
        );
        return;
      }

      // Validate bCountInput if needed
      if (subType === "BOTH") {
        if (num.length !== 3) {
          invalids.push(num);
          return;
        }
        if (!isValidNumberString(bCountInput) || !isValidPositiveNumber(bCountInput)) {
          Alert.alert(
            "Invalid input",
            "Please enter a valid box count."
          );
          return;
        }
      }
      if (isSingle && countVal < 5) {
        Alert.alert(
          "Invalid input",
          "For single digit bookings, the minimum count is 5."
        );
        return;
      }

      // ---------- Different Booking ----------
      if (selectedRange === "Different" && !isMixedMode) {
        // Only process if this is the first number (different only makes sense for one number)
        if (numbers.length > 1) return;
        if (numberLen !== 3) {
          Alert.alert(
            "Invalid",
            "Different option is only available for 3-digit numbers."
          );
          return;
        }
        const endLen = endNumberInput.length;
        if (!isValidNumberString(endNumberInput)) {
          Alert.alert("Invalid input", "End number must be a valid number.");
          return;
        }
        if (!isValidNumberString(differenceInput)) {
          Alert.alert("Invalid input", "Difference must be a valid number.");
          return;
        }
        if (endLen !== 3) {
          Alert.alert(
            "Invalid input",
            "Please enter a 3-digit end number."
          );
          return;
        }
        const start = parseNum(num);
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
          if (i >= start && i <= end) {
            const paddedNum = i.toString().padStart(3, "0");
            if (subType === "BOTH") {
              if (countVal > 0) newEntries.push(createEntry(paddedNum, countVal, "SUPER", undefined, bookingType));
              if (bCountVal > 0) newEntries.push(createEntry(paddedNum, bCountVal, "BOX", undefined, bookingType));
            } else if (isDouble && subType === "ALL") {
              ["AB", "BC", "AC"].forEach((lsk) => {
                if (countVal > 0) newEntries.push(createEntry(paddedNum, countVal, lsk, lsk, bookingType));
              });
            } else if (isSingle && subType === "ALL") {
              ["A", "B", "C"].forEach((lsk) => {
                if (countVal > 0) newEntries.push(createEntry(paddedNum, countVal, lsk, lsk, bookingType));
              });
            } else {
              const actualCount = subType === "BOX" ? bCountVal : countVal;
              if (actualCount > 0) newEntries.push(createEntry(paddedNum, actualCount, subType, undefined, bookingType));
            }
            addedAny = true;
          }
          i += diff;
        }
        if (!addedAny) {
          Alert.alert(
            "No bookings",
            "No bookings created. Please check your start, end, and difference values."
          );
          return;
        }
        setBookingDetails((prev) => [...newEntries, ...prev]);
        clearInputs();
        setEndNumberInput("");
        setBCountInput("");
        setDifferenceInput("");
        return;
      }

      // ---------- Set Booking ----------
      if (selectedRange === "Set" && !isMixedMode) {
        // Only process if this is the first number (set only makes sense for one number)
        if (numbers.length > 1) return;
        if (numberLen !== 3) {
          Alert.alert(
            "Invalid",
            "Set combinations only apply to 3-digit numbers."
          );
          return;
        }

        const padded = num.padStart(3, "0");
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
          const number = perm;
          if (subType === "BOTH") {
            if (countVal > 0) newEntries.push(createEntry(number, countVal, "SUPER", undefined, bookingType));
            if (bCountVal > 0) newEntries.push(createEntry(number, bCountVal, "BOX", undefined, bookingType));
          } else if (isDouble && subType === "ALL") {
            ["AB", "BC", "AC"].forEach((lsk) => {
              if (countVal > 0) newEntries.push(createEntry(number, countVal, lsk, lsk, bookingType));
            });
          } else if (isSingle && subType === "ALL") {
            ["A", "B", "C"].forEach((lsk) => {
              if (countVal > 0) newEntries.push(createEntry(number, countVal, lsk, lsk, bookingType));
            });
          } else {
            const actualCount = subType === "BOX" ? bCountVal : countVal;
            if (actualCount > 0) newEntries.push(createEntry(number, actualCount, subType, undefined, bookingType));
          }
        }

        setBookingDetails((prev) => [...newEntries, ...prev]);
        clearInputs();
        return;
      }

      // ---------- Normal Booking ----------
      if (subType === "BOTH") {
        if (!countInput || !bCountInput) {
          invalids.push(num);
          return;
        }
        if (
          !isValidNumberString(countInput) ||
          !isValidPositiveNumber(countInput) ||
          !isValidNumberString(bCountInput) ||
          !isValidPositiveNumber(bCountInput)
        ) {
          invalids.push(num);
          return;
        }
        const padded = num.padStart(digitsRequired, "0");
        allEntries.push(createEntry(padded, parseNum(countInput), "SUPER", undefined, bookingType));
        allEntries.push(createEntry(padded, parseNum(bCountInput), "BOX", undefined, bookingType));
        return;
      }

      if (subType === "ALL") {
        const padded = num.padStart(digitsRequired, "0");
        if (isDouble) {
          const lskArr = ["AB", "BC", "AC"];
          lskArr.forEach((lsk) => {
            if (countVal > 0) allEntries.push(createEntry(padded, countVal, lsk, lsk, bookingType));
          });
        } else if (isSingle) {
          const lskArr = ["A", "B", "C"];
          lskArr.forEach((lsk) => {
            if (countVal > 0) allEntries.push(createEntry(padded, countVal, lsk, lsk, bookingType));
          });
        }
        return;
      }

      if (!countInput) {
        invalids.push(num);
        return;
      }
      if (!isValidNumberString(countInput) || !isValidPositiveNumber(countInput)) {
        invalids.push(num);
        return;
      }

      const padded = num.padStart(digitsRequired, "0");
      allEntries.push(createEntry(padded, parseNum(countInput), subType, undefined, bookingType));
    });

    console.log("invalids", invalids);

    if (invalids.length > 0) {
      if (isMixedMode) {
        Alert.alert(
          "Invalid input",
          `The following numbers are invalid or do not match allowed digit lengths (1, 2, or 3):\n${invalids.join(
            ", "
          )}`
        );
      } else {
        // For BOX, show 3-digit error, else show digit error
        if (subType === "BOX") {
          Alert.alert(
            "Invalid input",
            `Number must be a 3-digit number.`
          );
        } else if (
          (subType === "ALL" || subType === "AB" || subType === "BC" || subType === "AC") &&
          getBookingType() === "double_digit"
        ) {
          Alert.alert(
            "Invalid input",
            `Number must be a 2-digit number.`
          );
        } else {
          Alert.alert(
            "Invalid input",
            `Number must be a ${drawSession}-digit number.`
          );
        }
      }
      return;
    }

    if (allEntries.length > 0) {
      setBookingDetails((prev) => [...allEntries, ...prev]);
      clearInputs();
      setBCountInput("");
    }
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

  // --- FIXED saveEdit for BOX/bCount ---
  const saveEdit = () => {
    if (editingEntry && editIndex !== null) {
      // ENFORCE number and count > 0 and are valid numbers
      if (
        !isValidNumberString(editingEntry.number) ||
        editingEntry.number.length === 0
      ) {
        Alert.alert("Invalid input", "Number must be a valid number.");
        return;
      }
      // For BOX, must be 3-digit and count > 0
      if (
        editingEntry.sub_type === "BOX"
      ) {
        if (editingEntry.number.length !== 3) {
          Alert.alert("Invalid input", "Number must be a 3-digit number for BOX.");
          return;
        }
        if (!isValidPositiveNumber(editingEntry.count)) {
          Alert.alert("Invalid input", "B.Count must be a valid number greater than 0.");
          return;
        }
      } else {
        if (!isValidPositiveNumber(editingEntry.count)) {
          Alert.alert("Invalid input", "Count must be a valid number greater than 0.");
          return;
        }
      }

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
  }

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



  const handlePastBookings = async () => {
    try {
      let clipboardText: string = "";
      if (Platform.OS === "web") {
        clipboardText = await navigator.clipboard.readText();
      } else if (RNClipboard?.Clipboard && RNClipboard.Clipboard.getString) {
        clipboardText = await RNClipboard.Clipboard.getString();
      } else if ((global as any).Clipboard && (global as any).Clipboard.getString) {
        clipboardText = await (global as any).Clipboard.getString();
      } else {
        try {
          const { getString } = require("@react-native-clipboard/clipboard");
          clipboardText = await getString();
        } catch (e) {
          ToastAndroid.show('Could not read clipboard.', ToastAndroid.SHORT);
          return;
        }
      }

      if (!clipboardText || !clipboardText.trim()) {
        ToastAndroid.show('Clipboard is empty.', ToastAndroid.SHORT);
        return;
      }

      // Split into lines and trim
      const lines = clipboardText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

      // Prepare to collect bookings and failed lines
      let bookings: { number: string; count: number; subType: string }[] = [];
      let failedLines: string[] = [];

      // Regex for WhatsApp metadata prefix
      const waPrefixRegex = /^\[\d{1,2}\/\d{1,2}(?:\/\d{2,4})?,\s*\d{1,2}:\d{2}(?:\s*[APMapm\.]*)?\]\s*[^:]*:/;

      // --- VALID SUBTYPES BY NUMBER LENGTH ---
      const validSubTypesByLength: { [len: number]: string[] } = {
        1: ["A", "B", "C"],
        2: ["AB", "AC", "BC"],
        3: ["SUPER", "BOX", "SET", "BOTH"],
      };

      // Helper: Validate if subType is allowed for number length
      function isValidSubtypeForNumber(number: string, subType: string) {
        const len = number.length;
        const st = (subType || "").toUpperCase();
        if (!validSubTypesByLength[len]) return false;
        // For 3-digit, allow "BOTH" as well (for input, but not as booking type)
        if (len === 3 && st === "BOTH") return true;
        return validSubTypesByLength[len].includes(st);
      }

      // Helper: Add booking with fallback subType and validation
      function pushBooking(number: string, count: number, subType?: string) {
        if (!number || isNaN(Number(number)) || !count || isNaN(Number(count)) || Number(count) <= 0) return false;
        let nlen = number.length;
        let st = (subType || "").toUpperCase();

        // Default subType logic
        if (!st) {
          if (nlen === 1) st = "A";
          else if (nlen === 2) st = "AB";
          else st = "SUPER";
        }

        // Validate subType for number length
        if (!isValidSubtypeForNumber(number, st)) return false;

        bookings.push({ number, count: Number(count), subType: st });
        return true;
      }

      // Helper: Add both SUPER and BOX for dual count (only for 3-digit)
      function pushDualBooking(number: string, count1: number, count2: number) {
        if (number.length !== 3) return false;
        let ok1 = pushBooking(number, count1, "SUPER");
        let ok2 = pushBooking(number, count2, "BOX");
        return ok1 && ok2;
      }

      // Regexes for various formats
      // 1. WhatsApp prefix
      // 2. "Abc 0 5" style (legacy)
      const abcRegex = /^\s*Abc\s+(\d+)\s+(\d+)\s*$/i;
      // 3. "304  10" style (number, 2+ spaces, count)
      const superSpaceRegex = /^\s*(\d{1,3})\s{2,}(\d+)\s*$/;
      // 4. "054 2" (3-digit number, 1 space, count)
      const threeDigitSpaceRegex = /^\s*(\d{3})\s+(\d+)\s*$/;
      // 5. "number [subType] count"
      const normalMatchRegex = /^\s*(\d{1,3})\s+([A-Za-z]+)?\s*(\d+)\s*$/;
      // 6. "123=5", "123+5", "123/5", "123.5", "123-5", "123:5", "123#5", "123&5", "123*5"
      const superSymbolRegex = /^\s*(\d{1,3})\s*([=+\-:\/\.\#\&\*])\s*(\d+)\s*$/;
      // 7. "041-1.2", "041-1*2", "041-1/2", "041-1:2", "041-1,2", "041-1=2", "041-1+2", etc.
      // Accepts any non-digit, non-space, non-letter as separator between number and counts
      // Also supports "123=3=3", "145+2+2", "156:3-5", "165+5:6"
      const dualCountRegex = /^\s*(\d{1,3})\s*[-=+\/\.\#\&\*:,]\s*(\d+)[^0-9]+(\d+)\s*$/;
      // 8. "036,2" or "036, 2" or "036-2" or "036.2" or "036/2" or "036:2" or "036*2"
      const commaOrSymbolRegex = /^\s*(\d{1,3})\s*[,=+\-:\/\.\#\&\*]\s*(\d+)\s*$/;
      // 9. "AB.24.2" or "BC.41.2" (subtype.number.count)
      const subtypeDotNumberDotCount = /^\s*([A-Za-z]+)[\.\-]([0-9]{1,3})[\.\-](\d+)\s*$/;
      // 10. "100.2.2" (number.count1.count2)
      const numberDotCountDotCount = /^\s*(\d{1,3})[\.\-](\d+)[\.\-](\d+)\s*$/;
      // 11. "021*2" (number*count)
      const numberStarCount = /^\s*(\d{1,3})\s*\*\s*(\d+)\s*$/;
      // 12. "312.6" (number.count)
      const numberDotCount = /^\s*(\d{1,3})\s*[\.\-]\s*(\d+)\s*$/;
      // 12a. "608..50" (number..count) - custom for this request
      const numberDoubleDotCount = /^\s*(\d{1,3})\s*\.\.\s*(\d+)\s*$/;
      // 13. "123-5 box", "123=5 set", "123-5 super", "123-5 both"
      const numberSymbolCountSubtype = /^\s*(\d{1,3})\s*([=+\-:\/\.\#\&\*])\s*(\d+)\s+([A-Za-z]+)\s*$/;
      // 14. "56 AC=5", "34 AB:5", "45 BC-5", "6 A=10", "8 B=15", "7 C #15"
      const numberSubtypeSymbolCount = /^\s*(\d{1,3})\s*([A-Za-z]+)\s*([=+\-:\/\.\#\&\*])\s*(\d+)\s*$/;
      // 15. "A 8 20", "A 9 20"
      const subtypeNumberCount = /^\s*([A-Za-z]+)\s+(\d{1,3})\s+(\d+)\s*$/;
      // 16. "Dear 6", "Kerala 3" (ignore, not a booking)
      const ignoreLineRegex = /^\s*[A-Za-z ]+\d+\s*$/;
      // 17. "709-5,077-6,078-5,..." (comma separated bookings in one line)
      const multiBookingLineRegex = /(\d{1,3})\s*[-=+\*\/\.\#\&:,]\s*(\d+)/g;

      // --- NEW: Regex for "Set 524.1" style ---
      const setWordNumberDotCount = /^\s*Set\s+(\d{3})\.(\d+)\s*$/i;

      // --- NEW: Regex for "770,,1" style (number,,count) ---
      const numberDoubleCommaCount = /^\s*(\d{1,3})\s*,{2,}\s*(\d+)\s*$/;

      // --- NEW: Regex for "Abc-8-5" style (add 3 single digit bookings: A 8 5, B 8 5, C 8 5) ---
      const abcDashNumberDashCount = /^\s*Abc\s*-\s*(\d+)\s*-\s*(\d+)\s*$/i;

      // --- NEW: Regex for "Ab 45=100" and "Ab=45=100" and similar ---
      // Matches: "Ab 45=100", "AB 45=100", "Ab=45=100", "AB=45=100"
      // Group 1: subtype (Ab/AB), Group 2: number, Group 3: count
      const abSpaceNumberEqCount = /^\s*([Aa][Bb])\s+(\d{1,3})\s*=\s*(\d+)\s*$/;
      const abEqNumberEqCount = /^\s*([Aa][Bb])\s*=\s*(\d{1,3})\s*=\s*(\d+)\s*$/;

      // --- NEW: Regex for "AB 45/100" and similar (subtype, number, symbol, count) ---
      // Matches: "AB 45/100", "AB 45-100", "AB 45:100", etc.
      // Group 1: subtype, Group 2: number, Group 3: symbol, Group 4: count
      const subtypeNumberSymbolCount = /^\s*([A-Za-z]+)\s+(\d{1,3})\s*([=+\-:\/\.\#\&\*])\s*(\d+)\s*$/;

      // --- NEW: Regex for "A=4=10", "B=4=5", "C=4=5" ---
      // Group 1: subtype (A/B/C), Group 2: number, Group 3: count
      const singleLetterEqNumberEqCount = /^\s*([ABCabc])\s*=\s*(\d{1,3})\s*=\s*(\d+)\s*$/;

      for (const origLine of lines) {
        let line = origLine;
        let waPrefix = "";

        // WhatsApp prefix
        const waMatch = line.match(waPrefixRegex);
        if (waMatch) {
          waPrefix = waMatch[0];
          line = line.slice(waPrefix.length).trim();
        }

        // If after removing prefix, line is empty, just add the prefix to failedLines and continue
        if (line.length === 0) {
          if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
          continue;
        }

        // 0. Ignore lines like "Dear 6", "Kerala 3"
        if (ignoreLineRegex.test(line)) continue;

        // --- NEW: "A=4=10", "B=4=5", "C=4=5" style ---
        let m = line.match(singleLetterEqNumberEqCount);
        if (m) {
          if (!pushBooking(m[2], m[3], m[1].toUpperCase())) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // --- NEW: "Ab 45=100" and "AB 45=100" style ---
        m = line.match(abSpaceNumberEqCount);
        if (m) {
          if (!pushBooking(m[2], m[3], m[1].toUpperCase())) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // --- NEW: "Ab=45=100" and "AB=45=100" style ---
        m = line.match(abEqNumberEqCount);
        if (m) {
          if (!pushBooking(m[2], m[3], m[1].toUpperCase())) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // --- NEW: "Abc-8-5" style ---
        m = line.match(abcDashNumberDashCount);
        if (m) {
          let ok = pushBooking(m[1], m[2], "A") && pushBooking(m[1], m[2], "B") && pushBooking(m[1], m[2], "C");
          if (!ok) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // --- NEW: "Set 524.1" style ---
        m = line.match(setWordNumberDotCount);
        if (m) {
          // Add all 6 permutations as SUPER, only for 3-digit
          const num = m[1];
          const count = m[2];
          if (num.length === 3) {
            const perms = Array.from(new Set([
              num[0] + num[1] + num[2],
              num[0] + num[2] + num[1],
              num[1] + num[0] + num[2],
              num[1] + num[2] + num[0],
              num[2] + num[0] + num[1],
              num[2] + num[1] + num[0],
            ]));
            for (let perm of perms) pushBooking(perm, count, "SUPER");
          } else {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // --- NEW: "770,,1" style (number,,count) ---
        m = line.match(numberDoubleCommaCount);
        if (m) {
          if (!pushBooking(m[1], m[2])) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // --- NEW: "AB 45/100" and similar (subtype, number, symbol, count) ---
        m = line.match(subtypeNumberSymbolCount);
        if (m) {
          // m[1]: subtype, m[2]: number, m[4]: count
          if (!pushBooking(m[2], m[4], m[1])) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // 1. Multi-booking line: "709-5,077-6,078-5,..."
        let multiMatch = [...line.matchAll(multiBookingLineRegex)];
        if (multiMatch.length > 1) {
          let anyOk = false;
          for (let m of multiMatch) {
            if (pushBooking(m[1], m[2])) anyOk = true;
          }
          if (!anyOk) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // 2. Dual count: "041-1.2", "041-1*2", "041-1/2", "123=3=3", "145+2+2", "156:3-5", "165+5:6"
        m = line.match(dualCountRegex);
        if (m) {
          if (!pushDualBooking(m[1], m[2], m[3])) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // 2a. "608..50" (number..count) - custom for this request
        m = line.match(numberDoubleDotCount);
        if (m) {
          if (!pushBooking(m[1], m[2])) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // 3. "Abc 0 5" style (legacy)
        m = line.match(abcRegex);
        if (m) {
          let ok = pushBooking(m[1], m[2], "A") && pushBooking(m[1], m[2], "B") && pushBooking(m[1], m[2], "C");
          if (!ok) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // 4. "304  10" style (number, 2+ spaces, count)
        m = line.match(superSpaceRegex);
        if (m) {
          if (!pushBooking(m[1], m[2])) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // 5. "054 2" (3-digit number, 1 space, count)
        m = line.match(threeDigitSpaceRegex);
        if (m) {
          if (!pushBooking(m[1], m[2])) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // 6. "number [subType] count"
        m = line.match(normalMatchRegex);
        if (m) {
          if (!pushBooking(m[1], m[3], m[2])) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // 7. "123=5", "123+5", "123/5", "123.5", "123-5", "123:5", "123#5", "123&5", "123*5"
        m = line.match(superSymbolRegex);
        if (m) {
          if (!pushBooking(m[1], m[3])) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // 8. "036,2" or "036, 2" or "036-2" or "036.2" or "036/2" or "036:2" or "036*2"
        m = line.match(commaOrSymbolRegex);
        if (m) {
          if (!pushBooking(m[1], m[2])) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // 9. "AB.24.2" or "BC.41.2" (subtype.number.count)
        m = line.match(subtypeDotNumberDotCount);
        if (m) {
          if (!pushBooking(m[2], m[3], m[1])) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // 10. "100.2.2" (number.count1.count2)
        m = line.match(numberDotCountDotCount);
        if (m) {
          let ok = pushBooking(m[1], m[2], "SUPER") && pushBooking(m[1], m[3], "BOX");
          if (!ok) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // 11. "021*2"
        m = line.match(numberStarCount);
        if (m) {
          if (!pushBooking(m[1], m[2])) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // 12. "312.6" (number.count)
        m = line.match(numberDotCount);
        if (m) {
          if (!pushBooking(m[1], m[2])) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // 13. "123-5 box", "123=5 set", "123-5 super", "123-5 both"
        m = line.match(numberSymbolCountSubtype);
        if (m) {
          let subType = m[4].toUpperCase();
          if (subType === "SET") {
            // Add all 6 permutations as SUPER, only for 3-digit
            if (m[1].length === 3) {
              const perms = Array.from(new Set([
                m[1][0] + m[1][1] + m[1][2],
                m[1][0] + m[1][2] + m[1][1],
                m[1][1] + m[1][0] + m[1][2],
                m[1][1] + m[1][2] + m[1][0],
                m[1][2] + m[1][0] + m[1][1],
                m[1][2] + m[1][1] + m[1][0],
              ]));
              for (let perm of perms) pushBooking(perm, m[3], "SUPER");
            } else {
              // Not valid for non-3-digit
              if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
              failedLines.push(origLine);
            }
          } else if (subType === "BOTH") {
            // Only for 3-digit
            if (m[1].length === 3) {
              pushBooking(m[1], m[3], "SUPER");
              pushBooking(m[1], m[3], "BOX");
            } else {
              if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
              failedLines.push(origLine);
            }
          } else {
            if (!pushBooking(m[1], m[3], subType)) {
              if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
              failedLines.push(origLine);
            }
          }
          continue;
        }

        // 14. "56 AC=5", "34 AB:5", "45 BC-5", "6 A=10", "8 B=15", "7 C #15"
        m = line.match(numberSubtypeSymbolCount);
        if (m) {
          if (!pushBooking(m[1], m[4], m[2])) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // 15. "A 8 20", "A 9 20"
        m = line.match(subtypeNumberCount);
        if (m) {
          if (!pushBooking(m[2], m[3], m[1])) {
            if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
            failedLines.push(origLine);
          }
          continue;
        }

        // If still not matched, add WhatsApp prefix (if any) and the line to failedLines
        if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
        if (line.length > 0) failedLines.push(origLine);
      }

      // Add bookings
      let added = 0;
      for (const booking of bookings) {
        // Determine drawSession based on number length
        let session = drawSession;
        if (booking.number.length === 1) session = "1";
        else if (booking.number.length === 2) session = "2";
        else if (booking.number.length === 3) session = "3";
        if (drawSession !== session) setDrawSession(session);

        addBooking(booking.subType, booking.number, booking.count, booking.count);
        added++;
      }

      if (added === 0) {
        ToastAndroid.show('No valid bookings found in clipboard.', ToastAndroid.SHORT);
      } else {
        ToastAndroid.show(`Added ${added} booking${added > 1 ? "s" : ""} from clipboard.`, ToastAndroid.SHORT);
      }

      if (failedLines.length > 0) {
        setFailedPasteLines(failedLines);
        setFailedPasteModalVisible(true);
      }
    } catch (err) {
      Alert.alert("Clipboard Error", "Could not read clipboard.");
    }
  }

  // 🔑 Utility: Generate all 6 permutations of a 3-digit number


  // const handlePastBookings = async () => {
  //   try {
  //     let clipboardText: string = "";
  //     if (Platform.OS === "web") {
  //       clipboardText = await navigator.clipboard.readText();
  //     } else if (RNClipboard?.Clipboard && RNClipboard.Clipboard.getString) {
  //       clipboardText = await RNClipboard.Clipboard.getString();
  //     } else if ((global as any).Clipboard && (global as any).Clipboard.getString) {
  //       clipboardText = await (global as any).Clipboard.getString();
  //     } else {
  //       try {
  //         const { getString } = require("@react-native-clipboard/clipboard");
  //         clipboardText = await getString();
  //       } catch (e) {
  //         ToastAndroid.show("Could not read clipboard.", ToastAndroid.SHORT);
  //         return;
  //       }
  //     }
  
  //     if (!clipboardText || !clipboardText.trim()) {
  //       ToastAndroid.show("Clipboard is empty.", ToastAndroid.SHORT);
  //       return;
  //     }
  
  //     // Split by new lines first
  //     const rawLines = clipboardText.split(/[\n]+/).map((l) => l.trim()).filter(Boolean);
  
  //     // Utility: Generate all 6 permutations of a 3-digit number
  //     const generatePermutations = (num: string): string[] => {
  //       if (num.length !== 3) return [];
  //       const digits = num.split("");
  //       const perms = new Set<string>();
  //       for (let i = 0; i < 3; i++) {
  //         for (let j = 0; j < 3; j++) {
  //           if (j === i) continue;
  //           for (let k = 0; k < 3; k++) {
  //             if (k === i || k === j) continue;
  //             perms.add(digits[i] + digits[j] + digits[k]);
  //           }
  //         }
  //       }
  //       return Array.from(perms);
  //     };
  
  //     // Helper: parse a single booking item into {number, count, subType}
  //     function parseLine(line: string) {
  //       let l = line.replace(/\s+/g, " ").trim();
  //       if (!l) return null;
  
  //       // First pattern: subtype + number + count (AB.24.2)
  //       let match = l.match(/^([A-Z]{1,3})[\.\:\-\s]+([0-9]{1,3})(?:[\.\:\-\s]+([0-9]{1,3}))?$/i);
  //       if (match) {
  //         let subType = match[1].toUpperCase();
  //         let number = match[2];
  //         let count = match[3] ? parseInt(match[3]) : 5;
  //         if (isNaN(count)) count = 5;
  //         return { number, count, subType };
  //       }
  
  //       // Extract explicit subtype if present (e.g., BOX 123 5)
  //       let subType = "";
  //       let subTypeMatch = l.match(/\b(box|set|super|both|ab|ac|bc|a|b|c|all)\b/i);
  //       if (subTypeMatch) {
  //         subType = subTypeMatch[1].toUpperCase();
  //         l = l.replace(subTypeMatch[0], "").trim();
  //       }
  
  //       // Number + count (e.g., 24 2, 123 10)
  //       let match2 = l.match(/^([0-9]{1,3})[\s\.\:\-]+([0-9]{1,3})$/);
  //       if (match2) {
  //         let number = match2[1];
  //         let count = parseInt(match2[2]);
  //         if (isNaN(count)) count = 5;
  //         if (!subType) {
  //           if (number.length === 3) subType = "SUPER";
  //           else if (number.length === 2) subType = "AB";
  //           else if (number.length === 1) subType = "A";
  //         }
  //         return { number, count, subType };
  //       }
  
  //       // Just a number (default count 5, subtype inferred)
  //       let match3 = l.match(/^([0-9]{1,3})$/);
  //       if (match3) {
  //         let number = match3[1];
  //         let count = 5;
  //         if (!subType) {
  //           if (number.length === 3) subType = "SUPER";
  //           else if (number.length === 2) subType = "AB";
  //           else if (number.length === 1) subType = "A";
  //         }
  //         return { number, count, subType };
  //       }
  
  //       return null;
  //     }
  
  //     let added = 0;
  //     let failedLines: string[] = [];
  
  //     // Process each line, allowing multiple bookings per line
  //     for (let raw of rawLines) {
  //       // Allow separators like comma/semicolon/space inside each line
  //       const parts = raw.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);
  
  //       for (let part of parts) {
  //         const parsed = parseLine(part);
  
  //         if (!parsed) {
  //           failedLines.push(part);
  //           continue;
  //         }
  
  //         if (
  //           !isValidNumberString(parsed.number) ||
  //           !isValidPositiveNumber(parsed.count) ||
  //           !isValidNumber(parsed)
  //         ) {
  //           failedLines.push(part);
  //           continue;
  //         }
  
  //         // Determine session by number length
  //         let session = drawSession;
  //         if (parsed.number.length === 1) session = "1";
  //         else if (parsed.number.length === 2) session = "2";
  //         else if (parsed.number.length === 3) session = "3";
  //         if (drawSession !== session) setDrawSession(session);
  
  //         // Handle special subTypes
  //         if (session === "3" && parsed.subType === "BOTH") {
  //           if (parsed.count > 0) addBooking("BOTH", parsed.number, parsed.count, parsed.count);
  //           added += 2;
  //         } else if (session === "3" && parsed.subType === "SET") {
  //           const perms = generatePermutations(parsed.number);
  //           perms.forEach((perm) => {
  //             addBooking("SUPER", perm, parsed.count, parsed.count);
  //             added++;
  //           });
  //         } else if (session === "3" && parsed.subType === "BOX") {
  //           if (parsed.count > 0) {
  //             addBooking("BOX", parsed.number, parsed.count, parsed.count);
  //             added++;
  //           }
  //         } else {
  //           if (parsed.count > 0) {
  //             addBooking(parsed.subType, parsed.number, parsed.count, parsed.count);
  //             added++;
  //           }
  //         }
  //       }
  //     }
  
  //     if (added === 0) {
  //       ToastAndroid.show("No valid bookings found in clipboard.", ToastAndroid.SHORT);
  //     } else {
  //       ToastAndroid.show(`Added ${added} booking${added > 1 ? "s" : ""} from clipboard.`, ToastAndroid.SHORT);
  //     }
  
  //     if (failedLines.length > 0) {
  //       setFailedPasteLines(failedLines);
  //       setFailedPasteModalVisible(true);
  //     }
  //   } catch (err) {
  //     Alert.alert("Clipboard Error", "Could not read clipboard.");
  //   }
  // };
  


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
              {(() => {
                const val = Number(totals.d_amount);
                const dec = val.toFixed(2).split(".")[1];
                if (!Number.isInteger(val)) {
                  // Show value with decimal (2 digits) if decimal exists
                  return `${val.toFixed(2)}`;
                }
                // Show integer value only
                return `${val}`;
              })()}
            </Text>
          </View>
          <View>
            <Text className="font-semibold text-xs">C.AMOUNT</Text>
            <Text className="font-semibold text-xs text-center mt-1">
              {(() => {
                const val = Number(totals.c_amount);
                const dec = val.toFixed(2).split(".")[1];
                if (!Number.isInteger(val)) {
                  // Show value with decimal (2 digits) if decimal exists
                  return `${val.toFixed(2)}`;
                }
                // Show integer value only
                return `${val}`;
              })()}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleSubmit}
            className="bg-green-800 rounded px-3 py-2 flex-row items-center justify-center w-28"
            disabled={!!isPending}
            activeOpacity={isPending ? 1 : 0.85}
          >
            {isPending ? (
              <View className="flex-row items-center justify-center">
                <ActivityIndicator size="small" color="#fff" />
              </View>
            ) : (
              <Text className="text-white text-center font-bold text-lg">
                SUBMIT
              </Text>
            )}
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
                <Text className="mb-1 font-semibold text-gray-700">
                  {editingEntry?.sub_type === "BOX" ? "B.Count" : "Count"}
                </Text>
                <TextInput
                  placeholder={editingEntry?.sub_type === "BOX" ? "B.Count" : "Count"}
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

        {/* Modal for failed lines in paste */}
        <Modal
          visible={failedPasteModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setFailedPasteModalVisible(false)}
        >
          <View className="flex-1 justify-center items-center bg-black/50 px-4">
            <View className="bg-white p-6 rounded-2xl w-full max-w-md shadow-lg">
              <Text className="text-xl font-bold mb-4 text-center text-red-700">
                Invalid/Skipped Bookings
              </Text>
              <Text className="mb-2 text-gray-700 text-center">
                The following lines could not be added:
              </Text>
              <View className="max-h-60 mb-4">
                <FlatList
                  data={failedPasteLines}
                  keyExtractor={(_, idx) => idx.toString()}
                  renderItem={({ item }) => (
                    <Text className="text-sm text-gray-800 mb-1">• {item}</Text>
                  )}
                />
              </View>
              <TouchableOpacity
                onPress={() => setFailedPasteModalVisible(false)}
                className="px-6 py-2 rounded-lg bg-red-700"
              >
                <Text className="text-white font-semibold text-base text-center">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default BookingScreen;
