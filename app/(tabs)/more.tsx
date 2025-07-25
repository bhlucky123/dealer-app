import { useAuthStore } from "@/store/auth";
import api from "@/utils/axios";
import { useMutation, useQuery } from "@tanstack/react-query";
import React, { useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Switch,
    Text,
    TextInput,
    ToastAndroid,
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

type BankDetailsResponse = {
    admin_bank_details?: BankDetails;
    dealer_bank_details?: BankDetails;
    agent_bank_details?: BankDetails;
};

type myBalanceResponse = {
    balance_amount?: number
}

export default function MoreTab() {
    const { setApplicationStatus, application_status, user } = useAuthStore();

    // For editing/adding bank details
    const [editingBankDetails, setEditingBankDetails] = useState<null | "admin" | "dealer" | "agent">(null);
    const [bankDetailsInput, setBankDetailsInput] = useState("");
    const [bankDetailsError, setBankDetailsError] = useState<string | null>(null);

    // Track local status to avoid UI glitches during async toggle
    const [localStatus, setLocalStatus] = useState<boolean | null>(null);
    const [statusLoading, setStatusLoading] = useState(false);
    const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Mutations for activate/deactivate (ADMIN only)
    const deactivateMutation = useMutation({
        mutationFn: () => api.post("/administrator/deactivate/"),
        onMutate: async () => {
            setStatusLoading(true);
            setLocalStatus(false);
        },
        onSuccess: () => {
            setApplicationStatus(false);
            setStatusLoading(false);
            setLocalStatus(null);
            ToastAndroid.show("Account deactivated", ToastAndroid.SHORT);
        },
        onError: () => {
            setStatusLoading(false);
            setLocalStatus(null);
            Alert.alert("Error", "Failed to deactivate");
        }
    });

    const activateMutation = useMutation({
        mutationFn: () => api.post("/administrator/activate/"),
        onMutate: async () => {
            setStatusLoading(true);
            setLocalStatus(true);
        },
        onSuccess: (data) => {
            setApplicationStatus(true);
            setStatusLoading(false);
            setLocalStatus(null);
            ToastAndroid.show("Account activated", ToastAndroid.SHORT);
        },
        onError: (err: any) => {
            console.log("err", err);
            // If error is "Application is already active", set status to true
            if (
                err &&
                err.status === 400 &&
                err.message &&
                (
                    err.message === "Application is already active." ||
                    (typeof err.message === "object" && err.message.message === "Application is already active.")
                )
            ) {
                setApplicationStatus(true);
            }
            setStatusLoading(false);
            setLocalStatus(null);
            Alert.alert("Error", "Failed to activate");
        }
    });

    // Fetch all bank details for the current user
    const {
        data: bankDetailsData,
        isLoading: isBankDetailsLoading,
        refetch: refetchBankDetails,
    } = useQuery<BankDetailsResponse>({
        queryKey: ["bank-details", user?.id, user?.user_type],
        enabled: !!user?.id,
        queryFn: async () => {
            try {
                const res = await api.get("/draw-payment/bank-details/");
                return res.data as BankDetailsResponse;
            } catch (err) {
                return {};
            }
        }
    });


    const {
        data: myBalance,
        isLoading: ismyBalanceLoading,
        refetch: refetchMyBalance,
        isFetching: isFetchingMyBalance,
    } = useQuery<myBalanceResponse>({
        queryKey: ["/draw-payment/get-my-pending-balance/"],
        enabled: (user?.user_type === "AGENT" || user?.user_type === "DEALER"),
        queryFn: async () => {
            try {
                const res = await api.get("/draw-payment/get-my-pending-balance/");
                return res.data as myBalanceResponse;
            } catch (err) {
                return { balance_amount: 0 };
            }
        },
        refetchOnMount: true
    });

    // Helper to get the correct details for editing/updating
    function getBankDetailsForEdit(type: "admin" | "dealer" | "agent") {
        if (!bankDetailsData) return null;
        if (type === "admin") return bankDetailsData.admin_bank_details || null;
        if (type === "dealer") return bankDetailsData.dealer_bank_details || null;
        // if (type === "agent") return bankDetailsData.agent_bank_details || null;
        return null;
    }

    // Add/update bank details
    const bankDetailsMutation = useMutation({
        mutationFn: async ({
            type,
            bank_details,
        }: {
            type: "admin" | "dealer" | "agent";
            bank_details: string;
        }) => {

            if (!user?.id) throw new Error("No user id");
            const details = getBankDetailsForEdit(type);
            let url = "/draw-payment/bank-details/";
            let method: "patch" | "post" = "post";
            let id: number | undefined = undefined;
            if (details?.id) {
                url += `${details.id}/`;
                method = "patch";
                id = details.id;
            }
            const payload: any = {
                bank_details,
                user: user.id,
            };
            // Optionally, you could add user_type to payload if needed
            if (type === "admin") payload.user_type = "ADMIN";
            if (type === "dealer") payload.user_type = "DEALER";
            if (type === "agent") payload.user_type = "AGENT";

            if (method === "patch") {
                return api.patch(url, payload);
            } else {
                return api.post(url, payload);
            }
        },
        onSuccess: () => {
            setEditingBankDetails(null);
            setBankDetailsInput("");
            setBankDetailsError(null);
            refetchBankDetails();
            ToastAndroid.show("Bank details updated", ToastAndroid.SHORT);
        },
        onError: (err) => {
            console.log("err", err);

            setBankDetailsError("Failed to update bank details");
        }
    });

    // Handle switch toggle
    const handleToggle = (value: boolean) => {
        // Prevent double toggling while loading
        if (statusLoading || activateMutation.isPending || deactivateMutation.isPending) return;

        // If already in desired state, do nothing
        if (application_status === value) return;

        // Optimistically update UI
        setLocalStatus(value);
        setStatusLoading(true);

        // Add a fallback timeout in case mutation hangs
        if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = setTimeout(() => {
            setStatusLoading(false);
            setLocalStatus(null);
        }, 10000);

        if (value) {
            activateMutation.mutate(undefined, {
                onSuccess: () => {
                    setStatusLoading(false);
                    setLocalStatus(null);
                    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
                }
            });
        } else {
            deactivateMutation.mutate(undefined, {
                onSuccess: () => {
                    setStatusLoading(false);
                    setLocalStatus(null);
                    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
                }
            });
        }
    };

    // Render bank details section(s)
    function renderBankDetailsSection() {
        if (!user?.user_type) return null;

        // Helper to render a single bank details block
        function renderSingleBankDetailsBlock(
            label: string,
            type: "admin" | "dealer" | "agent",
            details: BankDetails | undefined | null,
            canEdit: boolean,
            canAdd: boolean
        ) {
            const isEditing = editingBankDetails === type;
            const noBankDetails = !details?.bank_details;

            return (
                <View className="w-full mb-8" key={type}>
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
                                    {details?.bank_details
                                        ? details.bank_details
                                        : <Text className="text-gray-400">No bank details added.</Text>
                                    }
                                </Text>
                                {isEditing && (canEdit || (canAdd && noBankDetails)) ? (
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
                                            numberOfLines={3}
                                            placeholderTextColor="#9ca3af"
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
                                                    bankDetailsMutation.mutate({
                                                        type,
                                                        bank_details: bankDetailsInput.trim(),
                                                    });
                                                }}
                                                activeOpacity={0.85}
                                            >
                                                <Text className="text-white font-semibold">Save</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                className="bg-gray-200 px-4 py-2 rounded-lg"
                                                onPress={() => {
                                                    setEditingBankDetails(null);
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
                                    (canEdit || (canAdd && noBankDetails)) && (
                                        <TouchableOpacity
                                            className="mt-2 bg-blue-100 px-4 py-2 rounded-lg"
                                            onPress={() => {
                                                setEditingBankDetails(type);
                                                setBankDetailsInput(details?.bank_details || "");
                                            }}
                                            activeOpacity={0.85}
                                        >
                                            <Text className="text-blue-800 font-semibold text-center">
                                                {details?.bank_details
                                                    ? (canEdit ? "Edit" : "Add")
                                                    : "Add"} {label}
                                            </Text>
                                        </TouchableOpacity>
                                    )
                                )}
                            </>
                        )}
                    </View>
                </View>
            );
        }

        // Render logic based on user type and permissions
        if (user.user_type === "ADMIN") {
            // Admin can edit their own bank details and view them
            return renderSingleBankDetailsBlock(
                "My Bank Details",
                "admin",
                bankDetailsData?.admin_bank_details,
                true, // canEdit
                true // canAdd (allow add if not present)
            );
        } else if (user.user_type === "DEALER") {
            // Dealer can only edit and view dealer bank details, and view admin bank details
            return (
                <>
                    {renderSingleBankDetailsBlock(
                        "Admin Bank Details",
                        "admin",
                        bankDetailsData?.admin_bank_details,
                        false, // canEdit
                        false // canAdd
                    )}
                    {renderSingleBankDetailsBlock(
                        "Dealer Bank Details",
                        "dealer",
                        bankDetailsData?.dealer_bank_details,
                        true, // canEdit
                        true // canAdd (allow add if not present)
                    )}
                </>
            );
        }
        // else if (user.user_type === "AGENT") {
        //     // Agent can only add (if not present) and view agent bank details, and view dealer bank details
        //     return (
        //         <>
        //             {renderSingleBankDetailsBlock(
        //                 "Dealer Bank Details",
        //                 "dealer",
        //                 bankDetailsData?.dealer_bank_details,
        //                 false, // canEdit
        //                 false // canAdd
        //             )}
        //             {renderSingleBankDetailsBlock(
        //                 "Agent Bank Details",
        //                 "agent",
        //                 bankDetailsData?.agent_bank_details,
        //                 false, // canEdit
        //                 true // canAdd (can add if not present)
        //             )}
        //         </>
        //     );
        // }
        return null;
    }

    // Render balance for agent and dealer
    function renderMyBalanceSection() {
        if (user?.user_type === "AGENT" || user?.user_type === "DEALER") {
            return (
                <View className="w-full mb-8" key="my-balance">
                    <Text className="text-base font-semibold text-gray-500 mb-2 tracking-wider uppercase">
                        My Balance
                    </Text>
                    <View
                        className="w-full rounded-xl bg-gray-50 border border-gray-200 py-4 px-3 mb-1"
                        style={{
                            minHeight: 60,
                            justifyContent: "center",
                        }}
                    >
                        {ismyBalanceLoading ? (
                            <ActivityIndicator color="#6b7280" size="small" />
                        ) : (
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                <Text className="text-gray-800 text-2xl font-bold">
                                    ₹ {myBalance?.balance_amount?.toLocaleString("en-IN") ?? "0"}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => refetchMyBalance()}
                                    style={{
                                        marginLeft: 16,
                                        backgroundColor: "#e0e7ef",
                                        borderRadius: 8,
                                        paddingVertical: 6,
                                        paddingHorizontal: 14,
                                        flexDirection: "row",
                                        alignItems: "center",
                                    }}
                                    activeOpacity={0.8}
                                    disabled={isFetchingMyBalance}
                                >
                                    {isFetchingMyBalance ? (
                                        <ActivityIndicator size="small" color="#2563eb" />
                                    ) : (
                                        <Text style={{ color: "#2563eb", fontWeight: "bold", fontSize: 14 }}>
                                            Refresh
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            );
        }
        return null;
    }

    // Determine the status to show in the UI (localStatus if toggling, else from store)
    const effectiveStatus = localStatus !== null ? localStatus : application_status;

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
        >
            <ScrollView
                className="flex-1 px-4 py-8 "
                contentContainerStyle={{
                    justifyContent: "center",
                    alignItems: "center",
                    flexGrow: 1,
                }}
                keyboardShouldPersistTaps="handled"
            >
                <View
                    className="w-full max-w-sm bg-white pb-44 rounded-3xl shadow-lg border border-gray-200"
                    style={{
                        paddingVertical: 28,
                        paddingHorizontal: 20,
                        alignItems: "center",
                        elevation: 6,
                    }}
                >
                    {/* My Balance Section for Agent/Dealer */}
                    {renderMyBalanceSection()}

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
                                className={`text-base font-semibold mr-4 ${effectiveStatus ? "text-green-600" : "text-gray-500"
                                    }`}
                                style={{
                                    letterSpacing: 1,
                                    minWidth: 70,
                                    textAlign: "right",
                                }}
                            >
                                {effectiveStatus ? "Active" : "Inactive"}
                            </Text>
                            <Switch
                                value={effectiveStatus}
                                onValueChange={handleToggle}
                                disabled={
                                    statusLoading ||
                                    activateMutation.isPending ||
                                    deactivateMutation.isPending
                                }
                                thumbColor={effectiveStatus ? "#4ade80" : "#ffffff"}
                                trackColor={{ false: "#d1d5db", true: "#bbf7d0" }}
                                ios_backgroundColor="#d1d5db"
                                style={{
                                    transform: [{ scaleX: 1.15 }, { scaleY: 1.15 }],
                                    marginLeft: 6,
                                }}
                            />
                            {statusLoading && (
                                <ActivityIndicator
                                    size="small"
                                    color={effectiveStatus ? "#4ade80" : "#d1d5db"}
                                    style={{ marginLeft: 10 }}
                                />
                            )}
                        </View>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}