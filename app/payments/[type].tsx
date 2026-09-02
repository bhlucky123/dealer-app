import { useAuthStore } from "@/store/auth";
import api from "@/utils/axios";
import { formatDateDDMMYYYY } from "@/utils/date";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Calendar, Pencil, Trash2, Wallet } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * Drill-down for the dashboard's Payments card. `type` in the route is the
 * user-facing direction ("paid" / "received"); the backend stores the same
 * thing as AdminDealerPayment.type ("to_dealer" / "to_admin"), which is what
 * /draw-payment/admin-dealer-payments/ filters on.
 */
const TYPE_CONFIG = {
  paid: {
    apiType: "to_dealer",
    title: "Paid Payments",
    subtitle: "Paid to dealers",
    accent: "#dc2626",
    badgeBg: "bg-rose-50",
    badgeBorder: "border-rose-100",
    badgeText: "text-rose-700",
    amountText: "text-rose-700",
  },
  received: {
    apiType: "to_admin",
    title: "Received Payments",
    subtitle: "Received from dealers",
    accent: "#16a34a",
    badgeBg: "bg-emerald-50",
    badgeBorder: "border-emerald-100",
    badgeText: "text-emerald-700",
    amountText: "text-emerald-700",
  },
} as const;

type PaymentDirection = keyof typeof TYPE_CONFIG;

type PaymentRow = {
  id: number;
  dealer: number;
  dealer_name?: string | null;
  amount: string | number;
  date_received: string; // YYYY-MM-DD
  type: "to_dealer" | "to_admin";
  type_display?: string;
  created_user?: number | null;
  created_user_name?: string | null;
  created_date?: string | null;
};

type PaymentPage = {
  count: number;
  next: string | null;
  previous: string | null;
  results: PaymentRow[];
  total_amount: number;
  /**
   * Server's verdict on whether this caller may edit/delete these rows: true
   * for a vendor administrator (its own vendor's records), false for the
   * cross-vendor top admin, whose listing is view-only. Taken from the
   * response rather than inferred from the user's role so the UI can never
   * offer an action the API would reject.
   */
  can_manage?: boolean;
};

const LIMIT = 20;

