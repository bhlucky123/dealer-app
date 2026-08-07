import { useAuthStore } from "@/store/auth";
import { amountHandler } from "@/utils/amount";
import api from "@/utils/axios";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Hash,
  Search,
  ShieldAlert,
  Ticket,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const PAGE_SIZE = 30;

type DeletedNumber = {
  number: string;
  count: number;
  amount: number;
  type: string | null;
  sub_type: string | null;
};

type DeletionLog = {
  id: number;
  deletion_type: "booking" | "number";
  booking_id: number;
  booking_detail_id: number | null;
  deleted_by: number | null;
  deleted_by_username: string | null;
  deleted_by_name: string | null;
  deleted_by_user_type: string | null;
  deleted_by_display: string | null;
  booked_by_display: string | null;
  vendor_name: string | null;
  dealer_name: string | null;
  agent_name: string | null;
  customer_name: string | null;
  draw_name: string | null;
  session_date: string | null;
  booked_at: string | null;
  total_amount: number;
  total_count: number;
  numbers: DeletedNumber[];
  is_after_cutoff: boolean;
  transfer_status: string | null;
  deleted_at: string;
};

type LogPage = {
  count: number;
  next: string | null;
  previous: string | null;
  results: DeletionLog[];
  summary?: {
    total_deletions: number;
    total_amount: number;
    total_count: number;
  };
};

type RangeKey = "all" | "today" | "7d" | "30d" | "custom";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "custom", label: "Custom" },
];

const TYPE_TABS: { key: "" | "booking" | "number"; label: string }[] = [
  { key: "", label: "All" },
  { key: "booking", label: "Full Bookings" },
  { key: "number", label: "Numbers" },
];

