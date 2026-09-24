import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Dropdown } from "@/components/searchable-selector";
import { useAuthStore } from "@/store/auth";
import api from "@/utils/axios";

const path = "/integrations/whatsapp/rejections/";
type Detail = { number: string; sub_type: string; count: number };
type UnbookedMessage = { id: number; phone_number: string; status: "booking_failed" | "partially_booked"; remarks: string; username?: string; draw_name?: string; received_at: string; booking?: number | null; unbooked_details: Detail[] };
type Page = { count: number; next: string | null; results: UnbookedMessage[] };

export default function Rejections() {
  const user = useAuthStore((s) => s.user);
  const allowed = user?.user_type === "ADMIN" && !user.superuser;
  const [page, setPage] = useState(1);
  const [draw, setDraw] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dates, setDates] = useState({ date_from: "", date_to: "" });
  const [error, setError] = useState("");
  const draws = useQuery({ queryKey: ["/draw/list/"], enabled: allowed, queryFn: async () => (await api.get("/draw/list/")).data });
  const query = useQuery<Page>({ queryKey: [path, page, draw, dates], enabled: allowed, queryFn: async () => (await api.get(path, { params: { page, draw: draw || undefined, date_from: dates.date_from || undefined, date_to: dates.date_to || undefined } })).data });
  const applyFilters = () => {
    if ([from, to].some((value) => value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) || (from && to && from > to)) { setError("Enter dates as YYYY-MM-DD, with From before To."); return; }
    setError(""); setDates({ date_from: from, date_to: to }); setPage(1);
  };
  const clearFilters = () => { setDraw(""); setFrom(""); setTo(""); setDates({ date_from: "", date_to: "" }); setError(""); setPage(1); };
  const statusLabel = (status: UnbookedMessage["status"]) => status === "partially_booked" ? "Partially booked" : "Not booked";
  if (!allowed) return <SafeAreaView className="flex-1 bg-gray-100 items-center justify-center px-6"><Text className="text-gray-600 text-center">Vendor administrator access is required.</Text></SafeAreaView>;
  const drawRows = [{ label: "All draws", value: "" }, ...(Array.isArray(draws.data) ? draws.data : draws.data?.results || []).map((item: any) => ({ label: item.name, value: String(item.id) }))];

  return <SafeAreaView className="flex-1 bg-gray-100" edges={["bottom"]}><FlatList data={query.data?.results || []} keyExtractor={(item) => String(item.id)} contentContainerStyle={{ padding: 16, paddingBottom: 30, flexGrow: 1 }} ListHeaderComponent={<View style={{ maxWidth: 520, width: "100%", alignSelf: "center" }}>
    <View className="bg-blue-600 rounded-2xl p-5 mb-4"><View className="w-11 h-11 rounded-xl bg-blue-500 items-center justify-center mb-3"><Ionicons name="receipt-outline" size={24} color="#fff" /></View><Text className="text-white text-xl font-bold">Unbooked WhatsApp numbers</Text><Text className="text-blue-100 text-sm leading-5 mt-1">Inbound message tracking shows only requests that were not fully booked.</Text></View>
    <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 shadow-sm"><Text className="text-gray-800 font-bold">Filter requests</Text><Text className="text-gray-500 text-xs mt-1 mb-3">Filter by draw or message-received date.</Text><Dropdown data={drawRows} labelField="label" valueField="value" value={draw} loading={draws.isLoading} placeholder="All draws" onChange={(row) => { setDraw(String(row.value)); setPage(1); }} /><View className="flex-row mt-3" style={{ gap: 10 }}><TextInput accessibilityLabel="From date" placeholder="From YYYY-MM-DD" placeholderTextColor="#9ca3af" value={from} onChangeText={setFrom} className="flex-1 border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 text-gray-800" /><TextInput accessibilityLabel="To date" placeholder="To YYYY-MM-DD" placeholderTextColor="#9ca3af" value={to} onChangeText={setTo} className="flex-1 border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 text-gray-800" /></View>{!!error && <Text className="text-red-600 text-xs mt-2">{error}</Text>}<View className="flex-row mt-3" style={{ gap: 10 }}><Pressable onPress={applyFilters} className="flex-1 bg-blue-600 rounded-xl py-3 items-center"><Text className="text-white font-bold">Apply filters</Text></Pressable><Pressable onPress={clearFilters} className="border border-blue-200 rounded-xl px-4 py-3 items-center"><Text className="text-blue-700 font-bold">Clear</Text></Pressable></View></View>
    {query.isLoading && <View className="py-12 items-center"><ActivityIndicator color="#2563eb" /><Text className="text-gray-500 text-sm mt-3">Loading requests…</Text></View>}{query.isError && <Pressable onPress={() => query.refetch()} className="bg-white border border-red-100 rounded-2xl p-5 items-center"><Ionicons name="reload-outline" size={24} color="#dc2626" /><Text className="text-red-700 font-semibold mt-2">Unable to load requests. Tap to retry.</Text></Pressable>}
  </View>} ListEmptyComponent={!query.isLoading && !query.isError ? <View className="flex-1 items-center justify-center py-12"><Ionicons name="checkmark-circle-outline" size={38} color="#16a34a" /><Text className="text-gray-800 font-bold mt-3">Nothing unbooked</Text><Text className="text-gray-500 text-sm text-center mt-1">No failed or partially booked WhatsApp requests match these filters.</Text></View> : null} renderItem={({ item }) => <MessageCard item={item} statusLabel={statusLabel} />} ListFooterComponent={query.data && query.data.count > 0 ? <View className="flex-row items-center justify-between pt-2" style={{ maxWidth: 520, width: "100%", alignSelf: "center" }}><Pressable disabled={page <= 1 || query.isFetching} onPress={() => setPage(page - 1)} className={`px-4 py-3 rounded-xl ${page <= 1 || query.isFetching ? "bg-gray-200" : "bg-white border border-gray-200"}`}><Text className={page <= 1 || query.isFetching ? "text-gray-400" : "text-gray-700 font-semibold"}>Previous</Text></Pressable><Text className="text-gray-500 text-xs">Page {page} · {query.data.count} requests</Text><Pressable disabled={!query.data.next || query.isFetching} onPress={() => setPage(page + 1)} className={`px-4 py-3 rounded-xl ${!query.data.next || query.isFetching ? "bg-gray-200" : "bg-blue-600"}`}><Text className={!query.data.next || query.isFetching ? "text-gray-400" : "text-white font-semibold"}>Next</Text></Pressable></View> : null} /></SafeAreaView>;
}

