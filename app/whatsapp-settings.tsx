import { useState } from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/utils/axios";
import { normalizePhone } from "@/components/whatsapp-contacts";
import { useAuthStore } from "@/store/auth";

const path = "/integrations/whatsapp/settings/";
export default function WhatsAppSettings() {
  const user = useAuthStore(s => s.user);
  const allowed = user?.user_type === "ADMIN" && !user.superuser;
  const cache = useQueryClient();
  const [number, setNumber] = useState<string | null>(null);
  const [error, setError] = useState("");
  const query = useQuery({ queryKey: [path], enabled: allowed, queryFn: async () => (await api.get(path)).data });
  const save = useMutation({ mutationFn: (staff_phone_number: string) => api.patch(path, { staff_phone_number }), onSuccess: async () => { await cache.invalidateQueries({ queryKey: [path] }); setNumber(null); } });
  if (!allowed) return <Text>Vendor administrator access required.</Text>;
  if (query.isLoading) return <ActivityIndicator />;
  return <View style={{ padding: 20, gap: 16 }}>
    <Text style={{ fontSize: 22, fontWeight: "600" }}>Staff WhatsApp number</Text>
    <Text>Rejected booking numbers are forwarded here. They remain available in Unbooked WhatsApp numbers even if delivery fails.</Text>
    <TextInput accessibilityLabel="Staff WhatsApp number" keyboardType="phone-pad" placeholder="+919876543210" value={number ?? query.data?.staff_phone_number ?? ""} onChangeText={setNumber} style={{ padding: 14, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8 }} />
    {!!error && <Text style={{ color: "#b91c1c" }}>{error}</Text>}
    {(query.isError || save.isError) && <Text style={{ color: "#b91c1c" }}>Could not load or save this setting. Please retry.</Text>}
    {save.isSuccess && number === null && <Text>Saved</Text>}
    <TouchableOpacity disabled={save.isPending || query.isError} onPress={() => { const phone = normalizePhone(number ?? query.data?.staff_phone_number ?? ""); if (phone && !/^\+[1-9][0-9]{7,14}$/.test(phone)) { setError("Enter an international number including country code."); return; } setError(""); save.mutate(phone); }}><Text style={{ color: "#0369a1", padding: 14 }}>{save.isPending ? "Saving…" : "Save"}</Text></TouchableOpacity>
    {query.isError && <TouchableOpacity onPress={() => query.refetch()}><Text>Retry</Text></TouchableOpacity>}
  </View>;
}
