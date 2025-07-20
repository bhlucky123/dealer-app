import { useAuthStore } from "@/store/auth";
import api from "@/utils/axios";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";

type AgentOrDealer = {
    id: number;
    name: string;
    balance_amount: number;
};

// Helper to format date for display (dd-mm-yyyy)
function formatDateDisplay(yyyy_mm_dd: string | undefined): string {
    if (!yyyy_mm_dd) return "";
    // Accepts "yyyy-mm-dd" or ISO string
    let [yyyy, mm, dd] = ["", "", ""];
    if (/^\d{4}-\d{2}-\d{2}$/.test(yyyy_mm_dd)) {
        [yyyy, mm, dd] = yyyy_mm_dd.split("-");
    } else {
        // Try to parse as Date
        const d = new Date(yyyy_mm_dd);
        if (!isNaN(d.getTime())) {
            yyyy = String(d.getFullYear());
            mm = String(d.getMonth() + 1).padStart(2, "0");
            dd = String(d.getDate()).padStart(2, "0");
        }
    }
    if (yyyy && mm && dd) {
        return `${dd}-${mm}-${yyyy}`;
    }
    return yyyy_mm_dd;
}

// Helper to format date for server (yyyy-mm-dd)
function formatDateServer(date: Date | string): string {
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

export default function PaymentTab() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();

    // State to hold input values for each agent/dealer
    const [inputAmounts, setInputAmounts] = useState<{ [id: number]: string }>({});
    const [inputDates, setInputDates] = useState<{ [id: number]: string }>({});
    const [showDatePicker, setShowDatePicker] = useState<{ [id: number]: boolean }>({});
    const [datePickerSelectedId, setDatePickerSelectedId] = useState<number | null>(null);

    // Fetch agents with pending balance (for ADMIN)
    const {
        data: agentsData,
        isLoading: isAgentsLoading,
        refetch: refetchAgents,
    } = useQuery<{ agents_with_pending_balance: AgentOrDealer[] }>({
        queryKey: ["/draw-payment/agents-with-pending-balance"],
        queryFn: () => api.get(`/draw-payment/agents-with-pending-balance/`).then(res => res.data),
        enabled: user?.user_type === "DEALER",
    });

    // Fetch dealers with pending balance (for DEALER)
    const {
        data: dealersData,
        isLoading: isDealersLoading,
        refetch: refetchDealers,
    } = useQuery<{ dealers_with_pending_balance: AgentOrDealer[] }>({
        queryKey: ["/draw-payment/dealers-with-pending-balance"],
        queryFn: () => api.get(`/draw-payment/dealers-with-pending-balance/`).then(res => res.data),
        enabled: user?.user_type === "ADMIN",
    });

    console.log("dealersData", dealersData);


    // Mutation for ADMIN to update agent's balance
    const agentToDealerPaymentMutation = useMutation({
        mutationFn: async ({
            agentId,
            amount,
            date_received,
        }: {
            agentId: number;
            amount: number;
            date_received: string;
        }) => {
            return api.post(`/draw-payment/agent-to-dealer/${agentId}/`, {
                amount,
                date_received,
            });
        },
        onSuccess: () => {
            refetchAgents();
            Alert.alert("Success", "Agent balance updated successfully");
        },
        onError: (error: any) => {
            // Try to show backend error message if available
            let msg = "Failed to update agent balance";
            if (error?.response?.data?.date_received) {
                msg = error.response.data.date_received.join("\n");
            } else if (error?.response?.data?.agent) {
                msg = error.response.data.agent.join("\n");
            }
            Alert.alert("Error", msg);
        }
    });

    // Mutation for DEALER to update dealer's balance
    const dealerToAdminPaymentMutation = useMutation({
        mutationFn: async ({
            dealerId,
            amount,
            date_received,
        }: {
            dealerId: number;
            amount: number;
            date_received: string;
        }) => {
            return api.post(`/draw-payment/dealer-to-administrator/${dealerId}/`, {
                amount,
                date_received,
            });
        },
        onSuccess: () => {
            refetchDealers();
            Alert.alert("Success", "Dealer balance updated successfully");
        },
        onError: (error: any) => {
            // Try to show backend error message if available
            let msg = "Failed to update dealer balance";
            if (error?.response?.data?.date_received) {
                msg = error.response.data.date_received.join("\n");
            } else if (error?.response?.data?.dealer) {
                msg = error.response.data.dealer.join("\n");
            }
            Alert.alert("Error", msg);
        }
    });

    // Handler for updating input values
    const handleInputChange = (id: number, value: string) => {
        setInputAmounts((prev) => ({ ...prev, [id]: value }));
    };

    // Handler for date picker open
    const handleOpenDatePicker = (id: number) => {
        setDatePickerSelectedId(id);
        setShowDatePicker((prev) => ({ ...prev, [id]: true }));
    };

    // Handler for date picker change
    const handleDateChange = (event: any, selectedDate?: Date) => {
        if (datePickerSelectedId === null) return;
        setShowDatePicker((prev) => ({ ...prev, [datePickerSelectedId!]: Platform.OS === "ios" })); // keep open on iOS, close on Android
        if (selectedDate) {
            // Format as YYYY-MM-DD for server
            const formatted = formatDateServer(selectedDate);
            setInputDates((prev) => ({ ...prev, [datePickerSelectedId!]: formatted }));
        }
    };

    // Handler for submitting payment
    const handleSubmit = (id: number) => {
        const amount = Number(inputAmounts[id]);
        // Always send to server as yyyy-mm-dd
        const date_received = inputDates[id] || formatDateServer(new Date()); // Default to today if not set

        // Validate date format YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date_received)) {
            Alert.alert("Invalid Date", "Please select a valid date in YYYY-MM-DD format.");
            return;
        }

        if (!amount || amount <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid amount.");
            return;
        }

        if (user?.user_type === "ADMIN") {
            agentToDealerPaymentMutation.mutate({ agentId: id, amount, date_received });
        } else if (user?.user_type === "DEALER") {
            dealerToAdminPaymentMutation.mutate({ dealerId: id, amount, date_received });
        }
    };

    // Render list of agents or dealers
    const renderItem = ({ item }: { item: AgentOrDealer }) => (
        <View
            style={{
                backgroundColor: "#f3f4f6",
                borderRadius: 12,
                padding: 16,
                marginVertical: 8,
                marginHorizontal: 16,
                flexDirection: "column",
                elevation: 1,
            }}
        >
            <Text style={{ fontWeight: "bold", fontSize: 16, color: "#1e293b" }}>
                {item.name}
            </Text>
            <Text style={{ color: "#334155", marginTop: 4 }}>
                Balance: <Text style={{ fontWeight: "bold" }}>₹ {item.balance_amount.toLocaleString()}</Text>
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                <TextInput
                    placeholder="Amount"
                    keyboardType="numeric"
                    value={inputAmounts[item.id] || ""}
                    onChangeText={(val) => handleInputChange(item.id, val)}
                    style={{
                        backgroundColor: "#fff",
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#cbd5e1",
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        marginRight: 8,
                        flex: 1,
                    }}
                />
                <TouchableOpacity
                    onPress={() => handleOpenDatePicker(item.id)}
                    style={{
                        backgroundColor: "#fff",
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#cbd5e1",
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        marginRight: 8,
                        flex: 1.2,
                        justifyContent: "center",
                    }}
                    activeOpacity={0.85}
                >
                    <Text style={{ color: inputDates[item.id] ? "#0f172a" : "#64748b" }}>
                        {inputDates[item.id]
                            ? formatDateDisplay(inputDates[item.id])
                            : "Select Date"}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => handleSubmit(item.id)}
                    style={{
                        backgroundColor: "#2563eb",
                        paddingVertical: 8,
                        paddingHorizontal: 16,
                        borderRadius: 8,
                    }}
                    disabled={
                        (user?.user_type === "ADMIN" && agentToDealerPaymentMutation.isPending) ||
                        (user?.user_type === "DEALER" && dealerToAdminPaymentMutation.isPending)
                    }
                >
                    <Text style={{ color: "#fff", fontWeight: "bold" }}>
                        Update
                    </Text>
                </TouchableOpacity>
            </View>
            {showDatePicker[item.id] && (
                <DateTimePicker
                    value={
                        inputDates[item.id]
                            ? new Date(inputDates[item.id])
                            : new Date()
                    }
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                />
            )}
        </View>
    );

    // Loading state
    if (
        (user?.user_type === "ADMIN" && isAgentsLoading) ||
        (user?.user_type === "DEALER" && isDealersLoading)
    ) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-900">
                <ActivityIndicator size="large" color="#2563eb" />
                <Text className="mt-2 text-base text-white">Loading balances…</Text>
            </View>
        );
    }

    // No data state
    const listData =
        user?.user_type === "ADMIN"
            ? agentsData?.agents_with_pending_balance || []
            : user?.user_type === "DEALER"
                ? dealersData?.dealers_with_pending_balance || []
                : [];

    return (
        <View className="flex-1 pt-8 pb-20">
            {/* <Text className="text-2xl font-bold text-center mb-4">
                {user?.user_type === "ADMIN"
                    ? "Agents' Pending Balances"
                    : user?.user_type === "DEALER"
                        ? "Dealers' Pending Balances"
                        : "Payment Page"}
            </Text> */}
            {listData.length === 0 ? (
                <Text className="text-center text-gray-300 mt-10">
                    No {user?.user_type === "ADMIN" ? "agents" : "dealers"} with pending balance.
                </Text>
            ) : (
                <FlatList
                    data={listData}
                    keyExtractor={(item, index) => item.id.toString() + index}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 32 }}
                />
            )}
        </View>
    );
}