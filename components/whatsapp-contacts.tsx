import React from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";

export type WhatsAppContact = { phone_number: string; receive_results: boolean; is_active: boolean };
export function normalizePhone(value: string) {
  return value.replace(/[\s().-]/g, "").replace(/^00/, "+");
}
export function contactErrors(rows: WhatsAppContact[] | undefined | null): string[] {
  const safeRows = Array.isArray(rows) ? rows : [];
  const phones = safeRows.map(row => normalizePhone(row.phone_number));
  return phones.map(phone => !/^\+[1-9][0-9]{7,14}$/.test(phone) ? "Enter an international number, e.g. +919876543210" : phones.filter(other => other === phone).length > 1 ? "This number is entered more than once" : "");
}
export function initialContacts(user: { whatsapp_contacts?: WhatsAppContact[]; whatsapp_numbers?: string[]; phone_number?: string; whatsapp_result_subscribed?: boolean } = {}): WhatsAppContact[] {
  if (Array.isArray(user.whatsapp_contacts)) return user.whatsapp_contacts;
  const whatsappNumbers = Array.isArray(user.whatsapp_numbers) ? user.whatsapp_numbers : [];
  const phones = [...new Set([user.phone_number, ...whatsappNumbers].filter(Boolean))] as string[];
  return phones.map((phone, index) => ({ phone_number: phone, is_active: true, receive_results: index === 0 && !!user.whatsapp_result_subscribed }));
}

export function WhatsAppContacts({ value, onChange, serverErrors }: { value?: WhatsAppContact[] | null; onChange: (rows: WhatsAppContact[]) => void; serverErrors?: any }) {
  if (typeof serverErrors === "string") {
    try { serverErrors = JSON.parse(serverErrors); } catch { /* Show a general field error below. */ }
  }
  const contacts = Array.isArray(value) ? value : [];
  const errors = contactErrors(contacts);
  const change = (index: number, patch: Partial<WhatsAppContact>) => onChange(contacts.map((row, i) => i === index ? { ...row, ...patch } : row));
  return <View style={{ gap: 12, marginVertical: 16 }}>
    <Text style={{ fontWeight: "600", fontSize: 17 }}>WhatsApp numbers</Text>
    {typeof serverErrors === "string" && !!serverErrors && <Text style={{ color: "#b91c1c" }}>{serverErrors}</Text>}
    {contacts.map((row, index) => <View key={index} style={{ padding: 14, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, gap: 10 }}>
      <TextInput accessibilityLabel={`Phone number ${index + 1}`} keyboardType="phone-pad" placeholder="+919876543210" value={row.phone_number} onChangeText={phone_number => change(index, { phone_number })} style={{ padding: 10, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, color: "#111827" }} />
      {!!(errors[index] || serverErrors?.[index]?.phone_number) && <Text style={{ color: "#b91c1c" }}>{errors[index] || String(serverErrors[index].phone_number)}</Text>}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text>Receive results</Text><Switch accessibilityLabel={`Receive results ${index + 1}`} value={row.receive_results} onValueChange={receive_results => change(index, { receive_results })} /></View>
      <Pressable accessibilityRole="button" onPress={() => onChange(contacts.filter((_, i) => i !== index))}><Text style={{ color: "#b91c1c", paddingVertical: 8 }}>Remove number</Text></Pressable>
    </View>)}
    <Pressable accessibilityRole="button" onPress={() => onChange([...contacts, { phone_number: "", receive_results: false, is_active: true }])}><Text style={{ color: "#0369a1", padding: 12 }}>+ Add number</Text></Pressable>
    <Text style={{ color: "#64748b" }}>All active numbers can book through WhatsApp.</Text>
  </View>;
}
