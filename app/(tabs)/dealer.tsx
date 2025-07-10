// Adapted from Agent Management to Dealer Management
import useDealer from "@/hooks/use-dealer";
import api from "@/utils/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoveLeft } from "lucide-react-native";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

// Dealer type
type Dealer = {
  id: number;
  password?: string;
  username: string;
  is_active: boolean;
  calculate_str: string;
  secret_pin: number;
  commission: number;
  single_digit_number_commission: number;
  cap_amount: number;
};


const DealerForm = ({
  onSubmit,
  defaultValues = {},
  onCancel,
}: {
  onSubmit: (data: any) => void;
  defaultValues?: Partial<Dealer>;
  onCancel: () => void;
}) => {
  const [form, setForm] = useState({
    username: defaultValues.username || "",
    password: "", // Always start with an empty password for security
    is_active: defaultValues.is_active ?? true,
    calculate_str: defaultValues.calculate_str || "",
    secret_pin: defaultValues.secret_pin?.toString() || "",
    commission: defaultValues.commission?.toString() || "",
    single_digit_number_commission:
      defaultValues.single_digit_number_commission?.toString() || "",
    cap_amount: defaultValues.cap_amount?.toString() || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.username.trim()) newErrors.username = "Username is required";
    // Password is only required for new creations
    if (!defaultValues?.id && !form.password.trim())
      newErrors.password = "Password is required";
    if (
      form.secret_pin.length !== 4 ||
      !/^\d{4}$/.test(form.secret_pin.trim())
    )
      newErrors.secret_pin = "Secret PIN must be 4 digits";
    if (Number(form.commission) < 0)
      newErrors.commission = "Commission cannot be negative";
    if (Number(form.cap_amount) < 0)
      newErrors.cap_amount = "Cap amount cannot be negative";
    if (Number(form.single_digit_number_commission) < 0)
      newErrors.single_digit_number_commission = "Single digit commission cannot be negative";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const preparedData: Partial<Dealer> = {
      ...form,
      secret_pin: Number(form.secret_pin),
      commission: Number(form.commission),
      single_digit_number_commission: Number(form.single_digit_number_commission),
      cap_amount: Number(form.cap_amount),
    };

    // Only include password if it's set (for new creation or explicit update)
    if (form.password.trim() !== "") {
      preparedData.password = form.password;
    } else if (defaultValues.id) {
        // If it's an edit and password is empty, ensure it's not sent to avoid accidental overwrite
        delete preparedData.password;
    }

    onSubmit(preparedData);
  };

  const inputFields = [
    { key: "username", label: "Username", keyboardType: "default" as const, secureTextEntry: false, icon: "👤" },
    { key: "password", label: "Password", keyboardType: "default" as const, secureTextEntry: true, optional: !!defaultValues?.id, icon: "🔒" }, // Optional for edit
    { key: "calculate_str", label: "Calculate String", keyboardType: "default" as const, secureTextEntry: false, icon: "🧮" },
    { key: "secret_pin", label: "Secret PIN", keyboardType: "numeric" as const, secureTextEntry: true, icon: "🔑" },
    { key: "commission", label: "Commission (%)", keyboardType: "numeric" as const, secureTextEntry: false, icon: "💰" },
    { key: "single_digit_number_commission", label: "Single Digit Commission (%)", keyboardType: "numeric" as const, secureTextEntry: false, icon: "🎯" },
    { key: "cap_amount", label: "Cap Amount", keyboardType: "numeric" as const, secureTextEntry: false, icon: "💲" },
  ];

  return (
    <View className="flex-1 bg-gradient-to-br from-gray-50 to-blue-50">
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Header */}
      <View className="bg-white shadow-sm border-b border-gray-100">
        <View className="flex-row items-center justify-between px-6 pt-12 pb-4">
          <TouchableOpacity
            onPress={onCancel}
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center active:scale-95"
            activeOpacity={0.7}
          >
            <MoveLeft size={24} color="#4B5563" />
          </TouchableOpacity>

          <Text className="text-xl font-bold text-gray-800">
            {defaultValues?.id ? "Edit Dealer" : "Create Dealer"}
          </Text>

          <View className="w-10">
            {/* Spacer */}
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0} // Adjust as needed if header overlaps
      >
        <ScrollView
          className="flex-1 px-6 pt-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 50 }} // Add padding to the bottom
        >
          {inputFields.map(({ key, label, keyboardType, secureTextEntry, optional, icon }) => {
            const isFocused = focusedField === key;
            const hasError = !!errors[key];
            const hasValue = !!form[key as keyof typeof form]; // Check if the field has any value

            return (
              <View key={key} className="mb-6">
                <Text className="text-gray-700 font-semibold mb-2 ml-1">
                  <Text>{icon} </Text>
                  <Text>{label}</Text>
                  {!optional && <Text className="text-red-500"> *</Text>}
                </Text>

                <View className={`relative ${hasError ? 'mb-1' : ''}`}>
                  <TextInput
                    placeholder={optional ? `${label} (optional)` : `Enter ${label.toLowerCase()}`}
                    className={`
                      border-2 rounded-xl px-4 py-4 bg-white text-gray-800 font-medium
                      ${hasError
                        ? 'border-red-300 bg-red-50'
                        : isFocused
                          ? 'border-blue-400 bg-blue-50'
                          : hasValue // Apply green if it has a value and no error
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-200'
                      }
                      shadow-sm
                    `}
                    value={
                      typeof form[key as keyof typeof form] === "boolean"
                        ? form[key as keyof typeof form]
                          ? "true"
                          : "false"
                        : (form[key as keyof typeof form] as string)
                    }
                    onChangeText={(text) => handleChange(key, text)}
                    onFocus={() => setFocusedField(key)}
                    onBlur={() => setFocusedField(null)}
                    keyboardType={key.includes("commission") || key === "cap_amount" || key === "secret_pin" ? "numeric" : keyboardType}
                    secureTextEntry={secureTextEntry}
                    maxLength={key === "secret_pin" ? 4 : undefined}
                    autoCapitalize={key === "username" ? "none" : "sentences"}
                    placeholderTextColor="#9CA3AF"
                  />

                  {/* Success indicator (only for non-password fields with a value and no error) */}
                  {hasValue && !hasError && !isFocused && key !== "password" && (
                    <View className="absolute right-4 top-1/2 -mt-2">
                      <Text className="text-green-500 text-lg">✓</Text>
                    </View>
                  )}
                </View>

                {hasError && (
                  <Text className="text-red-500 text-sm mt-1 ml-1 font-medium">
                    {errors[key]}
                  </Text>
                )}
              </View>
            );
          })}

          {/* Status Toggle */}
          <View className="mb-8">
            <Text className="text-gray-700 font-semibold mb-3 ml-1">
              <Text>🔄</Text>
              <Text> Account Status</Text>
            </Text>
            <TouchableOpacity
              onPress={() => handleChange('is_active', (!form.is_active).toString())}
              className={`
                flex-row items-center justify-between p-4 rounded-xl border-2
                ${form.is_active
                  ? 'bg-green-50 border-green-300'
                  : 'bg-gray-50 border-gray-300'
                }
              `}
              activeOpacity={0.8}
            >
              <Text className="text-gray-700 font-medium">Active Account</Text>
              <View className={`
                w-12 h-6 rounded-full p-1
                ${form.is_active ? 'bg-green-500' : 'bg-gray-400'}
              `}>
                <View className={`
                  w-4 h-4 bg-white rounded-full transition-all duration-200
                  ${form.is_active ? 'ml-6' : 'ml-0'}
                `} />
              </View>
            </TouchableOpacity>
          </View>

          <View className="pb-20">
            {/* Added padding-bottom for the submit button */}
            <TouchableOpacity
              className="bg-blue-600 py-4 rounded-xl shadow-lg active:scale-95"
              onPress={handleSubmit}
              activeOpacity={0.9}
            >
              <Text className="text-white text-center font-bold text-lg">
                {defaultValues?.id ? "Update Dealer" : "Create Dealer"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const DealerCard = ({ item, onEdit, onDelete }: { item: Dealer; onEdit: () => void; onDelete: () => void }) => (
  <View className="bg-white mx-4 mb-4 rounded-xl border border-gray-200 overflow-hidden">
    <View className={`h-1 ${item.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
    <View className="p-5">
      <View className="flex-row justify-between mb-4">
        <Text className="text-lg font-semibold">{item.username}</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={onEdit} className="px-3 py-1 bg-gray-100 rounded-md">
            <Text>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} className="px-3 py-1 bg-red-100 rounded-md">
            <Text className="text-red-600">Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text className="text-sm text-gray-600">Commission: {item.commission}%</Text>
      <Text className="text-sm text-gray-600">Cap: {item.cap_amount}</Text>
    </View>
  </View>
);

export default function DealerManagement() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<Dealer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: dealers = [], isLoading } = useQuery<Dealer[]>({
    queryKey: ["dealers"],
    queryFn: () => api.get("/administrator/dealer/").then((res) => res.data),
  });

  const { createDealer, editDealer, deleteDealer } = useDealer();

  const filteredDealers = dealers.filter(d => d.username.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleCreate = (data: any) => {
    createDealer(data, {
      onSuccess: (newDealer) => {
        queryClient.setQueryData<any[]>(["dealers"], (old) => [newDealer, ...(old || [])]);
        setShowForm(false);
      },
    });
  };

  const handleEdit = (data: any) => {
    editDealer({ ...data, id: editData?.id }, {
      onSuccess: (updated) => {
        queryClient.setQueryData<any[]>(["dealers"], (old) =>
          old?.map(d => (d.id === updated.id ? updated : d)) || []
        );
        setEditData(null);
        setShowForm(false);
      },
    });
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Dealer", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteDealer({ id }, {
            onSuccess: () => {
              queryClient.setQueryData<any[]>(["dealers"], (old) =>
                old?.filter((d) => d.id !== parseInt(id)) || []
              );
            },
          });
        },
      },
    ]);
  };

  if (showForm) {
    return <DealerForm onSubmit={editData ? handleEdit : handleCreate} defaultValues={editData || {}} onCancel={() => { setShowForm(false); setEditData(null); }} />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <View className="bg-white border-b border-gray-200 px-6 pt-10 pb-6">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-2xl font-bold">Dealer Management</Text>
          <TouchableOpacity onPress={() => { setEditData(null); setShowForm(true); }} className="w-12 h-12 bg-blue-600 rounded-full items-center justify-center">
            <Text className="text-white text-2xl">+</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          placeholder="Search dealers..."
          className="bg-gray-100 rounded-lg px-4 py-3 text-gray-800"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="mt-4 text-gray-500">Loading dealers...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredDealers}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 16 }}
          renderItem={({ item }) => (
            <DealerCard
              item={item}
              onEdit={() => { setEditData(item); setShowForm(true); }}
              onDelete={() => handleDelete(item.id.toString())}
            />
          )}
        />
      )}
    </View>
  );
}
