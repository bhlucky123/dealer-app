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

type PendingBalanceResponse = {
    balance_amount: number;
};

type BankDetails = {
    id: number;
    user: number;
    bank_details: string;
    user_type?: string;
    name?: string;
};

export default function MoreTab() {
    // Track active/inactive state locally
    const [isActive, setIsActive] = useState(true);
    const [balanceError, setBalanceError] = useState<string | null>(null);

    // For editing/adding bank details
    const [editingBankDetails, setEditingBankDetails] = useState(false);
    const [bankDetailsInput, setBankDetailsInput] = useState("");
    const [bankDetailsError, setBankDetailsError] = useState<string | null>(null);

    // For editing/adding other party's bank details (for AGENT/DEALER)
    const [editingOtherBankDetails, setEditingOtherBankDetails] = useState(false);
    const [otherBankDetailsInput, setOtherBankDetailsInput] = useState("");
    const [otherBankDetailsError, setOtherBankDetailsError] = useState<string | null>(null);

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

    // Fetch my bank details
    const {
        data: myBankDetails,
        isLoading: isMyBankDetailsLoading,
        refetch: refetchMyBankDetails,
    } = useQuery<BankDetails | null>({
        queryKey: ["my-bank-details", user?.id],
        enabled: !!user?.id,
        queryFn: async () => {
            try {
                const res = await api.get("/draw-payment/bank-details/", {
                    params: { user: user?.id }
                });
                if (Array.isArray(res.data) && res.data.length > 0) {
                    return res.data[0] as BankDetails;
                }
                return null;
            } catch (err) {
                return null;
            }
        }
    });

    // Fetch admin's bank details (for DEALER/AGENT)
    const {
        data: adminBankDetails,
        isLoading: isAdminBankDetailsLoading,
        refetch: refetchAdminBankDetails,
    } = useQuery<BankDetails | null>({
        queryKey: ["admin-bank-details"],
        enabled: user?.user_type === "DEALER" || user?.user_type === "AGENT",
        queryFn: async () => {
            try {
                // Get admin user id
                const res = await api.get("/users/admin/");
                const adminId = res.data?.id;
                if (!adminId) return null;
                const bankRes = await api.get("/draw-payment/bank-details/", {
                    params: { user: adminId }
                });
                if (Array.isArray(bankRes.data) && bankRes.data.length > 0) {
                    return { ...bankRes.data[0], name: res.data?.name || "Admin" } as BankDetails;
                }
                return null;
            } catch (err) {
                return null;
            }
        }
    });

    // Fetch dealer's bank details (for AGENT)
    const {
        data: dealerBankDetails,
        isLoading: isDealerBankDetailsLoading,
        refetch: refetchDealerBankDetails,
    } = useQuery<BankDetails | null>({
        queryKey: ["dealer-bank-details", user?.dealer_id],
        enabled: user?.user_type === "AGENT" && !!user?.dealer_id,
        queryFn: async () => {
            try {
                // Get dealer user id
                const res = await api.get(`/users/${user?.dealer_id}/`);
                const dealerId = res.data?.id;
                if (!dealerId) return null;
                const bankRes = await api.get("/draw-payment/bank-details/", {
                    params: { user: dealerId }
                });
                if (Array.isArray(bankRes.data) && bankRes.data.length > 0) {
                    return { ...bankRes.data[0], name: res.data?.name || "Dealer" } as BankDetails;
                }
                return null;
            } catch (err) {
                return null;
            }
        }
    });

    // Add/update my bank details
    const myBankDetailsMutation = useMutation({
        mutationFn: async (bank_details: string) => {
            if (!user?.id) throw new Error("No user id");
            // If already exists, PATCH, else POST
            if (myBankDetails?.id) {
                return api.patch(`/draw-payment/bank-details/${myBankDetails.id}/`, {
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
            refetchMyBankDetails();
            Alert.alert("Success", "Bank details updated");
        },
        onError: (err: any) => {
            setBankDetailsError("Failed to update bank details");
        }
    });

    // Add/update other party's bank details (for AGENT/DEALER)
    const otherBankDetailsMutation = useMutation({
        mutationFn: async (payload: { bank_details: string; user: number }) => {
            // If already exists, PATCH, else POST
            let details: BankDetails | null = null;
            let id: number | undefined;
            if (user?.user_type === "AGENT") {
                details = dealerBankDetails;
            } else if (user?.user_type === "DEALER") {
                details = adminBankDetails;
            }
            id = details?.id;
            if (id) {
                return api.patch(`/draw-payment/bank-details/${id}/`, {
                    bank_details: payload.bank_details,
                    user: payload.user,
                });
            } else {
                return api.post("/draw-payment/bank-details/", {
                    bank_details: payload.bank_details,
                    user: payload.user,
                });
            }
        },
        onSuccess: () => {
            setEditingOtherBankDetails(false);
            setOtherBankDetailsInput("");
            setOtherBankDetailsError(null);
            if (user?.user_type === "AGENT") {
                refetchDealerBankDetails();
            } else if (user?.user_type === "DEALER") {
                refetchAdminBankDetails();
            }
            Alert.alert("Success", "Bank details updated");
        },
        onError: (err: any) => {
            setOtherBankDetailsError("Failed to update bank details");
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
        // ADMIN: show own bank details, can edit
        if (user?.user_type === "ADMIN") {
            return (
                <View className="w-full mb-8">
                    <Text className="text-base font-semibold text-gray-500 mb-2 tracking-wider uppercase">
                        Bank Details
                    </Text>
                    <View
                        className="w-full rounded-xl bg-gray-50 border border-gray-200 py-4 px-3 mb-1"
                        style={{
                            minHeight: 60,
                            justifyContent: "center",
                        }}
                    >
                        {isMyBankDetailsLoading ? (
                            <ActivityIndicator color="#6b7280" size="small" />
                        ) : (
                            <>
                                <Text className="text-gray-800 text-base mb-2">
                                    {myBankDetails?.bank_details
                                        ? myBankDetails.bank_details
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
                                                    myBankDetailsMutation.mutate(bankDetailsInput.trim());
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
                                            setBankDetailsInput(myBankDetails?.bank_details || "");
                                        }}
                                        activeOpacity={0.85}
                                    >
                                        <Text className="text-blue-800 font-semibold text-center">
                                            {myBankDetails?.bank_details ? "Edit" : "Add"} Bank Details
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}
                    </View>
                </View>
            );
        }

        // DEALER: show own bank details (editable), and admin's (readonly, but can update)
        if (user?.user_type === "DEALER") {
            return (
                <View className="w-full mb-8">
                    {/* My Bank Details */}
                    <Text className="text-base font-semibold text-gray-500 mb-2 tracking-wider uppercase">
                        My Bank Details
                    </Text>
                    <View
                        className="w-full rounded-xl bg-gray-50 border border-gray-200 py-4 px-3 mb-4"
                        style={{
                            minHeight: 60,
                            justifyContent: "center",
                        }}
                    >
                        {isMyBankDetailsLoading ? (
                            <ActivityIndicator color="#6b7280" size="small" />
                        ) : (
                            <>
                                <Text className="text-gray-800 text-base mb-2">
                                    {myBankDetails?.bank_details
                                        ? myBankDetails.bank_details
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
                                                    myBankDetailsMutation.mutate(bankDetailsInput.trim());
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
                                            setBankDetailsInput(myBankDetails?.bank_details || "");
                                        }}
                                        activeOpacity={0.85}
                                    >
                                        <Text className="text-blue-800 font-semibold text-center">
                                            {myBankDetails?.bank_details ? "Edit" : "Add"} Bank Details
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}
                    </View>
                    {/* Admin Bank Details */}
                    <Text className="text-base font-semibold text-gray-500 mb-2 tracking-wider uppercase">
                        Admin Bank Details
                    </Text>
                    <View
                        className="w-full rounded-xl bg-gray-50 border border-gray-200 py-4 px-3 mb-1"
                        style={{
                            minHeight: 60,
                            justifyContent: "center",
                        }}
                    >
                        {isAdminBankDetailsLoading ? (
                            <ActivityIndicator color="#6b7280" size="small" />
                        ) : (
                            <>
                                <Text className="text-gray-800 text-base mb-2">
                                    {adminBankDetails?.bank_details
                                        ? adminBankDetails.bank_details
                                        : <Text className="text-gray-400">No bank details added.</Text>
                                    }
                                </Text>
                                {editingOtherBankDetails ? (
                                    <>
                                        <TextInput
                                            placeholder="Enter admin bank details"
                                            value={otherBankDetailsInput}
                                            onChangeText={setOtherBankDetailsInput}
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
                                        {otherBankDetailsError && (
                                            <Text className="text-red-600 text-xs mb-2">{otherBankDetailsError}</Text>
                                        )}
                                        <View style={{ flexDirection: "row", gap: 10 }}>
                                            <TouchableOpacity
                                                className="bg-blue-600 px-4 py-2 rounded-lg"
                                                onPress={() => {
                                                    if (!otherBankDetailsInput.trim()) {
                                                        setOtherBankDetailsError("Bank details required");
                                                        return;
                                                    }
                                                    if (!adminBankDetails?.user) {
                                                        setOtherBankDetailsError("No admin user id");
                                                        return;
                                                    }
                                                    otherBankDetailsMutation.mutate({
                                                        bank_details: otherBankDetailsInput.trim(),
                                                        user: adminBankDetails.user,
                                                    });
                                                }}
                                                activeOpacity={0.85}
                                            >
                                                <Text className="text-white font-semibold">Save</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                className="bg-gray-200 px-4 py-2 rounded-lg"
                                                onPress={() => {
                                                    setEditingOtherBankDetails(false);
                                                    setOtherBankDetailsInput("");
                                                    setOtherBankDetailsError(null);
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
                                            setEditingOtherBankDetails(true);
                                            setOtherBankDetailsInput(adminBankDetails?.bank_details || "");
                                        }}
                                        activeOpacity={0.85}
                                    >
                                        <Text className="text-blue-800 font-semibold text-center">
                                            {adminBankDetails?.bank_details ? "Edit" : "Add"} Admin Bank Details
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}
                    </View>
                </View>
            );
        }

        // AGENT: show own bank details (editable), and dealer's (readonly, but can update)
        if (user?.user_type === "AGENT") {
            return (
                <View className="w-full mb-8">
                    {/* My Bank Details */}
                    <Text className="text-base font-semibold text-gray-500 mb-2 tracking-wider uppercase">
                        My Bank Details
                    </Text>
                    <View
                        className="w-full rounded-xl bg-gray-50 border border-gray-200 py-4 px-3 mb-4"
                        style={{
                            minHeight: 60,
                            justifyContent: "center",
                        }}
                    >
                        {isMyBankDetailsLoading ? (
                            <ActivityIndicator color="#6b7280" size="small" />
                        ) : (
                            <>
                                <Text className="text-gray-800 text-base mb-2">
                                    {myBankDetails?.bank_details
                                        ? myBankDetails.bank_details
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
                                                    myBankDetailsMutation.mutate(bankDetailsInput.trim());
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
                                            setBankDetailsInput(myBankDetails?.bank_details || "");
                                        }}
                                        activeOpacity={0.85}
                                    >
                                        <Text className="text-blue-800 font-semibold text-center">
                                            {myBankDetails?.bank_details ? "Edit" : "Add"} Bank Details
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}
                    </View>
                    {/* Dealer Bank Details */}
                    <Text className="text-base font-semibold text-gray-500 mb-2 tracking-wider uppercase">
                        Dealer Bank Details
                    </Text>
                    <View
                        className="w-full rounded-xl bg-gray-50 border border-gray-200 py-4 px-3 mb-1"
                        style={{
                            minHeight: 60,
                            justifyContent: "center",
                        }}
                    >
                        {isDealerBankDetailsLoading ? (
                            <ActivityIndicator color="#6b7280" size="small" />
                        ) : (
                            <>
                                <Text className="text-gray-800 text-base mb-2">
                                    {dealerBankDetails?.bank_details
                                        ? dealerBankDetails.bank_details
                                        : <Text className="text-gray-400">No bank details added.</Text>
                                    }
                                </Text>
                                {editingOtherBankDetails ? (
                                    <>
                                        <TextInput
                                            placeholder="Enter dealer bank details"
                                            value={otherBankDetailsInput}
                                            onChangeText={setOtherBankDetailsInput}
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
                                        {otherBankDetailsError && (
                                            <Text className="text-red-600 text-xs mb-2">{otherBankDetailsError}</Text>
                                        )}
                                        <View style={{ flexDirection: "row", gap: 10 }}>
                                            <TouchableOpacity
                                                className="bg-blue-600 px-4 py-2 rounded-lg"
                                                onPress={() => {
                                                    if (!otherBankDetailsInput.trim()) {
                                                        setOtherBankDetailsError("Bank details required");
                                                        return;
                                                    }
                                                    if (!dealerBankDetails?.user) {
                                                        setOtherBankDetailsError("No dealer user id");
                                                        return;
                                                    }
                                                    otherBankDetailsMutation.mutate({
                                                        bank_details: otherBankDetailsInput.trim(),
                                                        user: dealerBankDetails.user,
                                                    });
                                                }}
                                                activeOpacity={0.85}
                                            >
                                                <Text className="text-white font-semibold">Save</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                className="bg-gray-200 px-4 py-2 rounded-lg"
                                                onPress={() => {
                                                    setEditingOtherBankDetails(false);
                                                    setOtherBankDetailsInput("");
                                                    setOtherBankDetailsError(null);
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
                                            setEditingOtherBankDetails(true);
                                            setOtherBankDetailsInput(dealerBankDetails?.bank_details || "");
                                        }}
                                        activeOpacity={0.85}
                                    >
                                        <Text className="text-blue-800 font-semibold text-center">
                                            {dealerBankDetails?.bank_details ? "Edit" : "Add"} Dealer Bank Details
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}
                    </View>
                </View>
            );
        }

        // Fallback: nothing
        return null;
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