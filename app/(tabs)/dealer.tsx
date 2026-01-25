import { PrizeConfigBlock } from "@/components/prize-config";
import useDealer from "@/hooks/use-dealer";
import { useAuthStore } from "@/store/auth";
import { amountHandler } from "@/utils/amount";
import api from "@/utils/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Eye, EyeOff, MoveLeft } from "lucide-react-native";
import { useState } from "react";
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
import { Card, PRIZE_CONFIG_FIELDS } from "./more";

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

    is_prize_set?: boolean;
    "box_direct": string,
    "box_indirect": string,
    "double_digit_prize": string,
    "single_digit_prize": string,
    "super_complementary_prize": string,
    "super_fifth_prize": string,
    "super_first_prize": string,
    "super_fourth_prize": string,
    "super_second_prize": string,
    "super_third_prize": string
};

// Eye icon SVG (simple inline, no extra dependency)
const EyeIcon = ({ visible }: { visible: boolean }) => (
    <View style={{ width: 24, height: 24, justifyContent: "center", alignItems: "center" }}>
        {visible ? (
            // Open eye
            <Eye color="#6b7280" size={20} />
        ) : (
            // Closed eye (using emoji for simplicity)
            <EyeOff color="#6b7280" size={20} />
        )}
    </View>
);

const DealerForm = ({
    onSubmit,
    defaultValues = {},
    onCancel,
    submitting = false
}: {
    onSubmit: (data: any) => void;
    defaultValues?: Partial<Dealer>;
    onCancel: () => void;
    submitting?: boolean
}) => {
    const [form, setForm] = useState({
        username: defaultValues.username || "",
        password: "", // Always start with an empty password for security
        is_active: defaultValues.is_active ?? true,
        calculate_str: defaultValues.calculate_str || "",
        secret_pin: defaultValues.secret_pin?.toString() || "",
        commission: defaultValues.commission?.toString() || "",
        single_digit_number_commission: defaultValues.single_digit_number_commission?.toString() || "",
        cap_amount: defaultValues.cap_amount?.toString() || "",
        is_prize_set: defaultValues?.is_prize_set || false,
        "box_direct": defaultValues?.box_direct || "",
        "box_indirect": defaultValues?.box_indirect || "",
        "double_digit_prize": defaultValues?.double_digit_prize || "",
        "single_digit_prize": defaultValues?.single_digit_prize || "",
        "super_complementary_prize": defaultValues?.super_complementary_prize || "",
        "super_fifth_prize": defaultValues?.super_fifth_prize || "",
        "super_first_prize": defaultValues?.super_first_prize || "",
        "super_fourth_prize": defaultValues?.super_fourth_prize || "",
        "super_second_prize": defaultValues?.super_second_prize || "",
        "super_third_prize": defaultValues?.super_third_prize || ""
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);


    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!form.username.trim()) {
            newErrors.username = "Username is required";
        } else if (/\s/.test(form.username)) {
            newErrors.username = "Username should not contain spaces";
        }
        // Password is only required for new creations
        if (!defaultValues?.id && !form.password.trim())
            newErrors.password = "Password is required";
        if (!form?.calculate_str?.trim())
            newErrors.calculate_str = "required";
        if (!form.secret_pin.trim())
            newErrors.secret_pin = "required";
        if (!form?.commission)
            newErrors.commission = "required";
        if (Number(form.commission) < 0)
            newErrors.commission = "Commission cannot be negative";
        if (!form?.single_digit_number_commission)
            newErrors.single_digit_number_commission = "required";
        if (Number(form.single_digit_number_commission) < 0)
            newErrors.single_digit_number_commission = "Single digit Commission cannot be negative";
        if (!form?.cap_amount)
            newErrors.cap_amount = "required";
        if (Number(form.cap_amount) < 0)
            newErrors.cap_amount = "Cap amount cannot be negative";

        if (form?.is_prize_set) {
            if (!form?.single_digit_prize)
                newErrors.single_digit_prize = "Single digit prize is required";
            if (!form?.double_digit_prize)
                newErrors.double_digit_prize = "Double digit prize is required";
            if (!form?.box_direct)
                newErrors.box_direct = "Box Direct is required";
            if (!form?.super_first_prize)
                newErrors.super_first_prize = "Super First Prize is required";
            if (!form?.super_second_prize)
                newErrors.super_second_prize = "Super Second Prize is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (key: string, value: string | boolean) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => ({ ...prev, [key]: "" }));
    };

    const validatePrizeConfig = () => {
        // if(!form.box_direct){
        //     setErrors((prev) => ({ ...prev, ["errMsg"]: "Box Direct is required" }));
        //     return false;
        // }

        // if(!form.box_indirect){
        //     setErrors((prev) => ({ ...prev, ["errMsg"]: "Box Indirect is required" }));
        //     return false;
        // }

        // if(!form.double_digit_prize){
        //     setErrors((prev) => ({ ...prev, ["errMsg"]: "Double Digit Prize is required" }));
        //     return false;
        // }

        // if(!form.){
        //     setErrors((prev) => ({ ...prev, ["errMsg"]: "Double Digit Prize is required" }));
        //     return false;
        // }






        if (
            !form ||
            PRIZE_CONFIG_FIELDS.some(
                ({ key }) =>
                    form[key] === undefined ||
                    form[key] === null ||
                    isNaN(Number(form[key]))
            )
        ) {
            setErrors((prev) => ({ ...prev, ["errMsg"]: "All fields are required and must be numbers" }));

            return false;
        }
        setErrors((prev) => ({ ...prev, ["errMsg"]: "" }));

        return true
    };

    const handleSubmit = () => {
        console.log("validatePrizeConfig", validatePrizeConfig(), "!validate()", validate())
        if (!validate()) {
            console.log("inside if");
            return
        }
        console.log("after validation");

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
        { key: "secret_pin", label: "Secret PIN", keyboardType: "numeric" as const, secureTextEntry: false, icon: "🔑" },
        { key: "commission", label: "Commission", keyboardType: "numeric" as const, secureTextEntry: false, icon: "💰" },
        { key: "single_digit_number_commission", label: "Single Digit Commission", keyboardType: "numeric" as const, secureTextEntry: false, icon: "🎯" },
        { key: "cap_amount", label: "Cap Amount", keyboardType: "numeric" as const, secureTextEntry: false, icon: "💲" },
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

                        // Only for password field: show/hide logic and eye icon
                        if (key === "password") {
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
                                            keyboardType={keyboardType}
                                            secureTextEntry={!showPassword}
                                            autoCapitalize="none"
                                            placeholderTextColor="#9CA3AF"
                                        />
                                        {/* Eye icon button */}
                                        <TouchableOpacity
                                            onPress={() => setShowPassword((v) => !v)}
                                            style={{
                                                position: "absolute",
                                                right: 12,
                                                top: "50%",
                                                marginTop: -12,
                                                padding: 4,
                                                zIndex: 10,
                                            }}
                                            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <EyeIcon visible={showPassword} />
                                        </TouchableOpacity>
                                    </View>
                                    {hasError && (
                                        <Text className="text-red-500 text-sm mt-1 ml-1 font-medium">
                                            {errors[key]}
                                        </Text>
                                    )}
                                </View>
                            );
                        }

                        // All other fields
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
                            onPress={() => {
                                handleChange('is_active', !form.is_active)
                            }}
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

                    <Card>
                        <View>
                            <TouchableOpacity
                                onPress={() => {
                                    setForm((prev) => ({ ...form, is_prize_set: !prev?.is_prize_set }))
                                }}
                                className={`
                flex-row items-center justify-between p-4 rounded-xl border-2
                ${form.is_active
                                        ? 'bg-green-50 border-green-300'
                                        : 'bg-gray-50 border-gray-300'
                                    }
              `}
                                activeOpacity={0.8}
                            >
                                <Text className="text-gray-700 font-medium">Prize Config</Text>
                                <View className={`
                w-12 h-6 rounded-full p-1
                ${form?.is_prize_set ? 'bg-green-500' : 'bg-gray-400'}
              `}>
                                    <View className={`
                  w-4 h-4 bg-white rounded-full transition-all duration-200
                  ${form?.is_prize_set ? 'ml-6' : 'ml-0'}
                `} />
                                </View>
                            </TouchableOpacity>
                        </View>
                        {
                            form?.is_prize_set &&
                            <PrizeConfigBlock form={form} errors={errors} onChange={(data) => {
                                console.log("data", data);

                                if (Object.keys.length > 0) {
                                    setErrors({})
                                }
                                setForm((prev) => ({ ...prev, ...data } as any))
                            }} />
                        }
                    </Card>


                    <View className="pb-20 my-12 mb-12">
                        {/* Added padding-bottom for the submit button */}
                        <TouchableOpacity
                            className={`bg-blue-600 py-4 rounded-xl shadow-lg active:scale-95 ${submitting ? 'opacity-60' : ''}`}
                            onPress={handleSubmit}
                            activeOpacity={0.9}
                            disabled={submitting}
                        >
                            <Text className="text-white text-center font-bold text-lg">
                                {submitting
                                    ? (defaultValues?.id ? "Updating..." : "Creating...")
                                    : (defaultValues?.id ? "Update Dealer" : "Create Dealer")}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const DealerCard = ({ item, onEdit, onDelete }: { item: Dealer; onEdit: () => void; onDelete: () => void }) => {
    const { user } = useAuthStore();
    const router = useRouter()

    const onReport = () => {
        router.push("/reports/[id]")
    }

    return (
        < View className="bg-white mx-4 mb-4 rounded-xl border border-gray-200 overflow-hidden" >
            <View className={`h-1 ${item.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
            <View className="p-5">
                <View className="flex-row justify-between mb-4">
                    <Text className="text-lg font-semibold">{item.username}</Text>
                    <View className="flex-row gap-2">

                        <TouchableOpacity onPress={() => {
                            router.push(`/agent/${item.id}`)
                        }} className="px-3 py-1 bg-gray-100 rounded-md">
                            <Text>Agent</Text>
                        </TouchableOpacity>
                        {
                            user?.user_type === "ADMIN" && <TouchableOpacity onPress={onEdit} className="px-3 py-1 bg-gray-100 rounded-md">
                                <Text>Edit</Text>
                            </TouchableOpacity>
                        }
                        {
                            user?.user_type === "ADMIN" &&
                            <TouchableOpacity onPress={onDelete} className="px-3 py-1 bg-red-100 rounded-md">
                                <Text className="text-red-600">Delete</Text>
                            </TouchableOpacity>}
                    </View>
                </View>
                <View className="flex-row items-center mb-2">
                    <Text className="text-xs text-gray-500 mr-2">💰</Text>
                    <Text className="text-sm text-gray-700 font-medium flex-1">Commission:</Text>
                    <Text className="text-sm text-gray-800 font-bold">
                        ₹{amountHandler(item.commission)}
                    </Text>
                </View>
                <View className="flex-row items-center mb-2">
                    <Text className="text-xs text-gray-500 mr-2">🎯</Text>
                    <Text className="text-sm text-gray-700 font-medium flex-1">Single Digit Comm.:</Text>
                    <Text className="text-sm text-gray-800 font-bold">
                        ₹{amountHandler(item.single_digit_number_commission)}
                    </Text>
                </View>
                <View className="flex-row items-center">
                    <Text className="text-xs text-gray-500 mr-2">💲</Text>
                    <Text className="text-sm text-gray-700 font-medium flex-1">Cap Amount:</Text>
                    <Text className="text-sm text-gray-800 font-bold">
                        ₹{amountHandler(item.cap_amount)}
                    </Text>
                </View>

                <View className="flex-row justify-end">
                    {
                        user?.user_type === "ADMIN" &&
                        <TouchableOpacity onPress={() => {
                            router.push({ pathname: "/reports/[id]", params: { id: String(item.id) } })
                        }} className="px-3 py-1 w-24 mt-3 bg-green-100 rounded-md">
                            <Text className="text-center" >Report</Text>
                        </TouchableOpacity>}
                </View>
            </View>
        </View >
    )
};

export default function DealerManagement() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editData, setEditData] = useState<Dealer | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const {
        data: dealers = [],
        isLoading,
        isError,
        error,
        isFetching,
        refetch
    } = useQuery<Dealer[]>({
        queryKey: ["dealers"],
        queryFn: () => api.get("/administrator/dealer/").then((res) => res.data),
        retry: false, // Do not retry on error, only call once
    });
    const { createDealer, editDealer, deleteDealer } = useDealer();



    const filteredDealers = dealers.filter(d => d.username.toLowerCase().includes(searchQuery.toLowerCase()));
    console.log("filteredDealers", filteredDealers);

    const handleCreate = (data: any) => {
        setSubmitting(true)
        createDealer(data, {
            onSuccess: (newDealer) => {
                setSubmitting(false)
                queryClient.setQueryData<any[]>(["dealers"], (old) => [newDealer, ...(old || [])]);
                setShowForm(false);
            },
            onError: (error) => {
                setSubmitting(false)
                console.log("error", error);
                let errorMsg = "Failed to create dealer.";

                // Handle the specific error: {"message": ["Dealer with this calculate_str and secret_pin already exists."], "status": 400}
                if (
                    error?.message &&
                    Array.isArray(error.message) &&
                    error.message.length > 0 &&
                    typeof error.message[0] === "string"
                ) {
                    errorMsg = error.message[0];
                } else if (error?.message && typeof error.message === "object") {
                    // Find the first field with an error message
                    const field = Object.keys(error.message)[0];
                    if (field && Array.isArray(error.message[field]) && error.message[field][0]) {
                        errorMsg = error.message[field][0];
                    }
                } else if (typeof error?.message === "string") {
                    errorMsg = error.message;
                }
                Alert.alert("Error", errorMsg);
            }
        });
    };

    const handleEdit = (data: any) => {
        setSubmitting(true)

        editDealer({ ...data, id: editData?.id }, {
            onSuccess: (updated) => {
                console.log("Success")
                setShowForm(false);
                setSubmitting(false)
                queryClient.setQueryData<any[]>(["dealers"], (old) =>
                    old?.map(d => (d.id === updated.id ? updated : d)) || []
                );
                setEditData(null);
            },
            onError: (err) => {
                console.log("Error", err)
                setSubmitting(false);
                let errorMsg = "Failed to update dealer.";

                if (err?.message) {
                    // If error is an array like: ["Dealer with this calculate_str and secret_pin already exists."]
                    if (Array.isArray(err.message) && err.message.length > 0 && typeof err.message[0] === "string") {
                        errorMsg = err.message[0];
                    } else if (typeof err.message === "string") {
                        // If error is a string and looks like HTML, show generic message
                        if (err.message.trim().startsWith("<!DOCTYPE html") || err.message.trim().startsWith("<html")) {
                            errorMsg = "Something went wrong. Please try again.";
                        } else {
                            errorMsg = err.message;
                        }
                    } else if (typeof err.message === "object" && err.message !== null) {
                        // Handle non_field_errors (array of messages)
                        if (Array.isArray((err.message as any).non_field_errors) && (err.message as any).non_field_errors.length > 0) {
                            errorMsg = (err.message as any).non_field_errors.join("\n");
                        } else if ((err.message as any).detail) {
                            errorMsg = (err.message as any).detail;
                        } else {
                            // Try to get the first field error
                            const firstField = Object.keys(err.message)[0];
                            if (
                                firstField &&
                                Array.isArray((err.message as any)[firstField]) &&
                                (err.message as any)[firstField][0]
                            ) {
                                errorMsg = (err.message as any)[firstField][0];
                            } else {
                                errorMsg = JSON.stringify(err.message);
                            }
                        }
                    }
                }

                Alert.alert("Error", errorMsg);
            }
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
                            refetch()
                        },
                    });
                },
            },
        ]);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await refetch();
        } finally {
            setRefreshing(false);
        }
    };

    if (isError) {
        return (
            <View className="flex-1 justify-center items-center px-8 bg-white">
                <View className="bg-red-50 border border-red-200 rounded-2xl px-6 py-8 shadow-md items-center w-full">
                    <View className="bg-red-100 rounded-full p-4 mb-4">
                        <Text className="text-3xl">⚠️</Text>
                    </View>
                    <Text className="text-red-600 text-xl font-bold mb-2 text-center">Failed to load dealers</Text>
                    <Text className="text-gray-600 mb-6 text-center">
                        {
                            typeof (error as any)?.message === "object" && (error as any)?.message?.detail
                                ? (error as any).message.detail
                                : (typeof (error as any)?.message === "string"
                                    ? (error as any).message
                                    : "An error occurred while loading dealers. Please try again.")
                        }
                    </Text>
                    {/* {((error as any)?.status !== 403) && ( */}
                    <TouchableOpacity
                        onPress={() => refetch()}
                        className="flex-row items-center justify-center bg-blue-600 px-8 py-3 rounded-xl shadow active:scale-95"
                        activeOpacity={0.85}
                    >
                        <Text className="text-white font-bold text-lg mr-2">Retry</Text>
                        <Text className="text-white text-xl">↻</Text>
                    </TouchableOpacity>
                    {/* )} */}
                </View>
            </View>
        )
    }
    if (showForm) {
        return <DealerForm onSubmit={editData ? handleEdit : handleCreate} submitting={submitting} defaultValues={editData || {}} onCancel={() => { setShowForm(false); setEditData(null); }} />;
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
                    placeholderTextColor="#9ca3af"
                />
            </View>
            {isLoading && !isFetching ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text className="mt-4 text-gray-500">Loading dealers...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredDealers || []}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ paddingBottom: 100, paddingTop: 16 }}
                    renderItem={({ item }) => (
                        <DealerCard
                            item={item}
                            onEdit={() => { setEditData(item); setShowForm(true); }}
                            onDelete={() => handleDelete(item.id.toString())}
                        />
                    )}
                    refreshControl={
                        <RefreshControl
                            refreshing={isFetching || refreshing}
                            onRefresh={onRefresh}
                            colors={["#3B82F6"]}
                            tintColor="#3B82F6"
                        />
                    }
                    ListEmptyComponent={
                        <View className="flex-1 justify-center items-center mt-16">
                            <Text className="text-gray-500 text-lg">No dealers found.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}
