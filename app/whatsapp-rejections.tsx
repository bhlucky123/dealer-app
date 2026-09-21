import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Dropdown } from "@/components/searchable-selector";
import { useAuthStore } from "@/store/auth";
import api from "@/utils/axios";

const path = "/integrations/whatsapp/rejections/";
export default function Rejections() {
  const user = useAuthStore(s => s.user);
  const allowed = user?.user_type === "ADMIN" && !user.superuser;
  const [page, setPage] = useState(1);
  const [draw, setDraw] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dates, setDates] = useState({ date_from: "", date_to: "" });
  const [group, setGroup] = useState<number | null>(null);
  const [error, setError] = useState("");
  const draws = useQuery({ queryKey: ["/draw/list/"], enabled: allowed, queryFn: async () => (await api.get("/draw/list/")).data });
  const query = useQuery({ queryKey: [path, page, draw, dates, group], enabled: allowed, queryFn: async () => (await api.get(path, { params: { page, draw: draw || undefined, group: group || undefined, date_from: dates.date_from || undefined, date_to: dates.date_to || undefined } })).data });
  if (!allowed) return <Text>Vendor administrator access required.</Text>;
  return <View style={{ flex: 1, padding: 16, gap: 10 }}>
    <Text style={{ fontSize: 22, fontWeight: "600" }}>Unbooked WhatsApp numbers</Text>
    <Dropdown data={(Array.isArray(draws.data) ? draws.data : draws.data?.results || []).map((d: any) => ({ label: d.name, value: d.id }))} labelField="label" valueField="value" value={draw} loading={draws.isLoading} placeholder="All draws" onChange={row => { setDraw(row.value); setPage(1); }} />
    <View style={{ flexDirection: "row", gap: 8 }}><TextInput accessibilityLabel="From date" placeholder="From YYYY-MM-DD" value={from} onChangeText={setFrom} style={{ flex: 1, borderWidth: 1, padding: 10 }} /><TextInput accessibilityLabel="To date" placeholder="To YYYY-MM-DD" value={to} onChangeText={setTo} style={{ flex: 1, borderWidth: 1, padding: 10 }} /></View>
    <Pressable onPress={() => { if ([from, to].some(v => v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) || (from && to && from > to)) { setError("Enter dates as YYYY-MM-DD, with From before To."); return; } setError(""); setDates({ date_from: from, date_to: to }); setPage(1); }}><Text style={{ padding: 8, color: "#0369a1" }}>Apply dates</Text></Pressable>
    {!!error && <Text style={{ color: "#b91c1c" }}>{error}</Text>}
    {group && <Pressable onPress={() => { setGroup(null); setPage(1); }}><Text>Group {group} · Show all groups</Text></Pressable>}
    {query.isLoading ? <ActivityIndicator /> : query.isError ? <Pressable onPress={() => query.refetch()}><Text>Unable to load records. Tap to retry.</Text></Pressable> : <FlatList data={query.data?.results || []} keyExtractor={row => String(row.id)} ListEmptyComponent={<Text>No rejected numbers for these filters.</Text>} renderItem={({ item }) => <View style={{ padding: 14, backgroundColor: "white", marginBottom: 10, borderRadius: 10, gap: 4 }}>
      <Text style={{ fontWeight: "700" }}>{item.number} · {item.sub_type} · {item.rejected_count} rejected</Text>
      <Text>{item.username} · {item.sender}</Text><Text>{item.draw_name} · {item.session_date}</Text><Text>{item.reason}</Text><Text>{new Date(item.created_at).toLocaleString()}</Text>
      <Pressable onPress={() => { setGroup(item.group_id); setPage(1); }}><Text style={{ color: "#0369a1", paddingVertical: 8 }}>Group {item.group_id} · {item.booking ? `Successful bill #${item.booking}` : "No successful booking"}</Text></Pressable>
    </View>} />}
    <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 12 }}><Pressable disabled={page <= 1 || query.isFetching} onPress={() => setPage(page - 1)}><Text>Previous</Text></Pressable><Text>Page {page} · {query.data?.count ?? 0} records</Text><Pressable disabled={!query.data?.next || query.isFetching} onPress={() => setPage(page + 1)}><Text>Next</Text></Pressable></View>
  </View>;
}
