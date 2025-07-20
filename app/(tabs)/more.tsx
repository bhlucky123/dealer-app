 import { useAuthStore } from "@/store/auth";
import api from "@/utils/axios";
import { useMutation, useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Switch, Text, TouchableOpacity, View } from "react-native";

type PendingBalanceResponse = {
    balance_amount: number;
};

export default function MoreTab() {
    // Track active/inactive state locally
    const [isActive, setIsActive] = useState(true);
    const [balanceError, setBalanceError] = useState<string | null>(null);

    const { user } = useAuthStore();

    // Only enable the query if user_type is AGENT or DEALER
    const shouldFetchBalance =
        user?.user_type === "AGENT" || user?.user_type === "DEALER";

    // Fetch balance (only if user_type is AGENT or DEALER)
    const {
        data,
        isLoading: isBalanceLoading,
        refetch,
        error,
    } = useQuery<PendingBalanceResponse>({
        queryKey: ["/draw-payment/get-my-pending-balance/"],
        queryFn: async () => {
            try {
                const response = await api.get("/draw-payment/get-my-pending-balance/");
                setBalanceError(null);
                return response.data as PendingBalanceResponse;
            } catch (err: any) {
                // Try to extract error message
                let msg = "Something went wrong";
                if (
                    err?.response?.data?.message?.error === "Admin cannot get pending balance"
                ) {
                    msg = "Admin cannot get pending balance";
                }
                setBalanceError(msg);
                throw new Error(msg);
            }
        },
        enabled: shouldFetchBalance,
    });

    // Mutations for activate/deactivate
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

    // Handle switch toggle
    const handleToggle = (value: boolean) => {
        if (value) {
            activateMutation.mutate();
        } else {
            deactivateMutation.mutate();
        }
    };

    return (
        /* wrapper */
        <View
            className="flex-1 px-4 py-8 bg-gradient-to-b from-gray-100 to-gray-200"
            style={{
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            {/* Card */}
            <View
                className="w-full max-w-sm bg-white rounded-3xl shadow-lg border border-gray-200"
                style={{
                    paddingVertical: 28,
                    paddingHorizontal: 20,
                    alignItems: "center",
                    elevation: 6,
                }}
            >
                {/* Title */}
                <Text className="text-2xl font-extrabold text-gray-900 mb-6 tracking-wide">
                    More
                </Text>

                {/* Balance */}
                {shouldFetchBalance && (
                    <View className="items-center mb-10 w-full">
                        <Text className="text-base font-semibold text-gray-500 mb-2 tracking-wider uppercase">
                            Pending Balance
                        </Text>
                        <View
                            className="w-full rounded-xl bg-gray-50 border border-gray-200 py-4 px-2 mb-1"
                            style={{
                                alignItems: "center",
                                minHeight: 60,
                                justifyContent: "center",
                            }}
                        >
                            {isBalanceLoading ? (
                                <ActivityIndicator color="#6b7280" size="small" />
                            ) : balanceError ? (
                                <View style={{ alignItems: "center" }}>
                                    <Text className="text-red-600 text-base font-semibold text-center">
                                        {balanceError}
                                    </Text>
                                    <TouchableOpacity
                                        className="mt-3 bg-red-200 px-4 py-2 rounded-lg"
                                        onPress={() => refetch()}
                                        activeOpacity={0.85}
                                    >
                                        <Text className="text-red-800 font-semibold text-center">Retry</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <Text className="text-3xl font-extrabold text-gray-800 tracking-tight">
                                    ₹ {data?.balance_amount?.toLocaleString()}
                                </Text>
                            )}
                        </View>
                    </View>
                )}

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
                            className={`text-base font-semibold mr-4 ${
                                isActive ? "text-green-600" : "text-gray-500"
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
        </View>
    );
}