import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, Switch, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";

const path = "/integrations/whatsapp/rejections/";
type BookingStatus = "booking_failed" | "partially_booked" | "completely_booked";
type UnbookedMessage = { id: number; dealer: string; phone_number: string; draw_name: string; status: BookingStatus; rejection_reason: string };
type Page = { count: number; next: string | null; results: UnbookedMessage[] };

const toApiDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromApiDate = (value: string) => value ? new Date(`${value}T12:00:00`) : new Date();
const displayDate = (value: string) => value ? fromApiDate(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "Select date";

export default function Rejections() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const selectedDraw = useDrawStore((state) => state.selectedDraw);
  const allowed = user?.user_type === "ADMIN" && !user.superuser;
  const [showAllDraws, setShowAllDraws] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [draftDate, setDraftDate] = useState("");
  const [date, setDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const drawId = showAllDraws ? undefined : selectedDraw?.id;
  const query = useInfiniteQuery<Page>({
    queryKey: [path, drawId ?? null, date, showCopied],
    enabled: allowed && (showAllDraws || !!selectedDraw?.id),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => (await api.get(path, { params: { page: pageParam, draw: drawId, date: date || undefined, copied: showCopied } })).data,
    getNextPageParam: (lastPage, _pages, lastPageParam) => lastPage.next ? Number(lastPageParam) + 1 : undefined,
  });
  const records = useMemo(() => query.data?.pages.flatMap((page) => page.results) ?? [], [query.data]);
  const total = query.data?.pages[0]?.count ?? 0;

  const applyFilters = () => setDate(draftDate);
  const clearDate = () => { setDraftDate(""); setDate(""); };
  const updatePicker = (selectedDate?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (selectedDate) setDraftDate(toApiDate(selectedDate));
  };
  const loadMore = () => { if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage(); };

  if (!allowed) return <SafeAreaView className="flex-1 bg-gray-100 items-center justify-center px-6"><Text className="text-gray-600 text-center">Vendor administrator access is required.</Text></SafeAreaView>;

  return <SafeAreaView className="flex-1 bg-gray-100" edges={["bottom"]}>
    <FlatList
      data={records}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 30, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => query.refetch()} tintColor="#2563eb" />}
      ListHeaderComponent={<View style={{ maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <View className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 mb-3 shadow-sm">
          <View className="flex-row items-center justify-between"><View className="flex-1 pr-3"><Text className="text-gray-800 text-xs font-bold">{showAllDraws ? "All draws" : selectedDraw?.name || "No draw selected"}</Text></View><View className="flex-row items-center"><Text className="text-gray-600 text-xs font-semibold mr-2">All draws</Text><Switch accessibilityLabel="Show all draws" value={showAllDraws} onValueChange={setShowAllDraws} trackColor={{ false: "#cbd5e1", true: "#93c5fd" }} thumbColor={showAllDraws ? "#2563eb" : "#fff"} /></View></View>
          <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-gray-100"><Text className="text-gray-800 text-xs font-semibold">{showCopied ? "Copied requests" : "Uncopied requests"}</Text><Switch accessibilityLabel="Show copied requests" value={showCopied} onValueChange={setShowCopied} trackColor={{ false: "#cbd5e1", true: "#93c5fd" }} thumbColor={showCopied ? "#2563eb" : "#fff"} /></View>
          <View className="flex-row mt-2" style={{ gap: 8 }}><DateButton label="Date" value={draftDate} onPress={() => setShowDatePicker(true)} /><Pressable accessibilityLabel="Apply filters" onPress={applyFilters} className="bg-blue-600 rounded-lg px-3 justify-center"><Ionicons name="checkmark" size={18} color="#fff" /></Pressable>{(date || draftDate) && <Pressable accessibilityLabel="Clear date" onPress={clearDate} className="border border-blue-200 rounded-lg px-3 justify-center"><Ionicons name="close" size={18} color="#1d4ed8" /></Pressable>}</View>
          {showDatePicker && <DateTimePicker value={fromApiDate(draftDate)} mode="date" display="default" onChange={(_, selectedDate) => updatePicker(selectedDate)} />}
        </View>
        <View className="bg-gray-50 border border-gray-200 border-b-0 rounded-t-xl flex-row px-3 py-2"><Text className="w-[20%] text-[10px] text-gray-500 font-bold uppercase">Dealer</Text><Text className="w-[18%] text-[10px] text-gray-500 font-bold uppercase">Number</Text><Text className="w-[18%] text-[10px] text-gray-500 font-bold uppercase">Draw</Text><Text className="w-[29%] text-[10px] text-gray-500 font-bold uppercase">Reason</Text><Text className="w-[15%] text-[10px] text-gray-500 font-bold uppercase">Status</Text></View>
      </View>}
      renderItem={({ item, index }) => <Pressable accessibilityRole="button" accessibilityLabel={`Open unbooked request from ${item.dealer || item.phone_number}`} onPress={() => router.push({ pathname: "/whatsapp-rejections/[id]", params: { id: String(item.id), date: date || undefined } } as any)} className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} border-x border-b border-gray-200 px-3 py-3 flex-row`} style={{ maxWidth: 720, width: "100%", alignSelf: "center" }}><Text className="w-[20%] text-xs font-semibold text-gray-800 pr-2" numberOfLines={1}>{item.dealer || "Unknown"}</Text><Text className="w-[18%] text-xs text-gray-700 pr-2" numberOfLines={1}>{item.phone_number}</Text><Text className="w-[18%] text-xs text-gray-700 pr-2" numberOfLines={1}>{item.draw_name || "-"}</Text><Text className="w-[29%] text-xs text-red-700 pr-2">{item.rejection_reason || "Not recorded"}</Text><View className="w-[15%] justify-center"><StatusPill status={item.status} /></View></Pressable>}
      onEndReached={loadMore}
      onEndReachedThreshold={0.35}
      initialNumToRender={20}
      maxToRenderPerBatch={20}
      windowSize={11}
      ListEmptyComponent={<EmptyState loading={query.isLoading} error={query.isError} selectedDraw={!!selectedDraw?.id || showAllDraws} copied={showCopied} onRetry={() => query.refetch()} />}
      ListFooterComponent={<Footer loaded={records.length} total={total} loading={query.isFetchingNextPage} hasNext={!!query.hasNextPage} />}
    />
  </SafeAreaView>;
}

function DateButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={`${label} date`} onPress={onPress} className="flex-1 border border-gray-200 bg-gray-50 rounded-lg px-2.5 py-2"><Text className="text-gray-500 text-[10px] font-semibold">{label}</Text><View className="flex-row items-center justify-between mt-0.5"><Text className={`text-xs font-medium ${value ? "text-gray-800" : "text-gray-400"}`}>{displayDate(value)}</Text><Ionicons name="calendar-outline" size={15} color="#2563eb" /></View></Pressable>;
}

function StatusPill({ status }: { status: BookingStatus }) {
  const partial = status === "partially_booked";
  const booked = status === "completely_booked";
  const label = booked ? "Booked" : partial ? "Partial" : "Not booked";
  return <View className={`self-start rounded-full px-1.5 py-1 ${booked ? "bg-green-100" : partial ? "bg-yellow-100" : "bg-red-100"}`}><Text className={`text-[9px] font-bold ${booked ? "text-green-700" : partial ? "text-yellow-800" : "text-red-700"}`} numberOfLines={1}>{label}</Text></View>;
}

function EmptyState({ loading, error, selectedDraw, copied, onRetry }: { loading: boolean; error: boolean; selectedDraw: boolean; copied: boolean; onRetry: () => void }) {
  if (loading) return <View className="py-12 items-center"><ActivityIndicator color="#2563eb" /><Text className="text-gray-500 text-sm mt-3">Loading requests...</Text></View>;
  if (error) return <Pressable onPress={onRetry} className="bg-white border border-red-100 rounded-b-xl p-5 items-center"><Ionicons name="reload-outline" size={24} color="#dc2626" /><Text className="text-red-700 font-semibold mt-2">Unable to load requests. Tap to retry.</Text></Pressable>;
  if (!selectedDraw) return <View className="bg-white border border-gray-200 rounded-b-xl py-12 items-center"><Text className="text-gray-500 text-sm">Choose a draw or enable All draws.</Text></View>;
  return <View className="bg-white border border-gray-200 rounded-b-xl py-12 items-center"><Ionicons name="checkmark-circle-outline" size={36} color="#16a34a" /><Text className="text-gray-700 font-semibold mt-2">{copied ? "No copied requests" : "No uncopied requests"}</Text></View>;
}

function Footer({ loaded, total, loading, hasNext }: { loaded: number; total: number; loading: boolean; hasNext: boolean }) {
  if (loading) return <View className="py-4 items-center"><ActivityIndicator size="small" color="#2563eb" /><Text className="text-gray-500 text-xs mt-1">Loading more requests...</Text></View>;
  if (loaded > 0) return <View className="py-3 items-center"><Text className="text-gray-400 text-[11px]">{hasNext ? `${loaded} of ${total} requests loaded` : `${total} requests loaded`}</Text></View>;
  return null;
}