/** yyyy-mm-dd in the device's local calendar (the API filters on IST dates). */
function toApiDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/** Short DD/MM/YY — matches the sales report row. */
function formatShortDate(date?: Date | null) {
  if (!date || isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function formatTime(date?: Date | null) {
  if (!date || isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
  return `${date}, ${formatTime(d)}`;
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SummaryTile({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-lg font-bold" style={{ color }}>
        {value}
      </Text>
      <Text className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mt-0.5">
        {label}
      </Text>
    </View>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-1/2 mb-2 pr-2">
      <Text className="text-[9px] font-semibold uppercase text-gray-400">
        {label}
      </Text>
      <Text className="text-gray-700 text-xs font-medium" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** The numbers that were removed, laid out like the booking-details table. */
function DeletedNumbers({ log }: { log: DeletionLog }) {
  const numbers = log.numbers ?? [];
  return (
    <View className="bg-indigo-50/40 border-b border-gray-200 px-3 py-3">
      <View className="flex-row flex-wrap">
        <MetaCell label="Draw" value={log.draw_name || "—"} />
        <MetaCell label="Session date" value={fmtDate(log.session_date)} />
        <MetaCell label="Booked by" value={log.booked_by_display || "—"} />
        <MetaCell label="Customer" value={log.customer_name || "—"} />
        <MetaCell label="Booked at" value={fmtDateTime(log.booked_at) || "—"} />
      </View>

      <Text className="text-[10px] font-semibold uppercase text-gray-400 mb-1 mt-1">
        Deleted numbers ({numbers.length})
      </Text>

      {numbers.length ? (
        <View className="rounded-xl bg-white border border-gray-200 overflow-hidden">
          <View className="flex-row bg-gray-100/80 border-b border-gray-200 px-3 py-2">
            <Text className="flex-1 text-[10px] font-semibold text-center text-gray-500 uppercase">
              Number
            </Text>
            <Text className="flex-1 text-[10px] font-semibold text-center text-gray-500 uppercase">
              Type
            </Text>
            <Text className="flex-[0.6] text-[10px] font-semibold text-center text-gray-500 uppercase">
              Cnt
            </Text>
            <Text className="flex-1 text-[10px] font-semibold text-right text-gray-500 uppercase">
              Amt
            </Text>
          </View>
          {numbers.map((row, index) => (
            <View
              key={`${log.id}-${row.number}-${index}`}
              className={`flex-row items-center px-3 py-2 border-b border-gray-100 ${
                index % 2 === 0 ? "bg-white" : "bg-gray-50"
              }`}
            >
              <Text className="flex-1 text-sm text-center text-emerald-700 font-bold tracking-wider">
                {row.number}
              </Text>
              <View className="flex-1 items-center">
                <Text className="text-[11px] text-violet-700 font-semibold">
                  {row.sub_type || "—"}
                </Text>
                {row.type ? (
                  <Text className="text-[9px] text-gray-500">
                    {row.type.replace(/_/g, " ")}
                  </Text>
                ) : null}
              </View>
              <Text className="flex-[0.6] text-xs text-center text-gray-700">
                {row.count}
              </Text>
              <Text className="flex-1 text-xs text-right text-violet-700 font-bold">
                ₹{amountHandler(Number(row.amount || 0))}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-gray-400 text-xs">No number snapshot</Text>
      )}
    </View>
  );
}

const DeletionRow = React.memo(
  ({
    log,
    index,
    expanded,
    onToggle,
  }: {
    log: DeletionLog;
    index: number;
    expanded: boolean;
    onToggle: (id: number) => void;
  }) => {
    const isFullBooking = log.deletion_type === "booking";
    const deletedAt = new Date(log.deleted_at);

    return (
      <View className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => onToggle(log.id)}>
          <View className="flex-row px-3 py-3 items-center border-b border-gray-100">
            <View className="flex-[1.1] justify-center">
              <Text className="text-[10px] text-gray-800 font-medium">
                {formatShortDate(deletedAt)}
              </Text>
              <Text className="text-[9px] text-gray-500 mt-0.5">
                {formatTime(deletedAt)}
              </Text>
            </View>

            <View className="flex-[1.3] px-1">
              <Text
                className="text-xs text-center text-gray-800 font-semibold"
                numberOfLines={1}
              >
                {log.deleted_by_name ||
                  log.deleted_by_username ||
                  "Unknown user"}
              </Text>
              {log.deleted_by_user_type ? (
                <Text
                  className="text-[10px] text-center text-violet-700"
                  numberOfLines={1}
                >
                  {log.deleted_by_user_type}
                </Text>
              ) : null}
              {log.booked_by_display ? (
                <Text
                  className="text-[10px] text-center text-emerald-700"
                  numberOfLines={1}
                >
                  {log.booked_by_display}
                </Text>
              ) : null}
            </View>

            <View className="flex-1 items-center">
              <Text className="text-xs text-gray-700">#{log.booking_id}</Text>
              <Text
                className={`text-[9px] font-bold uppercase ${
                  isFullBooking ? "text-red-500" : "text-orange-500"
                }`}
              >
                {isFullBooking ? "Full" : "1 no."}
              </Text>
              {log.is_after_cutoff ? (
                <Text className="text-[9px] font-bold text-amber-600">
                  LATE
                </Text>
              ) : null}
            </View>

            <Text className="flex-[0.6] text-xs text-center text-gray-700">
              {log.total_count}
            </Text>
            <Text className="flex-1 text-xs text-right text-emerald-700 font-semibold">
              ₹{amountHandler(log.total_amount || 0)}
            </Text>

            <View className="w-5 items-end">
              {expanded ? (
                <ChevronUp size={14} color="#9CA3AF" />
              ) : (
                <ChevronDown size={14} color="#9CA3AF" />
              )}
            </View>
          </View>
        </TouchableOpacity>

        {expanded ? <DeletedNumbers log={log} /> : null}
      </View>
    );
  }
);
DeletionRow.displayName = "DeletionRow";

export default function BookingDeletionsScreen() {
  const { user } = useAuthStore();
  const params = useLocalSearchParams<{ draw?: string }>();
  const isAdmin = user?.user_type === "ADMIN";

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [drawId, setDrawId] = useState<number | null>(
    params.draw ? Number(params.draw) : null
  );
  const [drawPickerOpen, setDrawPickerOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"" | "booking" | "number">("");
  const [range, setRange] = useState<RangeKey>("all");
  const [fromDate, setFromDate] = useState<Date>(daysAgo(7));
  const [toDate, setToDate] = useState<Date>(new Date());
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: draws = [] } = useQuery<any[]>({
    queryKey: ["/draw/list/"],
    queryFn: () => api.get("/draw/list/").then((r) => r.data),
    enabled: isAdmin,
  });

  const dateParams = useMemo(() => {
    if (range === "all") return {};
    if (range === "today") return { deleted_at__gte: toApiDate(new Date()) };
    if (range === "7d") return { deleted_at__gte: toApiDate(daysAgo(7)) };
    if (range === "30d") return { deleted_at__gte: toApiDate(daysAgo(30)) };
    return {
      deleted_at__gte: toApiDate(fromDate),
      deleted_at__lte: toApiDate(toDate),
    };
  }, [range, fromDate, toDate]);

  const filters = useMemo(
    () => ({
      search: search || undefined,
      draw_session__draw__id: drawId || undefined,
      deletion_type: typeFilter || undefined,
      ...dateParams,
    }),
    [search, drawId, typeFilter, dateParams]
  );

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isError,
  } = useInfiniteQuery<LogPage, any>({
    queryKey: ["/draw-booking/deletion-log/", filters],
    initialPageParam: 0,
    enabled: isAdmin,
    queryFn: ({ pageParam = 0 }) =>
      api
        .get("/draw-booking/deletion-log/", {
          params: { limit: PAGE_SIZE, offset: pageParam, ...filters },
        })
        .then((r) => r.data as LogPage),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.next) return undefined;
      return allPages.reduce((acc, p) => acc + (p.results?.length ?? 0), 0);
    },
    retry: false,
  });

  const logs = useMemo(
    () => data?.pages.flatMap((p) => p.results ?? []) ?? [],
    [data]
  );
  const totalCount = data?.pages?.[0]?.count ?? 0;
  const summary = data?.pages?.[0]?.summary;
  const selectedDraw = draws.find((d: any) => d.id === drawId);
  const shouldShowTotalFooter = !isLoading && !isError && logs.length > 0;

  const activeFilterCount =
    (search ? 1 : 0) +
    (drawId ? 1 : 0) +
    (typeFilter ? 1 : 0) +
    (range !== "all" ? 1 : 0);

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setDrawId(null);
    setTypeFilter("");
    setRange("all");
  };

  const handleToggle = useCallback((id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: DeletionLog; index: number }) => (
      <DeletionRow
        log={item}
        index={index}
        expanded={!!expanded[item.id]}
        onToggle={handleToggle}
      />
    ),
    [expanded, handleToggle]
  );

  const listHeader = useMemo(
    () => (
      <View className="flex-row bg-gray-100/80 border-b border-gray-200 px-3 py-3">
        <Text className="flex-[1.1] text-[10px] font-semibold text-gray-600 uppercase">
          Deleted
        </Text>
        <Text className="flex-[1.3] text-[10px] font-semibold text-center text-gray-600 uppercase">
          Deleted by
        </Text>
        <Text className="flex-1 text-[10px] font-semibold text-center text-gray-600 uppercase">
          Booking
        </Text>
        <Text className="flex-[0.6] text-[10px] font-semibold text-center text-gray-600 uppercase">
          Cnt
        </Text>
        <Text className="flex-1 text-[10px] font-semibold text-right text-gray-600 uppercase">
          Amt
        </Text>
        <View className="w-5" />
      </View>
    ),
    []
  );

  // Admin-only screen; the API returns 403 for dealers/agents anyway.
  if (!isAdmin) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-10">
        <ShieldAlert size={34} color="#D1D5DB" />
        <Text className="text-gray-500 text-sm mt-3 text-center">
          Only administrators can view the booking deletion log.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Summary */}
      <View className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm py-4 flex-row">
        <SummaryTile
          label="Deletions"
          value={String(summary?.total_deletions ?? 0)}
          color="#DC2626"
        />
        <View className="w-px bg-gray-100" />
        <SummaryTile
          label="Tickets"
          value={String(summary?.total_count ?? 0)}
          color="#4F46E5"
        />
        <View className="w-px bg-gray-100" />
        <SummaryTile
          label="Amount"
          value={`₹${amountHandler(summary?.total_amount ?? 0)}`}
          color="#059669"
        />
      </View>

      {/* Filters */}
      <View className="px-4 mt-3">
        <TouchableOpacity
          onPress={() => setFiltersOpen((prev) => !prev)}
          className="flex-row items-center justify-between py-3 px-3 mb-2 bg-gray-100 rounded-lg"
          activeOpacity={0.7}
        >
          <Text className="text-sm font-semibold text-gray-700">Filters</Text>
          <View
            className="w-8 h-8 rounded-full bg-white items-center justify-center shadow-sm"
            pointerEvents="none"
          >
            {filtersOpen ? (
              <ChevronUp size={18} color="#4F46E5" />
            ) : (
              <ChevronDown size={18} color="#4F46E5" />
            )}
          </View>
        </TouchableOpacity>

        {filtersOpen ? (
          <View>
            <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-3 mb-2">
              <Search size={16} color="#9CA3AF" />
              <TextInput
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder="Search user, dealer, agent, draw…"
                placeholderTextColor="#9CA3AF"
                className="flex-1 text-gray-800 text-sm py-2.5 px-2"
              />
              {searchInput ? (
                <TouchableOpacity
                  onPress={() => setSearchInput("")}
                  hitSlop={10}
                >
                  <X size={16} color="#9CA3AF" />
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={() => setDrawPickerOpen(true)}
              className="flex-row items-center justify-between border border-gray-200 bg-white rounded-xl px-3 py-3 mb-2"
              activeOpacity={0.7}
            >
              <View className="flex-row items-center flex-1">
                <Ticket size={16} color="#6366F1" />
                <View className="ml-2 flex-1">
                  <Text className="text-[10px] text-gray-400 font-semibold uppercase">
                    Draw
                  </Text>
                  <Text
                    className="text-gray-800 font-semibold text-sm mt-0.5"
                    numberOfLines={1}
                  >
                    {selectedDraw ? selectedDraw.name : "All Draws"}
                  </Text>
                </View>
              </View>
              <ChevronDown size={16} color="#6366F1" />
            </TouchableOpacity>

            {/* Type tabs */}
            <View className="flex-row bg-gray-100 rounded-xl p-1 mb-2">
              {TYPE_TABS.map((tab) => {
                const active = typeFilter === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key || "all"}
                    onPress={() => setTypeFilter(tab.key)}
                    className={`flex-1 py-2 rounded-lg items-center ${
                      active ? "bg-white shadow-sm" : ""
                    }`}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        active ? "text-indigo-700" : "text-gray-500"
                      }`}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Date range chips */}
            <View className="flex-row items-center">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {RANGES.map((r) => {
                  const active = range === r.key;
                  return (
                    <TouchableOpacity
                      key={r.key}
                      onPress={() => setRange(r.key)}
                      className={`px-3 py-1.5 rounded-full mr-2 border ${
                        active
                          ? "bg-indigo-600 border-indigo-600"
                          : "bg-white border-gray-200"
                      }`}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          active ? "text-white" : "text-gray-600"
                        }`}
                      >
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {activeFilterCount > 0 ? (
                <TouchableOpacity
                  onPress={clearFilters}
                  className="flex-row items-center bg-gray-200 px-3 py-1.5 rounded-full ml-1"
                >
                  <X size={12} color="#4B5563" />
                  <Text className="text-gray-600 text-xs font-semibold ml-1">
                    Clear
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {range === "custom" ? (
              <View className="flex-row mt-2">
                <TouchableOpacity
                  onPress={() => setShowFrom(true)}
                  className="flex-1 flex-row items-center border border-gray-200 bg-white rounded-xl px-3 py-2.5 mr-2"
                >
                  <Calendar size={14} color="#6366F1" />
                  <Text className="text-gray-700 text-xs font-semibold ml-2">
                    From {toApiDate(fromDate)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowTo(true)}
                  className="flex-1 flex-row items-center border border-gray-200 bg-white rounded-xl px-3 py-2.5"
                >
                  <Calendar size={14} color="#6366F1" />
                  <Text className="text-gray-700 text-xs font-semibold ml-2">
                    To {toApiDate(toDate)}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-10">
          <AlertTriangle size={32} color="#F87171" />
          <Text className="text-gray-500 text-sm mt-3 text-center">
            Could not load the deletion log.
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="mt-4 bg-indigo-600 px-5 py-2.5 rounded-xl"
          >
            <Text className="text-white font-semibold text-sm">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-1 mx-4 mt-3 rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
          <FlatList
            data={logs}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            stickyHeaderIndices={[0]}
            showsVerticalScrollIndicator={false}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={11}
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isFetchingNextPage}
                onRefresh={refetch}
                colors={["#4F46E5"]}
                tintColor="#4F46E5"
              />
            }
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            ListEmptyComponent={
              <View className="items-center justify-center py-20">
                <Trash2 size={32} color="#D1D5DB" />
                <Text className="text-gray-400 text-sm mt-3">
                  No deletions recorded
                </Text>
                <Text className="text-gray-300 text-xs mt-1 text-center px-10">
                  Deleted bookings will appear here with who removed them.
                </Text>
              </View>
            }
            ListFooterComponent={
              isFetchingNextPage ? (
                <View className="py-4 items-center">
                  <ActivityIndicator size="small" color="#4F46E5" />
                  <Text className="text-xs text-gray-500 mt-1">
                    Loading more…
                  </Text>
                </View>
              ) : logs.length > 0 ? (
                <View className="py-3 items-center">
                  <Text className="text-xs text-gray-400">
                    {hasNextPage
                      ? `${logs.length} of ${totalCount} deletions loaded`
                      : `All ${totalCount || logs.length} deletions loaded`}
                  </Text>
                </View>
              ) : null
            }
          />
        </View>
      )}

      {shouldShowTotalFooter ? (
        <View className="border-t border-gray-200 py-3 bg-gray-100 px-3 mx-4 mt-3 mb-3 rounded-lg">
          <View className="flex-row">
            <Text className="flex-[1.1] font-bold text-xs text-gray-800">
              TOTAL
            </Text>
            <Text className="flex-[1.3] text-xs text-center font-semibold text-gray-700">
              {summary?.total_deletions ?? 0} del.
            </Text>
            <Text className="flex-1 text-xs"> </Text>
            <Text className="flex-[0.6] text-xs text-center font-semibold text-gray-700">
              {summary?.total_count ?? 0}
            </Text>
            <Text className="flex-1 text-xs text-right font-semibold text-emerald-700">
              ₹{amountHandler(summary?.total_amount ?? 0)}
            </Text>
            <View className="w-5" />
          </View>
        </View>
      ) : null}

      {/* Draw picker */}
      <Modal
        visible={drawPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDrawPickerOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 justify-center px-8"
          onPress={() => setDrawPickerOpen(false)}
        >
          <Pressable
            className="bg-white rounded-2xl max-h-[70%] overflow-hidden"
            onPress={() => {}}
          >
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
              <Text className="text-base font-bold text-gray-800">
                Select Draw
              </Text>
              <TouchableOpacity
                onPress={() => setDrawPickerOpen(false)}
                hitSlop={10}
              >
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ id: 0, name: "All Draws" }, ...draws]}
              keyExtractor={(d: any) => String(d.id)}
              renderItem={({ item }: any) => {
                const isAll = item.id === 0;
                const isSelected = isAll ? drawId === null : drawId === item.id;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setDrawId(isAll ? null : item.id);
                      setDrawPickerOpen(false);
                    }}
                    className="flex-row items-center justify-between px-5 py-4 border-b border-gray-50"
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-sm ${
                        isSelected
                          ? "text-indigo-700 font-bold"
                          : "text-gray-700"
                      }`}
                    >
                      {item.name}
                    </Text>
                    {isSelected ? <Hash size={16} color="#4F46E5" /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {showFrom ? (
        <DateTimePicker
          value={fromDate}
          mode="date"
          display={Platform.OS === "android" ? "default" : "spinner"}
          maximumDate={toDate}
          onChange={(_event, picked) => {
            setShowFrom(false);
            if (picked) setFromDate(picked);
          }}
        />
      ) : null}
      {showTo ? (
        <DateTimePicker
          value={toDate}
          mode="date"
          display={Platform.OS === "android" ? "default" : "spinner"}
          minimumDate={fromDate}
          onChange={(_event, picked) => {
            setShowTo(false);
            if (picked) setToDate(picked);
          }}
        />
      ) : null}
    </View>
  );
}
