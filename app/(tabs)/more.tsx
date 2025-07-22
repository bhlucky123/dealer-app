import { useAuthStore } from "@/store/auth";
import api from "@/utils/axios";
import { useMutation, useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type BankDetails = {
    id: number;
    user: number;
    bank_details: string;
    user_type?: string;
    name?: string;
};

export default function MoreTab() {
    const [isActive, setIsActive] = useState(true);

    // For editing/adding bank details
    const [editingBankDetails, setEditingBankDetails] = useState(false);
    const [bankDetailsInput, setBankDetailsInput] = useState("");
    const [bankDetailsError, setBankDetailsError] = useState<string | null>(null);

    const { user } = useAuthStore();

    // Mutations for activate/deactivate (ADMIN only)
    const deactivateMutation = useMutation({
        mutationFn: () => api.post("/administrator/deactivate/"),
        onSuccess: () => {
            setIsActive(false);
            Alert.alert("Status", "Account deactivated");
        },
        onError: () => {
            Alert.alert("Error", "Failed to deactivate");
        }
    });

    const activateMutation = useMutation({
        mutationFn: () => api.post("/administrator/activate/"),
        onSuccess: () => {
            setIsActive(true);
            Alert.alert("Status", "Account activated");
        },
        onError: () => {
            Alert.alert("Error", "Failed to activate");
        }
    });

    // Fetch bank details for the current user (ADMIN/AGENT) or for the dealer (DEALER)
    const {
        data: bankDetails,
        isLoading: isBankDetailsLoading,
        refetch: refetchBankDetails,
    } = useQuery<BankDetails | null>({
        queryKey: ["bank-details", user?.id, user?.user_type],
        enabled: !!user?.id,
        queryFn: async () => {
            try {
                const res = await api.get("/draw-payment/bank-details/");
                if (Array.isArray(res.data) && res.data.length > 0) {
                    return res.data[0] as BankDetails;
                }
                return null;
            } catch (err) {
                return null;
            }
        }
    });

    console.log("bankDetails", bankDetails);


    // Add/update bank details
    const bankDetailsMutation = useMutation({
        mutationFn: async (bank_details: string) => {
            if (!user?.id) throw new Error("No user id");
            if (bankDetails?.id) {
                return api.patch(`/draw-payment/bank-details/${bankDetails.id}/`, {
                    bank_details,
                    user: user.id,
                });
            } else {
                return api.post("/draw-payment/bank-details/", {
                    bank_details,
                    user: user.id,
                });
            }
        },
        onSuccess: () => {
            setEditingBankDetails(false);
            setBankDetailsInput("");
            setBankDetailsError(null);
            refetchBankDetails();
            Alert.alert("Success", "Bank details updated");
        },
        onError: () => {
            setBankDetailsError("Failed to update bank details");
        }
    });

    // Handle switch toggle
    const handleToggle = (value: boolean) => {
        if (value) {
            activateMutation.mutate();
        } else {
            deactivateMutation.mutate();
        }
    };

    // Render bank details section
    function renderBankDetailsSection() {
        let label = "";
        if (user?.user_type === "ADMIN") {
            label = "My Bank Details";
        } else if (user?.user_type === "DEALER") {
            label = "Dealer Bank Details";
        } else if (user?.user_type === "AGENT") {
            label = "Agent Bank Details";
        } else {
            return null;
        }

        return (
            <View className="w-full mb-8">
                <Text className="text-base font-semibold text-gray-500 mb-2 tracking-wider uppercase">
                    {label}
                </Text>
                <View
                    className="w-full rounded-xl bg-gray-50 border border-gray-200 py-4 px-3 mb-1"
                    style={{
                        minHeight: 60,
                        justifyContent: "center",
                    }}
                >
                    {isBankDetailsLoading ? (
                        <ActivityIndicator color="#6b7280" size="small" />
                    ) : (
                        <>
                            <Text className="text-gray-800 text-base mb-2">
                                {bankDetails?.bank_details
                                    ? bankDetails.bank_details
                                    : <Text className="text-gray-400">No bank details added.</Text>
                                }
                            </Text>
                            {editingBankDetails ? (
                                <>
                                    <TextInput
                                        placeholder="Enter bank details"
                                        value={bankDetailsInput}
                                        onChangeText={setBankDetailsInput}
                                        style={{
                                            backgroundColor: "#f3f4f6",
                                            borderRadius: 8,
                                            borderWidth: 1,
                                            borderColor: "#cbd5e1",
                                            paddingHorizontal: 10,
                                            paddingVertical: 8,
                                            fontSize: 16,
                                            marginBottom: 8,
                                        }}
                                        multiline
                                    />
                                    {bankDetailsError && (
                                        <Text className="text-red-600 text-xs mb-2">{bankDetailsError}</Text>
                                    )}
                                    <View style={{ flexDirection: "row", gap: 10 }}>
                                        <TouchableOpacity
                                            className="bg-blue-600 px-4 py-2 rounded-lg"
                                            onPress={() => {
                                                if (!bankDetailsInput.trim()) {
                                                    setBankDetailsError("Bank details required");
                                                    return;
                                                }
                                                bankDetailsMutation.mutate(bankDetailsInput.trim());
                                            }}
                                            activeOpacity={0.85}
                                        >
                                            <Text className="text-white font-semibold">Save</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            className="bg-gray-200 px-4 py-2 rounded-lg"
                                            onPress={() => {
                                                setEditingBankDetails(false);
                                                setBankDetailsInput("");
                                                setBankDetailsError(null);
                                            }}
                                            activeOpacity={0.85}
                                        >
                                            <Text className="text-gray-700 font-semibold">Cancel</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : (
                                <TouchableOpacity
                                    className="mt-2 bg-blue-100 px-4 py-2 rounded-lg"
                                    onPress={() => {
                                        setEditingBankDetails(true);
                                        setBankDetailsInput(bankDetails?.bank_details || "");
                                    }}
                                    activeOpacity={0.85}
                                >
                                    <Text className="text-blue-800 font-semibold text-center">
                                        {bankDetails?.bank_details ? "Edit" : "Add"} {label}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>
            </View>
        );
    }

    return (
        <ScrollView
            className="flex-1 px-4 py-8 bg-gradient-to-b from-gray-100 to-gray-200"
            contentContainerStyle={{
                justifyContent: "center",
                alignItems: "center",
                flexGrow: 1,
            }}
            keyboardShouldPersistTaps="handled"
        >
            <View
                className="w-full max-w-sm bg-white rounded-3xl shadow-lg border border-gray-200"
                style={{
                    paddingVertical: 28,
                    paddingHorizontal: 20,
                    alignItems: "center",
                    elevation: 6,
                }}
            >

                {/* Bank Details Section */}
                {renderBankDetailsSection()}

                {/* Toggle */}
                {user?.user_type === "ADMIN" && (
                    <View
                        className="flex-row items-center mt-2"
                        style={{
                            backgroundColor: "#f3f4f6",
                            borderRadius: 16,
                            paddingVertical: 10,
                            paddingHorizontal: 18,
                        }}
                    >
                        <Text
                            className={`text-base font-semibold mr-4 ${isActive ? "text-green-600" : "text-gray-500"
                                }`}
                            style={{
                                letterSpacing: 1,
                                minWidth: 70,
                                textAlign: "right",
                            }}
                        >
                            {isActive ? "Active" : "Inactive"}
                        </Text>
                        <Switch
                            value={isActive}
                            onValueChange={handleToggle}
                            disabled={activateMutation.isPending || deactivateMutation.isPending}
                            thumbColor={isActive ? "#4ade80" : "#ffffff"}
                            trackColor={{ false: "#d1d5db", true: "#bbf7d0" }}
                            ios_backgroundColor="#d1d5db"
                            style={{
                                transform: [{ scaleX: 1.15 }, { scaleY: 1.15 }],
                                marginLeft: 6,
                            }}
                        />
                    </View>
                )}
            </View>
        </ScrollView>
    );
}