import { useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, Switch, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";

const path = "/integrations/whatsapp/rejections/";
type Detail = { number: string; sub_type: string; count: number };
type UnbookedMessage = { id: number; phone_number: string; status: "booking_failed" | "partially_booked"; remarks: string; username?: string; draw_name?: string; received_at: string; booking?: number | null; unbooked_details: Detail[] };
type Page = { count: number; next: string | null; results: UnbookedMessage[] };
type PickerField = "from" | "to" | null;

const toApiDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromApiDate = (value: string) => value ? new Date(`${value}T12:00:00`) : new Date();
const displayDate = (value: string) => value ? fromApiDate(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "Select date";

export default function Rejections() {
  const user = useAuthStore((state) => state.user);
  const selectedDraw = useDrawStore((state) => state.selectedDraw);
  const allowed = user?.user_type === "ADMIN" && !user.superuser;
  const [page, setPage] = useState(1);
  const [showAllDraws, setShowAllDraws] = useState(false);
  const [draftDates, setDraftDates] = useState({ date_from: "", date_to: "" });
  const [dates, setDates] = useState({ date_from: "", date_to: "" });
  const [picker, setPicker] = useState<PickerField>(null);
  const [error, setError] = useState("");
  const drawId = showAllDraws ? undefined : selectedDraw?.id;
  const query = useQuery<Page>({
    queryKey: [path, page, drawId, showAllDraws, dates],
    enabled: allowed && (showAllDraws || !!selectedDraw?.id),
    queryFn: async () => (await api.get(path, { params: { page, draw: drawId, date_from: dates.date_from || undefined, date_to: dates.date_to || undefined } })).data,
  });

  const applyFilters = () => {
    if (draftDates.date_from && draftDates.date_to && draftDates.date_from > draftDates.date_to) { setError("From date must be before To date."); return; }
    setError(""); setDates(draftDates); setPage(1);
  };
  const clearDates = () => { setDraftDates({ date_from: "", date_to: "" }); setDates({ date_from: "", date_to: "" }); setError(""); setPage(1); };
  const updatePicker = (field: Exclude<PickerField, null>, date?: Date) => {
    if (Platform.OS === "android") setPicker(null);
    if (date) setDraftDates((current) => ({ ...current, [field === "from" ? "date_from" : "date_to"]: toApiDate(date) }));
  };
  const statusLabel = (status: UnbookedMessage["status"]) => status === "partially_booked" ? "Partially booked" : "Not booked";

  if (!allowed) return <SafeAreaView className="flex-1 bg-gray-100 items-center justify-center px-6"><Text className="text-gray-600 text-center">Vendor administrator access is required.</Text></SafeAreaView>;

  return <SafeAreaView className="flex-1 bg-gray-100" edges={["bottom"]}>
    <FlatList
      data={query.data?.results || []}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: 16, paddingBottom: 30, flexGrow: 1 }}
      ListHeaderComponent={<View style={{ maxWidth: 520, width: "100%", alignSelf: "center" }}>
        <Text className="text-gray-900 text-xl font-bold mb-1">Unbooked WhatsApp numbers</Text>
        <Text className="text-gray-500 text-sm leading-5 mb-4">Review incoming WhatsApp bookings that were not fully booked.</Text>
        <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 shadow-sm">
          <View className="flex-row items-center justify-between"><View className="flex-1 pr-3"><Text className="text-gray-800 font-bold">Draw</Text><Text className="text-gray-500 text-xs mt-1">{showAllDraws ? "Showing requests from every draw" : selectedDraw ? selectedDraw.name : "No draw selected"}</Text></View><View className="items-end"><Text className="text-gray-600 text-xs font-semibold mb-1">Show all draws</Text><Switch accessibilityLabel="Show all draws" value={showAllDraws} onValueChange={(value) => { setShowAllDraws(value); setPage(1); }} trackColor={{ false: "#cbd5e1", true: "#93c5fd" }} thumbColor={showAllDraws ? "#2563eb" : "#fff"} /></View></View>
          <Text className="text-gray-700 text-sm font-semibold mt-5 mb-2">Received date</Text>
          <View className="flex-row" style={{ gap: 10 }}><DateButton label="From" value={draftDates.date_from} onPress={() => setPicker("from")} /><DateButton label="To" value={draftDates.date_to} onPress={() => setPicker("to")} /></View>
          {!!error && <Text className="text-red-600 text-xs mt-2">{error}</Text>}
          <View className="flex-row mt-4" style={{ gap: 10 }}><Pressable onPress={applyFilters} className="flex-1 bg-blue-600 rounded-xl py-3 items-center"><Text className="text-white font-bold">Apply filters</Text></Pressable><Pressable onPress={clearDates} className="border border-blue-200 rounded-xl px-4 py-3 items-center"><Text className="text-blue-700 font-bold">Clear dates</Text></Pressable></View>
          {picker && <DateTimePicker value={fromApiDate(picker === "from" ? draftDates.date_from : draftDates.date_to)} mode="date" display="default" onChange={(_, date) => updatePicker(picker, date)} />}
        </View>
        {query.isLoading && <View className="py-12 items-center"><ActivityIndicator color="#2563eb" /><Text className="text-gray-500 text-sm mt-3">Loading requests…</Text></View>}
        {query.isError && <Pressable onPress={() => query.refetch()} className="bg-white border border-red-100 rounded-2xl p-5 items-center"><Ionicons name="reload-outline" size={24} color="#dc2626" /><Text className="text-red-700 font-semibold mt-2">Unable to load requests. Tap to retry.</Text></Pressable>}
      </View>}
      ListEmptyComponent={!query.isLoading && !query.isError ? <View className="flex-1 items-center justify-center py-12"><Ionicons name="checkmark-circle-outline" size={38} color="#16a34a" /><Text className="text-gray-800 font-bold mt-3">Nothing unbooked</Text><Text className="text-gray-500 text-sm text-center mt-1">No failed or partially booked WhatsApp requests match these filters.</Text></View> : null}
      renderItem={({ item }) => <MessageCard item={item} statusLabel={statusLabel} />}
      ListFooterComponent={query.data && query.data.count > 0 ? <Pagination page={page} total={query.data.count} hasNext={!!query.data.next} busy={query.isFetching} onPrevious={() => setPage(page - 1)} onNext={() => setPage(page + 1)} /> : null}
    />
  </SafeAreaView>;
}

function DateButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={`${label} date`} onPress={onPress} className="flex-1 border border-gray-200 bg-gray-50 rounded-xl px-3 py-3"><Text className="text-gray-500 text-xs font-semibold">{label}</Text><View className="flex-row items-center justify-between mt-1"><Text className={`text-sm font-medium ${value ? "text-gray-800" : "text-gray-400"}`}>{displayDate(value)}</Text><Ionicons name="calendar-outline" size={18} color="#2563eb" /></View></Pressable>;
}

function Pagination({ page, total, hasNext, busy, onPrevious, onNext }: { page: number; total: number; hasNext: boolean; busy: boolean; onPrevious: () => void; onNext: () => void }) {
  return <View className="flex-row items-center justify-between pt-2" style={{ maxWidth: 520, width: "100%", alignSelf: "center" }}><Pressable disabled={page <= 1 || busy} onPress={onPrevious} className={`px-4 py-3 rounded-xl ${page <= 1 || busy ? "bg-gray-200" : "bg-white border border-gray-200"}`}><Text className={page <= 1 || busy ? "text-gray-400" : "text-gray-700 font-semibold"}>Previous</Text></Pressable><Text className="text-gray-500 text-xs">Page {page} · {total} requests</Text><Pressable disabled={!hasNext || busy} onPress={onNext} className={`px-4 py-3 rounded-xl ${!hasNext || busy ? "bg-gray-200" : "bg-blue-600"}`}><Text className={!hasNext || busy ? "text-gray-400" : "text-white font-semibold"}>Next</Text></Pressable></View>;
}

function MessageCard({ item, statusLabel }: { item: UnbookedMessage; statusLabel: (status: UnbookedMessage["status"]) => string }) {
  const partial = item.status === "partially_booked";
  return <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-3 shadow-sm" style={{ maxWidth: 520, width: "100%", alignSelf: "center" }}><View className="flex-row items-start"><View className={`w-10 h-10 rounded-xl items-center justify-center ${partial ? "bg-orange-50" : "bg-red-50"}`}><Ionicons name={partial ? "alert-circle-outline" : "close-circle-outline"} size={21} color={partial ? "#ea580c" : "#dc2626"} /></View><View className="flex-1 ml-3"><View className="flex-row justify-between" style={{ gap: 8 }}><Text className="text-gray-900 font-bold flex-1" numberOfLines={1}>{item.phone_number}</Text><View className={`rounded-full px-2 py-1 ${partial ? "bg-orange-50" : "bg-red-50"}`}><Text className={`text-xs font-bold ${partial ? "text-orange-700" : "text-red-700"}`}>{statusLabel(item.status)}</Text></View></View><Text className="text-gray-500 text-xs mt-1">{item.username || "Unknown sender"}{item.draw_name ? ` · ${item.draw_name}` : ""}</Text></View></View><View className="bg-gray-50 rounded-xl p-3 mt-3">{item.unbooked_details?.length ? item.unbooked_details.map((detail, index) => <Text key={`${detail.number}-${index}`} className="text-gray-800 text-sm"><Text className="font-bold">{detail.number}</Text> · {detail.sub_type} · {detail.count} unbooked</Text>) : <Text className="text-gray-700 text-sm">{item.remarks}</Text>}</View><Text className="text-gray-500 text-xs leading-4 mt-3">{item.remarks}{item.booking ? ` · Successful bill #${item.booking}` : ""}</Text><Text className="text-gray-400 text-xs mt-2">{new Date(item.received_at).toLocaleString()}</Text></View>;
}
