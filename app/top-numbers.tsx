import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { formatDateDDMMYYYY } from "@/utils/date";
import Clipboard from "@react-native-clipboard/clipboard";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Calendar, ChevronDown, ChevronUp, Copy, Filter } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";

type InsightItem = {
  number: string;
  type: string;
  sub_type: string | null;
  total_count: number;
  total_amount: number;
  extra_count?: number;
};

type InsightsResponse = {
  results: InsightItem[];
  page: number;
  num_pages: number;
  total_items: number;
  grand_total_count: number;
  grand_total_amount: number;
};

type Dealer = {
  id: number;
  username: string;
};

type Draw = {
  id: number;
  name: string;
};

export default function TopNumbers() {
  const { user } = useAuthStore();
  const { selectedDraw } = useDrawStore();

  const [selectedTypes, setSelectedTypes] = useState<string[]>(["single_digit", "double_digit", "triple_digit"]);
  const [subType, setSubType] = useState<string>("");
  const [drawId, setDrawId] = useState<number | "">(
    selectedDraw?.id ?? ""
  );
  const [dealerId, setDealerId] = useState<number | "">("");
  const [excludedDealerIds, setExcludedDealerIds] = useState<number[]>([]);
  const [minCount, setMinCount] = useState<string>("");
  const [minCountSingle, setMinCountSingle] = useState<string>("");
  const [minCountDouble, setMinCountDouble] = useState<string>("");
  const [minCountTriple, setMinCountTriple] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [showToast, setShowToast] = useState(false);
  const toastOpacity = useMemo(() => new Animated.Value(0), []);
  
  // Date filter state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Exclude dealers expand/collapse
  const [excludeDealersExpanded, setExcludeDealersExpanded] = useState(false);

  // Selected items for copying
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());


  // Fetch dealers for filters / exclusion list
  const { data: dealers = [] as Dealer[] } = useQuery<Dealer[]>({
    queryKey: ["dealers"],
    queryFn: () => api.get("/administrator/dealer/").then((res) => res.data),
    enabled: user?.user_type === "ADMIN" || user?.user_type === "DEALER",
  });

  console.log("dealers", dealers.length);

  // Fetch draws for filter
  const { data: draws = [] as Draw[] } = useQuery<Draw[]>({
    queryKey: ["/draw/list/"],
    queryFn: () => api.get("/draw/list/").then((res) => res.data || []),
  });

  const buildParams = (forPage = true) => {
    const params: Record<string, any> = {};

    if (forPage) {
      params.page = page;
    }

    if (selectedTypes.length) params.type = selectedTypes.join(",");
    if (subType) params.sub_type = subType;
    if (drawId) params.draw = drawId;
    if (dealerId) params.dealer = dealerId;
    if (minCount) params.min_count = Number(minCount);
    if (minCountSingle) params.min_count_single_digit = Number(minCountSingle);
    if (minCountDouble) params.min_count_double_digit = Number(minCountDouble);
    if (minCountTriple) params.min_count_triple_digit = Number(minCountTriple);
    if (excludedDealerIds.length) {
      params.exclude_dealer = excludedDealerIds.join(",");
    }
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const day = String(selectedDate.getDate()).padStart(2, "0");
      params.date = `${year}-${month}-${day}`;
    }

    return params;
  };

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<InsightsResponse>({
    queryKey: ["/draw-booking/top-numbers/", buildParams()],
    queryFn: async () => {
      const res = await api.get("/draw-booking/top-numbers/", {
        params: buildParams(),
      });
      return res.data;
    },
  });

  console.log("data", data);

  const items = data?.results || [];

  const maxCount = useMemo(
    () => (items.length ? Math.max(...items.map((i) => i.total_count)) : 0),
    [items]
  );

  const maxAmount = useMemo(
    () => (items.length ? Math.max(...items.map((i) => i.total_amount)) : 0),
    [items]
  );

  const topByCount = useMemo(
    () =>
      [...items]
        .sort((a, b) => b.total_count - a.total_count)
        .slice(0, 5),
    [items]
  );

  const topByAmount = useMemo(
    () =>
      [...items]
        .sort((a, b) => b.total_amount - a.total_amount)
        .slice(0, 5),
    [items]
  );

  const toggleExcludedDealer = (id: number) => {
    setExcludedDealerIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
    setPage(1);

  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const resetFilters = () => {
    setSelectedTypes(["single_digit", "double_digit", "triple_digit"]);
    setSubType("");
    setDrawId(selectedDraw?.id ?? "");
    setDealerId("");
    setExcludedDealerIds([]);
    setMinCount("");
    setMinCountSingle("");
    setMinCountDouble("");
    setMinCountTriple("");
    setSelectedDate(null);
    setPage(1);

  };

  const formatCopyText = (item: InsightItem): string => {
    const { number, type, sub_type, total_count, extra_count } = item;
    
    // super = "number count"
    if (sub_type?.toUpperCase() === "SUPER") {
      return `${number} ${extra_count || total_count}`;
    }
    
    // 3digit number = "number count subtype"
    if (type === "triple_digit") {
      return `${number} ${extra_count || total_count} ${sub_type || ""}`.trim();
    }
    
    // other = "subtype number count"
    return `${sub_type || ""} ${number} ${extra_count || total_count}`.trim();
  };

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    
    // Fade in
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    
    // Fade out after 2 seconds
    setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowToast(false);
      });
    }, 2000);
  };

  const handleCopy = (item: InsightItem) => {
    const copyText = formatCopyText(item);
    Clipboard.setString(copyText);
    showToastMessage(`Copied: ${copyText}`);
  };

  const getItemKey = (item: InsightItem): string => {
    return `${item.number}-${item.sub_type}-${item.type}`;
  };

  const toggleItemSelection = (item: InsightItem) => {
    const key = getItemKey(item);
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const selectAllItems = () => {
    setSelectedItems(new Set(items.map((item) => getItemKey(item))));
  };

  const deselectAllItems = () => {
    setSelectedItems(new Set());
  };

  const handleCopySelected = () => {
    const itemsToCopy = items.filter((item) => selectedItems.has(getItemKey(item)));
    if (itemsToCopy.length === 0) {
      showToastMessage("No items selected");
      return;
    }
    const text = itemsToCopy.map((item) => formatCopyText(item)).join("\n");
    Clipboard.setString(text);
    showToastMessage(`Copied ${itemsToCopy.length} item${itemsToCopy.length > 1 ? "s" : ""}`);
  };

  const [copyLoading, setCopyLoading] = useState(false);

  const handleCopyAll = async () => {
    setCopyLoading(true);
    try {
      const res = await api.get("/draw-booking/top-numbers/all/", {
        params: buildParams(false),
      });
      const lines: string[] = res.data || [];

      if (lines.length === 0) {
        showToastMessage("No items to copy");
        return;
      }

      const text = lines.join("\n");
      Clipboard.setString(text);
      showToastMessage(`Copied ${lines.length} item${lines.length > 1 ? "s" : ""}`);
    } catch (err) {
      showToastMessage("Failed to copy");
    } finally {
      setCopyLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isFetching}
            onRefresh={onRefresh}
            colors={["#6366f1"]}
            tintColor="#6366f1"
          />
        }
      >
        {/* Header */}
        <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-xl font-extrabold text-gray-900">
              Top Numbers
            </Text>
            <Text className="text-xs text-gray-500 mt-1">
              Top numbers by count and amount
            </Text>
          </View>
          <View className="w-10 h-10 rounded-full bg-indigo-100 items-center justify-center">
            <BarChart3 size={20} color="#4f46e5" />
          </View>
        </View>

        {/* Filters */}
        <View className="mx-4 mt-3 mb-4 border border-gray-200 rounded-2xl p-3 bg-gray-50">
          <View className="flex-row items-center mb-2">
            <Filter size={16} color="#4b5563" />
            <Text className="ml-2 text-xs font-semibold text-gray-700">
              Filters
            </Text>
            <TouchableOpacity
              onPress={resetFilters}
              className="ml-auto px-2 py-1 rounded-full bg-white border border-gray-200"
              activeOpacity={0.7}
            >
              <Text className="text-[10px] font-semibold text-gray-600">
                Clear
              </Text>
            </TouchableOpacity>
          </View>

          {/* Game Type toggles with per-type min count */}
          <View className="mt-1">
            <Text className="text-[11px] text-gray-500 mb-1">
              Game Type &amp; Min Count
            </Text>
            {([
              { label: "Single", value: "single_digit" as string, min: minCountSingle, setMin: setMinCountSingle },
              { label: "Double", value: "double_digit" as string, min: minCountDouble, setMin: setMinCountDouble },
              { label: "Triple", value: "triple_digit" as string, min: minCountTriple, setMin: setMinCountTriple },
            ]).map((opt) => {
              const isActive = selectedTypes.includes(opt.value);
              return (
                <View key={opt.value} className="flex-row items-center gap-2 mb-2">
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedTypes((prev) =>
                        isActive
                          ? prev.filter((t) => t !== opt.value)
                          : [...prev, opt.value]
                      );
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-full border min-w-[70px] items-center ${
                      isActive
                        ? "bg-indigo-600 border-indigo-600"
                        : "bg-white border-gray-300"
                    }`}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-[11px] font-semibold ${
                        isActive ? "text-white" : "text-gray-700"
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                  {isActive && (
                    <TextInput
                      value={opt.min}
                      onChangeText={(txt) => {
                        opt.setMin(txt.replace(/[^0-9]/g, ""));
                        setPage(1);
                      }}
                      placeholder="Min count"
                      keyboardType="numeric"
                      style={{
                        flex: 1,
                        borderColor: "#d1d5db",
                        borderWidth: 1,
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: "#fff",
                        fontSize: 12,
                        color: "#111827",
                      }}
                      placeholderTextColor="#9ca3af"
                    />
                  )}
                </View>
              );
            })}
          </View>

          <View className="flex-row gap-3 mt-3">
            <View className="flex-1">
              <Text className="text-[11px] text-gray-500 mb-1">
                Sub Type
              </Text>
              <Dropdown
                data={[
                  { label: "A", value: "A" },
                  { label: "B", value: "B" },
                  { label: "C", value: "C" },
                  { label: "AB", value: "AB" },
                  { label: "BC", value: "BC" },
                  { label: "AC", value: "AC" },
                  { label: "SUPER", value: "SUPER" },
                  { label: "BOX", value: "BOX" },
                ]}
                labelField="label"
                valueField="value"
                value={subType}
                placeholder="All"
                onChange={(item: any) => {
                  setSubType(item.value);
                  setPage(1);

                }}
                renderRightIcon={() =>
                  subType ? (
                    <TouchableOpacity
                      onPress={() => {
                        setSubType("");
                        setPage(1);
      
                      }}
                      style={{
                        position: "absolute",
                        right: 10,
                        zIndex: 10,
                        backgroundColor: "#fff",
                        width: 24,
                        height: 24,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 12,
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: "#9ca3af", fontSize: 16 }}>✕</Text>
                    </TouchableOpacity>
                  ) : null
                }
                style={{
                  borderColor: "#d1d5db",
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  backgroundColor: "#fff",
                }}
                selectedTextStyle={{
                  color: "#111827",
                  fontSize: 12,
                }}
                itemTextStyle={{
                  color: "#111827",
                  fontSize: 12,
                }}
              />
            </View>
            <View className="flex-1">
              <Text className="text-[11px] text-gray-500 mb-1">
                Dealer
              </Text>
              <Dropdown
                data={dealers.map((d) => ({
                  label: d.username,
                  value: d.id,
                }))}
                labelField="label"
                valueField="value"
                value={dealerId}
                placeholder="All dealers"
                onChange={(item: any) => {
                  setDealerId(item.value);
                  setExcludedDealerIds([]);
                  setPage(1);

                }}
                renderRightIcon={() =>
                  dealerId ? (
                    <TouchableOpacity
                      onPress={() => {
                        setDealerId("");
                        setPage(1);
      
                      }}
                      style={{
                        position: "absolute",
                        right: 10,
                        zIndex: 10,
                        backgroundColor: "#fff",
                        width: 24,
                        height: 24,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 12,
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: "#9ca3af", fontSize: 16 }}>✕</Text>
                    </TouchableOpacity>
                  ) : null
                }
                style={{
                  borderColor: "#d1d5db",
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  backgroundColor: "#fff",
                }}
                selectedTextStyle={{
                  color: "#111827",
                  fontSize: 12,
                }}
                itemTextStyle={{
                  color: "#111827",
                  fontSize: 12,
                }}
              />
            </View>
          </View>

          {/* Row 3: Date / Min count */}
          <View className="flex-row gap-3 mt-3">
            <View className="flex-1">
              <Text className="text-[11px] text-gray-500 mb-1">Date</Text>
              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 flex-row justify-between items-center bg-white"
                  activeOpacity={0.7}
                >
                  <Text className="text-xs text-gray-700">
                    {selectedDate ? formatDateDDMMYYYY(selectedDate) : "Select date"}
                  </Text>
                  <Calendar size={14} color="#6366f1" />
                </TouchableOpacity>
                {selectedDate && (
                  <TouchableOpacity
                onPress={() => {
                  setSelectedDate(null);
                  setPage(1);

                }}
                    className="px-2 py-2 rounded-lg bg-red-50 border border-red-200"
                    activeOpacity={0.7}
                  >
                    <Text className="text-xs font-semibold text-red-600">✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View className="flex-1">
              <Text className="text-[11px] text-gray-500 mb-1">
                Min Count
              </Text>
              <TextInput
                value={minCount}
                onChangeText={(txt) => {
                  const clean = txt.replace(/[^0-9]/g, "");
                  setMinCount(clean);
                  setPage(1);

                }}
                placeholder="Global"
                keyboardType="numeric"
                style={{
                  borderColor: "#d1d5db",
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  backgroundColor: "#fff",
                  fontSize: 12,
                  color: "#111827",
                }}
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>


          {/* Row 4: Pagination */}
          <View className="mt-3">
            <Text className="text-[11px] text-gray-500 mb-1">Page</Text>
            <View className="flex-row items-center justify-between bg-white border border-gray-200 rounded-full px-2 py-1.5">
              <TouchableOpacity
                disabled={page <= 1}
                onPress={() => {
                  setPage((p) => Math.max(1, p - 1));

                }}
                className={`px-2 py-1 rounded-full ${
                  page <= 1 ? "bg-gray-100" : "bg-indigo-50"
                }`}
                activeOpacity={0.8}
              >
                <Text
                  className={`text-[11px] font-semibold ${
                    page <= 1 ? "text-gray-400" : "text-indigo-600"
                  }`}
                >
                  Prev
                </Text>
              </TouchableOpacity>
              <Text className="text-[11px] text-gray-600">
                {data?.page || page} / {data?.num_pages || "-"}
              </Text>
              <TouchableOpacity
                disabled={
                  !data?.num_pages || (data?.page || page) >= data.num_pages
                }
                onPress={() => {
                  setPage((p) =>
                    data?.num_pages ? Math.min(data.num_pages, p + 1) : p + 1
                  );

                }}
                className={`px-2 py-1 rounded-full ${
                  !data?.num_pages ||
                  (data?.page || page) >= (data?.num_pages || 0)
                    ? "bg-gray-100"
                    : "bg-indigo-50"
                }`}
                activeOpacity={0.8}
              >
                <Text
                  className={`text-[11px] font-semibold ${
                    !data?.num_pages ||
                    (data?.page || page) >= (data?.num_pages || 0)
                      ? "text-gray-400"
                      : "text-indigo-600"
                  }`}
                >
                  Next
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Exclude dealers - Collapsible */}
          {dealers.length > 0 && !dealerId && (
            <View className="mt-3">
              <TouchableOpacity
                onPress={() => setExcludeDealersExpanded(!excludeDealersExpanded)}
                className="flex-row items-center justify-between py-2"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center">
                  <Text className="text-[11px] font-semibold text-gray-700">
                    Exclude Dealers
                  </Text>
                  {excludedDealerIds.length > 0 && (
                    <View className="ml-2 px-2 py-0.5 bg-indigo-100 rounded-full">
                      <Text className="text-[10px] font-semibold text-indigo-700">
                        {excludedDealerIds.length}
                      </Text>
                    </View>
                  )}
                </View>
                {excludeDealersExpanded ? (
                  <ChevronUp size={16} color="#6b7280" />
                ) : (
                  <ChevronDown size={16} color="#6b7280" />
                )}
              </TouchableOpacity>

              {excludeDealersExpanded && (
                <View className="mt-2 border border-gray-200 rounded-xl bg-white overflow-hidden">
                  <ScrollView
                    style={{ maxHeight: 200 }}
                    contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                    scrollEnabled={true}
                  >
                    {dealers.map((d) => {
                      const checked = excludedDealerIds.includes(d.id);
                      return (
                        <TouchableOpacity
                          key={d.id}
                          className="flex-row items-center py-2 border-b border-gray-100 last:border-b-0"
                          activeOpacity={0.7}
                          onPress={() => toggleExcludedDealer(d.id)}
                        >
                          <View
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              borderWidth: 2,
                              borderColor: checked ? "#4f46e5" : "#d1d5db",
                              backgroundColor: checked ? "#4f46e5" : "#fff",
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 10,
                            }}
                          >
                            {checked && (
                              <Text
                                style={{
                                  color: "#fff",
                                  fontSize: 12,
                                  fontWeight: "700",
                                }}
                              >
                                ✓
                              </Text>
                            )}
                          </View>
                          <Text className="text-xs font-medium text-gray-800 flex-1">
                            {d.username}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {excludedDealerIds.length > 0 && (
                <Text className="mt-2 text-[10px] text-gray-500">
                  Excluding dealers:{" "}
                  <Text className="font-mono text-indigo-600">
                    {excludedDealerIds
                      .map((id) => dealers.find((d) => d.id === id)?.username ?? id)
                      .join(", ")}
                  </Text>
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Summary cards */}
        {isLoading ? (
          <View className="mt-10 items-center justify-center">
            <ActivityIndicator size="large" color="#4f46e5" />
          </View>
        ) : error ? (
          <View className="mt-10 mx-4 p-4 rounded-2xl bg-red-50 border border-red-200">
            <Text className="text-sm font-semibold text-red-700 mb-1">
              Failed to load insights
            </Text>
            {/* @ts-ignore */}
            <Text className="text-xs text-red-600">
              {error?.message || "Unknown error"}
            </Text>
            <TouchableOpacity
              onPress={() => refetch()}
              className="mt-3 self-start px-3 py-1.5 rounded-full bg-red-600"
              activeOpacity={0.8}
            >
              <Text className="text-xs font-semibold text-white">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View className="mx-4 flex-row gap-3">
              <View className="flex-1 bg-indigo-50 border border-indigo-100 rounded-2xl p-3">
                <Text className="text-[11px] text-indigo-700 mb-1">
                  Total Count
                </Text>
                <Text className="text-lg font-extrabold text-indigo-900">
                  {data?.grand_total_count ?? 0}
                </Text>
                <Text className="text-[10px] text-indigo-500 mt-1">
                  Across {data?.total_items ?? 0} numbers
                </Text>
              </View>
              <View className="flex-1 bg-emerald-50 border border-emerald-100 rounded-2xl p-3">
                <Text className="text-[11px] text-emerald-700 mb-1">
                  Total Amount
                </Text>
                <Text className="text-lg font-extrabold text-emerald-900">
                  ₹{data?.grand_total_amount ?? 0}
                </Text>
                <Text className="text-[10px] text-emerald-500 mt-1">
                  Sum of all filtered bookings
                </Text>
              </View>
            </View>

            {/* Charts */}
            <View className="mx-4 mt-4">
              <View className="bg-white border border-gray-200 rounded-2xl p-3 mb-3">
                <Text className="text-xs font-semibold text-gray-800 mb-2">
                  Top Numbers
                </Text>
                {topByCount.length === 0 ? (
                  <Text className="text-[11px] text-gray-500">
                    No data for selected filters.
                  </Text>
                ) : (
                  topByCount.map((item) => (
                    <View key={`${item.number}-${item.sub_type}-count`} className="mb-2">
                      <View className="flex-row justify-between mb-1">
                        <Text className="text-[11px] text-gray-700">
                          #{item.number}
                          {item.sub_type ? ` (${item.sub_type})` : ""}
                        </Text>
                        <Text className="text-[11px] font-semibold text-gray-900">
                          {item.total_count} {item?.extra_count && (item?.extra_count)}
                        </Text>
                      </View>
                      <View className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <View
                          className="h-3 rounded-full bg-indigo-500"
                          style={{
                            width: `${
                              maxCount
                                ? Math.max(
                                    6,
                                    (item.total_count / maxCount) * 100
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </View>
                    </View>
                  ))
                )}
              </View>
{/* 
              <View className="bg-white border border-gray-200 rounded-2xl p-3">
                <Text className="text-xs font-semibold text-gray-800 mb-2">
                  Top Numbers by Amount
                </Text>
                {topByAmount.length === 0 ? (
                  <Text className="text-[11px] text-gray-500">
                    No data for selected filters.
                  </Text>
                ) : (
                  topByAmount.map((item) => (
                    <View key={`${item.number}-${item.sub_type}-amount`} className="mb-2">
                      <View className="flex-row justify-between mb-1">
                        <Text className="text-[11px] text-gray-700">
                          #{item.number}
                          {item.sub_type ? ` (${item.sub_type})` : ""}
                        </Text>
                        <Text className="text-[11px] font-semibold text-gray-900">
                          ₹{item.total_amount}
                        </Text>
                      </View>
                      <View className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <View
                          className="h-3 rounded-full bg-emerald-500"
                          style={{
                            width: `${
                              maxAmount
                                ? Math.max(
                                    6,
                                    (item.total_amount / maxAmount) * 100
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </View>
                    </View>
                  ))
                )}
              </View> */}
            </View>

            {/* Numbers table */}
            <View className="mx-4 mt-4 mb-6 bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <View className="flex-row items-center justify-between bg-gray-50 border-b border-gray-200 py-2 px-3">
                <View className="flex-row flex-1">
                  <Text className="flex-1 text-[11px] font-semibold text-gray-700">
                    Number
                  </Text>
                  <Text className="w-14 text-[11px] font-semibold text-right text-gray-700">
                    {/* Count */}
                  </Text>
                  <Text className="w-18 text-[11px] font-semibold text-right text-gray-700">
                    {/* Amount */}
                  </Text>
                  <View className="w-10" />
                </View>
                {items.length > 0 && (
                  <View className="flex-row items-center gap-2 ml-2">
                    {selectedItems.size > 0 ? (
                      <TouchableOpacity
                        onPress={deselectAllItems}
                        className="px-2 py-1.5 rounded-full bg-gray-200 active:bg-gray-300"
                        activeOpacity={0.8}
                      >
                        <Text className="text-[10px] font-semibold text-gray-700">
                          Clear ({selectedItems.size})
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={selectAllItems}
                        className="px-2 py-1.5 rounded-full bg-gray-200 active:bg-gray-300"
                        activeOpacity={0.8}
                      >
                        <Text className="text-[10px] font-semibold text-gray-700">
                          Select All
                        </Text>
                      </TouchableOpacity>
                    )}
                    {selectedItems.size > 0 && (
                      <TouchableOpacity
                        onPress={handleCopySelected}
                        className="flex-row items-center px-3 py-1.5 rounded-full bg-emerald-600 active:bg-emerald-700"
                        activeOpacity={0.8}
                      >
                        <Copy size={12} color="#fff" />
                        <Text className="ml-1.5 text-[11px] font-semibold text-white">
                          Copy ({selectedItems.size})
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={handleCopyAll}
                      disabled={copyLoading}
                      className="flex-row items-center px-3 py-1.5 rounded-full bg-indigo-600 active:bg-indigo-700"
                      activeOpacity={0.8}
                      style={copyLoading ? { opacity: 0.7 } : undefined}
                    >
                      {copyLoading ? (
                        <ActivityIndicator size={12} color="#fff" />
                      ) : (
                        <Copy size={12} color="#fff" />
                      )}
                      <Text className="ml-1.5 text-[11px] font-semibold text-white">
                        {copyLoading ? "Copying..." : "Copy All"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {items.length === 0 ? (
                <View className="py-6 px-3 items-center">
                  <Text className="text-xs text-gray-500">
                    No results for selected filters.
                  </Text>
                </View>
              ) : (
                items.map((item) => {
                  const itemKey = getItemKey(item);
                  const isSelected = selectedItems.has(itemKey);
                  return (
                    <TouchableOpacity
                      key={itemKey}
                      onPress={() => toggleItemSelection(item)}
                      onLongPress={() => handleCopy(item)}
                      className="flex-row items-center py-2 px-3 border-b border-gray-100 active:bg-gray-50"
                      activeOpacity={0.7}
                    >
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: isSelected ? "#4f46e5" : "#d1d5db",
                          backgroundColor: isSelected ? "#4f46e5" : "#fff",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                        }}
                      >
                        {isSelected && (
                          <Text
                            style={{
                              color: "#fff",
                              fontSize: 12,
                              fontWeight: "700",
                            }}
                          >
                            ✓
                          </Text>
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-gray-900">
                          #{item.number}
                        </Text>
                        <Text className="text-[10px] text-gray-500">
                          {item.type}
                          {item.sub_type ? ` • ${item.sub_type}` : ""}
                        </Text>
                      </View>
                      {item?.extra_count &&
                        <Text className="w-14 text-[11px] text-right text-gray-800 ">
                          ({item?.extra_count})
                        </Text>
                      }
                      <Text className="w-14 text-[11px] text-right text-gray-800 ">
                      {item.total_count} &nbsp; &nbsp; &nbsp; &nbsp;
                      </Text>

                      <Text className="w-18 text-[11px] text-right text-gray-800">
                        ₹{item.total_amount} &nbsp;
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}

              {!!data?.num_pages && data.num_pages > 1 && (
                <View className="flex-row items-center justify-between px-3 py-2 bg-gray-50">
                  <TouchableOpacity
                    disabled={page <= 1}
                    onPress={() => {
                      setPage((p) => Math.max(1, p - 1));
    
                    }}
                    className={`px-3 py-1.5 rounded-full ${
                      page <= 1 ? "bg-gray-100" : "bg-white border border-gray-300"
                    }`}
                    activeOpacity={0.8}
                  >
                    <Text
                      className={`text-[11px] font-semibold ${
                        page <= 1 ? "text-gray-400" : "text-gray-700"
                      }`}
                    >
                      Previous
                    </Text>
                  </TouchableOpacity>
                  <Text className="text-[11px] text-gray-600">
                    Page {data.page} of {data.num_pages}
                  </Text>
                  <TouchableOpacity
                    disabled={data.page >= data.num_pages}
                    onPress={() => {
                      setPage((p) =>
                        data?.num_pages ? Math.min(data.num_pages, p + 1) : p + 1
                      );
    
                    }}
                    className={`px-3 py-1.5 rounded-full ${
                      data.page >= data.num_pages
                        ? "bg-gray-100"
                        : "bg-white border border-gray-300"
                    }`}
                    activeOpacity={0.8}
                  >
                    <Text
                      className={`text-[11px] font-semibold ${
                        data.page >= data.num_pages
                          ? "text-gray-400"
                          : "text-gray-700"
                      }`}
                    >
                      Next
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Toast Notification */}
      {showToast && (
        <Animated.View
          style={{
            position: "absolute",
            bottom: 100,
            left: 20,
            right: 20,
            zIndex: 1000,
            opacity: toastOpacity,
          }}
          className="bg-gray-900 rounded-xl px-4 py-3 shadow-lg"
        >
          <Text className="text-white text-sm font-semibold text-center">
            {toastMessage}
          </Text>
        </Animated.View>
      )}

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          display={Platform.OS === "android" ? "default" : "spinner"}
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (event.type === "set" && date) {
              setSelectedDate(date);
              setPage(1);
          
            }
          }}
        />
      )}
    </View>
  );
}

