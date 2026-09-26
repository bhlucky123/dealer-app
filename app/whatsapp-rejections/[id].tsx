import Clipboard from "@react-native-clipboard/clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/store/auth";
import api from "@/utils/axios";

const path = "/integrations/whatsapp/rejections/";
type BookingStatus = "booking_failed" | "partially_booked" | "completely_booked";
type Detail = { number: string; sub_type: string; type: string; count: number; reason: string };
type NumberPage = { count: number; next: string | null; results: Detail[] };
type UnbookedMessage = { id: number; dealer: string; phone_number: string; draw_name: string; status: BookingStatus; received_at: string; rejection_reason: string };

export default function WhatsAppRejectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const allowed = user?.user_type === "ADMIN" && !user.superuser;
  const [copying, setCopying] = useState(false);
  const [notice, setNotice] = useState("");
  const query = useQuery<UnbookedMessage>({ queryKey: [path, id], enabled: allowed && !!id, queryFn: async () => (await api.get(`${path}${id}/`)).data });
  const numbersQuery = useInfiniteQuery<NumberPage>({
    queryKey: [path, id, "numbers"],
    enabled: allowed && !!id,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => (await api.get(`${path}${id}/numbers/`, { params: { page: pageParam } })).data,
    getNextPageParam: (lastPage, _pages, lastPageParam) => lastPage.next ? Number(lastPageParam) + 1 : undefined,
  });
  const details = useMemo(() => numbersQuery.data?.pages.flatMap((page) => page.results) ?? [], [numbersQuery.data]);
  const numberCount = numbersQuery.data?.pages[0]?.count ?? 0;

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
  const loadMore = () => { if (numbersQuery.hasNextPage && !numbersQuery.isFetchingNextPage) numbersQuery.fetchNextPage(); };

  if (!allowed) return <SafeAreaView className="flex-1 bg-gray-100 items-center justify-center px-6"><Text className="text-gray-600 text-center">Vendor administrator access is required.</Text></SafeAreaView>;
  if (query.isLoading) return <SafeAreaView className="flex-1 bg-gray-100 items-center justify-center"><ActivityIndicator color="#2563eb" /><Text className="text-gray-500 text-sm mt-3">Loading request...</Text></SafeAreaView>;
  if (query.isError || !query.data) return <SafeAreaView className="flex-1 bg-gray-100 items-center justify-center px-6"><Pressable onPress={() => query.refetch()} className="bg-white border border-red-100 rounded-xl p-5 items-center"><Ionicons name="reload-outline" size={24} color="#dc2626" /><Text className="text-red-700 font-semibold mt-2">Unable to load request. Tap to retry.</Text></Pressable></SafeAreaView>;

  const message = query.data;
  const showLineReasons = message.status === "partially_booked";
  return <SafeAreaView className="flex-1 bg-gray-100" edges={["bottom"]}>
    <View className="flex-1" style={{ maxWidth: 720, width: "100%", alignSelf: "center" }}>
      <View className="px-4 pt-4 pb-3">
        <View className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <View className="flex-row justify-between items-start" style={{ gap: 12 }}><View className="flex-1"><Text className="text-gray-900 text-lg font-bold" numberOfLines={1}>{message.draw_name || "No draw selected"}</Text><Text className="text-gray-500 text-xs mt-1">{new Date(message.received_at).toLocaleString()}</Text></View><StatusPill status={message.status} /></View>
          <View className="border-t border-gray-100 mt-4 pt-3" style={{ gap: 8 }}><Meta label="Dealer" value={message.dealer || "Unknown"} /><Meta label="WhatsApp number" value={message.phone_number} /></View>
          {!showLineReasons && <View className="mt-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2"><Text className="text-[10px] font-bold uppercase text-red-700">Reason</Text><Text className="text-xs text-red-800 mt-0.5">{message.rejection_reason || "Booking was not completed."}</Text></View>}
        </View>
        <View className="flex-row items-center justify-between mt-4"><Text className="text-gray-800 font-bold">Unbooked numbers</Text><Text className="text-gray-500 text-xs">{numberCount} item{numberCount === 1 ? "" : "s"}</Text></View>
      </View>

      <View className="flex-1 mx-4 border border-gray-200 rounded-xl overflow-hidden bg-white">
        <View className="flex-row bg-gray-50 px-3 py-2 border-b border-gray-200"><Text className={`${showLineReasons ? "w-[20%]" : "w-[40%]"} text-[10px] text-gray-500 font-bold uppercase`}>Number</Text><Text className={`${showLineReasons ? "w-[18%]" : "w-[30%]"} text-[10px] text-gray-500 font-bold uppercase`}>Type</Text><Text className={`${showLineReasons ? "w-[13%]" : "w-[30%]"} text-[10px] text-gray-500 font-bold uppercase text-right`}>Count</Text>{showLineReasons && <Text className="w-[49%] pl-3 text-[10px] text-gray-500 font-bold uppercase">Rejection reason</Text>}</View>
        <FlatList
          data={details}
          keyExtractor={(item, index) => `${item.number}-${item.sub_type}-${index}`}
          renderItem={({ item, index }) => <View className={`${index % 2 ? "bg-gray-50" : "bg-white"} flex-row px-3 py-3 border-b border-gray-100`}><Text className={`${showLineReasons ? "w-[20%]" : "w-[40%]"} text-sm text-gray-900 font-bold`}>{item.number}</Text><Text className={`${showLineReasons ? "w-[18%]" : "w-[30%]"} text-sm text-gray-700`}>{item.sub_type || item.type || "-"}</Text><Text className={`${showLineReasons ? "w-[13%]" : "w-[30%]"} text-sm text-gray-800 font-semibold text-right`}>{item.count}</Text>{showLineReasons && <Text className="w-[49%] pl-3 text-sm text-red-700">{item.reason || "Not recorded"}</Text>}</View>}
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={11}
          ListEmptyComponent={numbersQuery.isLoading ? <View className="py-10 items-center"><ActivityIndicator color="#2563eb" /></View> : numbersQuery.isError ? <Pressable onPress={() => numbersQuery.refetch()} className="py-10 items-center"><Text className="text-red-700 font-semibold">Unable to load numbers. Tap to retry.</Text></Pressable> : <View className="py-10 px-4 items-center"><Text className="text-gray-500 text-sm text-center">No structured unbooked numbers were recorded for this request.</Text></View>}
          ListFooterComponent={numbersQuery.isFetchingNextPage ? <View className="py-3 items-center"><ActivityIndicator size="small" color="#2563eb" /></View> : details.length > 0 && numbersQuery.hasNextPage ? <View className="py-3 items-center"><Text className="text-gray-400 text-[11px]">{details.length} of {numberCount} numbers loaded</Text></View> : null}
        />
      </View>

      <View className="px-4 pt-3 pb-4 bg-gray-100"><Pressable disabled={copying || numbersQuery.isLoading || !numberCount} onPress={copyNumbers} className={`rounded-xl py-3.5 flex-row items-center justify-center ${copying || numbersQuery.isLoading || !numberCount ? "bg-gray-300" : "bg-blue-600 active:bg-blue-700"}`}><Ionicons name="copy-outline" size={19} color="#fff" /><Text className="text-white font-bold ml-2">{copying ? "Copying..." : "Copy unbooked numbers"}</Text></Pressable></View>
    </View>
    {!!notice && <View className="absolute bottom-20 left-5 right-5 bg-gray-900 rounded-xl px-4 py-3"><Text className="text-white text-center text-sm font-semibold">{notice}</Text></View>}
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