// Server wants YYYY-MM-DD; formatDateDDMMYYYY in utils/date is the display side.
function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseServerDate(value?: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function displayDate(value?: string | null): string {
  const parsed = parseServerDate(value);
  return parsed ? formatDateDDMMYYYY(parsed) : "—";
}

function displayDateTime(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${formatDateDDMMYYYY(d)} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })}`;
}

function formatAmount(value?: number | string | null): string {
  const num = Number(value ?? 0);
  if (isNaN(num)) return "₹0.00";
  return `₹${num.toFixed(2)}`;
}

function errorMessage(error: any, fallback: string): string {
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  if (data?.error) return data.error;
  if (data?.detail) return data.detail;
  if (Array.isArray(data?.amount)) return data.amount.join("\n");
  if (Array.isArray(data?.date_received)) return data.date_received.join("\n");
  return error?.message?.detail || error?.message || fallback;
}

export default function PaymentsListScreen() {
  const params = useLocalSearchParams<{
    type?: string;
    start_date?: string;
    end_date?: string;
    days?: string;
  }>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const direction = (params.type === "received" ? "received" : "paid") as PaymentDirection;
  const config = TYPE_CONFIG[direction];
  const isKnownType = params.type === "paid" || params.type === "received";

  // The dashboard hands over whichever range it is showing so the list adds up
  // to the total on the card. Falls back to the API default when absent.
  const dateParams = useMemo(() => {
    if (params.start_date && params.end_date) {
      return { start_date: params.start_date, end_date: params.end_date };
    }
    if (params.days) return { days: params.days };
    return {};
  }, [params.start_date, params.end_date, params.days]);

  const rangeLabel = useMemo(() => {
    if (params.start_date && params.end_date) {
      const from = displayDate(params.start_date);
      const to = displayDate(params.end_date);
      return from === to ? from : `${from} – ${to}`;
    }
    if (params.days) return `Last ${params.days} days`;
    return "Last 7 days";
  }, [params.start_date, params.end_date, params.days]);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [editRow, setEditRow] = useState<PaymentRow | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: config.title });
  }, [navigation, config.title]);

  // Debounce the dealer search the same way the payment tab does (300ms).
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    // @ts-expect-error type-off
    searchTimeout.current = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchInput]);

  const isAdmin = user?.user_type === "ADMIN";

  const queryKey = useMemo(
    () => ["/draw-payment/admin-dealer-payments/", config.apiType, dateParams, search],
    [config.apiType, dateParams, search]
  );

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<PaymentPage>({
    queryKey,
    enabled: isAdmin && isKnownType,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const query = new URLSearchParams({
        type: config.apiType,
        limit: String(LIMIT),
        offset: String(pageParam ?? 0),
      });
      Object.entries(dateParams).forEach(([key, value]) => {
        if (value) query.set(key, String(value));
      });
      if (search) query.set("search", search);
      const res = await api.get(`/draw-payment/admin-dealer-payments/?${query.toString()}`);
      return res.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.next) return undefined;
      return allPages.reduce((sum, page) => sum + (page?.results?.length ?? 0), 0);
    },
  });

  const rows = useMemo(
    () => (data?.pages ?? []).flatMap((page) => page?.results ?? []),
    [data]
  );
  const totalAmount = data?.pages?.[0]?.total_amount ?? 0;
  const totalCount = data?.pages?.[0]?.count ?? 0;
  const canManage = data?.pages?.[0]?.can_manage ?? false;

  const invalidateAfterChange = useCallback(() => {
    // This list, plus the dashboard card that linked here (its Paid/Received
    // totals and dealer_pending both read these rows). The dealer
    // pending-balance lists fetch outside React Query, so they pick the
    // change up on their own next refresh.
    queryClient.invalidateQueries({ queryKey: ["/draw-payment/admin-dealer-payments/"] });
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
  }, [queryClient]);

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      amount,
      date_received,
    }: {
      id: number;
      amount: number;
      date_received: string;
    }) => api.patch(`/draw-payment/admin-dealer-payments/${id}/`, { amount, date_received }),
    onSuccess: () => {
      setEditRow(null);
      invalidateAfterChange();
      ToastAndroid.show("Payment updated successfully", ToastAndroid.SHORT);
    },
    onError: (err: any) => {
      Alert.alert("Update Failed", errorMessage(err, "Could not update the payment."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/draw-payment/admin-dealer-payments/${id}/`),
    onSuccess: () => {
      invalidateAfterChange();
      ToastAndroid.show("Payment deleted successfully", ToastAndroid.SHORT);
    },
    onError: (err: any) => {
      Alert.alert("Delete Failed", errorMessage(err, "Could not delete the payment."));
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const openEditModal = useCallback((row: PaymentRow) => {
    setEditRow(row);
    setEditAmount(String(Number(row.amount ?? 0)));
    setEditDate(row.date_received);
    setShowEditDatePicker(false);
  }, []);

  const onEditDateChange = useCallback((event: { type: string }, selectedDate?: Date) => {
    setShowEditDatePicker(Platform.OS === "ios");
    if (event.type !== "set" || !selectedDate) return;
    setEditDate(formatDateYYYYMMDD(selectedDate));
  }, []);

  const submitEdit = useCallback(() => {
    if (!editRow) return;
    const amount = Number(editAmount);
    if (!editAmount.trim() || isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter an amount greater than 0.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editDate)) {
      Alert.alert("Invalid Date", "Please select a valid date.");
      return;
    }
    updateMutation.mutate({ id: editRow.id, amount, date_received: editDate });
  }, [editRow, editAmount, editDate, updateMutation]);

  const confirmDelete = useCallback(
    (row: PaymentRow) => {
      Alert.alert(
        "Delete Payment",
        `Delete the ${formatAmount(row.amount)} payment ${
          direction === "paid" ? "to" : "from"
        } ${row.dealer_name || "this dealer"} on ${displayDate(row.date_received)}?\n\n` +
          "This also adjusts the dealer's pending balance and cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteMutation.mutate(row.id),
          },
        ]
      );
    },
    [deleteMutation, direction]
  );

  const renderItem = useCallback(
    ({ item }: { item: PaymentRow }) => (
      <View className="mx-4 mb-3 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
              {item.dealer_name || `Dealer #${item.dealer}`}
            </Text>
            <View className="mt-1.5 flex-row items-center">
              <Calendar size={12} color="#64748b" />
              <Text className="ml-1 text-xs font-medium text-gray-500">
                {displayDate(item.date_received)}
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text className={`text-lg font-extrabold ${config.amountText}`}>
              {formatAmount(item.amount)}
            </Text>
            <View
              className={`mt-1 rounded-full border px-2 py-0.5 ${config.badgeBg} ${config.badgeBorder}`}
            >
              <Text className={`text-[10px] font-semibold ${config.badgeText}`}>
                {item.type_display || (item.type === "to_dealer" ? "To Dealer" : "To Admin")}
              </Text>
            </View>
          </View>
        </View>

        {(item.created_user_name || item.created_date) && (
          <Text className="mt-2 text-[10px] text-gray-400">
            {item.created_user_name ? `Recorded by ${item.created_user_name}` : "Recorded"}
            {item.created_date ? ` · ${displayDateTime(item.created_date)}` : ""}
          </Text>
        )}

        {/* Edit/Delete belong to the vendor that owns the record. The top
            admin reads across vendors, so its listing has no actions. */}
        {canManage && (
          <View className="mt-3 flex-row gap-2 border-t border-gray-100 pt-3">
            <TouchableOpacity
              onPress={() => openEditModal(item)}
              className="flex-1 flex-row items-center justify-center rounded-xl bg-indigo-50 py-2"
              activeOpacity={0.8}
            >
              <Pencil size={14} color="#4f46e5" />
              <Text className="ml-1.5 text-xs font-bold text-indigo-700">Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => confirmDelete(item)}
              className="flex-1 flex-row items-center justify-center rounded-xl bg-red-50 py-2"
              activeOpacity={0.8}
              disabled={deleteMutation.isPending}
            >
              <Trash2 size={14} color="#dc2626" />
              <Text className="ml-1.5 text-xs font-bold text-red-700">Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    ),
    [config, canManage, openEditModal, confirmDelete, deleteMutation.isPending]
  );

  if (!isAdmin) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-center text-sm font-semibold text-gray-700">
          Payment management is available to administrators only.
        </Text>
      </View>
    );
  }

  if (!isKnownType) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-center text-sm font-semibold text-gray-700">
          Unknown payment type “{String(params.type)}”.
        </Text>
        <Text className="mt-1 text-center text-xs text-gray-500">
          Open this screen from the dashboard&apos;s Payments card.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Summary header */}
      <View className="mx-4 mb-3 mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              {config.subtitle}
            </Text>
            <Text className={`mt-1 text-2xl font-extrabold ${config.amountText}`}>
              {formatAmount(totalAmount)}
            </Text>
          </View>
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-gray-50">
            <Wallet size={20} color={config.accent} />
          </View>
        </View>
        <Text className="mt-2 text-xs font-medium text-gray-500">
          {rangeLabel} · {totalCount} {totalCount === 1 ? "payment" : "payments"}
        </Text>
        {!isLoading && !error && !canManage && (
          <Text className="mt-1 text-[10px] font-medium text-gray-400">
            View only — records are edited by the vendor they belong to.
          </Text>
        )}
      </View>

      {/* Dealer search */}
      <View className="mx-4 mb-3 flex-row items-center rounded-xl border border-gray-200 bg-white px-3">
        <TextInput
          placeholder="Search dealer..."
          value={searchInput}
          onChangeText={setSearchInput}
          className="h-10 flex-1 text-base text-gray-900"
          placeholderTextColor="#94a3b8"
          returnKeyType="search"
          autoCorrect={false}
        />
        {isFetching && !refreshing && (
          <ActivityIndicator size="small" color="#4f46e5" style={{ marginRight: 4 }} />
        )}
        {!!searchInput && (
          <TouchableOpacity
            onPress={() => setSearchInput("")}
            className="h-10 justify-center px-2"
          >
            <Text className="text-xl text-gray-500">×</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View className="mt-10 items-center justify-center">
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : error ? (
        <View className="mx-4 mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <Text className="mb-1 text-sm font-semibold text-red-700">
            Failed to load payments
          </Text>
          <Text className="text-xs text-red-600">
            {errorMessage(error, "Unknown error")}
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="mt-3 self-start rounded-full bg-red-600 px-3 py-1.5"
            activeOpacity={0.8}
          >
            <Text className="text-xs font-semibold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#4f46e5"]}
              tintColor="#4f46e5"
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View className="mt-16 items-center justify-center px-8">
              <Wallet size={28} color="#cbd5e1" />
              <Text className="mt-3 text-center text-sm font-semibold text-gray-500">
                No {direction} payments
              </Text>
              <Text className="mt-1 text-center text-xs text-gray-400">
                {search
                  ? "No dealer matches this search in the selected date range."
                  : `Nothing recorded for ${rangeLabel.toLowerCase()}.`}
              </Text>
            </View>
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ alignItems: "center", marginVertical: 12 }}>
                <ActivityIndicator size="small" color="#4f46e5" />
              </View>
            ) : null
          }
        />
      )}

      {/* Edit modal — same amount + date form the payment tab uses to create */}
      <Modal
        visible={canManage && !!editRow}
        animationType="slide"
        transparent
        onRequestClose={() => setEditRow(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/30">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "90%", maxWidth: 400 }}
          >
            <View className="rounded-2xl bg-white p-6 shadow-lg">
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text className="mb-1 text-center text-lg font-bold text-gray-900">
                  Edit {direction === "paid" ? "Paid" : "Received"} Payment
                </Text>
                <Text className="mb-4 text-center text-sm text-gray-600">
                  {editRow?.dealer_name || (editRow ? `Dealer #${editRow.dealer}` : "")}
                </Text>

                <Text className="mb-1 text-xs font-semibold text-gray-500">Amount</Text>
                <TextInput
                  placeholder="Amount"
                  keyboardType="numeric"
                  value={editAmount}
                  onChangeText={setEditAmount}
                  className="mb-3 rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-base text-gray-900"
                  placeholderTextColor="#9ca3af"
                />

                <Text className="mb-1 text-xs font-semibold text-gray-500">Date</Text>
                <TouchableOpacity
                  onPress={() => setShowEditDatePicker(true)}
                  className="mb-1 rounded-lg border border-gray-300 bg-gray-100 px-3 py-2.5"
                  activeOpacity={0.85}
                >
                  <Text className="text-base text-gray-900">
                    {editDate ? displayDate(editDate) : "Select Date"}
                  </Text>
                </TouchableOpacity>
                {showEditDatePicker && (
                  <DateTimePicker
                    value={parseServerDate(editDate) || new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={onEditDateChange}
                    maximumDate={new Date()}
                  />
                )}

                <Text className="mt-2 text-[10px] text-gray-400">
                  Saving also adjusts the dealer&apos;s pending balance by the difference.
                </Text>

                <View className="mt-5 flex-row justify-between">
                  <Pressable
                    onPress={() => setEditRow(null)}
                    className="rounded-lg bg-gray-200 px-6 py-2.5"
                  >
                    <Text className="font-bold text-gray-700">Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={submitEdit}
                    disabled={updateMutation.isPending}
                    className="rounded-lg px-6 py-2.5"
                    style={{ backgroundColor: config.accent }}
                  >
                    <Text className="font-bold text-white">
                      {updateMutation.isPending ? "Saving..." : "Save"}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
