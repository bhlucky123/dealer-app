import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/utils/axios";
import { normalizePhone } from "@/components/whatsapp-contacts";
import { useAuthStore } from "@/store/auth";

const path = "/integrations/whatsapp/settings/";

export default function WhatsAppSettings() {
  const user = useAuthStore((s) => s.user);
  const allowed = user?.user_type === "ADMIN" && !user.superuser;
  const cache = useQueryClient();
  const [number, setNumber] = useState<string | null>(null);
  const [error, setError] = useState("");
  const query = useQuery({ queryKey: [path], enabled: allowed, queryFn: async () => (await api.get(path)).data });
  const save = useMutation({ mutationFn: (staff_phone_number: string) => api.patch(path, { staff_phone_number }), onSuccess: async () => { await cache.invalidateQueries({ queryKey: [path] }); setNumber(null); } });
  const currentNumber = number ?? query.data?.staff_phone_number ?? "";
  const saveNumber = () => {
    const phone = normalizePhone(currentNumber);
    if (phone && !/^\+[1-9][0-9]{7,14}$/.test(phone)) { setError("Enter an international number with country code, for example +919876543210."); return; }
    setError(""); save.mutate(phone);
  };
  if (!allowed) return <SafeAreaView className="flex-1 bg-gray-100 items-center justify-center px-6"><Text className="text-gray-600 text-center">Vendor administrator access is required.</Text></SafeAreaView>;
  return <SafeAreaView className="flex-1 bg-gray-100" edges={["bottom"]}><KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }} keyboardShouldPersistTaps="handled"><View style={{ width: "100%", maxWidth: 520, alignSelf: "center" }}>
    <View className="bg-blue-600 rounded-2xl p-5 mb-4"><View className="w-11 h-11 rounded-xl bg-blue-500 items-center justify-center mb-3"><Ionicons name="logo-whatsapp" size={24} color="#fff" /></View><Text className="text-white text-xl font-bold">Staff WhatsApp number</Text><Text className="text-blue-100 text-sm leading-5 mt-1">Receive a notification whenever a WhatsApp booking cannot be fully booked.</Text></View>
    <View className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"><Text className="text-gray-800 font-bold text-base">Notification recipient</Text><Text className="text-gray-500 text-sm leading-5 mt-1">Leave this blank to stop staff notifications. Booking tracking will continue normally.</Text>
      {query.isLoading ? <View className="py-10 items-center"><ActivityIndicator color="#2563eb" /><Text className="text-gray-500 text-sm mt-3">Loading setting…</Text></View> : <><Text className="text-gray-700 text-sm font-semibold mt-5 mb-2">WhatsApp number</Text><View className={`flex-row items-center rounded-xl border-2 px-3 ${error ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50"}`}><Ionicons name="call-outline" size={20} color={error ? "#dc2626" : "#2563eb"} /><TextInput accessibilityLabel="Staff WhatsApp number" keyboardType="phone-pad" placeholder="+919876543210" placeholderTextColor="#9ca3af" value={currentNumber} onChangeText={(value) => { setNumber(value); setError(""); }} className="flex-1 px-3 py-3 text-gray-900 font-medium" /></View>
        {!!error && <Text className="text-red-600 text-xs mt-2">{error}</Text>}{(query.isError || save.isError) && <View className="flex-row bg-red-50 border border-red-100 rounded-xl p-3 mt-4"><Ionicons name="alert-circle-outline" size={19} color="#dc2626" /><Text className="flex-1 text-red-700 text-sm ml-2">Could not load or save this setting. Please try again.</Text></View>}{save.isSuccess && number === null && <View className="flex-row bg-green-50 border border-green-100 rounded-xl p-3 mt-4"><Ionicons name="checkmark-circle" size={19} color="#16a34a" /><Text className="text-green-700 text-sm font-medium ml-2">Staff number saved.</Text></View>}
        <Pressable disabled={save.isPending || query.isError} onPress={saveNumber} className={`flex-row justify-center items-center rounded-xl py-3.5 mt-5 ${save.isPending || query.isError ? "bg-blue-300" : "bg-blue-600"}`}>{save.isPending ? <ActivityIndicator color="#fff" /> : <><Ionicons name="save-outline" size={19} color="#fff" /><Text className="text-white font-bold ml-2">Save number</Text></>}</Pressable>{query.isError && <Pressable onPress={() => query.refetch()} className="items-center py-3 mt-1"><Text className="text-blue-600 font-semibold">Retry loading</Text></Pressable>}</>}
    </View>
  </View></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
