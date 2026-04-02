import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { formatDateDDMMYYYY } from "@/utils/date";
import Clipboard from "@react-native-clipboard/clipboard";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { BarChart3, Calendar, ChevronDown, ChevronUp, Clock, Copy, Filter } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
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
  count_before?: number;
  count_after?: number;
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
  const [selectedSubTypes, setSelectedSubTypes] = useState<Record<string, string[]>>({
    single_digit: ["A", "B", "C"],
    double_digit: ["AB", "BC", "AC"],
  });
  const [drawId, setDrawId] = useState<number | "">(
    selectedDraw?.id ?? ""
  );
  const [dealerId, setDealerId] = useState<number | "">("");
  const [excludedDealerIds, setExcludedDealerIds] = useState<number[]>([]);
  const [minCount, setMinCount] = useState<string>("");
  const [minCountSingle, setMinCountSingle] = useState<string>("");
  const [minCountDouble, setMinCountDouble] = useState<string>("");
  const [minCountSuper, setMinCountSuper] = useState<string>("");
  const [minCountBox, setMinCountBox] = useState<string>("");
  const [superActive, setSuperActive] = useState(true);
  const [boxActive, setBoxActive] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [showToast, setShowToast] = useState(false);
  const toastOpacity = useMemo(() => new Animated.Value(0), []);

  // Date filter state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Time filter state
  const [fromTime, setFromTime] = useState<string>("");
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Exclude dealers expand/collapse
  const [excludeDealersExpanded, setExcludeDealersExpanded] = useState(false);

  // Top numbers chart collapse
  const [topNumbersExpanded, setTopNumbersExpanded] = useState(false);

  // Selected items for copying
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());


  // Fetch dealers for filters / exclusion list
  const { data: dealers = [] as Dealer[] } = useQuery<Dealer[]>({
    queryKey: ["dealers"],
    queryFn: () => api.get("/administrator/dealer/").then((res) => res.data),
    enabled: user?.user_type === "ADMIN" || user?.user_type === "DEALER",
  });


  // Fetch draws for filter
  const { data: draws = [] as Draw[] } = useQuery<Draw[]>({
    queryKey: ["/draw/list/"],
    queryFn: () => api.get("/draw/list/").then((res) => res.data || []),
  });

  const buildParams = (pageNum?: number) => {
    const params: Record<string, any> = {};

    if (pageNum) {
      params.page = pageNum;
    }

    // Only include triple_digit if super or box is active
    const types = (superActive || boxActive)
      ? selectedTypes
      : selectedTypes.filter((t) => t !== "triple_digit");
    if (types.length) params.type = types.join(",");
    const allSubTypes = types.flatMap((t) => selectedSubTypes[t] || []);
    if (types.includes("triple_digit")) {
      if (superActive) allSubTypes.push("SUPER");
      if (boxActive) allSubTypes.push("BOX");
    }
    if (allSubTypes.length) params.sub_type = allSubTypes.join(",");
    if (drawId) params.draw = drawId;
    if (dealerId) params.dealer = dealerId;
    if (minCount) params.min_count = Number(minCount);
    if (minCountSingle) params.min_count_single_digit = Number(minCountSingle);
    if (minCountDouble) params.min_count_double_digit = Number(minCountDouble);
    if (superActive && minCountSuper) params.min_count_super = Number(minCountSuper);
    if (boxActive && minCountBox) params.min_count_box = Number(minCountBox);
    if (excludedDealerIds.length) {
      params.exclude_dealer = excludedDealerIds.join(",");
    }
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const day = String(selectedDate.getDate()).padStart(2, "0");
      params.date = `${year}-${month}-${day}`;
    }
    if (fromTime) {
      params.time = fromTime;
    }

    console.log("top-numbers params", params);


    return params;
  };

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery<InsightsResponse>({
    queryKey: ["/draw-booking/top-numbers/", buildParams()],
    queryFn: async ({ pageParam = 1 }) => {
      const params = buildParams(pageParam as number);
      const res = await api.get("/draw-booking/top-numbers/", { params });
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.num_pages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
  });

  const lastPage = data?.pages?.[data.pages.length - 1];
  const items = useMemo(
    () => data?.pages?.flatMap((p) => p.results) || [],
    [data]
  );

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


  };

  const handleScroll = useCallback(
    (e: any) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
      if (distanceFromBottom < 200 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

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
    setSelectedSubTypes({ single_digit: ["A", "B", "C"], double_digit: ["AB", "BC", "AC"] });
    setDrawId(selectedDraw?.id ?? "");
    setDealerId("");
    setExcludedDealerIds([]);
    setMinCount("");
    setMinCountSingle("");
    setMinCountDouble("");
    setMinCountSuper("");
    setMinCountBox("");
    setSuperActive(true);
    setBoxActive(true);
    setSelectedDate(null);
    setFromTime("");


  };

  const formatCopyText = (item: InsightItem): string => {
    const { number, type, sub_type, total_count, extra_count, count_before, count_after } = item;
    const count = extra_count || total_count;
    const timeSuffix = count_before != null ? ` (${count_before}|${count_after})` : "";

    // super = "number count"
    if (sub_type?.toUpperCase() === "SUPER") {
      return `${number} ${count}${timeSuffix}`;
    }

    // 3digit number = "number count subtype"
    if (type === "triple_digit") {
      return `${number} ${count} ${sub_type || ""}${timeSuffix}`.trim();
    }

    // other = "subtype number count"
    return `${sub_type || ""} ${number} ${count}${timeSuffix}`.trim();
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
  const [copyAfterLoading, setCopyAfterLoading] = useState(false);

  const handleCopyAll = async () => {
    setCopyLoading(true);
    try {
      const res = await api.get("/draw-booking/top-numbers/all/", {
        params: buildParams(),
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

  const handleCopyAfter = async () => {
    setCopyAfterLoading(true);
    try {
      const res = await api.get("/draw-booking/top-numbers/all-after/", {
        params: buildParams(),
      });
      const lines: string[] = res.data || [];

      if (lines.length === 0) {
        showToastMessage("No after-time items to copy");
        return;
      }

      const text = lines.join("\n");
      Clipboard.setString(text);
      showToastMessage(`Copied ${lines.length} after-time item${lines.length > 1 ? "s" : ""}`);
    } catch (err) {
      showToastMessage("Failed to copy");
    } finally {
      setCopyAfterLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        onScroll={handleScroll}
        scrollEventThrottle={400}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || (isFetching && !isFetchingNextPage)}
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
              Game Type, Min Count &amp; Sub Type
            </Text>
            {([
              { label: "Single", value: "single_digit" as string, min: minCountSingle, setMin: setMinCountSingle, subTypes: ["A", "B", "C"] },
              { label: "Double", value: "double_digit" as string, min: minCountDouble, setMin: setMinCountDouble, subTypes: ["AB", "BC", "AC"] },
            ]).map((opt) => {
              const isActive = selectedTypes.includes(opt.value);
              const activeSubTypes = selectedSubTypes[opt.value] || [];
              return (
                <View key={opt.value} className="mb-2">
                  <View className="flex-row items-center gap-1.5">
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedTypes((prev) =>
                          isActive
                            ? prev.filter((t) => t !== opt.value)
                            : [...prev, opt.value]
                        );

                      }}
                      style={{ width: 60 }}
                      className={`py-1.5 rounded-full border items-center ${isActive
                        ? "bg-indigo-600 border-indigo-600"
                        : "bg-white border-gray-300"
                        }`}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-[11px] font-semibold ${isActive ? "text-white" : "text-gray-700"
                          }`}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                    {isActive && opt.subTypes.map((st) => {
                      const isSubActive = activeSubTypes.includes(st);
                      return (
                        <TouchableOpacity
                          key={st}
                          onPress={() => {
                            setSelectedSubTypes((prev) => ({
                              ...prev,
                              [opt.value]: isSubActive
                                ? prev[opt.value].filter((s) => s !== st)
                                : [...(prev[opt.value] || []), st],
                            }));

                          }}
                          className={`px-2 py-1 rounded-full border ${isSubActive
                            ? "bg-indigo-100 border-indigo-400"
                            : "bg-white border-gray-200"
                            }`}
                          activeOpacity={0.7}
                        >
                          <Text
                            className={`text-[10px] font-semibold ${isSubActive ? "text-indigo-700" : "text-gray-500"
                              }`}
                          >
                            {st}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    {isActive && (
                      <TextInput
                        value={opt.min}
                        onChangeText={(txt) => {
                          opt.setMin(txt.replace(/[^0-9]/g, ""));

                        }}
                        placeholder="Min"
                        keyboardType="numeric"
                        style={{
                          flex: 1,
                          borderColor: "#d1d5db",
                          borderWidth: 1,
                          borderRadius: 8,
                          paddingHorizontal: 6,
                          paddingVertical: 4,
                          backgroundColor: "#fff",
                          fontSize: 11,
                          color: "#111827",
                          textAlign: "center",
                        }}
                        placeholderTextColor="#9ca3af"
                      />
                    )}
                  </View>
                </View>
              );
            })}

            {/* Super */}
            <View className="mb-2">
              <View className="flex-row items-center gap-1.5">
                <TouchableOpacity
                  onPress={() => {
                    setSuperActive((prev) => !prev);

                  }}
                  style={{ width: 60 }}
                  className={`py-1.5 rounded-full border items-center ${superActive
                    ? "bg-indigo-600 border-indigo-600"
                    : "bg-white border-gray-300"
                    }`}
                  activeOpacity={0.7}
                >
                  <Text className={`text-[11px] font-semibold ${superActive ? "text-white" : "text-gray-700"}`}>Super</Text>
                </TouchableOpacity>
                {superActive && (
                  <TextInput
                    value={minCountSuper}
                    onChangeText={(txt) => {
                      setMinCountSuper(txt.replace(/[^0-9]/g, ""));

                    }}
                    placeholder="Min"
                    keyboardType="numeric"
                    style={{
                      flex: 1,
                      borderColor: "#d1d5db",
                      borderWidth: 1,
                      borderRadius: 8,
                      paddingHorizontal: 6,
                      paddingVertical: 4,
                      backgroundColor: "#fff",
                      fontSize: 11,
                      color: "#111827",
                      textAlign: "center",
                    }}
                    placeholderTextColor="#9ca3af"
                  />
                )}
              </View>
            </View>

            {/* Box */}
            <View className="mb-2">
              <View className="flex-row items-center gap-1.5">
                <TouchableOpacity
                  onPress={() => {
                    setBoxActive((prev) => !prev);

                  }}
                  style={{ width: 60 }}
                  className={`py-1.5 rounded-full border items-center ${boxActive
                    ? "bg-indigo-600 border-indigo-600"
                    : "bg-white border-gray-300"
                    }`}
                  activeOpacity={0.7}
                >
                  <Text className={`text-[11px] font-semibold ${boxActive ? "text-white" : "text-gray-700"}`}>Box</Text>
                </TouchableOpacity>
                {boxActive && (
                  <TextInput
                    value={minCountBox}
                    onChangeText={(txt) => {
                      setMinCountBox(txt.replace(/[^0-9]/g, ""));

                    }}
                    placeholder="Min"
                    keyboardType="numeric"
                    style={{
                      flex: 1,
                      borderColor: "#d1d5db",
                      borderWidth: 1,
                      borderRadius: 8,
                      paddingHorizontal: 6,
                      paddingVertical: 4,
                      backgroundColor: "#fff",
                      fontSize: 11,
                      color: "#111827",
                      textAlign: "center",
                    }}
                    placeholderTextColor="#9ca3af"
                  />
                )}
              </View>
            </View>
          </View>

          <View className="flex-row gap-3 mt-3">
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


                }}
                renderRightIcon={() =>
                  dealerId ? (
                    <TouchableOpacity
                      onPress={() => {
                        setDealerId("");


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
              <Text className="text-[11px] text-gray-500 mb-1">From Time</Text>
              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  onPress={() => setShowTimePicker(true)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 flex-row justify-between items-center bg-white"
                  activeOpacity={0.7}
                >
                  <Text className="text-xs text-gray-700">
                    {fromTime || "Select time"}
                  </Text>
                  <Clock size={14} color="#6366f1" />
                </TouchableOpacity>
                {fromTime !== "" && (
                  <TouchableOpacity
                    onPress={() => {
                      setFromTime("");

                    }}
                    className="px-2 py-2 rounded-lg bg-red-50 border border-red-200"
                    activeOpacity={0.7}
                  >
                    <Text className="text-xs font-semibold text-red-600">✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Row: Min count */}
          <View className="flex-row gap-3 mt-3">
            <View className="flex-1">
              <Text className="text-[11px] text-gray-500 mb-1">
                Min Count
              </Text>
              <TextInput
                value={minCount}
                onChangeText={(txt) => {
                  const clean = txt.replace(/[^0-9]/g, "");
                  setMinCount(clean);


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
                  {lastPage?.grand_total_count ?? 0}
                </Text>
                <Text className="text-[10px] text-indigo-500 mt-1">
                  Across {lastPage?.total_items ?? 0} numbers
                </Text>
              </View>
              <View className="flex-1 bg-emerald-50 border border-emerald-100 rounded-2xl p-3">
                <Text className="text-[11px] text-emerald-700 mb-1">
                  Total Amount
                </Text>
                <Text className="text-lg font-extrabold text-emerald-900">
                  ₹{lastPage?.grand_total_amount ?? 0}
                </Text>
                <Text className="text-[10px] text-emerald-500 mt-1">
                  Sum of all filtered bookings
                </Text>
              </View>
            </View>

            {/* Charts */}
            <View className="mx-4 mt-4">
              <View className="bg-white border border-gray-200 rounded-2xl mb-3 overflow-hidden">
                <TouchableOpacity
                  onPress={() => setTopNumbersExpanded(!topNumbersExpanded)}
                  className="flex-row items-center justify-between p-3"
                  activeOpacity={0.7}
                >
                  <Text className="text-xs font-semibold text-gray-800">
                    Top Numbers
                  </Text>
                  {topNumbersExpanded ? (
                    <ChevronUp size={16} color="#6b7280" />
                  ) : (
                    <ChevronDown size={16} color="#6b7280" />
                  )}
                </TouchableOpacity>
                {topNumbersExpanded && (
                  <View className="px-3 pb-3">
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
                              {item.count_before != null
                                ? `${item.count_before} | ${item.count_after} (${item.total_count})`
                                : item.total_count}{" "}
                              {item?.extra_count != null && item?.extra_count}
                            </Text>
                          </View>
                          <View className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <View
                              className="h-3 rounded-full bg-indigo-500"
                              style={{
                                width: `${maxCount
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
              {/* Action buttons row */}
              {items.length > 0 && (
                <View className="flex-row items-center justify-end gap-2 bg-gray-50 border-b border-gray-200 py-2 px-3">
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
                  {fromTime ? (
                    <TouchableOpacity
                      onPress={handleCopyAfter}
                      disabled={copyAfterLoading}
                      className="flex-row items-center px-3 py-1.5 rounded-full bg-green-600 active:bg-green-700"
                      activeOpacity={0.8}
                      style={copyAfterLoading ? { opacity: 0.7 } : undefined}
                    >
                      {copyAfterLoading ? (
                        <ActivityIndicator size={12} color="#fff" />
                      ) : (
                        <Copy size={12} color="#fff" />
                      )}
                      <Text className="ml-1.5 text-[11px] font-semibold text-white">
                        {copyAfterLoading ? "Copying..." : "Copy After"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}

              {/* Column headings row */}
              <View className="flex-row items-center bg-gray-50 border-b border-gray-200 py-2 px-3">
                <View className="w-8" />
                <Text className="flex-1 text-[11px] font-semibold text-gray-700">
                  Number
                </Text>
                {fromTime ? (
                  <>
                    <Text className="w-14 text-[11px] font-semibold text-right text-orange-600">
                      Before
                    </Text>
                    <Text className="w-14 text-[11px] font-semibold text-right text-green-700">
                      After
                    </Text>
                    <Text className="w-14 text-[11px] font-semibold text-right text-gray-700">
                      Total
                    </Text>
                  </>
                ) : (
                  <Text className="w-14 text-[11px] font-semibold text-right text-gray-700">
                    Count
                  </Text>
                )}
                <Text className="w-18 text-[11px] font-semibold text-right text-gray-700">
                  Amount
                </Text>
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
                      {item?.extra_count != null &&
                        <Text className="w-14 text-[11px] text-right text-gray-800 ">
                          ({item?.extra_count})
                        </Text>
                      }
                      {item.count_before != null ? (
                        <>
                          <Text className="w-14 text-[11px] text-right text-orange-600">
                            {item.count_before} &nbsp;
                          </Text>
                          <Text className="w-14 text-[11px] text-right text-green-700 font-semibold">
                            {item.count_after} &nbsp;
                          </Text>
                          <Text className="w-14 text-[11px] text-right text-gray-800">
                            {item.total_count} &nbsp;
                          </Text>
                        </>
                      ) : (
                        <Text className="w-14 text-[11px] text-right text-gray-800 ">
                          {item.total_count} &nbsp; &nbsp; &nbsp; &nbsp;
                        </Text>
                      )}

                      <Text className="w-18 text-[11px] text-right text-gray-800">
                        ₹{item.total_amount} &nbsp;
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}

              {/* Loading more indicator */}
              {isFetchingNextPage && (
                <View className="py-3 items-center">
                  <ActivityIndicator size="small" color="#4f46e5" />
                  <Text className="text-[10px] text-gray-500 mt-1">Loading more...</Text>
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


            }
          }}
        />
      )}

      {/* Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={(() => {
            if (fromTime) {
              const [h, m] = fromTime.split(":").map(Number);
              const d = new Date();
              d.setHours(h, m, 0, 0);
              return d;
            }
            return new Date();
          })()}
          mode="time"
          is24Hour={true}
          display={Platform.OS === "android" ? "default" : "spinner"}
          onChange={(event, date) => {
            setShowTimePicker(false);
            if (event.type === "set" && date) {
              const hours = String(date.getHours()).padStart(2, "0");
              const minutes = String(date.getMinutes()).padStart(2, "0");
              setFromTime(`${hours}:${minutes}`);

            }
          }}
        />
      )}
    </View>
  );
}

