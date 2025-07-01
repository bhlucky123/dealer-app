import useAgent from "@/hooks/use-agent";
import api from "@/utils/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  View
} from "react-native";

// Agent type
type Agent = {
  id: number;
  password: string;
  last_login: string | null;
  is_superuser: boolean;
  username: string;
  is_staff: boolean;
  is_active: boolean;
  date_joined: string;
  calculate_str: string;
  secret_pin: number;
  user_type: string;
  commission: number;
  single_digit_number_commission: number;
  cap_amount: number;
  assigned_dealer: number;
  created_user: number;
  groups: any[];
  user_permissions: any[];
};

// Enhanced Form component with better animations and styling
const AgentForm = ({
  onSubmit,
  defaultValues = {},
  onCancel,
}: {
  onSubmit: (data: any) => void;
  defaultValues?: Partial<Agent>;
  onCancel: () => void;
}) => {
  const [form, setForm] = useState({
    name: defaultValues.name || "",
    username: defaultValues.username || "",
    password: "",
    is_active: defaultValues.is_active ?? true,
    calculate_str: defaultValues.calculate_str || "",
    secret_pin: defaultValues.secret_pin?.toString() || "1234",
    commission: defaultValues.commission?.toString() || "1",
    single_digit_number_commission:
      defaultValues.single_digit_number_commission?.toString() || "0.5",
    cap_amount: defaultValues.cap_amount?.toString() || "1000",
    assigned_dealer: defaultValues.assigned_dealer?.toString() || "1",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.username.trim()) newErrors.username = "Username is required";
    if (!defaultValues?.id && !form.password.trim())
      newErrors.password = "Password is required";
    if (
      form.secret_pin.length !== 4 ||
      !/^\d{4}$/.test(form.secret_pin.trim())
    )
      newErrors.secret_pin = "Secret PIN must be 4 digits";
    if (Number(form.commission) < 0)
      newErrors.commission = "Commission cannot be negative";
    if (Number(form.cap_amount) < 0) newErrors.cap_amount = "Cap cannot be negative";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const preparedData = {
      ...form,
      secret_pin: Number(form.secret_pin),
      commission: Number(form.commission),
      single_digit_number_commission: Number(form.single_digit_number_commission),
      cap_amount: Number(form.cap_amount),
      assigned_dealer: Number(form.assigned_dealer),
    };

    onSubmit(preparedData);
  };

  const inputFields = [
    { key: "name", label: "Full Name", keyboardType: "default" as const, secureTextEntry: false, icon: "👤" },
    { key: "username", label: "Username", keyboardType: "default" as const, secureTextEntry: false, icon: "@" },
    { key: "password", label: "Password", keyboardType: "default" as const, secureTextEntry: true, optional: !!defaultValues?.id, icon: "🔒" },
    { key: "calculate_str", label: "Calculate String", keyboardType: "default" as const, secureTextEntry: false, icon: "🧮" },
    { key: "secret_pin", label: "Secret PIN", keyboardType: "numeric" as const, secureTextEntry: true, icon: "🔐" },
    { key: "commission", label: "Commission (%)", keyboardType: "numeric" as const, secureTextEntry: false, icon: "💰" },
    { key: "single_digit_number_commission", label: "Single Digit Commission (%)", keyboardType: "numeric" as const, secureTextEntry: false, icon: "📊" },
    { key: "cap_amount", label: "Cap Amount", keyboardType: "numeric" as const, secureTextEntry: false, icon: "🎯" },
    { key: "assigned_dealer", label: "Assigned Dealer ID", keyboardType: "numeric" as const, secureTextEntry: false, icon: "🏪" },
  ];

  return (
    <View className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100">
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {/* Header */}
      <View className="bg-white shadow-sm border-b border-gray-100">
        <View className="flex-row items-center justify-between px-6 pt-12 pb-4">
          <TouchableOpacity
            onPress={onCancel}
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
            activeOpacity={0.7}
          >
            <Text className="text-gray-600 text-lg">←</Text>
          </TouchableOpacity>
          
          <Text className="text-xl font-bold text-gray-800">
            {defaultValues?.id ? "Edit Agent" : "Create Agent"}
          </Text>
          
          <View className="w-10" />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-6 pt-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {inputFields.map(({ key, label, keyboardType, secureTextEntry, optional, icon }) => {
            const isFocused = focusedField === key;
            const hasError = !!errors[key];
            const hasValue = !!form[key as keyof typeof form];
            
            return (
              <View key={key} className="mb-6">
                <Text className="text-gray-700 font-semibold mb-2 ml-1">
                  {icon} {label}
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
                          : hasValue 
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-200'
                      }
                      shadow-sm
                    `}
                    value={form[key as keyof typeof form]}
                    onChangeText={(text) => handleChange(key, text)}
                    onFocus={() => setFocusedField(key)}
                    onBlur={() => setFocusedField(null)}
                    keyboardType={keyboardType}
                    secureTextEntry={secureTextEntry}
                    maxLength={key === "secret_pin" ? 4 : undefined}
                    autoCapitalize={key === "username" ? "none" : "sentences"}
                    placeholderTextColor="#9CA3AF"
                  />
                  
                  {/* Success indicator */}
                  {hasValue && !hasError && !isFocused && (
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
              🔄 Account Status
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

          <View className="pb-8">
            <TouchableOpacity
              className="bg-gradient-to-r from-blue-600 to-blue-700 py-4 rounded-xl shadow-lg active:scale-95"
              onPress={handleSubmit}
              activeOpacity={0.9}
            >
              <Text className="text-white font-bold text-center text-lg">
                {defaultValues?.id ? "Update Agent" : "Create Agent"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

// Enhanced Agent Card Component
const AgentCard = ({ 
  item, 
  onEdit, 
  onDelete 
}: { 
  item: Agent; 
  onEdit: () => void; 
  onDelete: () => void; 
}) => {
  return (
    <View className="bg-white mx-4 mb-4 rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Status indicator */}
      <View className={`h-1 ${item.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
      
      <View className="p-6">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <View className={`
              w-12 h-12 rounded-full items-center justify-center mr-3
              ${item.is_active ? 'bg-green-100' : 'bg-gray-100'}
            `}>
              <Text className="text-2xl">👤</Text>
            </View>
            <View>
              <Text className="text-xl font-bold text-gray-800">
                {item.username}
              </Text>
              <Text className={`text-sm font-medium ${
                item.is_active ? 'text-green-600' : 'text-red-600'
              }`}>
                {item.is_active ? '● Active' : '● Inactive'}
              </Text>
            </View>
          </View>
          
          <View className="flex-row space-x-2">
            <TouchableOpacity
              onPress={onEdit}
              className="bg-blue-100 px-4 py-2 rounded-lg active:scale-95"
              activeOpacity={0.8}
            >
              <Text className="text-blue-700 font-semibold">Edit</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={onDelete}
              className="bg-red-100 px-4 py-2 rounded-lg active:scale-95"
              activeOpacity={0.8}
            >
              <Text className="text-red-700 font-semibold">Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid */}
        <View className="flex-row flex-wrap -mx-2">
          <View className="w-1/2 px-2 mb-3">
            <View className="bg-blue-50 p-3 rounded-xl">
              <Text className="text-blue-600 text-xs font-semibold uppercase tracking-wide">
                Commission
              </Text>
              <Text className="text-blue-800 text-lg font-bold">
                {item.commission}%
              </Text>
            </View>
          </View>
          
          <View className="w-1/2 px-2 mb-3">
            <View className="bg-purple-50 p-3 rounded-xl">
              <Text className="text-purple-600 text-xs font-semibold uppercase tracking-wide">
                Cap Amount
              </Text>
              <Text className="text-purple-800 text-lg font-bold">
                ${item?.cap_amount?.toLocaleString()}
              </Text>
            </View>
          </View>
          
          <View className="w-1/2 px-2">
            <View className="bg-green-50 p-3 rounded-xl">
              <Text className="text-green-600 text-xs font-semibold uppercase tracking-wide">
                Single Digit
              </Text>
              <Text className="text-green-800 text-lg font-bold">
                {item.single_digit_number_commission}%
              </Text>
            </View>
          </View>
          
          <View className="w-1/2 px-2">
            <View className="bg-orange-50 p-3 rounded-xl">
              <Text className="text-orange-600 text-xs font-semibold uppercase tracking-wide">
                Dealer ID
              </Text>
              <Text className="text-orange-800 text-lg font-bold">
                #{item.assigned_dealer}
              </Text>
            </View>
          </View>
        </View>

        {/* Last login info */}
        {item.last_login && (
          <View className="mt-4 pt-4 border-t border-gray-100">
            <Text className="text-gray-500 text-sm">
              Last login: {new Date(item.last_login).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

// Main Agent Tab with enhanced UI
export default function AgentTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<Agent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: () => api.get("/agent/agent/").then((res) => res.data),
  });

  const { createAgent, editAgent, deleteAgent } = useAgent();

  // Filter agents based on search
  const filteredAgents = agents.filter(agent =>
    agent.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (data: any) => {
    createAgent(data, {
      onSuccess: (newAgent: any) => {
        queryClient.setQueryData<any[]>(["agents"], (old) => [
          newAgent,
          ...(old || []),
        ]);
        setShowForm(false);
      },
    });
  };

  const handleEdit = (data: any) => {
    editAgent(
      { ...data, id: editData?.id },
      {
        onSuccess: (updatedAgent) => {
          queryClient.setQueryData<any[]>(["agents"], (old) =>
            old?.map((a) => (a.id === updatedAgent.id ? updatedAgent : a)) || []
          );
          setEditData(null);
          setShowForm(false);
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Agent", 
      "This action cannot be undone. Are you sure you want to delete this agent?", 
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          onPress: () => {
            deleteAgent(
              { id },
              {
                onSuccess: () => {
                  queryClient.setQueryData<any[]>(["agents"], (old) =>
                    old?.filter((a) => a.id !== parseInt(id)) || []
                  );
                },
              }
            );
          },
          style: "destructive",
        },
      ]
    );
  };

  if (showForm) {
    return (
      <AgentForm
        onSubmit={editData ? handleEdit : handleCreate}
        defaultValues={editData || {}}
        onCancel={() => {
          setShowForm(false);
          setEditData(null);
        }}
      />
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {/* Header */}
      <View className="bg-white shadow-sm border-b border-gray-100">
        <View className="px-6 pt-12 pb-6">
          <Text className="text-3xl font-bold text-gray-800 mb-4">
            Agent Management
          </Text>
          
          {/* Search Bar */}
          <View className="relative">
            <TextInput
              placeholder="Search agents..."
              className="bg-gray-100 rounded-xl px-4 py-3 pr-10 text-gray-800"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
            <View className="absolute right-3 top-1/2 -mt-2">
              <Text className="text-gray-400 text-lg">🔍</Text>
            </View>
          </View>
          
          {/* Stats */}
          <View className="flex-row justify-between mt-4">
            <View className="bg-blue-50 px-4 py-2 rounded-lg">
              <Text className="text-blue-600 text-sm font-semibold">Total</Text>
              <Text className="text-blue-800 text-xl font-bold">{agents.length}</Text>
            </View>
            <View className="bg-green-50 px-4 py-2 rounded-lg">
              <Text className="text-green-600 text-sm font-semibold">Active</Text>
              <Text className="text-green-800 text-xl font-bold">
                {agents.filter(a => a.is_active).length}
              </Text>
            </View>
            <View className="bg-red-50 px-4 py-2 rounded-lg">
              <Text className="text-red-600 text-sm font-semibold">Inactive</Text>
              <Text className="text-red-800 text-xl font-bold">
                {agents.filter(a => !a.is_active).length}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-gray-500 mt-4 font-medium">Loading agents...</Text>
        </View>
      ) : filteredAgents.length === 0 ? (
        <View className="flex-1 justify-center items-center px-8">
          <Text className="text-6xl mb-4">👥</Text>
          <Text className="text-xl font-bold text-gray-800 mb-2">
            {searchQuery ? 'No agents found' : 'No agents yet'}
          </Text>
          <Text className="text-gray-500 text-center mb-8">
            {searchQuery 
              ? `No agents match "${searchQuery}"`
              : 'Get started by creating your first agent'
            }
          </Text>
          {!searchQuery && (
            <TouchableOpacity
              onPress={() => setShowForm(true)}
              className="bg-blue-600 px-8 py-4 rounded-xl active:scale-95"
              activeOpacity={0.9}
            >
              <Text className="text-white font-bold text-lg">Create First Agent</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredAgents}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <AgentCard
              item={item}
              onEdit={() => {
                setEditData(item);
                setShowForm(true);
              }}
              onDelete={() => handleDelete(item.id.toString())}
            />
          )}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        onPress={() => {
          setEditData(null);
          setShowForm(true);
        }}
        className="absolute bottom-8 right-6 w-16 h-16 bg-blue-600 rounded-full shadow-xl items-center justify-center active:scale-95"
        activeOpacity={0.9}
      >
        <Text className="text-white text-2xl font-light">+</Text>
      </TouchableOpacity>
    </View>
  );
}