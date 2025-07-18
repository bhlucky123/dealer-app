import api from "@/utils/axios";
import { useMutation, useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Switch, Text, View } from "react-native";

type PendingBalanceResponse = {
    balance_amount: number;
};

export default function MoreTab() {
    // Track active/inactive state locally
    const [isActive, setIsActive] = useState(true);
    const [balanceError, setBalanceError] = useState<string | null>(null);

    // Fetch balance
    const { data, isLoading: isBalanceLoading, refetch, error } = useQuery<PendingBalanceResponse>({
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
        }
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
        <View className="flex-1 bg-gray-50 px-6 py-10">

            {/* card */}
            <View className="w-full max-w-sm mx-auto bg-white rounded-2xl p-6 items-center shadow-md border border-gray-200">
                {/* title */}
                <Text className="text-xl font-bold text-gray-900 mb-4">More</Text>

                {/* balance */}
                <View className="items-center mb-8 w-full">
                    <Text className="text-sm font-medium text-gray-500 mb-1 tracking-wide">
                        Pending Balance
                    </Text>

                    {isBalanceLoading ? (
                        <ActivityIndicator color="#6b7280" />
                    ) : balanceError ? (
                        <Text className="text-red-600 text-base font-semibold text-center">
                            {balanceError}
                        </Text>
                    ) : (
                        <Text className="text-3xl font-extrabold text-gray-800">
                            ₹ {data?.balance_amount?.toLocaleString()}
                        </Text>
                    )}
                </View>

                {/* toggle */}
                <View className="flex-row items-center">
                    <Text className="text-base font-medium text-gray-700 mr-3">
                        {isActive ? "Active" : "Inactive"}
                    </Text>

                    <Switch
                        value={isActive}
                        onValueChange={handleToggle}
                        disabled={activateMutation.isPending || deactivateMutation.isPending}
                        thumbColor="#ffffff"
                        trackColor={{ false: "#d1d5db", true: "#4ade80" }}
                        ios_backgroundColor="#d1d5db"
                        style={{ transform: [{ scaleX: 1.05 }, { scaleY: 1.05 }] }}
                    />
                </View>
            </View>
        </View>

    );
}