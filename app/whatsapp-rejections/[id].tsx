import Clipboard from "@react-native-clipboard/clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/store/auth";
import api from "@/utils/axios";

const path = "/integrations/whatsapp/rejections/";
type BookingStatus = "booking_failed" | "partially_booked" | "completely_booked";
type Detail = { number: string; sub_type: string; type: string; count: number };
type UnbookedMessage = { id: number; dealer: string; phone_number: string; draw_name: string; status: BookingStatus; received_at: string; unbooked_details: Detail[] };

export default function WhatsAppRejectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const allowed = user?.user_type === "ADMIN" && !user.superuser;
  const [copying, setCopying] = useState(false);
  const [notice, setNotice] = useState("");
  const query = useQuery<UnbookedMessage>({
    queryKey: [path, id],
    enabled: allowed && !!id,
    queryFn: async () => (await api.get(`${path}${id}/`)).data,
  });

  const showNotice = (message: string) => { setNotice(message); setTimeout(() => setNotice(""), 2200); };
  const copyNumbers = async () => {
    if (!id || copying) return;
    setCopying(true);
    try {
      const { data } = await api.get<string[]>(`${path}${id}/copy/`);
      if (!data.length) { showNotice("No copyable numbers found"); return; }
      Clipboard.setString(data.join("\n"));
      showNotice(`Copied ${data.length} number${data.length === 1 ? "" : "s"}`);
    } catch {
      showNotice("Unable to copy numbers");
    } finally {
      setCopying(false);
    }
  };

  if (!allowed) return <SafeAreaView className="flex-1 bg-gray-100 items-center justify-center px-6"><Text className="text-gray-600 text-center">Vendor administrator access is required.</Text></SafeAreaView>;
  if (query.isLoading) return <SafeAreaView className="flex-1 bg-gray-100 items-center justify-center"><ActivityIndicator color="#2563eb" /><Text className="text-gray-500 text-sm mt-3">Loading request...</Text></SafeAreaView>;
  if (query.isError || !query.data) return <SafeAreaView className="flex-1 bg-gray-100 items-center justify-center px-6"><Pressable onPress={() => query.refetch()} className="bg-white border border-red-100 rounded-xl p-5 items-center"><Ionicons name="reload-outline" size={24} color="#dc2626" /><Text className="text-red-700 font-semibold mt-2">Unable to load request. Tap to retry.</Text></Pressable></SafeAreaView>;

  const message = query.data;
  return <SafeAreaView className="flex-1 bg-gray-100" edges={["bottom"]}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={{ maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <View className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <View className="flex-row justify-between items-start" style={{ gap: 12 }}><View className="flex-1"><Text className="text-gray-900 text-lg font-bold" numberOfLines={1}>{message.draw_name || "No draw selected"}</Text><Text className="text-gray-500 text-xs mt-1">{new Date(message.received_at).toLocaleString()}</Text></View><StatusPill status={message.status} /></View>
          <View className="border-t border-gray-100 mt-4 pt-3" style={{ gap: 8 }}><Meta label="Dealer" value={message.dealer || "Unknown"} /><Meta label="WhatsApp number" value={message.phone_number} /></View>
        </View>
        <View className="flex-row items-center justify-between mt-5 mb-2"><Text className="text-gray-800 font-bold">Unbooked numbers</Text><Text className="text-gray-500 text-xs">{message.unbooked_details.length} item{message.unbooked_details.length === 1 ? "" : "s"}</Text></View>
        <View className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <View className="flex-row bg-gray-50 px-3 py-2 border-b border-gray-200"><Text className="w-[38%] text-[10px] text-gray-500 font-bold uppercase">Number</Text><Text className="w-[35%] text-[10px] text-gray-500 font-bold uppercase">Type</Text><Text className="w-[27%] text-[10px] text-gray-500 font-bold uppercase text-right">Count</Text></View>
          {message.unbooked_details.length ? message.unbooked_details.map((detail, index) => <View key={`${detail.number}-${detail.sub_type}-${index}`} className={`${index % 2 ? "bg-gray-50" : "bg-white"} flex-row px-3 py-3 border-b border-gray-100`}><Text className="w-[38%] text-sm text-gray-900 font-bold">{detail.number}</Text><Text className="w-[35%] text-sm text-gray-700">{detail.sub_type || detail.type || "-"}</Text><Text className="w-[27%] text-sm text-gray-800 font-semibold text-right">{detail.count}</Text></View>) : <View className="py-10 px-4 items-center"><Text className="text-gray-500 text-sm text-center">No structured unbooked numbers were recorded for this request.</Text></View>}
        </View>
        <Pressable disabled={copying || !message.unbooked_details.length} onPress={copyNumbers} className={`mt-4 rounded-xl py-3.5 flex-row items-center justify-center ${copying || !message.unbooked_details.length ? "bg-gray-300" : "bg-blue-600 active:bg-blue-700"}`}><Ionicons name="copy-outline" size={19} color="#fff" /><Text className="text-white font-bold ml-2">{copying ? "Copying..." : "Copy unbooked numbers"}</Text></Pressable>
      </View>
    </ScrollView>
    {!!notice && <View className="absolute bottom-5 left-5 right-5 bg-gray-900 rounded-xl px-4 py-3"><Text className="text-white text-center text-sm font-semibold">{notice}</Text></View>}
  </SafeAreaView>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <View className="flex-row justify-between" style={{ gap: 16 }}><Text className="text-gray-500 text-xs">{label}</Text><Text className="flex-1 text-gray-800 text-xs font-semibold text-right" numberOfLines={1}>{value}</Text></View>;
}

function StatusPill({ status }: { status: BookingStatus }) {
  const partial = status === "partially_booked";
  const booked = status === "completely_booked";
  const label = booked ? "Completely booked" : partial ? "Partially booked" : "Not booked";
  return <View className={`rounded-full px-2 py-1 ${booked ? "bg-green-100" : partial ? "bg-yellow-100" : "bg-red-100"}`}><Text className={`text-[10px] font-bold ${booked ? "text-green-700" : partial ? "text-yellow-800" : "text-red-700"}`}>{label}</Text></View>;
}