function MessageCard({ item, statusLabel }: { item: UnbookedMessage; statusLabel: (status: UnbookedMessage["status"]) => string }) {
  const partial = item.status === "partially_booked";
  return <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-3 shadow-sm" style={{ maxWidth: 520, width: "100%", alignSelf: "center" }}><View className="flex-row items-start"><View className={`w-10 h-10 rounded-xl items-center justify-center ${partial ? "bg-orange-50" : "bg-red-50"}`}><Ionicons name={partial ? "alert-circle-outline" : "close-circle-outline"} size={21} color={partial ? "#ea580c" : "#dc2626"} /></View><View className="flex-1 ml-3"><View className="flex-row justify-between" style={{ gap: 8 }}><Text className="text-gray-900 font-bold flex-1" numberOfLines={1}>{item.phone_number}</Text><View className={`rounded-full px-2 py-1 ${partial ? "bg-orange-50" : "bg-red-50"}`}><Text className={`text-xs font-bold ${partial ? "text-orange-700" : "text-red-700"}`}>{statusLabel(item.status)}</Text></View></View><Text className="text-gray-500 text-xs mt-1">{item.username || "Unknown sender"}{item.draw_name ? ` · ${item.draw_name}` : ""}</Text></View></View><View className="bg-gray-50 rounded-xl p-3 mt-3">{item.unbooked_details?.length ? item.unbooked_details.map((detail, index) => <Text key={`${detail.number}-${index}`} className="text-gray-800 text-sm"><Text className="font-bold">{detail.number}</Text> · {detail.sub_type} · {detail.count} unbooked</Text>) : <Text className="text-gray-700 text-sm">{item.remarks}</Text>}</View><Text className="text-gray-500 text-xs leading-4 mt-3">{item.remarks}{item.booking ? ` · Successful bill #${item.booking}` : ""}</Text><Text className="text-gray-400 text-xs mt-2">{new Date(item.received_at).toLocaleString()}</Text></View>;
}
