import { CirclePlus, MessageCircle, Phone, Trash2 } from "lucide-react-native";
import React from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";

export type WhatsAppContact = { phone_number: string; receive_results: boolean; is_active: boolean };

export function normalizePhone(value: string) {
  return value.replace(/[\s().-]/g, "").replace(/^00/, "+");
}

function normalizedContacts(rows: unknown): WhatsAppContact[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is Partial<WhatsAppContact> => !!row && typeof row === "object")
    .map((row) => ({
      phone_number: typeof row.phone_number === "string" ? row.phone_number : "",
      receive_results: !!row.receive_results,
      is_active: row.is_active !== false,
    }));
}

export function contactErrors(rows: WhatsAppContact[] | undefined | null): string[] {
  const contacts = normalizedContacts(rows);
  const phones = contacts.map(row => normalizePhone(row.phone_number));
  return phones.map(phone => !/^\+[1-9][0-9]{7,14}$/.test(phone) ? "Enter an international number, e.g. +919876543210" : phones.filter(other => other === phone).length > 1 ? "This number is entered more than once" : "");
}

export function initialContacts(user: { whatsapp_contacts?: WhatsAppContact[]; whatsapp_numbers?: string[]; phone_number?: string; whatsapp_result_subscribed?: boolean } = {}): WhatsAppContact[] {
  if (Array.isArray(user.whatsapp_contacts)) return normalizedContacts(user.whatsapp_contacts);
  const whatsappNumbers = Array.isArray(user.whatsapp_numbers) ? user.whatsapp_numbers : [];
  const phones = [...new Set([user.phone_number, ...whatsappNumbers].filter(Boolean))] as string[];
  return phones.map((phone, index) => ({ phone_number: phone, is_active: true, receive_results: !!user.whatsapp_result_subscribed && index === 0 }));
}

export function WhatsAppContacts({
  value,
  onChange,
  serverErrors,
  resultSubscription,
  onResultSubscriptionChange,
  resultReceiver,
}: {
  value?: WhatsAppContact[] | null;
  onChange: (rows: WhatsAppContact[]) => void;
  serverErrors?: any;
  resultSubscription?: boolean;
  onResultSubscriptionChange?: (enabled: boolean) => void;
  resultReceiver?: React.ReactNode;
}) {
  if (typeof serverErrors === "string") {
    try { serverErrors = JSON.parse(serverErrors); } catch { /* Render the general API error below. */ }
  }

  const contacts = normalizedContacts(value);
  const errors = contactErrors(contacts);
  const changeNumber = (index: number, phone_number: string) => onChange(contacts.map((row, itemIndex) => itemIndex === index ? { ...row, phone_number } : row));
  const addNumber = () => onChange([...contacts, { phone_number: "", receive_results: false, is_active: true }]);

  const showResultSettings = typeof resultSubscription === "boolean" && !!onResultSubscriptionChange;

  return <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-8 shadow-sm">
    <View className="flex-row items-start justify-between mb-4">
      <View className="flex-1 mr-3">
        <View className="flex-row items-center">
          <MessageCircle size={18} color="#2563EB" />
          <Text className="text-gray-800 font-semibold text-base ml-2">WhatsApp numbers</Text>
        </View>
      </View>
      <View className="bg-blue-50 border border-blue-100 rounded-full px-3 py-1">
        <Text className="text-blue-700 font-semibold text-xs">{contacts.length} {contacts.length === 1 ? "number" : "numbers"}</Text>
      </View>
    </View>

    {showResultSettings && <View className="border-y border-gray-100 py-3.5 mb-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-gray-800 font-semibold">WhatsApp result subscription</Text>
        <Switch
          accessibilityLabel="WhatsApp result subscription"
          accessibilityState={{ checked: resultSubscription, disabled: contacts.length === 0 }}
          value={resultSubscription}
          disabled={contacts.length === 0}
          onValueChange={onResultSubscriptionChange}
          trackColor={{ false: "#CBD5E1", true: "#2563EB" }}
          thumbColor="#FFFFFF"
        />
      </View>
      {resultSubscription && <View className="mt-3">
        <Text className="text-gray-500 text-xs font-medium mb-1">Result receiver</Text>
        {resultReceiver}
      </View>}
    </View>}

    {typeof serverErrors === "string" && !!serverErrors && <Text className="text-red-600 text-sm mb-3">{serverErrors}</Text>}

    {contacts.length > 0 && <View className="border border-gray-200 rounded-2xl overflow-hidden mb-3">
      {contacts.map((row, index) => {
        const fieldError = errors[index] || serverErrors?.[index]?.phone_number;
        return <View key={`${row.phone_number}-${index}`} className={`${index > 0 ? "border-t border-gray-100" : ""} px-4 py-3.5`}>
          <View className="flex-row items-center">
            <View className="w-9 h-9 rounded-full bg-blue-50 items-center justify-center mr-3">
              <Phone size={17} color="#2563EB" />
            </View>
            <TextInput
              accessibilityLabel={`Phone number ${index + 1}`}
              keyboardType="phone-pad"
              placeholder="+919876543210"
              value={row.phone_number}
              onChangeText={phone_number => changeNumber(index, phone_number)}
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
              className={`flex-1 border-2 rounded-xl px-3 py-2.5 text-gray-800 font-medium ${fieldError ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"}`}
            />
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove number ${index + 1}`} onPress={() => onChange(contacts.filter((_, itemIndex) => itemIndex !== index))} className="w-9 h-9 rounded-full bg-red-50 items-center justify-center ml-3" hitSlop={8}>
              <Trash2 size={17} color="#DC2626" />
            </Pressable>
          </View>
          {!!fieldError && <Text className="text-red-600 text-xs mt-2 ml-12">{String(fieldError)}</Text>}
        </View>;
      })}
    </View>}

    {contacts.length === 0 && <View className="bg-blue-50 border border-dashed border-blue-200 rounded-2xl p-5 items-center mb-3">
      <Phone size={22} color="#2563EB" />
      <Text className="text-gray-800 font-semibold mt-2">No WhatsApp number added</Text>
      <Text className="text-gray-500 text-center text-sm mt-1">Add a number to allow the dealer to book through WhatsApp.</Text>
    </View>}

    <Pressable accessibilityRole="button" accessibilityLabel="Add WhatsApp number" onPress={addNumber} className="flex-row items-center justify-center border-2 border-blue-200 bg-blue-50 rounded-xl py-3.5 active:bg-blue-100">
      <CirclePlus size={19} color="#2563EB" />
      <Text className="text-blue-700 font-semibold ml-2">Add another number</Text>
    </Pressable>
  </View>;
}
