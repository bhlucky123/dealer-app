import { useAuthStore } from "@/store/auth";
import api from "@/utils/axios";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    ToastAndroid,
    TouchableOpacity,
    View,
} from "react-native";

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

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [modalItem, setModalItem] = useState<AgentOrDealer | null>(null);
    const [modalAmount, setModalAmount] = useState<string>("");
    const [modalDate, setModalDate] = useState<string>("");
    const [showModalDatePicker, setShowModalDatePicker] = useState(false);

    // Fetch dealers with pending balance (for ADMIN)
    const {
        data: dealersData,
        isLoading: isDealersLoading,
        refetch: refetchDealers,
    } = useQuery<{ dealers_with_pending_balance: AgentOrDealer[] }>({
        queryKey: ["/draw-payment/dealers-with-pending-balance"],
        queryFn: () => api.get(`/draw-payment/dealers-with-pending-balance/`).then(res => res.data),
        enabled: user?.user_type === "ADMIN",
    });



    // Fetch agents with pending balance (for DEALER)
    const {
        data: agentsData,
        isLoading: isAgentsLoading,
        refetch: refetchAgents,
    } = useQuery<{ agents_with_pending_balance: AgentOrDealer[] }>({
        queryKey: ["/draw-payment/agents-with-pending-balance"],
        queryFn: () => api.get(`/draw-payment/agents-with-pending-balance/`).then(res => res.data),
        enabled: user?.user_type === "DEALER",

    });

    console.log("agentsData", agentsData);

    // Mutation for ADMIN to update dealer's balance
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
            setModalVisible(false);
            ToastAndroid.show("Dealer balance updated successfully", ToastAndroid.SHORT);
        },
        onError: (error: any) => {
            let msg = "Failed to update dealer balance";
            if (error?.response?.data?.date_received) {
                msg = error.response.data.date_received.join("\n");
            } else if (error?.response?.data?.dealer) {
                msg = error.response.data.dealer.join("\n");
            }
            Alert.alert("Error", msg);
        }
    });

    // Mutation for DEALER to update agent's balance
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
            setModalVisible(false);
            ToastAndroid.show("Agent balance updated successfully", ToastAndroid.SHORT);
        },
        onError: (error: any) => {
            let msg = "Failed to update agent balance";
            if (error?.response?.data?.date_received) {
                msg = error.response.data.date_received.join("\n");
            } else if (error?.response?.data?.agent) {
                msg = error.response.data.agent.join("\n");
            }
            Alert.alert("Error", msg);
        }
    });

    // Open modal for a specific agent/dealer
    const openUpdateModal = (item: AgentOrDealer) => {
        setModalItem(item);
        setModalAmount("");
        setModalDate("");
        setModalVisible(true);
    };

    // Handler for modal date picker
    const handleModalDateChange = (_event: any, selectedDate?: Date) => {
        setShowModalDatePicker(Platform.OS === "ios");
        if (selectedDate) {
            setModalDate(formatDateServer(selectedDate));
        }
    };

    // Handler for submitting payment from modal
    const handleModalSubmit = () => {
        if (!modalItem) return;
        const amount = Number(modalAmount);
        const date_received = modalDate || formatDateServer(new Date());

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date_received)) {
            Alert.alert("Invalid Date", "Please select a valid date in YYYY-MM-DD format.");
            return;
        }
        if (!amount || amount <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid amount.");
            return;
        }

        if (user?.user_type === "ADMIN") {
            dealerToAdminPaymentMutation.mutate({ dealerId: modalItem.id, amount, date_received });
        } else if (user?.user_type === "DEALER") {
            agentToDealerPaymentMutation.mutate({ agentId: modalItem.id, amount, date_received });
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
            {
                item?.balance_amount > 0 && (<View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                    <TouchableOpacity
                        onPress={() => {
                            openUpdateModal(item)
                        }}
                        style={{
                            backgroundColor: "#2563eb",
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                            borderRadius: 8,
                            flex: 1,
                            alignItems: "center",
                        }}
                    >
                        <Text style={{ color: "#fff", fontWeight: "bold" }}>
                            Update Balance
                        </Text>
                    </TouchableOpacity>
                </View>)
            }
        </View>
    );

    // Loading state
    if (
        (user?.user_type === "ADMIN" && isDealersLoading) ||
        (user?.user_type === "DEALER" && isAgentsLoading)
    ) {
        return (
            <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#2563eb" />
                <Text className="mt-2 text-base text-white">Loading balances…</Text>
            </View>
        );
    }

    // No data state
    const listData =
        user?.user_type === "ADMIN"
            ? dealersData?.dealers_with_pending_balance || []
            : user?.user_type === "DEALER"
                ? agentsData?.agents_with_pending_balance || []
                : [];

    return (
        <View className="flex-1 pt-8 pb-20">
            {/* <Text className="text-2xl font-bold text-center mb-4">
                {user?.user_type === "ADMIN"
                    ? "Dealers' Pending Balances"
                    : user?.user_type === "DEALER"
                        ? "Agents' Pending Balances"
                        : "Payment Page"}
            </Text> */}
            {listData.length === 0 ? (
                <Text className="text-center text-gray-300 mt-10">
                    No {user?.user_type === "ADMIN" ? "dealers" : "agents"} with pending balance.
                </Text>
            ) : (
                <FlatList
                    data={listData || []}
                    keyExtractor={(item, index) => item?.id?.toString() + index}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 32 }}
                />
            )}

            {/* Modal for updating balance */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.3)",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : undefined}
                        style={{
                            width: "90%",
                            maxWidth: 400,
                            backgroundColor: "#fff",
                            borderRadius: 16,
                            padding: 24,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 8,
                            elevation: 5,
                        }}
                    >
                        <ScrollView
                            contentContainerStyle={{ flexGrow: 1 }}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Text style={{ fontWeight: "bold", fontSize: 18, color: "#1e293b", marginBottom: 8, textAlign: "center" }}>
                                {user?.user_type === "ADMIN" ? "Update Dealer Balance" : "Update Agent Balance"}
                            </Text>
                            <Text style={{ color: "#334155", marginBottom: 12, textAlign: "center" }}>
                                {modalItem?.name}
                            </Text>
                            <Text style={{ color: "#64748b", marginBottom: 4 }}>
                                Current Balance: <Text style={{ fontWeight: "bold" }}>₹ {modalItem?.balance_amount?.toLocaleString()}</Text>
                            </Text>
                            <TextInput
                                placeholder="Amount"
                                keyboardType="numeric"
                                value={modalAmount}
                                onChangeText={setModalAmount}
                                style={{
                                    backgroundColor: "#f3f4f6",
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: "#cbd5e1",
                                    paddingHorizontal: 10,
                                    paddingVertical: 8,
                                    marginTop: 12,
                                    marginBottom: 12,
                                    fontSize: 16,
                                }}
                            />
                            <TouchableOpacity
                                onPress={() => setShowModalDatePicker(true)}
                                style={{
                                    backgroundColor: "#f3f4f6",
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: "#cbd5e1",
                                    paddingHorizontal: 10,
                                    paddingVertical: 10,
                                    marginBottom: 12,
                                    justifyContent: "center",
                                }}
                                activeOpacity={0.85}
                            >
                                <Text style={{ color: modalDate ? "#0f172a" : "#64748b", fontSize: 16 }}>
                                    {modalDate
                                        ? formatDateDisplay(modalDate)
                                        : "Select Date"}
                                </Text>
                            </TouchableOpacity>
                            {showModalDatePicker && (
                                <DateTimePicker
                                    value={
                                        modalDate
                                            ? new Date(modalDate)
                                            : new Date()
                                    }
                                    mode="date"
                                    display={Platform.OS === "ios" ? "spinner" : "default"}
                                    onChange={handleModalDateChange}
                                    maximumDate={new Date()}
                                />
                            )}
                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
                                <Pressable
                                    onPress={() => setModalVisible(false)}
                                    style={{
                                        backgroundColor: "#e5e7eb",
                                        paddingVertical: 10,
                                        paddingHorizontal: 24,
                                        borderRadius: 8,
                                    }}
                                >
                                    <Text style={{ color: "#334155", fontWeight: "bold" }}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                    onPress={handleModalSubmit}
                                    style={{
                                        backgroundColor: "#2563eb",
                                        paddingVertical: 10,
                                        paddingHorizontal: 24,
                                        borderRadius: 8,
                                    }}
                                    disabled={
                                        (user?.user_type === "ADMIN" && dealerToAdminPaymentMutation.isPending) ||
                                        (user?.user_type === "DEALER" && agentToDealerPaymentMutation.isPending)
                                    }
                                >
                                    <Text style={{ color: "#fff", fontWeight: "bold" }}>
                                        {((user?.user_type === "ADMIN" && dealerToAdminPaymentMutation.isPending) ||
                                            (user?.user_type === "DEALER" && agentToDealerPaymentMutation.isPending))
                                            ? "Updating..."
                                            : "Update"}
                                    </Text>
                                </Pressable>
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}