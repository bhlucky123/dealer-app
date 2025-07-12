import useAgent from "@/hooks/use-agent";
import { useAuthStore } from "@/store/auth";
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
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// Agent type
export type Agent = {
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
  const { user } = useAuthStore()
  const [form, setForm] = useState({
    username: defaultValues.username || "",
    password: "",
    is_active: defaultValues.is_active ?? true,
    calculate_str: defaultValues.calculate_str || "",
    secret_pin: defaultValues.secret_pin?.toString() || "",
    commission: defaultValues.commission?.toString() || "",
    single_digit_number_commission:
      defaultValues.single_digit_number_commission?.toString() || "",
    cap_amount: defaultValues.cap_amount?.toString() || "",
    assigned_dealer: user?.id?.toString() || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.assigned_dealer || !form.assigned_dealer.trim()) {
      newErrors.assigned_dealer = "Dealer ID is required";
    }
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
    { key: "username", label: "Username", keyboardType: "default" as const, secureTextEntry: false, icon: "@" },
    { key: "password", label: "Password", keyboardType: "default" as const, secureTextEntry: true, optional: !!defaultValues?.id, icon: "🔒" },
    { key: "calculate_str", label: "Calculate String", keyboardType: "default" as const, secureTextEntry: false, icon: "🧮" },
    { key: "secret_pin", label: "Secret PIN", keyboardType: "numeric" as const, secureTextEntry: true, icon: "🔐" },
    { key: "commission", label: "Commission (%)", keyboardType: "numeric" as const, secureTextEntry: false, icon: "💰" },
    { key: "single_digit_number_commission", label: "Single Digit Commission (%)", keyboardType: "numeric" as const, secureTextEntry: false, icon: "📊" },
    { key: "cap_amount", label: "Cap Amount", keyboardType: "numeric" as const, secureTextEntry: false, icon: "🎯" },
  ];

  return (
    <View className="flex-1">
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Header */}
      <View className="bg-white shadow-sm border-b border-gray-100">
        <View className="flex-row items-center justify-between px-6 pt-12 pb-4">
          <TouchableOpacity
            onPress={onCancel}
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center active:scale-95"
            activeOpacity={0.7}
          >
            <MoveLeft />
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
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          className="flex-1 px-6 pt-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 50 }}
        >
          {inputFields.map(({ key, label, keyboardType, secureTextEntry, optional, icon }) => {
            const isFocused = focusedField === key;
            const hasError = !!errors[key];
            const hasValue = !!form[key as keyof typeof form];

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
                          : hasValue
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
                        : (form[key as keyof typeof form] as string | undefined)
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

                  {/* Success indicator */}
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
              onPress={() => handleChange('is_active', !form.is_active)}
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
  onDelete,
}: {
  item: Agent;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  return (
    <View className="bg-white mx-4 mb-4 rounded-xl border border-gray-200 overflow-hidden">
      {/* Status bar */}
      <View className={`h-1 ${item.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />

      <View className="p-5">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <View
              className={`w-11 h-11 rounded-full justify-center items-center mr-3 ${item.is_active ? 'bg-green-100' : 'bg-gray-100'
                }`}
            >
              <Text className="text-xl">👤</Text>
            </View>

            <View>
              <Text className="text-lg font-semibold text-gray-800">{item.username}</Text>
              <Text
                className={`text-xs font-medium ${item.is_active ? 'text-green-600' : 'text-gray-500'
                  }`}
              >
                {item.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={onEdit}
              className="px-3 py-1.5 bg-gray-100 rounded-md"
              activeOpacity={0.8}
            >
              <Text className="text-gray-800 text-sm">Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onDelete}
              className="px-3 py-1.5 bg-red-100 rounded-md"
              activeOpacity={0.8}
            >
              <Text className="text-red-600 text-sm">Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Info grid */}
        <View className="flex-row flex-wrap -mx-2">
          {[
            {
              label: 'Commission',
              value: `${item.commission}%`,
            },
            {
              label: 'Cap Amount',
              value: `$${item?.cap_amount?.toLocaleString() || '0'}`,
            },
            {
              label: 'Single Digit',
              value: `${item.single_digit_number_commission}%`,
            },
            {
              label: 'Dealer ID',
              value: `#${item.assigned_dealer}`,
            },
          ].map(({ label, value }, index) => (
            <View key={index} className="w-1/2 px-2 mb-3">
              <View className="bg-gray-50 p-3 rounded-lg">
                <Text className="text-xs text-gray-500 font-medium uppercase mb-1">
                  {label}
                </Text>
                <Text className="text-base font-semibold text-gray-800">{value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Last login */}
        {item.last_login && (
          <View className="pt-4 border-t border-gray-100 mt-2">
            <Text className="text-xs text-gray-500">
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
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: agents = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<Agent[]>({
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
    console.log("editData", editData);
    
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

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
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
      <View className="bg-white border-b border-gray-200 shadow-sm">
        <View className="px-6 pt-10 pb-6">
          <View className="flex-row justify-between items-center  mb-4" >
            {/* Title */}
            <Text className="text-2xl font-bold text-gray-800">
              Agent Management
            </Text>
            <TouchableOpacity
              onPress={() => {
                setEditData(null);
                setShowForm(true);
              }}
              className="w-16 h-16 bg-blue-600 rounded-full shadow-xl items-center justify-center active:scale-95"
              activeOpacity={0.9}
            >
              <Text className="text-white text-2xl font-light">+</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View className="relative">
            <TextInput
              placeholder="Search agents..."
              className="bg-gray-100 rounded-lg px-4 py-3 pr-10 text-gray-800"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
            <View className="absolute right-3 top-1/2 -mt-3">
              <Text className="text-gray-400 text-base">🔍</Text>
            </View>
          </View>

          {/* Stats */}
          <View className="flex-row justify-between mt-5">
            {[
              {
                label: 'Total',
                count: agents.length,
                bg: 'bg-gray-50',
                text: 'text-gray-700',
              },
              {
                label: 'Active',
                count: agents.filter(a => a.is_active).length,
                bg: 'bg-green-50',
                text: 'text-green-700',
              },
              {
                label: 'Inactive',
                count: agents.filter(a => !a.is_active).length,
                bg: 'bg-red-50',
                text: 'text-red-700',
              },
            ].map((stat, index) => (
              <View
                key={index}
                className={`flex-1 mx-1 px-4 py-2 rounded-lg ${stat.bg}`}
              >
                <Text className={`text-sm font-medium ${stat.text}`}>{stat.label}</Text>
                <Text className={`text-xl font-bold ${stat.text}`}>{stat.count}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Content */}
      {isLoading || isFetching ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-gray-500 mt-4 font-medium">Loading agents...</Text>
        </View>
      ) : isError ? (
        <View className="flex-1 justify-center items-center px-8">
          <Text className="text-6xl mb-4">⚠️</Text>
          <Text className="text-xl font-bold text-gray-800 mb-2">
            Failed to load agents
          </Text>
          <Text className="text-gray-500 text-center mb-8">
            {error && typeof error === "object" && "message" in error
              ? (error as any).message
              : "An unexpected error occurred. Please try again."}
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="bg-blue-600 px-8 py-4 rounded-xl active:scale-95"
            activeOpacity={0.9}
          >
            <Text className="text-white font-bold text-lg">Retry</Text>
          </TouchableOpacity>
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
          {/* Allow pull to refresh even on empty */}
          <FlatList
            data={[]}
            renderItem={null}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            style={{ width: 0, height: 0 }}
          />
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}